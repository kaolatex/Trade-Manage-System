"""
TradeManageSystem (TMS) — MT5 to Supabase Cloud Sync Bridge Service
Runs on port 8000. Synchronizes HFM MT5 account metrics, active positions,
and 90-day trade history directly into Supabase Cloud tables:
- tms_accounts
- tms_active_positions
- tms_trade_journal (Preserving existing user notes and audit logs)
"""

import os
import json
import asyncio
from datetime import datetime, timedelta, timezone
from typing import Optional, List, Dict, Any
from pathlib import Path

from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

# Try importing MetaTrader5 if supported on this Python/OS
try:
    import MetaTrader5 as mt5
    MT5_AVAILABLE = True
except (ImportError, Exception):
    mt5 = None
    MT5_AVAILABLE = False

# Try importing Supabase client
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
    version="1.0.0",
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
# Local Credentials Storage (Passwords stay local only!)
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
    # Check if exists -> update, else append
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
    login_id: int
    password: str
    server: str
    account_name: Optional[str] = None

class SyncResponse(BaseModel):
    success: bool
    message: str
    synced_accounts: int
    timestamp: str

# ------------------------------------------------------------------------------
# Core Synchronization Logic
# ------------------------------------------------------------------------------
last_sync_time: Optional[str] = None
is_syncing = False

def sync_single_account(cred: Dict[str, Any], sb: Optional[Client]) -> Dict[str, Any]:
    login_id = int(cred["login_id"])
    server = cred["server"]
    password = cred["password"]
    account_name = cred.get("account_name") or f"HFM {login_id}"
    now_iso = datetime.now(timezone.utc).isoformat()

    account_record = {
        "login_id": login_id,
        "account_name": account_name,
        "server": server,
        "balance": 10000.0,
        "equity": 10000.0,
        "floating_pnl": 0.0,
        "margin_level": None,
        "currency": "USD",
        "is_demo": "demo" in server.lower(),
        "last_synced_at": now_iso,
    }
    active_positions: List[Dict[str, Any]] = []
    trade_journal: List[Dict[str, Any]] = []

    # 1. Native MetaTrader 5 Sync
    if MT5_AVAILABLE and mt5 is not None:
        try:
            if not mt5.initialize():
                print(f"[MT5] initialize() failed: {mt5.last_error()}")
            else:
                authorized = mt5.login(login=login_id, password=password, server=server)
                if authorized:
                    info = mt5.account_info()
                    if info:
                        account_record.update({
                            "balance": round(float(info.balance), 2),
                            "equity": round(float(info.equity), 2),
                            "floating_pnl": round(float(info.equity - info.balance), 2),
                            "margin_level": round(float(info.margin_level), 2) if info.margin else None,
                            "currency": info.currency or "USD",
                            "is_demo": info.trade_mode == mt5.ACCOUNT_TRADE_MODE_DEMO,
                        })

                    # Active Positions
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

                    # 90-Day History Deals
                    from_date = datetime.now() - timedelta(days=90)
                    raw_deals = mt5.history_deals_get(from_date, datetime.now())
                    if raw_deals:
                        for d in raw_deals:
                            # Consider deals that close a position (OUT or INOUT)
                            if d.entry in (mt5.DEAL_ENTRY_OUT, mt5.DEAL_ENTRY_INOUT) and d.profit != 0:
                                d_type = "BUY" if d.type == mt5.DEAL_TYPE_BUY else "SELL"
                                exec_type = "MANUAL" if d.magic == 0 else "BOT"
                                close_dt = datetime.fromtimestamp(d.time, tz=timezone.utc).isoformat()
                                net_pnl = round(float(d.profit + d.swap + d.commission), 2)
                                trade_journal.append({
                                    "ticket": int(d.position_id or d.ticket),
                                    "login_id": login_id,
                                    "symbol": d.symbol,
                                    "order_type": d_type,
                                    "execution_type": exec_type,
                                    "lot": float(d.volume),
                                    "entry_price": float(d.price),
                                    "exit_price": float(d.price),
                                    "net_pnl": net_pnl,
                                    "magic_number": int(d.magic),
                                    "close_time": close_dt,
                                })
                else:
                    print(f"[MT5] Login failed for {login_id} on {server}: {mt5.last_error()}")
        except Exception as e:
            print(f"[MT5] Error syncing {login_id}: {e}")

    # 2. Upload to Supabase Cloud
    if sb is not None:
        try:
            # Upsert Account Profile
            sb.table("tms_accounts").upsert(account_record).execute()

            # Active Positions: Delete removed positions and upsert active ones
            sb.table("tms_active_positions").delete().eq("login_id", login_id).execute()
            if active_positions:
                sb.table("tms_active_positions").upsert(active_positions).execute()

            # Trade Journal:
            # CRITICAL: Preserve existing user notes and audit logs!
            if trade_journal:
                res = sb.table("tms_trade_journal").select(
                    "ticket, setup_tag, emotion_state, user_note, audit_note"
                ).eq("login_id", login_id).execute()

                existing_notes = {int(r["ticket"]): r for r in (res.data or [])}

                for row in trade_journal:
                    ticket = row["ticket"]
                    if ticket in existing_notes:
                        old = existing_notes[ticket]
                        if old.get("setup_tag"):
                            row["setup_tag"] = old["setup_tag"]
                        if old.get("emotion_state"):
                            row["emotion_state"] = old["emotion_state"]
                        if old.get("user_note"):
                            row["user_note"] = old["user_note"]
                        if old.get("audit_note"):
                            row["audit_note"] = old["audit_note"]

                sb.table("tms_trade_journal").upsert(trade_journal).execute()

            print(f"[Sync] Successfully synced account {login_id} ({account_name}) to Supabase ✓")
        except Exception as e:
            print(f"[Supabase] Error uploading account {login_id}: {e}")

    return {
        "login_id": login_id,
        "account": account_record,
        "positions_count": len(active_positions),
        "journal_count": len(trade_journal),
    }

