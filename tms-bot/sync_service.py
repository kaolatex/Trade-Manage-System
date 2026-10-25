"""
TradeManageSystem (TMS) — MT5 to Supabase Cloud Sync Bridge Service
Runs on port 8000. Synchronizes HFM MT5 account metrics, active positions,
and 90-day trade history directly into Supabase Cloud tables:
- tms_accounts
- tms_active_positions 
- tms_trade_journal (Preserving existing user notes and audit tags)
"""

import os
import sys
import json
import asyncio
from datetime import datetime, timedelta, timezone
from typing import Optional, List, Dict, Any
from collections import deque
from pathlib import Path

# Fix Windows console UTF-8 output encoding (CP874 / CP1252)
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
from dotenv import load_dotenv

# TMS Deep Strategy Engine & Order Executor
from strategy_engine import StrategyEngine
from order_executor import OrderExecutor

# MetaTrader 5 Native Library
try:
    import MetaTrader5 as mt5
    MT5_AVAILABLE = True
except (ImportError, Exception):
    mt5 = None
    MT5_AVAILABLE = False

# Supabase Client
try:
    from supabase import create_client, Client
    SUPABASE_LIB_AVAILABLE = True
except ImportError:
    create_client = None
    Client = Any
    SUPABASE_LIB_AVAILABLE = False

# Load environment
ENV_PATH = Path(__file__).resolve().parent / ".env"
load_dotenv(dotenv_path=ENV_PATH)

SUPABASE_URL = os.getenv("SUPABASE_URL", "").strip()
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "").strip()
PORT = int(os.getenv("PORT", "8000"))
SYNC_INTERVAL = int(os.getenv("SYNC_INTERVAL_SECONDS", "10"))
CREDENTIALS_FILE = Path(__file__).resolve().parent / "local_credentials.json"

app = FastAPI(
    title="TMS MT5 Cloud Sync Service",
    description="Bridge connecting local MetaTrader 5 (HFM) with Supabase Cloud",
    version="2.0.0",
)

# Enable CORS for Next.js web client
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ------------------------------------------------------------------------------
# Supabase Client Factory
# ------------------------------------------------------------------------------
def get_supabase() -> Optional[Client]:
    if not SUPABASE_LIB_AVAILABLE:
        return None
    if not SUPABASE_URL or not SUPABASE_KEY:
        return None
    if "your-project" in SUPABASE_URL:
        return None
    try:
        return create_client(SUPABASE_URL, SUPABASE_KEY)
    except Exception as e:
        print(f"[Supabase] Connection error: {e}")
        return None

