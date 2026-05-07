# FloodSense Malaysia — Backend

Python Flask backend for the FloodSense agentic AI flood early warning system.

Runs an autonomous 5-agent pipeline every 60 seconds:
**DataAgent → ForecastAgent → AnalysisAgent → DecisionAgent → ActionAgent**

---

## Setup

### 1. Install dependencies

```bash
cd backend
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # macOS/Linux
pip install -r requirements.txt
```

### 2. Configure environment variables

Create a `.env` file in `backend/`:

```env
ANTHROPIC_API_KEY=sk-ant-...
WEATHERAPI_KEY=your_weatherapi_key
FIREBASE_CREDENTIALS=/path/to/serviceAccount.json
FLASK_DEBUG=1
# DASHBOARD_KEY=   # leave blank in local dev to skip key guard
```

For Render deployment, use `FIREBASE_CREDENTIALS_JSON` (full JSON string) instead of a file path.

### 3. Run the server

```bash
python app.py
```

Server starts at `http://localhost:5000`

On first run, the ML model (`flood_model.pkl`) is trained and saved automatically. Subsequent starts load it from disk in under 1 second.

---

## Government Dashboard

```
http://localhost:5000/dashboard
```

Live ops centre showing: AI reasoning banner, storm cell warnings, SOS priority queue, district status table, and real-time agent communications feed. Polls the backend every 10 seconds.

---

## API Endpoints

### Flood Data

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/flood/levels` | Live readings for all 11 KL/Selangor districts with risk status |
| POST | `/api/flood/analyze` | On-demand ML + Claude analysis (body: `{"readings": {...}}`) |
| GET | `/api/flood/alerts` | 20 most recent alert events (Firestore or in-memory) |
| GET | `/api/flood/evacuate?district=X` | Evacuation centres for a district (omit param for all) |

### Rescue Coordination

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/rescue/request` | Submit SOS request — zone-gated, 5/hr rate limit |
| GET | `/api/rescue/cases` | All active rescue cases |
| POST | `/api/rescue/dispatch/<case_id>` | Mark a case as help dispatched |
| POST | `/api/rescue/resolve/<case_id>` | Mark a case as resolved |

### Infrastructure

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/push/register` | Register Expo push token — 20/hr rate limit |
| GET | `/api/dashboard/stats` | Aggregated stats for the dashboard |
| POST | `/api/demo/inject` | Inject a demo flood spike — key-guarded, 10/hr limit |
| GET | `/dashboard` | Government operations dashboard HTML |
| GET | `/health` | Liveness check — shows Firebase, Claude, ML model status |

---

## Health Check Response

```json
{
  "status": "FloodSense backend running",
  "firebase": true,
  "claude": true,
  "model_loaded": true,
  "alerts_cached": 5,
  "last_cycle": "2026-05-07T10:00:00.000000"
}
```

---

## Demo Inject

`POST /api/demo/inject`

Simulates a flood event without waiting for the 60-second scheduler. Requires `X-Dashboard-Key` header if `DASHBOARD_KEY` is set.

**Random spike (fully randomised):**
```json
{}
```

**Pin district and severity:**
```json
{ "district": "Klang", "scenario": "DANGER" }
```

**Full manual override:**
```json
{ "district": "Gombak", "river_level": 5.2, "rainfall_rate": 55.0 }
```

---

## Flood Risk Levels

### Urban Flash Flood (9 districts — rainfall-driven)
Klang · Gombak · Kepong · Cheras · Ampang · Petaling Jaya · Bangsar · Subang Jaya · Shah Alam

| Level | Rainfall |
|---|---|
| SAFE | < 15 mm/hr |
| WATCH | 15–30 mm/hr |
| WARNING | 30–50 mm/hr |
| DANGER | > 50 mm/hr |

### River Overflow (2 districts — JPS level-driven)
Kuala Selangor · Sepang

| Level | River Level |
|---|---|
| SAFE | < 3.0 m |
| WATCH | 3.0–4.5 m |
| WARNING | 4.5–5.5 m |
| DANGER | > 5.5 m |

---

## Security

- **Rate limiting** — flask-limiter with per-IP in-memory counters
- **Dashboard key** — `DASHBOARD_KEY` env var guards the demo inject endpoint
- **SOS zone gate** — Only WATCH/WARNING/DANGER zones accepted; GPS-verified when coordinates submitted
- **Graceful degradation** — JPS API down → static fallback; WeatherAPI down → file cache; Claude down → rule-based fallback

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | Yes | Claude AI API key |
| `WEATHERAPI_KEY` | Yes | WeatherAPI.com key |
| `FIREBASE_CREDENTIALS_JSON` | Render only | Full service account JSON as string |
| `FIREBASE_CREDENTIALS` | Local only | Path to serviceAccount.json file |
| `FLASK_DEBUG` | No | Set to `0` in production |
| `DASHBOARD_KEY` | No | Secret key for demo inject endpoint |

---

## Dependencies

```
flask
flask-cors
flask-limiter
anthropic
firebase-admin
apscheduler
scikit-learn
numpy
pandas
requests
python-dotenv
gunicorn==21.2.0
```