def sync_all_accounts_sync() -> int:
    global last_sync_time, is_syncing
    if is_syncing:
        return 0
    is_syncing = True
    sb = get_supabase()
    creds = load_credentials()
    synced = 0
    try:
        for cred in creds:
            sync_single_account(cred, sb)
            synced += 1
        last_sync_time = datetime.now(timezone.utc).isoformat()
    finally:
        is_syncing = False
    return synced

# ------------------------------------------------------------------------------
# Background Sync Task
# ------------------------------------------------------------------------------
async def auto_sync_worker():
    print(f"[Worker] Background MT5 Auto-Sync started (Interval: {SYNC_INTERVAL}s)")
    while True:
        try:
            await asyncio.to_thread(sync_all_accounts_sync)
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
    }

@app.get("/api/status")
def get_status():
    creds = load_credentials()
    return {
        "status": "online",
        "mt5_connected": MT5_AVAILABLE,
        "supabase_connected": bool(SUPABASE_URL and "your-project" not in SUPABASE_URL),
        "accounts_count": len(creds),
        "last_sync": last_sync_time,
        "bridge_mode": "native_mt5" if MT5_AVAILABLE else "simulation_bridge",
        "note": (
            "Connected directly to MetaTrader 5"
            if MT5_AVAILABLE
            else "MetaTrader 5 library not detected in active Python environment. Python 3.10-3.12 recommended for native MT5."
        ),
    }

@app.get("/api/accounts")
def list_accounts():
    """Lists saved accounts (passwords excluded for security)."""
    creds = load_credentials()
    return [
        {
            "login_id": c["login_id"],
            "server": c["server"],
            "account_name": c.get("account_name") or f"HFM {c['login_id']}",
            "added_at": c.get("added_at"),
            "updated_at": c.get("updated_at"),
        }
        for c in creds
    ]

@app.post("/api/accounts/add")
def add_account(req: AddAccountRequest, background_tasks: BackgroundTasks):
    account_name = req.account_name or f"HFM {req.login_id}"

    # Verify MT5 login if MT5 is available
    if MT5_AVAILABLE and mt5 is not None:
        try:
            mt5.initialize()
            authorized = mt5.login(login=req.login_id, password=req.password, server=req.server)
            if not authorized:
                error = mt5.last_error()
                print(f"[MT5] Verification warning: login {req.login_id} returned {error}")
        except Exception as e:
            print(f"[MT5] Verification error: {e}")

    # Store credential locally (password kept on computer only)
    store_account_credential(
        login_id=req.login_id,
        password=req.password,
        server=req.server,
        account_name=account_name,
    )

    # Trigger immediate sync in background
    sb = get_supabase()
    background_tasks.add_task(
        sync_single_account,
        {
            "login_id": req.login_id,
            "password": req.password,
            "server": req.server,
            "account_name": account_name,
        },
        sb,
    )

    return {
        "success": True,
        "message": f"HFM Account #{req.login_id} ({account_name}) added successfully and sync initiated.",
        "account": {
            "login_id": req.login_id,
            "account_name": account_name,
            "server": req.server,
        },
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
    if len(filtered) == len(creds):
        raise HTTPException(status_code=404, detail="Account not found")
    save_credentials(filtered)

    # Also delete from Supabase if connected
    sb = get_supabase()
    if sb:
        try:
            sb.table("tms_accounts").delete().eq("login_id", login_id).execute()
        except Exception as e:
            print(f"[Supabase] Error deleting account {login_id}: {e}")

    return {"success": True, "message": f"Account #{login_id} removed"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("sync_service:app", host="0.0.0.0", port=PORT, reload=True)