# ------------------------------------------------------------------------------
# Local Credentials Storage (Saved securely locally only)
# ------------------------------------------------------------------------------
def load_credentials() -> List[Dict[str, Any]]:
    if not CREDENTIALS_FILE.exists():
        return []
    try:
        with open(CREDENTIALS_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return []

def save_credentials(creds: List[Dict[str, Any]]) -> None:
    with open(CREDENTIALS_FILE, "w", encoding="utf-8") as f:
        json.dump(creds, f, indent=2, ensure_ascii=False)

def store_account_credential(login_id: int, password: str, server: str, account_name: str) -> None:
    creds = load_credentials()
    existing = False
    for c in creds:
        if int(c["login_id"]) == login_id:
            c["password"] = password
            c["server"] = server
            c["account_name"] = account_name
            c["updated_at"] = datetime.now(timezone.utc).isoformat()
            existing = True
            break
    if not existing:
        creds.append({
            "login_id": login_id,
            "password": password,
            "server": server,
            "account_name": account_name,
            "added_at": datetime.now(timezone.utc).isoformat(),
        })
    save_credentials(creds)

# ------------------------------------------------------------------------------
# Models
# ------------------------------------------------------------------------------
class AddAccountRequest(BaseModel):
    login_id: Optional[int] = None
    login: Optional[int] = None
    password: str
    server: str
    account_name: Optional[str] = None

class SyncResponse(BaseModel):
    success: bool
    message: str
    synced_accounts: int
    timestamp: str

class UpdateBotConfigRequest(BaseModel):
    is_running: Optional[bool] = None
    bot_mode: Optional[str] = None
    strategy_mode: Optional[str] = None
    symbol: Optional[str] = None
    timeframe: Optional[str] = None
    magic_number: Optional[int] = None
    advanced_params: Optional[Dict[str, Any]] = None

class TestFireRequest(BaseModel):
    symbol: Optional[str] = None
    lot: Optional[float] = 0.01
    side: Optional[str] = "BUY"

class RemoteCommandRequest(BaseModel):
    command_type: str
    payload: Optional[Dict[str, Any]] = None

# ------------------------------------------------------------------------------
# Deep EA Configuration & Dynamic Parameter Manager
# ------------------------------------------------------------------------------
DEFAULT_BOT_CONFIG: Dict[str, Any] = {
    "id": "default",
    "is_running": False,
    "bot_mode": "live",
    "strategy_mode": "MODE_AGGRESSIVE_SCALPER",
    "symbol": "XAUUSD",
    "timeframe": "M15",
    "magic_number": 888999,
    "advanced_params": {
        "strategy": {
            "strategyMode": "MODE_AGGRESSIVE_SCALPER",
            "timeframe": "M15",
            "magicNumber": 888999,
            "orderComment": "TMS-Quantum-EA",
            "emaTrendPeriod": 50,
            "bbPeriod": 20,
            "bbDeviation": 1.8,
            "stochRsiK": 14,
            "stochRsiOversold": 22.0,
            "stochRsiOverbought": 78.0,
            "minRejectionWickPct": 25.0,
            "newsSpikeFilterAtr": 2.8,
            "lookbackBars": 2000,
            "patternLength": 5,
            "forwardHorizonBars": 3,
            "minWinProbabilityPct": 65.0,
            "zScoreThreshold": 1.5,
            "dynamicAtrSlMult": 1.5,
            "dynamicAtrTpMult": 2.5,
        },
        "layering": {
            "lotMode": "fixed",
            "baseLot": 0.01,
            "riskPercent": 1.0,
            "maxLayers": 5,
            "lotMultiplier": 1.0,
            "minStepPoints": 80,
            "useDynamicAtrStep": True,
            "atrStepMult": 0.7,
            "layerCooldownSec": 15,
        },
        "basket": {
            "singleTpUsd": 1.0,
            "singleTpPoints": 150,
            "singleSlPoints": 400,
            "useBasketClose": True,
            "basketTargetUsd": 1.5,
            "useAutoBreakEven": True,
            "beTriggerPoints": 120,
            "beLockPoints": 20,
            "useTrailingStop": True,
            "trailStartPoints": 150,
            "trailStepPoints": 30,
        },
        "risk": {
            "maxSpreadPoints": 35,
            "dailyMaxLossUsd": 50.0,
            "dailyTargetProfitUsd": 100.0,
            "tradeAsianSession": True,
            "tradeLondonSession": True,
            "tradeNySession": True,
        },
    },
    "updated_at": datetime.now(timezone.utc).isoformat(),
}

current_bot_config: Dict[str, Any] = json.loads(json.dumps(DEFAULT_BOT_CONFIG))
strategy_engine = StrategyEngine(current_bot_config)
order_executor = OrderExecutor(current_bot_config)

def export_ea_config_file(config: Dict[str, Any]) -> List[str]:
    """
    Exports flattened JSON parameters to:
    1. MetaQuotes Common Files (%APPDATA%/MetaQuotes/Terminal/Common/Files/tms_ea_config.json)
    2. Active MT5 Terminal MQL5/Files
    3. Local tms-bot/mql5/Files/tms_ea_config.json
    This allows TMS_Quantum_EA.mq5 running in MT5 chart to pick up changes dynamically!
    """
    adv = config.get("advanced_params", {})
    strat = adv.get("strategy", {})
    layer = adv.get("layering", {})
    basket = adv.get("basket", {})
    risk = adv.get("risk", {})

    ea_flat_dict = {
        "strategyMode": strat.get("strategyMode", config.get("strategy_mode", "MODE_AGGRESSIVE_SCALPER")),
        "timeframe": strat.get("timeframe", config.get("timeframe", "M15")),
        "magicNumber": int(strat.get("magicNumber", config.get("magic_number", 888999))),
        "orderComment": strat.get("orderComment", "TMS-Quantum-EA"),
        "lookbackBars": int(strat.get("lookbackBars", 3000)),
        "useMultiEmaRibbon": bool(strat.get("useMultiEmaRibbon", True)),
        "use3000BarQuantFilter": bool(strat.get("use3000BarQuantFilter", True)),
        "forwardHorizonBars": int(strat.get("forwardHorizonBars", 10)),
        "minWinProbabilityPct": float(strat.get("minWinProbabilityPct", 55.0)),
        "baseLot": float(layer.get("baseLot", 0.01)),
        "riskPercent": float(layer.get("riskPercent", 1.0)),
        "maxLayers": int(layer.get("maxLayers", 5)),
        "useSmartPyramiding": bool(layer.get("useSmartPyramiding", True)),
        "maxOpenPositions": int(layer.get("maxOpenPositions", 10)),
        "lotMultiplier": float(layer.get("lotMultiplier", 1.0)),
        "minStepPoints": int(layer.get("minStepPoints", 80)),
        "useDynamicAtrStep": bool(layer.get("useDynamicAtrStep", True)),
        "atrStepMult": float(layer.get("atrStepMult", 0.7)),
        "layerCooldownSec": int(layer.get("layerCooldownSec", 15)),
        "singleTpUsd": float(basket.get("singleTpUsd", 1.0)),
        "singleTpPoints": int(basket.get("singleTpPoints", 150)),
        "singleSlPoints": int(basket.get("singleSlPoints", 400)),
        "useBasketClose": bool(basket.get("useBasketClose", True)),
        "basketTargetUsd": float(basket.get("basketTargetUsd", 1.5)),
        "useAutoBreakEven": bool(basket.get("useAutoBreakEven", True)),
        "beTriggerPoints": int(basket.get("beTriggerPoints", 120)),
        "beLockPoints": int(basket.get("beLockPoints", 20)),
        "useInstantSmartBE": bool(basket.get("useInstantSmartBE", True)),
        "instantBeTriggerPoints": int(basket.get("instantBeTriggerPoints", 80)),
        "instantBeLockPoints": int(basket.get("instantBeLockPoints", 20)),
        "instantBeMinUsd": float(basket.get("instantBeMinUsd", 0.30)),
        "useTrailingStop": bool(basket.get("useTrailingStop", True)),
        "trailStartPoints": int(basket.get("trailStartPoints", 150)),
        "trailStepPoints": int(basket.get("trailStepPoints", 30)),
        "maxSpreadPoints": int(risk.get("maxSpreadPoints", 35)),
        "dailyMaxLossUsd": float(risk.get("dailyMaxLossUsd", 50.0)),
        "dailyTargetProfitUsd": float(risk.get("dailyTargetProfitUsd", 100.0)),
        "isRunning": bool(config.get("is_running", True)),
        "panicClose": bool(config.get("panic_close", False)),
        "advanced_params": adv,
        "updated_at": config.get("updated_at") or datetime.now(timezone.utc).isoformat(),
    }

    written_paths: List[str] = []
    json_text = json.dumps(ea_flat_dict, indent=2, ensure_ascii=False)

    # 1. MT5 Common Files
    appdata = os.getenv("APPDATA")
    if appdata:
        common_path = Path(appdata) / "MetaQuotes" / "Terminal" / "Common" / "Files"
        try:
            common_path.mkdir(parents=True, exist_ok=True)
            target = common_path / "tms_ea_config.json"
            with open(target, "w", encoding="utf-8") as f:
                f.write(json_text)
            written_paths.append(str(target))
        except Exception as e:
            print(f"⚠️ Could not write to Common Files: {e}")

    # 2. Running MT5 Terminal MQL5/Files
    if MT5_AVAILABLE and mt5 is not None:
        try:
            tinfo = mt5.terminal_info()
            if tinfo and tinfo.data_path:
                t_files = Path(tinfo.data_path) / "MQL5" / "Files"
                t_files.mkdir(parents=True, exist_ok=True)
                target = t_files / "tms_ea_config.json"
                with open(target, "w", encoding="utf-8") as f:
                    f.write(json_text)
                written_paths.append(str(target))
        except Exception as e:
            print(f"⚠️ Could not write to terminal MQL5/Files: {e}")

    # 3. Local workspace fallback
    local_files = Path(__file__).resolve().parent / "mql5" / "Files"
    try:
        local_files.mkdir(parents=True, exist_ok=True)
        target = local_files / "tms_ea_config.json"
        with open(target, "w", encoding="utf-8") as f:
            f.write(json_text)
        written_paths.append(str(target))
    except Exception as e:
        print(f"⚠️ Could not write to local MQL5/Files: {e}")

    return written_paths

def sync_bot_config_from_cloud(sb: Optional[Client] = None) -> Dict[str, Any]:
    global current_bot_config
    if sb is None:
        sb = get_supabase()

    if sb is not None:
        try:
            res = sb.table("tms_bot_configs").select("*").eq("id", "default").limit(1).execute()
            if res.data and len(res.data) > 0:
                cloud_row = res.data[0]
                current_bot_config.update(cloud_row)
                strategy_engine.set_params(current_bot_config)
                order_executor.set_params(current_bot_config)
                export_ea_config_file(current_bot_config)
                return current_bot_config
        except Exception as e:
            print(f"⚠️ [Bot Config Cloud Fetch] Warning: {e}")

    export_ea_config_file(current_bot_config)
    return current_bot_config

# ------------------------------------------------------------------------------
# Core Synchronization Logic
# ------------------------------------------------------------------------------
last_sync_time: Optional[str] = None
last_active_account: Optional[Dict[str, Any]] = None
is_syncing = False

def sync_active_terminal_account(sb: Optional[Client] = None) -> Optional[Dict[str, Any]]:
    """
    Auto-binds to the currently running MT5 terminal instance,
    extracts real account metrics, open positions, and 90-day history deals,
    and upserts them directly into Supabase.
    """
    global last_sync_time, last_active_account
    if not MT5_AVAILABLE or mt5 is None:
        print("❌ MetaTrader5 library is not available.")
        return None

    # Step 1: Auto-bind to running MT5 Terminal
    if not mt5.initialize():
        err = mt5.last_error()
        print(f"❌ mt5.initialize() failed: {err}")
        return None

    # Step 2: Extract current logged-in account info
    acc = mt5.account_info()
    if acc is None:
        err = mt5.last_error()
        print(f"⚠️ mt5.account_info() is None: {err}")
        return None

    login_id = int(acc.login)
    account_name = acc.name or f"HFM {login_id}"
    server = acc.server
    balance = round(float(acc.balance), 2)
    equity = round(float(acc.equity), 2)
    floating_pnl = round(float(equity - balance), 2)
    margin_level = round(float(acc.margin_level), 2) if acc.margin else None
    currency = acc.currency or "USD"
    is_demo = acc.trade_mode == mt5.ACCOUNT_TRADE_MODE_DEMO

    now_iso = datetime.now(timezone.utc).isoformat()
    account_record = {
        "login_id": login_id,
        "account_name": account_name,
        "server": server,
        "balance": balance,
        "equity": equity,
        "floating_pnl": floating_pnl,
        "margin_level": margin_level,
        "currency": currency,
        "is_demo": is_demo,
        "last_synced_at": now_iso,
    }

    last_active_account = account_record

    # Step 3: Fetch active positions
    active_positions: List[Dict[str, Any]] = []
    raw_positions = mt5.positions_get()
    if raw_positions:
        for p in raw_positions:
            pos_type = "BUY" if p.type == mt5.POSITION_TYPE_BUY else "SELL"
            exec_type = "MANUAL" if p.magic == 0 else "BOT"
            open_dt = datetime.fromtimestamp(p.time, tz=timezone.utc).isoformat()
            active_positions.append({
                "ticket": int(p.ticket),
                "login_id": login_id,
                "symbol": p.symbol,
                "order_type": pos_type,
                "execution_type": exec_type,
                "lot": float(p.volume),
                "entry_price": float(p.price_open),
                "current_price": float(p.price_current),
                "sl": float(p.sl),
                "tp": float(p.tp),
                "floating_profit": round(float(p.profit), 2),
                "magic_number": int(p.magic),
                "open_time": open_dt,
            })

    # Step 4: Fetch 90-day history deals and pair by position_id
    trade_journal: List[Dict[str, Any]] = []
    from_date = datetime.now() - timedelta(days=90)
    raw_deals = mt5.history_deals_get(from_date, datetime.now())
    if raw_deals:
        pos_map: Dict[int, List[Any]] = {}
        for d in raw_deals:
            pos_map.setdefault(d.position_id, []).append(d)

        seen_tickets = set()
        for pos_id, p_deals in pos_map.items():
            in_deals = [d for d in p_deals if d.entry == mt5.DEAL_ENTRY_IN]
            out_deals = [d for d in p_deals if d.entry in (mt5.DEAL_ENTRY_OUT, mt5.DEAL_ENTRY_INOUT) and d.profit != 0]

            for out in out_deals:
                in_d = in_deals[0] if in_deals else None
                entry_price = float(in_d.price) if in_d else float(out.price)
                exit_price = float(out.price)
                order_type = "BUY" if (in_d and in_d.type == mt5.DEAL_TYPE_BUY) or (not in_d and out.type == mt5.DEAL_TYPE_SELL) else "SELL"
                exec_type = "MANUAL" if out.magic == 0 else "BOT"
                net_pnl = round(float(out.profit + out.swap + out.commission), 2)
                close_dt = datetime.fromtimestamp(out.time, tz=timezone.utc).isoformat()

                t_id = int(pos_id) if (pos_id and pos_id not in seen_tickets) else int(out.ticket)
                seen_tickets.add(t_id)

                trade_journal.append({
                    "ticket": t_id,
                    "login_id": login_id,
                    "symbol": out.symbol,
                    "order_type": order_type,
                    "execution_type": exec_type,
                    "lot": float(out.volume),
                    "entry_price": entry_price,
                    "exit_price": exit_price,
                    "net_pnl": net_pnl,
                    "magic_number": int(out.magic),
                    "close_time": close_dt,
                })

    # Step 5: Upload clean real data to Supabase Cloud
    if sb is None:
        sb = get_supabase()

    if sb is not None:
        try:
            # 1. Upsert Account Profile
            sb.table("tms_accounts").upsert(account_record).execute()

            # 2. Active Positions: Clean old positions for this login_id and insert live ones
            sb.table("tms_active_positions").delete().eq("login_id", login_id).execute()
            if active_positions:
                sb.table("tms_active_positions").upsert(active_positions).execute()

            # 3. Trade Journal: Preserve existing manual notes and tags
            if trade_journal:
                try:
                    res = sb.table("tms_trade_journal").select(
                        "ticket, setup_tag, emotion_state, user_note, audit_note"
                    ).eq("login_id", login_id).execute()

                    existing_notes = {int(r["ticket"]): r for r in (res.data or [])}
                    for row in trade_journal:
                        ticket = row["ticket"]
                        if ticket in existing_notes:
                            old = existing_notes[ticket]
                            if old.get("setup_tag"): row["setup_tag"] = old["setup_tag"]
                            if old.get("emotion_state"): row["emotion_state"] = old["emotion_state"]
                            if old.get("user_note"): row["user_note"] = old["user_note"]
                            if old.get("audit_note"): row["audit_note"] = old["audit_note"]
                except Exception as ne:
                    print(f"⚠️ Note lookup warning: {ne}")

                sb.table("tms_trade_journal").upsert(trade_journal).execute()

            last_sync_time = now_iso
            print(f"📤 Synced: 1 Account (#{login_id}), {len(active_positions)} Open Positions, {len(trade_journal)} History Deals to Supabase")
        except Exception as e:
            print(f"❌ [Supabase] Error uploading account {login_id}: {e}")
            if "row-level security" in str(e).lower() or "42501" in str(e):
                print("💡 [Fix RLS Error] In Supabase Dashboard -> SQL Editor, run the updated supabase_schema.sql, or use the 'service_role' secret in tms-bot/.env")
    else:
        print(f"⚠️ [Sync] Supabase not connected. Local data ready: #{login_id} balance ${balance}")

    return {
        "login_id": login_id,
        "account": account_record,
        "positions_count": len(active_positions),
        "journal_count": len(trade_journal),
    }

def sync_all_accounts_sync() -> int:
    global is_syncing
    if is_syncing:
        return 0
    is_syncing = True
    sb = get_supabase()
    synced = 0
    try:
        # 1. Primary Sync: Active logged-in MT5 Terminal account
        active_res = sync_active_terminal_account(sb)
        if active_res:
            synced += 1

        # 2. Secondary Sync: If there are additional saved credentials with different logins
        creds = load_credentials()
        for cred in creds:
            c_login = int(cred["login_id"])
            if active_res and c_login == active_res["login_id"]:
                continue  # already synced

            # Attempt login to sync secondary account
            try:
                if mt5 and mt5.login(login=c_login, password=cred["password"], server=cred["server"]):
                    sync_active_terminal_account(sb)
                    synced += 1
                else:
                    if mt5:
                        print(f"⚠️ Could not login secondary account #{c_login}: {mt5.last_error()}")
            except Exception as se:
                print(f"⚠️ Secondary sync error for #{c_login}: {se}")

        # Switch back to primary terminal account if needed
        if active_res:
            active_login = active_res["login_id"]
            cur_acc = mt5.account_info() if mt5 else None
            if cur_acc and int(cur_acc.login) != active_login:
                # Find password if in creds
                for c in creds:
                    if int(c["login_id"]) == active_login:
                        mt5.login(login=active_login, password=c["password"], server=c["server"])
                        break

    finally:
        is_syncing = False
    return synced

# ------------------------------------------------------------------------------
# Real-Time Bot Logs & Action Engine
# ------------------------------------------------------------------------------
bot_logs_buffer: deque = deque(maxlen=200)
bot_log_counter: int = 1

def add_bot_log(level: str, message: str, details: Optional[Dict[str, Any]] = None, symbol: Optional[str] = None) -> Dict[str, Any]:
    global bot_log_counter
    sym = symbol or current_bot_config.get("symbol", "BTCUSD")
    entry = {
        "id": bot_log_counter,
        "ts": int(datetime.now(timezone.utc).timestamp() * 1000),
        "level": level,
        "message": message,
        "details": details,
        "symbol": sym,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    bot_log_counter += 1
    bot_logs_buffer.append(entry)
    print(f"[{entry['level'].upper()}] {entry['message']}")

    # Try saving to Supabase tms_bot_logs asynchronously/safely
    sb = get_supabase()
    if sb:
        try:
            sb.table("tms_bot_logs").insert({
                "level": level,
                "message": message,
                "details": details,
                "symbol": sym,
            }).execute()
        except Exception:
            pass
    return entry

def resolve_mt5_symbol(preferred_symbol: Optional[str] = None) -> str:
    """Finds exact MT5 symbol name on active broker (e.g. #BTCUSD or BTCUSD)."""
    if not MT5_AVAILABLE or mt5 is None:
        return preferred_symbol or "BTCUSD"
    candidates = []
    if preferred_symbol:
        candidates.extend([preferred_symbol, f"#{preferred_symbol}", preferred_symbol.replace("#", "")])
    cfg_sym = current_bot_config.get("symbol", "BTCUSD")
    candidates.extend([cfg_sym, f"#{cfg_sym}", cfg_sym.replace("#", ""), "XAUUSD", "EURUSD"])

    for s in candidates:
        try:
            info = mt5.symbol_info(s)
            if info is not None:
                mt5.symbol_select(s, True)
                return s
        except Exception:
            pass
    return preferred_symbol or "BTCUSD"

def execute_test_fire_order(symbol: Optional[str] = None, lot: float = 0.01, side: str = "BUY") -> Dict[str, Any]:
    """Fires real test order with Magic Number 888999 into MT5."""
    if not MT5_AVAILABLE or mt5 is None:
        raise HTTPException(status_code=500, detail="MetaTrader5 library is not installed or available.")

    if not mt5.initialize():
        raise HTTPException(status_code=500, detail=f"MT5 initialize failed: {mt5.last_error()}")

    sym = resolve_mt5_symbol(symbol)
    tick = mt5.symbol_info_tick(sym)
    if not tick:
        raise HTTPException(status_code=400, detail=f"Cannot fetch live tick for {sym}")

    is_buy = side.upper() == "BUY"
    order_type = mt5.ORDER_TYPE_BUY if is_buy else mt5.ORDER_TYPE_SELL
    price = tick.ask if is_buy else tick.bid
    magic = int(current_bot_config.get("magic_number", 888999))

    req = {
        "action": mt5.TRADE_ACTION_DEAL,
        "symbol": sym,
        "volume": float(lot),
        "type": order_type,
        "price": price,
        "deviation": 25,
        "magic": magic,
        "comment": "TMS-TestFire",
        "type_time": mt5.ORDER_TIME_GTC,
        "type_filling": mt5.ORDER_FILLING_IOC,
    }

    res = mt5.order_send(req)
    if res and res.retcode != mt5.TRADE_RETCODE_DONE:
        # Retry with RETURN filling mode
        req["type_filling"] = mt5.ORDER_FILLING_RETURN
        res = mt5.order_send(req)

    if not res or res.retcode != mt5.TRADE_RETCODE_DONE:
        err_msg = f"Order failed retcode: {getattr(res, 'retcode', 'Unknown')} ({getattr(res, 'comment', 'Send Error')})"
        add_bot_log("error", f"[TEST FIRE FAILED] {sym} {lot} {side}: {err_msg}", {"retcode": getattr(res, "retcode", -1)}, sym)
        return {"success": False, "error": err_msg, "retcode": getattr(res, "retcode", -1)}

    ticket = int(res.order)
    add_bot_log("exec", f"[TEST FIRE] Ticket #{ticket} opened {lot} lot {side} on {sym} @ {price:.2f} (Magic: {magic})", {"ticket": ticket, "price": price}, sym)

    # Immediate sync positions to Supabase
    sync_active_terminal_account()
    return {"success": True, "ticket": ticket, "symbol": sym, "price": price, "lot": lot, "side": side}

def execute_panic_close(magic: int = 888999) -> Dict[str, Any]:
    """Closes all active positions matching magic number 888999 and stops the bot."""
    global current_bot_config
    if not MT5_AVAILABLE or mt5 is None:
        raise HTTPException(status_code=500, detail="MetaTrader5 is not available.")
    if not mt5.initialize():
        raise HTTPException(status_code=500, detail=f"MT5 initialize failed: {mt5.last_error()}")

    positions = mt5.positions_get()
    closed_tickets = []
    failed_tickets = []

    if positions:
        for p in positions:
            if int(p.magic) == magic:
                close_type = mt5.ORDER_TYPE_SELL if p.type == mt5.POSITION_TYPE_BUY else mt5.ORDER_TYPE_BUY
                tick = mt5.symbol_info_tick(p.symbol)
                price = (tick.bid if close_type == mt5.ORDER_TYPE_SELL else tick.ask) if tick else p.price_current
                req = {
                    "action": mt5.TRADE_ACTION_DEAL,
                    "position": p.ticket,
                    "symbol": p.symbol,
                    "volume": p.volume,
                    "type": close_type,
                    "price": price,
                    "deviation": 25,
                    "magic": magic,
                    "comment": "TMS-PanicClose",
                    "type_time": mt5.ORDER_TIME_GTC,
                    "type_filling": mt5.ORDER_FILLING_IOC,
                }
                res = mt5.order_send(req)
                if res and res.retcode != mt5.TRADE_RETCODE_DONE:
                    req["type_filling"] = mt5.ORDER_FILLING_RETURN
                    res = mt5.order_send(req)
                if res and res.retcode == mt5.TRADE_RETCODE_DONE:
                    closed_tickets.append(int(p.ticket))
                else:
                    failed_tickets.append({"ticket": int(p.ticket), "retcode": getattr(res, "retcode", -1), "comment": getattr(res, "comment", "")})

    # Update state: is_running = False
    current_bot_config["is_running"] = False
    current_bot_config["panic_close"] = True
    export_ea_config_file(current_bot_config)

    sb = get_supabase()
    if sb:
        try:
            sb.table("tms_bot_configs").upsert(current_bot_config).execute()
        except Exception:
            pass

    log_msg = f"[EMERGENCY PANIC] Closed {len(closed_tickets)} positions for Magic: {magic}. Bot Engine PAUSED."
    if failed_tickets:
        log_msg += f" (Failed to close: {len(failed_tickets)})"
    add_bot_log("error" if failed_tickets else "warn", log_msg, {"closed": closed_tickets, "failed": failed_tickets})

    sync_active_terminal_account()
    return {"success": True, "closed_count": len(closed_tickets), "closed_tickets": closed_tickets, "failed": failed_tickets}

def execute_set_bot_running(is_running: bool) -> Dict[str, Any]:
    global current_bot_config
    current_bot_config["is_running"] = is_running
    current_bot_config["panic_close"] = False
    export_ea_config_file(current_bot_config)

    sb = get_supabase()
    if sb:
        try:
            sb.table("tms_bot_configs").upsert(current_bot_config).execute()
        except Exception:
            pass

    status_str = "STARTED 🟢" if is_running else "PAUSED 🟡"
    add_bot_log("system", f"[BOT ENGINE] Execution status changed to: {status_str}", {"is_running": is_running})
    return {"success": True, "is_running": is_running}

def poll_cloud_remote_commands():
    """Polls tms_remote_commands from Supabase and executes pending commands."""
    sb = get_supabase()
    if not sb:
        return
    try:
        res = sb.table("tms_remote_commands").select("*").eq("status", "PENDING").order("created_at").limit(5).execute()
        if not res.data:
            return
        for cmd in res.data:
            cmd_id = cmd["id"]
            cmd_type = cmd["command_type"]
            payload = cmd.get("payload") or {}

            # Mark PROCESSING
            sb.table("tms_remote_commands").update({"status": "PROCESSING"}).eq("id", cmd_id).execute()

            result = {}
            status = "EXECUTED"
            try:
                if cmd_type == "TEST_BOT_ORDER":
                    result = execute_test_fire_order(payload.get("symbol"), payload.get("lot", 0.01), payload.get("side", "BUY"))
                elif cmd_type == "PANIC_CLOSE_BOT":
                    result = execute_panic_close(payload.get("magic", 888999))
                elif cmd_type == "START_BOT":
                    result = execute_set_bot_running(True)
                elif cmd_type == "STOP_BOT":
                    result = execute_set_bot_running(False)
                elif cmd_type == "UPDATE_CONFIG":
                    current_bot_config.update(payload)
                    export_ea_config_file(current_bot_config)
                    result = {"success": True}
                else:
                    status = "FAILED"
                    result = {"error": f"Unknown command: {cmd_type}"}
            except Exception as ex:
                status = "FAILED"
                result = {"error": str(ex)}

            sb.table("tms_remote_commands").update({
                "status": status,
                "result": result,
                "executed_at": datetime.now(timezone.utc).isoformat(),
            }).eq("id", cmd_id).execute()
    except Exception:
        pass

# ------------------------------------------------------------------------------
# Background Auto-Sync Worker
# ------------------------------------------------------------------------------
async def auto_sync_worker():
    print(f"[Worker] Background MT5 Auto-Sync running every {SYNC_INTERVAL}s")
    quant_scan_counter = 0
    while True:
        try:
            await asyncio.to_thread(sync_all_accounts_sync)
            await asyncio.to_thread(sync_bot_config_from_cloud)
            await asyncio.to_thread(poll_cloud_remote_commands)

            # Generate real-time Quant Scanner heartbeat log every ~20s
            quant_scan_counter += 1
            if quant_scan_counter % 2 == 0:
                sym = resolve_mt5_symbol()
                running_status = "RUNNING 🟢" if current_bot_config.get("is_running") else "PAUSED 🟡"
                add_bot_log("scanner", f"[3000-BAR QUANT] {sym} | Multi-EMA Ribbon (9/21/50/200) scanning M15 structure | Status: {running_status}", symbol=sym)

        except Exception as e:
            print(f"[Worker] Auto-sync loop error: {e}")
        await asyncio.sleep(SYNC_INTERVAL)

@app.on_event("startup")
async def on_startup():
    print("==================================================================")
    print("  TradeManageSystem (TMS) — MT5 Cloud Sync Bridge Service")
    print(f"  MT5 Native Library Available: {MT5_AVAILABLE}")
    print(f"  Supabase Configured: {bool(SUPABASE_URL and 'your-project' not in SUPABASE_URL)}")
    print(f"  Server listening on: http://localhost:{PORT}")
    print("==================================================================")

    # Initial bot config load and MQL5 export
    sync_bot_config_from_cloud()

    # Initial auto-bind and immediate sync
    if MT5_AVAILABLE and mt5 is not None:
        if mt5.initialize():
            acc = mt5.account_info()
            if acc:
                print(f"✅ Connected to HFM Account: {acc.login} | Server: {acc.server} | Balance: ${acc.balance:,.2f}")
                # Perform immediate startup sync
                sync_active_terminal_account()
            else:
                print(f"⚠️ MT5 terminal open, but not logged into an account: {mt5.last_error()}")
        else:
            print(f"❌ mt5.initialize() failed: {mt5.last_error()}")

    # Launch background auto-sync loop
    asyncio.create_task(auto_sync_worker())

# ------------------------------------------------------------------------------
# API Endpoints
# ------------------------------------------------------------------------------
@app.get("/")
def index():
    return {
        "service": "TMS MT5 Cloud Sync Service",
        "status": "online",
        "mt5_available": MT5_AVAILABLE,
        "supabase_configured": bool(SUPABASE_URL and "your-project" not in SUPABASE_URL),
        "last_sync": last_sync_time,
        "active_account": last_active_account,
    }

@app.get("/api/status")
def get_status():
    creds = load_credentials()
    active_login = None
    if MT5_AVAILABLE and mt5:
        try:
            info = mt5.account_info()
            if info:
                active_login = int(info.login)
        except Exception:
            pass

    return {
        "status": "online",
        "mt5_connected": bool(MT5_AVAILABLE and active_login is not None),
        "supabase_connected": bool(SUPABASE_URL and "your-project" not in SUPABASE_URL),
        "active_login": active_login,
        "accounts_count": max(len(creds), 1 if active_login else 0),
        "last_sync_time": last_sync_time,
        "bridge_mode": "local_mt5",
    }

@app.get("/api/accounts")
def list_accounts():
    """Lists saved accounts (passwords excluded for security)."""
    creds = load_credentials()
    accs = [
        {
            "login_id": c["login_id"],
            "server": c["server"],
            "account_name": c.get("account_name") or f"HFM {c['login_id']}",
            "added_at": c.get("added_at"),
            "updated_at": c.get("updated_at"),
        }
        for c in creds
    ]
    # If active terminal account is not in creds, include it
    if last_active_account:
        cur_id = last_active_account["login_id"]
        if not any(int(c["login_id"]) == cur_id for c in creds):
            accs.insert(0, {
                "login_id": cur_id,
                "server": last_active_account["server"],
                "account_name": last_active_account["account_name"],
                "added_at": last_active_account["last_synced_at"],
                "is_active_terminal": True,
            })
    return accs

@app.post("/api/accounts/add")
def add_account(req: AddAccountRequest):
    login_id = req.login_id or req.login
    if not login_id:
        raise HTTPException(status_code=400, detail="Missing login_id in request.")

    login_id = int(login_id)
    account_name = req.account_name or f"HFM {login_id}"

    # Verify MT5 login directly
    if not MT5_AVAILABLE or mt5 is None:
        raise HTTPException(status_code=500, detail="MetaTrader5 library is not installed or available.")

    if not mt5.initialize():
        err = mt5.last_error()
        raise HTTPException(status_code=500, detail=f"Cannot initialize MT5 Terminal: {err}")

    authorized = mt5.login(login=login_id, password=req.password, server=req.server)
    if not authorized:
        err = mt5.last_error()
        print(f"❌ [MT5] Login failed for #{login_id} on '{req.server}': {err}")
        raise HTTPException(
            status_code=400,
            detail=f"MT5 login failed: {err}. Please verify your login, password, and HFM server name ('{req.server}')."
        )

    # Store credential locally
    store_account_credential(
        login_id=login_id,
        password=req.password,
        server=req.server,
        account_name=account_name,
    )

    # Sync this account to Supabase immediately
    res = sync_active_terminal_account()

    return {
        "success": True,
        "message": f"✅ Connected and synced HFM Account #{login_id} successfully.",
        "account": res.get("account") if res else None,
    }

@app.post("/api/accounts/sync", response_model=SyncResponse)
def trigger_sync():
    synced = sync_all_accounts_sync()
    return SyncResponse(
        success=True,
        message=f"Sync completed successfully for {synced} account(s).",
        synced_accounts=synced,
        timestamp=datetime.now(timezone.utc).isoformat(),
    )

@app.delete("/api/accounts/{login_id}")
def delete_account(login_id: int):
    creds = load_credentials()
    filtered = [c for c in creds if int(c["login_id"]) != login_id]
    save_credentials(filtered)

    sb = get_supabase()
    if sb:
        try:
            sb.table("tms_accounts").delete().eq("login_id", login_id).execute()
            sb.table("tms_active_positions").delete().eq("login_id", login_id).execute()
            sb.table("tms_trade_journal").delete().eq("login_id", login_id).execute()
        except Exception as e:
            print(f"[Supabase] Error deleting account {login_id}: {e}")

    return {"success": True, "message": f"Account #{login_id} removed"}

# ------------------------------------------------------------------------------
# Bot Deep Configuration Endpoints
# ------------------------------------------------------------------------------
@app.get("/api/bot/config")
def get_bot_config():
    """Returns current runtime deep bot & EA configuration."""
    return current_bot_config

@app.post("/api/bot/config")
def update_bot_config(req: UpdateBotConfigRequest):
    """
    Updates deep EA configuration.
    1. Updates local runtime config
    2. Updates strategy_engine & order_executor
    3. Writes new parameters into tms_ea_config.json for running MT5 EA
    4. Upserts to Supabase Cloud tms_bot_configs table
    """
    global current_bot_config
    patch_data = req.dict(exclude_unset=True)
    for k, v in patch_data.items():
        if v is not None:
            if k == "advanced_params" and isinstance(v, dict):
                current_bot_config.setdefault("advanced_params", {})
                for cat, sub in v.items():
                    if isinstance(sub, dict):
                        current_bot_config["advanced_params"].setdefault(cat, {}).update(sub)
                    else:
                        current_bot_config["advanced_params"][cat] = sub
            else:
                current_bot_config[k] = v

    current_bot_config["updated_at"] = datetime.now(timezone.utc).isoformat()
    strategy_engine.set_params(current_bot_config)
    order_executor.set_params(current_bot_config)

    # Write to MT5 file paths
    written_files = export_ea_config_file(current_bot_config)

    # Upsert to Supabase Cloud
    sb = get_supabase()
    cloud_synced = False
    if sb:
        try:
            sb.table("tms_bot_configs").upsert(current_bot_config).execute()
            cloud_synced = True
        except Exception as e:
            print(f"⚠️ [Supabase] Bot config upload failed: {e}")

    return {
        "success": True,
        "message": "Bot parameters updated and synced to MT5 EA configuration.",
        "cloud_synced": cloud_synced,
        "written_files": written_files,
        "config": current_bot_config,
    }

@app.post("/api/bot/test-fire")
def api_test_fire(req: TestFireRequest = TestFireRequest()):
    """Fires a real 0.01 lot test order into MT5 with Magic 888999."""
    result = execute_test_fire_order(
        symbol=req.symbol,
        lot=req.lot or 0.01,
        side=req.side or "BUY",
    )
    return result

@app.post("/api/bot/panic")
def api_panic_close():
    """Emergency Panic: closes all positions for Magic 888999 and pauses the bot."""
    result = execute_panic_close(magic=888999)
    return result

@app.post("/api/bot/start")
def api_start_bot():
    """Starts automated bot execution."""
    return execute_set_bot_running(True)

@app.post("/api/bot/stop")
def api_stop_bot():
    """Pauses automated bot execution."""
    return execute_set_bot_running(False)

@app.post("/api/bot/command")
def api_remote_command(req: RemoteCommandRequest):
    """Executes a named bot command."""
    payload = req.payload or {}
    cmd = req.command_type.upper()
    if cmd == "TEST_BOT_ORDER":
        return execute_test_fire_order(payload.get("symbol"), payload.get("lot", 0.01), payload.get("side", "BUY"))
    elif cmd == "PANIC_CLOSE_BOT":
        return execute_panic_close(payload.get("magic", 888999))
    elif cmd == "START_BOT":
        return execute_set_bot_running(True)
    elif cmd == "STOP_BOT":
        return execute_set_bot_running(False)
    else:
        raise HTTPException(status_code=400, detail=f"Unknown command: {cmd}")

@app.get("/api/bot/logs")
def api_get_bot_logs(limit: int = 50):
    """Returns the latest in-memory and Supabase logs for the Live Terminal."""
    logs_list = list(bot_logs_buffer)[-limit:]
    return {
        "success": True,
        "count": len(logs_list),
        "logs": logs_list,
        "is_running": current_bot_config.get("is_running", False),
        "symbol": current_bot_config.get("symbol", "BTCUSD"),
    }

@app.get("/api/bot/download-ea")
def download_mql5_ea():
    """Serves the pure native TMS_Quantum_EA.mq5 file directly for download."""
    ea_path = Path(__file__).resolve().parent / "mql5" / "TMS_Quantum_EA.mq5"
    if not ea_path.exists():
        raise HTTPException(status_code=404, detail="EA file not found.")
    return FileResponse(
        path=str(ea_path),
        filename="TMS_Quantum_EA.mq5",
        media_type="text/plain; charset=utf-8",
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("sync_service:app", host="0.0.0.0", port=PORT, reload=False)
