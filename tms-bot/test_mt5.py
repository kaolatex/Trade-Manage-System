"""
TradeManageSystem (TMS) — MT5 Terminal & Supabase Diagnostic Test Script
Tests direct connection to running MetaTrader 5 (HFM) terminal and Supabase Cloud.
"""

import os
import sys
from datetime import datetime, timedelta
from pathlib import Path

# Fix Windows console UTF-8 output encoding (CP874 / CP1252)
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

try:
    import MetaTrader5 as mt5
except ImportError:
    print("❌ MetaTrader5 package is not installed in this Python environment.")
    print("Run: py -3.12 -m pip install MetaTrader5")
    sys.exit(1)

# Try loading .env for Supabase
try:
    from dotenv import load_dotenv
    from supabase import create_client
    ENV_PATH = Path(__file__).resolve().parent / ".env"
    load_dotenv(dotenv_path=ENV_PATH)
    SUPABASE_URL = os.getenv("SUPABASE_URL", "").strip()
    SUPABASE_KEY = os.getenv("SUPABASE_KEY", "").strip()
    SUPABASE_AVAILABLE = bool(SUPABASE_URL and SUPABASE_KEY and "your-project" not in SUPABASE_URL)
except Exception:
    SUPABASE_AVAILABLE = False
    SUPABASE_URL = ""
    SUPABASE_KEY = ""

def run_test():
    print("==================================================================")
    print("  TradeManageSystem (TMS) — MT5 & Cloud Diagnostic")
    print(f"  MT5 Library Version: {mt5.__version__}")
    print("==================================================================")
    print("⏳ Auto-binding to currently running MT5 Terminal...")

    # Step 1: Auto-bind to running terminal (empty initialize)
    if not mt5.initialize():
        error = mt5.last_error()
        print(f"❌ mt5.initialize() failed: {error}")
        print("\n💡 Troubleshooting:")
        print("  1. Make sure MetaTrader 5 (HFM) is OPEN and RUNNING on your PC.")
        print("  2. In MT5: Tools -> Options -> Expert Advisors -> Ensure 'Allow algorithmic trading' is checked.")
        return False

    terminal_info = mt5.terminal_info()
    if terminal_info:
        print(f"🖥️ Terminal Name:     {terminal_info.name}")
        print(f"📂 Terminal Path:     {terminal_info.path}")
        print(f"📡 Terminal Connected: {terminal_info.connected}")

    # Step 2: Fetch active account info
    acc = mt5.account_info()
    if acc is None:
        error = mt5.last_error()
        print(f"⚠️ mt5.account_info() is None. Error: {error}")
        print("Please log in to your HFM trading account in the MetaTrader 5 terminal.")
        mt5.shutdown()
        return False

    trade_mode = "DEMO" if acc.trade_mode == mt5.ACCOUNT_TRADE_MODE_DEMO else "LIVE REAL"
    print("\n------------------------------------------------------------------")
    print(f"✅ Connected to HFM Account: {acc.login} | Server: {acc.server} | Balance: ${acc.balance:,.2f}")
    print(f"   Name:     {acc.name}")
    print(f"   Currency: {acc.currency}")
    print(f"   Equity:   ${acc.equity:,.2f}")
    print(f"   Profit:   ${acc.profit:,.2f}")
    print(f"   Margin:   ${acc.margin:,.2f} (Free: ${acc.margin_free:,.2f})")
    print(f"   Mode:     {trade_mode}")
    print("------------------------------------------------------------------")

    # Step 3: Fetch active positions
    positions = mt5.positions_get()
    if positions is None or len(positions) == 0:
        print("\n📊 Active Positions: 0 open positions")
    else:
        print(f"\n📊 Active Positions: {len(positions)} open")
        for p in positions:
            side = "BUY" if p.type == mt5.POSITION_TYPE_BUY else "SELL"
            exec_type = "MANUAL" if p.magic == 0 else f"BOT (Magic #{p.magic})"
            print(f"   • Ticket #{p.ticket}: {p.symbol} {side} {p.volume} lot @ {p.price_open} | Profit: ${p.profit:+.2f} | [{exec_type}]")

    # Step 4: Fetch 90-day history deals and pair by position_id
    from_date = datetime.now() - timedelta(days=90)
    deals = mt5.history_deals_get(from_date, datetime.now())
    if deals is None:
        print(f"\n📜 History Deals (90D): 0 (error: {mt5.last_error()})")
    else:
        pos_map = {}
        for d in deals:
            pos_map.setdefault(d.position_id, []).append(d)

        paired_deals = []
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
                paired_deals.append({
                    "ticket": int(pos_id or out.ticket),
                    "deal_ticket": int(out.ticket),
                    "symbol": out.symbol,
                    "type": order_type,
                    "volume": float(out.volume),
                    "entry_price": entry_price,
                    "exit_price": exit_price,
                    "net_pnl": net_pnl,
                    "exec_type": exec_type,
                    "time": datetime.fromtimestamp(out.time),
                })

        print(f"\n📜 Closed Deals (90D Paired): {len(paired_deals)} closed trades (from {len(deals)} total deal events)")
        for t in paired_deals[-5:]:
            print(f"   • #{t['ticket']} {t['symbol']} {t['type']} {t['volume']} lot | Entry: {t['entry_price']} → Exit: {t['exit_price']} | Net: ${t['net_pnl']:+.2f} [{t['exec_type']}]")

    # Step 5: Check Supabase connectivity
    print("\n------------------------------------------------------------------")
    if SUPABASE_AVAILABLE:
        try:
            sb = create_client(SUPABASE_URL, SUPABASE_KEY)
            acc_count = len(sb.table("tms_accounts").select("login_id").execute().data or [])
            pos_count = len(sb.table("tms_active_positions").select("ticket").execute().data or [])
            j_count = len(sb.table("tms_trade_journal").select("ticket").execute().data or [])
            print("🌐 Supabase Cloud Database: 🟢 Connected")
            print(f"   URL: {SUPABASE_URL}")
            print(f"   Current Cloud Records: {acc_count} Accounts, {pos_count} Positions, {j_count} Journal Trades")
        except Exception as e:
            print(f"🌐 Supabase Cloud Database: 🔴 Error connecting: {e}")
    else:
        print("🌐 Supabase Cloud Database: ⚠️ Not configured in tms-bot/.env")
    print("------------------------------------------------------------------")

    print("\n==================================================================")
    print("✅ MT5 Direct Connection Diagnostic: SUCCESSFUL")
    print("==================================================================")
    mt5.shutdown()
    return True

if __name__ == "__main__":
    run_test()
