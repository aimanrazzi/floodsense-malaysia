# FloodSense Malaysia

**Agentic AI Flood Early Warning System for Kuala Lumpur & Selangor**

Real-time flood monitoring, 1–2 hour advance warnings, AI-powered risk classification, SOS rescue coordination, and a government operations dashboard — all in one full-stack system.

---

## What It Does

- **Proactive flood warnings** — Combines live JPS river gauge data, WeatherAPI radar + 2-hour forecast, and Isolation Forest ML anomaly detection to warn 1–2 hours *before* critical thresholds are breached
- **Dual flood model** — Separate logic for urban flash floods (rainfall-driven, KL drainage thresholds) and rural river overflow (JPS level thresholds)
- **Claude AI reasoning** — When the ML model flags an anomaly or a storm is incoming, Claude Haiku 4.5 produces a natural-language risk assessment with specific recommended actions
- **SOS rescue coordination** — Citizens submit geo-located rescue requests; an AI priority scoring algorithm ranks them for government dispatch
- **Government dashboard** — Live web ops centre with AI reasoning banner, storm cell warnings, SOS priority queue, and real-time agent communications feed
- **4-language mobile app** — English, Bahasa Malaysia, 中文, தமிழ் with Expo push notifications for WARNING/DANGER alerts

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Python 3.11 / Flask 3.x |
| Agent pipeline | APScheduler (60-second autonomous loop) |
| ML model | scikit-learn IsolationForest |
| AI reasoning | Anthropic Claude Haiku 4.5 |
| Rainfall data | WeatherAPI.com (live + 2h forecast) |
| River levels | JPS Water Level API (info.water.gov.my) |
| Database | Firebase Firestore |
| Auth | Firebase Authentication |
| Rate limiting | flask-limiter |
| Production server | gunicorn |
| Cloud hosting | Render.com |
| Mobile app | React Native + Expo SDK |
| GPS | expo-location |
| Push notifications | expo-notifications (Expo push) |

---

## Project Structure

```
floodsense-malaysia/
├── backend/
│   ├── app.py              Main Flask app — 5-agent pipeline + all API endpoints
│   ├── dashboard.html      Government operations dashboard (served by Flask)
│   ├── requirements.txt    Python dependencies
│   └── data/               ML training CSVs + rainfall cache (gitignored)
├── frontend/
│   ├── App.js              Navigation + Firebase auth state
│   ├── app.json            Expo config (package ID, EAS project)
│   ├── config.js           Backend URL (local vs production)
│   ├── firebase.js         Firebase Auth init
│   ├── context/
│   │   ├── ThemeContext.js
│   │   └── LanguageContext.js
│   ├── screens/
│   │   ├── LoginScreen.js       Auth (login, signup, forgot password)
│   │   ├── HomeScreen.js        Flood map — flash flood + river overflow tabs
│   │   ├── AlertDetailScreen.js Per-district AI analysis
│   │   ├── RescueScreen.js      SOS rescue request form
│   │   ├── RescuerScreen.js     Rescuer case management
│   │   ├── EvacuationScreen.js  Nearest evacuation centres
│   │   └── SplashScreen.js      Loading screen
│   └── utils/
│       ├── api.js               All backend API calls
│       └── translations.js      EN / MY / ZH / TA strings
├── render.yaml             Render.com deployment config
└── .gitignore
```

---

## Running Locally

### Prerequisites

- Python 3.10+
- Node.js 18+
- Expo Go app on your phone (for the mobile app demo)

### Backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # macOS/Linux
pip install -r requirements.txt
```

Create `backend/.env`:

```env
ANTHROPIC_API_KEY=sk-ant-...
WEATHERAPI_KEY=your_weatherapi_key
FIREBASE_CREDENTIALS=/path/to/serviceAccount.json
FLASK_DEBUG=1
# DASHBOARD_KEY=optional_secret   # leave blank for local dev
```

Start the backend:

```bash
python app.py
```

Server runs at `http://localhost:5000`. The government dashboard is at `http://localhost:5000/dashboard`.

