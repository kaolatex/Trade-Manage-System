# TradeManageSystem (TMS) 🚀

> **Next-Generation Multi-Account Portfolio Management & Algorithmic Trading Terminal**  
> Tailored for MetaTrader 5 (HFM Broker) & Supabase Cloud.

---

## 🏗️ Architecture Overview

```text
TradeManageSystem/
├── supabase_schema.sql        # Database schema for Supabase Cloud (RLS disabled, Realtime enabled)
├── tms-web/                   # Web Dashboard (Next.js 15, App Router, Tailwind CSS, Recharts)
│   ├── src/
│   │   ├── app/               # Next.js App Router (Portfolio & Bot System)
│   │   ├── components/        # UI components (Header, Portfolio, Bot System, PIN Gate)
│   │   ├── context/           # React Context (Trading & Language state)
│   │   └── lib/               # Supabase client, calculation engine, market types
│   ├── .env.example           # Web environment variable template
│   └── package.json
└── tms-bot/                   # Local Python Sync Bridge (FastAPI, MetaTrader 5, Supabase)
    ├── sync_service.py        # Background service syncing MT5 to Supabase Cloud
    ├── local_credentials.json # Local-only MT5 account credentials (never pushed to cloud)
    ├── run_sync.bat           # 1-click launcher for Windows
    ├── requirements.txt
    └── .env.example           # Bot environment variable template
```

---

## ⚡ Features

- **🌐 Multi-Account Switcher**: Seamlessly switch between individual HFM accounts or view **"All Accounts Overview"** with aggregated balance, equity curves, and performance statistics.
- **🖐️ Hard Separation**: Completely separate views and metrics for **Manual Discretionary Trading** and **Automated Bot Systems**.
- **☁️ Hybrid Cloud Mode**: Real-time MT5 bridge when your computer is on, with seamless cached read/write access via Supabase Cloud when accessing remotely or from mobile.
- **🔒 Zero-Leak Security**: Passwords for MT5 are strictly stored on your local computer (`local_credentials.json`) and never transmitted to Supabase Cloud.
- **📝 Smart Trade Journal**: Tag trade setups, emotions, and personal audit notes without fear of automated sync overwriting your notes.
- **🌐 Bilingual UI**: Instant switching between Thai (ภาษาไทย) and English.

---

## 🚀 Deployment on Vercel

To deploy `tms-web` on **[Vercel](https://vercel.com)**:

1. **Import Repository**: Connect your GitHub repository `kaolatex/Trade-Manage-System`.
2. **Project Settings**:
   - **Framework Preset**: `Next.js`
   - **Root Directory**: Click `Edit` and select **`tms-web`** *(Important!)*
3. **Environment Variables**:
   Add the following variables in the Vercel project settings:
   - `NEXT_PUBLIC_SUPABASE_URL` = `https://your-project.supabase.co`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = `your-supabase-anon-key`
   - `NEXT_PUBLIC_SYNC_SERVICE_URL` = `http://localhost:8000` (or your deployed sync server address)
4. Click **Deploy**!

---

## 💻 Local Development Setup

### 1. Database Setup (Supabase Cloud)
1. Open your project in the [Supabase Dashboard](https://supabase.com).
2. Go to **SQL Editor** -> **New Query**.
3. Copy the entire contents of [`supabase_schema.sql`](./supabase_schema.sql) and click **Run**.

### 2. Frontend (`tms-web`)
```bash
cd tms-web
cp .env.example .env.local
# Fill in NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY
npm install
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 3. Local MT5 Sync Bridge (`tms-bot`)
```bash
cd tms-bot
cp .env.example .env
# Fill in SUPABASE_URL and SUPABASE_KEY
pip install -r requirements.txt
# Double-click run_sync.bat or run:
python -m uvicorn sync_service:app --port 8000 --host 127.0.0.1
```

---

## 🛡️ License

Private & Proprietary. All rights reserved.