On first run, the ML model trains and saves to `flood_model.pkl`. Subsequent starts load it instantly.

### Frontend

```bash
cd frontend
npm install
```

Update `frontend/config.js` with your machine's local IP:

```js
export const BACKEND_URL = "http://YOUR_LAN_IP:5000";
```

Start the app:

```bash
npx expo start
```

Scan the QR code with **Expo Go** on your phone. Both phone and computer must be on the same Wi-Fi network.

---

## Deployment (Production)

### Backend — Render.com

1. Push the repo to GitHub
2. Create a new **Web Service** on [render.com](https://render.com)
3. Set the following environment variables in the Render dashboard:

| Variable | Description |
|---|---|
| `ANTHROPIC_API_KEY` | Claude AI API key (Anthropic console) |
| `WEATHERAPI_KEY` | WeatherAPI.com key (free tier: 1M calls/month) |
| `FIREBASE_CREDENTIALS_JSON` | Full Firebase service account JSON as a string |
| `FLASK_DEBUG` | Set to `0` for production |
| `DASHBOARD_KEY` | Secret key to protect the demo inject endpoint |

4. Build command: `pip install -r requirements.txt`
5. Start command: `gunicorn app:app`

### Frontend — Update backend URL

Once Render gives you a URL, update `frontend/config.js`:

```js
export const BACKEND_URL = "https://floodsense-malaysia.onrender.com";
```

### Android APK (optional, for demo without Expo Go)

```bash
cd frontend
npx eas build --profile preview --platform android
```

Requires an Expo account. Build takes ~15–30 minutes in the cloud.

---

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/flood/levels` | Live readings for all 11 KL/Selangor districts |
| POST | `/api/flood/analyze` | On-demand ML + Claude analysis |
| GET | `/api/flood/alerts` | 20 most recent alerts |
| GET | `/api/flood/evacuate?district=X` | Evacuation centres |
| POST | `/api/rescue/request` | Submit SOS rescue request |
| GET | `/api/rescue/cases` | All active rescue cases |
| POST | `/api/rescue/dispatch/<id>` | Mark case as dispatched |
| POST | `/api/rescue/resolve/<id>` | Mark case as resolved |
| POST | `/api/push/register` | Register Expo push token |
| GET | `/api/dashboard/stats` | Aggregated dashboard data |
| POST | `/api/demo/inject` | Demo flood spike (key-guarded) |
| GET | `/dashboard` | Government operations dashboard |
| GET | `/health` | Service liveness check |

---

## The 5-Agent Pipeline

Every 60 seconds, the backend runs an autonomous pipeline:

```
DataAgent (COLLECT)
  → ForecastAgent (PREDICT)
    → AnalysisAgent (DETECT anomalies via Isolation Forest)
      → DecisionAgent (CLASSIFY via Claude AI or rule-based)
        → ActionAgent (ACT — alerts, push, Firestore)
```

All inter-agent messages are logged and visible in the government dashboard's real-time comms feed.

---

## Security

- **Rate limiting** — 300 req/hr default; 10/hr demo inject; 5/hr SOS; 20/hr push register
- **Dashboard key guard** — `DASHBOARD_KEY` env var protects the demo inject endpoint
- **SOS zone gate** — Rescue requests only accepted from WATCH/WARNING/DANGER zones; GPS-verified
- **No secrets in code** — All API keys via environment variables only
- **Graceful degradation** — JPS down → static fallback; WeatherAPI down → file cache; Claude down → rule-based

---

## Monitored Districts

9 urban flash flood zones (rainfall threshold): Klang, Gombak, Kepong, Cheras, Ampang, Petaling Jaya, Bangsar, Subang Jaya, Shah Alam

2 river overflow zones (JPS level threshold): Kuala Selangor, Sepang

---

## License

MIT
