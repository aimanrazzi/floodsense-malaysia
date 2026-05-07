# FloodSense Malaysia — Complete Project Documentation

> **Agentic AI Flood Early Warning System for Kuala Lumpur & Selangor**
> Built for the 2026 Hackathon | Powered by Claude AI + Isolation Forest + JPS Live Data

---

## Table of Contents

1. [Problem Statement](#1-problem-statement)
2. [The Solution](#2-the-solution)
3. [System Architecture](#3-system-architecture)
4. [Technical Approach](#4-technical-approach)
5. [AI & Agent Details](#5-ai--agent-details)
6. [Government Dashboard](#6-government-dashboard)
7. [Backend Security & Data Protection](#7-backend-security--data-protection)
8. [Results & Validation](#8-results--validation)
9. [Market & Impact](#9-market--impact)
10. [Challenges & Future Improvements](#10-challenges--future-improvements)
11. [Deployment & Configuration](#11-deployment--configuration)

---

## 1. Problem Statement

### Malaysia's Flood Crisis

Malaysia experiences devastating floods almost every year. The 2021–2022 Klang Valley mega-floods — the worst in over 50 years — displaced over **150,000 people**, killed at least **54 people**, and caused more than **RM 6.1 billion (USD 1.4 billion)** in damage. Despite this, critical gaps remain in how flood warnings reach the public and how rescue is coordinated.

### The Core Gaps

| Problem | Reality |
|---|---|
| **Late warnings** | JPS (Jabatan Pengairan dan Saliran) river gauges report current levels but don't forecast the next 1–2 hours. Residents get warnings after water is already in their homes. |
| **No flash flood distinction** | Urban KL/Selangor flooding is caused by drainage overload (banjir kilat), not river overflow. Existing systems treat them identically, leading to wrong thresholds. |
| **Fragmented rescue** | When disasters hit, citizens have no single way to report their location and situation. Rescuers from JKM, BOMBA, and police get conflicting, uncoordinated requests. |
| **No priority scoring** | With hundreds of SOS requests, rescuers don't know where to go first. There's no algorithmic triage. |
| **Language barriers** | Malaysia's multicultural population (Malay, English, Chinese, Tamil) gets warnings only in one or two languages. |
| **Government blind spots** | Operations centres rely on manual monitoring of multiple dashboards. There's no unified, AI-powered command view. |

### Who Gets Hurt

- **Residents of KL/Selangor**: 600,000+ people in flood-prone zones from Klang to Cheras, Gombak to Ampang.
- **Vulnerable groups**: Elderly, disabled, and non-Malay speakers who can't monitor multiple channels.
- **Rescuers**: JKM, BOMBA, and army units with no intelligent dispatch system.
- **Government**: No real-time situational awareness tool combining AI + data + rescue coordination.

---

## 2. The Solution

### FloodSense Malaysia

FloodSense is a **full-stack, agentic AI system** that delivers:

1. **Proactive warnings** — not just current risk, but predicted risk up to 2 hours ahead, combining live JPS river data, WeatherAPI radar readings, and Isolation Forest anomaly detection.
2. **Flood-type intelligence** — separate assessment logic for urban flash floods (drainage-driven, rainfall threshold) and rural river overflow (JPS level threshold).
3. **Claude AI reasoning** — when sensors detect anomalies or storms are incoming, Claude AI provides contextual, natural-language risk classification with actionable advice.
4. **SOS rescue coordination** — citizens submit geo-located rescue requests; an AI-powered priority scoring algorithm ranks them for dispatch.
5. **Multilingual public app** — React Native app in English, Bahasa Malaysia, Chinese, and Tamil.
6. **Government operations dashboard** — a live web dashboard for disaster managers with AI reasoning, storm alerts, SOS priority queue, and district-by-district evacuation status.
7. **Push notifications** — real-time WARNING/DANGER alerts to all registered citizen devices via Expo push.

### What Makes It Different

| Feature | FloodSense | Existing Systems |
|---|---|---|
| Flash flood vs overflow distinction | ✅ Two-model thresholds | ❌ One-size-fits-all |
| 2-hour storm forecast | ✅ WeatherAPI forecast | ❌ Current readings only |
| AI reasoning (Claude) | ✅ Natural language analysis | ❌ Threshold rules only |
| Anomaly detection (ML) | ✅ Isolation Forest | ❌ None |
| SOS rescue coordination | ✅ Priority scoring | ❌ Manual, fragmented |
| Government dashboard | ✅ Live AI command view | ❌ Basic tables |
| Multilingual | ✅ EN / MY / 中文 / தமிழ் | ❌ Malay/English only |

---

## 3. System Architecture

### Overview

```
┌──────────────────────────────────────────────────────────────────────────┐
│                        DATA SOURCES                                       │
│  JPS Water Level API  ·  WeatherAPI.com (radar+forecast)  ·  Firebase    │
└──────────────┬───────────────────────────────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                     FLASK BACKEND (Python)                                │
│                                                                           │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────┐  ┌─────────────┐ │
│  │  DataAgent  │→ │ForecastAgent │→ │AnalysisAgent  │→ │DecisionAgent│ │
│  │   COLLECT   │  │   PREDICT    │  │  DETECT/SCORE │  │  CLASSIFY   │ │
│  └─────────────┘  └──────────────┘  └───────────────┘  └──────┬──────┘ │
│                                           │ Isolation Forest   │ Claude  │
│                                           │ ML anomaly score   │ AI      │
│                                                                 ▼        │
│                                                    ┌─────────────────┐  │
│                                                    │  ActionAgent    │  │
│                                                    │  ALERT + PUSH   │  │
│                                                    └─────────────────┘  │
│                                                                           │
│  REST API endpoints (/api/flood/*, /api/rescue/*, /api/dashboard/stats)  │
│  Rate limiting (flask-limiter) · Dashboard key guard · CORS              │
└──────────────────────────────────────────────────────────────────────────┘
               │
       ┌───────┴──────────────────┐
       ▼                          ▼
┌─────────────────┐    ┌──────────────────────────┐
│  CITIZEN APP    │    │ GOVERNMENT DASHBOARD      │
│ React Native    │    │ HTML/JS served by Flask   │
│ (Expo)          │    │                           │
│                 │    │ · AI reasoning banner     │
│ · Flood map     │    │ · Storm cell warnings     │
│ · Your Area     │    │ · SOS priority queue      │
│ · SOS rescue    │    │ · District status table   │
│ · Evacuation    │    │ · Agent comms log         │
│ · 4 languages   │    │ · Demo inject + dispatch  │
└─────────────────┘    └──────────────────────────┘
```

### Tech Stack

**Backend**
- Python 3.11 / Flask 3.x
- APScheduler (60-second pipeline loop)
- scikit-learn (Isolation Forest)
- Anthropic SDK (Claude Haiku 4.5)
- Firebase Admin SDK (Firestore persistence)
- WeatherAPI.com (live rainfall + 2h forecast)
- JPS Water Level API (river gauge data)
- flask-limiter (rate limiting)
- gunicorn (production WSGI server)
- Render.com (cloud hosting)

**Frontend**
- React Native + Expo SDK
- expo-location (GPS)
- expo-notifications (push)
- Firebase Auth (authentication)
- expo-linear-gradient (UI)

**Data Sources**
- `https://info.water.gov.my` — JPS live river water level telemetry (Selangor)
- `https://api.weatherapi.com` — Live precipitation + hourly forecast (11 districts)
- Google Firestore — Persistent alert and rescue request storage

---

## 4. Technical Approach

### 4.1 Flood Type Classification

FloodSense recognises that KL/Selangor has two fundamentally different flood mechanisms:

#### Urban Flash Flood (banjir kilat) — 9 districts
Klang, Gombak, Kepong, Cheras, Ampang, Petaling Jaya, Bangsar, Subang Jaya, Shah Alam

These are **drainage-driven** floods. KL's ageing stormwater infrastructure fails when rainfall intensity exceeds its capacity. The primary trigger is rainfall rate, NOT river level.

```
Flash Flood Thresholds (mm/hr accumulated):
  SAFE    < 15 mm/hr
  WATCH   ≥ 15 mm/hr   (surface pooling begins in low-lying streets)
  WARNING ≥ 30 mm/hr   (JPS Alert Level 1, localised flash flooding)
  DANGER  ≥ 50 mm/hr   (JPS Alert Level 2/3, widespread flash flood)
```

#### River Overflow Flood — 2 districts
Kuala Selangor, Sepang

These are **level-driven** floods caused by rivers exceeding their banks after sustained upstream rainfall.

```
JPS River Level Thresholds (metres):
  SAFE    < 3.0 m
  WATCH   ≥ 3.0 m
  WARNING ≥ 4.5 m
  DANGER  ≥ 5.5 m
```

### 4.2 Composite Risk Scoring

A simple threshold on current readings is insufficient — it misses the "light rain now, heavy storm incoming" scenario. FloodSense uses a **composite score**:

```
probability_weight = min(rain_chance / 100, 0.8) if rain_chance ≥ 40 else 0.0
composite = current_rainfall + forecast_2h × probability_weight
```

The `0.8` cap ensures forecasts never fully override observed reality. The `rain_chance ≥ 40` guard prevents dry-weather forecasts from inflating risk.

**Special escalation rules:**
- If `rainfall ≥ 8mm` AND `forecast_2h ≥ 25mm` AND `chance ≥ 60%` → escalate to WARNING (catch building storms early)
- If `level ≥ 3.5m` AND `rainfall ≥ 15mm` → WARNING (river + rain compounding)
- If `composite ≥ 60mm` → DANGER (forecast-driven extreme event)

### 4.3 Parallel WeatherAPI Fetch

All 11 districts are fetched in parallel using Python's `ThreadPoolExecutor`:

```python
with ThreadPoolExecutor(max_workers=10) as pool:
    futures = {pool.submit(_fetch_one_district, d): d for d in DISTRICT_COORDS}
```

Each call returns: `precip_mm` (current), `forecast_1h`, `forecast_2h`, `rain_chance_max`, `condition`.

The cache TTL is 5 minutes with file persistence (`data/rainfall_cache.json`) — survives server restarts and protects WeatherAPI free-tier rate limits (1M calls/month).

### 4.4 SOS Priority Scoring

When a citizen submits a rescue request, it is added to the queue. For dispatch prioritisation, each active case receives a **priority score**:

```
score = district_weight × people_count × (1 + log₁₊₁(minutes_waiting / 10))
```

Where:
- `district_weight` = 3 (DANGER) / 2 (WARNING) / 1 (WATCH)
- `people_count` = number of people at risk
- `log₁₊₁(minutes_waiting / 10)` = logarithmic time penalty (so waiting longer = more urgent, but sub-linearly — prevents old low-risk cases from always topping the queue)

The highest-scoring case is surfaced as `sos_priority` in the dashboard API, with a one-click dispatch button.

---

## 5. AI & Agent Details

### 5.1 The 5-Agent Pipeline

FloodSense runs an autonomous 5-agent pipeline every **60 seconds** via APScheduler. All inter-agent messages are logged to `_agent_comms` and displayed in the government dashboard's real-time comms feed.

#### Agent 1: DataAgent — COLLECT

**Role**: Live data ingestion specialist for KL/Selangor.

**Actions**:
1. Calls `fetch_jps_data()` which in turn calls:
   - JPS Water Level API (`info.water.gov.my`) for river levels
   - WeatherAPI in parallel for all 11 districts
2. Merges both sources with JPS_FALLBACK static data as a failsafe
3. Packages into unified `readings` dict: `{river_name: {level, rainfall, forecast_1h, forecast_2h, rain_chance_max, district, station, live_wl, live_rainfall}}`

**Message to ForecastAgent**: "Ingested N districts — X currently raining, Y with elevated river levels"

#### Agent 2: ForecastAgent — PREDICT

**Role**: Storm trajectory and arrival time estimation.

**Actions**:
1. Scans all district forecasts for incoming storm cells
2. A storm cell is flagged when: `peak > 10mm` AND `peak > current * 1.5` AND `chance ≥ 60%`
3. Estimates ETA: 1 hour if `forecast_1h ≥ forecast_2h`, else 2 hours
4. Stores `_latest_storm_warnings` globally for dashboard display

**Key insight**: This agent catches the "light drizzle now, but 45mm forecast in 1 hour" scenario — giving residents 1–2 hours to prepare instead of zero.

**Message to AnalysisAgent**: "Storm cells detected approaching N district(s): District (Xmm in Yh)"

#### Agent 3: AnalysisAgent — DETECT ANOMALIES

**Role**: Isolation Forest ML anomaly detection.

**Actions**:
1. Runs `compute_anomaly_score()` on every station
2. Each station gets: `(anomaly_score: 0.0–1.0, is_anomaly: bool)`
3. Decides whether to escalate to Claude AI: `needs_claude = max_score > 0.7 OR storm_warnings > 0`

**Escalation logic**: Claude is only called when needed (anomaly OR incoming storm), saving API cost for routine SAFE cycles. Rule-based fallback handles the rest.

**Message to DecisionAgent**: "Score: X.XXX | [reason] — Escalating to Claude AI / Rule-based sufficient"

#### Agent 4: DecisionAgent — CLASSIFY RISK

**Role**: Structured risk classification using Claude AI or rules.

**If Claude is called** (via `classify_risk_with_claude()`):

Model: `claude-haiku-4-5-20251001` (fast, cost-efficient)

The prompt includes:
- Full readings dict with forecasts for all 11 districts
- ML anomaly score
- Flash flood vs river overflow thresholds
- Composite scoring rules
- Instruction to flag forecast-driven risk explicitly

Claude returns JSON:
```json
{
  "risk_level": "SAFE|WATCH|WARNING|DANGER",
  "affected_districts": ["list"],
  "estimated_time_to_critical": "X hours or N/A",
  "confidence": 0.0-1.0,
  "recommended_action": "one clear action",
  "reasoning": "One sentence: flood type, district, primary metric, current or forecast-driven"
}
```

**If rule-based fallback** (`_rule_based_fallback()`):
Iterates all stations, applies `_compute_station_status()`, returns worst-case risk.

**Message to ActionAgent**: "[Claude AI / Rule-based] Decision: RISK — reasoning"

#### Agent 5: ActionAgent — ACT

**Role**: Persist alerts, update global state, trigger notifications.

**Actions**:
1. Builds structured `alert` document with all metadata
2. Writes to Firestore if risk is WARNING or DANGER (`flood_alerts` collection)
3. Sends Expo push notifications to all registered devices
4. Updates `_latest_readings` and `_active_alerts` (in-memory, up to 20)
5. Logs final cycle summary to agent comms

**Message to Dashboard**: "Cycle complete — RISK. Actions: Alert stored, Firestore write triggered, Push sent to N devices"

### 5.2 Isolation Forest ML Model

**Algorithm**: scikit-learn `IsolationForest`

**Training data**: JPS historical normal-condition readings (SAFE-band only)
- Features: `[river_level (m), rainfall_rate (mm/hr), hour_of_day, month]`
- 7,776 training rows covering every hour × month × normal reading pair
- `contamination=0.05` (expects ~5% anomalies in real-world data)
- `n_estimators=200` for stability

**Why SAFE-band only**: Isolation Forest is an unsupervised algorithm — it learns what "normal" looks like and flags deviations. Training on labelled flood data would be classification, not anomaly detection.

**Scoring**: Uses `decision_function` (offset-corrected by sklearn):
```
anomaly_score = clip(0.7 - decision_function × 5.0, 0, 1)
```
- Score > 0.70 → anomaly (threshold aligns with sklearn's decision boundary)
- Score = 0.10 → clearly safe
- Score = 0.80 → anomalous, flagged for Claude

**Model persistence**: Saved as `flood_model.pkl`. Delete to force retrain. Supports loading real CSV data from `backend/data/*.csv` (Kaggle Malaysia Flood Dataset format or JPS direct exports).

### 5.3 Claude AI Integration

**Model**: `claude-haiku-4-5-20251001` — chosen for:
- Sub-second latency (critical for real-time alerts)
- Cost efficiency (invoked only when ML flags anomaly or ForecastAgent detects storms)
- Strong JSON instruction following

**Prompt engineering**:
- Explicit flood type instructions (flash vs overflow) with thresholds
- Composite scoring rules in the prompt
- Instruction to mention forecast-driven risk explicitly in reasoning
- JSON-only output enforced with regex extraction fallback (`re.search(r"\{.*\}", raw, re.DOTALL)`)

**Fallback**: If Claude API fails, `_rule_based_fallback()` is used — the system degrades gracefully and never goes offline.

---

## 6. Government Dashboard

The government dashboard is a single-page HTML/JS app served directly by Flask at `/dashboard`. It polls the backend every 10 seconds.

### Key Dashboard Sections

#### AI Decision Banner
Three-part intelligent banner showing:
1. **Situation text**: Current risk level with color-coded reasoning from Claude
2. **Storm bar** (appears when ForecastAgent detects incoming storms): "⛈ Incoming storm: District (Xmm in Yh, Z% chance)"
3. **Priority bar** (appears when active SOS cases exist): "🚨 Priority dispatch: Case SOS-XXXX — 5 people, 12 min waiting, score 47.3 — [Dispatch button]"

#### Agent Communications Feed
Real-time log of all 5-agent messages showing exactly what each agent decided and why. Colour-coded by risk level. Timestamped.

#### District Status Table
All 11 KL/Selangor districts with:
- Status badge (DANGER/WARNING/WATCH/SAFE)
- Flood type (flash_flood / river_overflow)
- Rainfall rate + river level
- 2h forecast
- Weather condition
- Evacuation centres count + capacity
- Expandable evac centre list with Google Maps links (where real GPS is provided)

#### Demo Inject Modal
Allows operators to simulate a flood scenario without waiting for real data:
1. Select district (or "Random")
2. Select severity: WATCH / WARNING / DANGER / Random
3. Confirm → injects a realistic spike, runs full pipeline, shows result

Protected by: rate limiting (10/hour) + optional `DASHBOARD_KEY` environment variable.

#### SOS Cases Panel
Active rescue requests with:
- Case ID, district, situation, people count, time waiting
- Google Maps link (if GPS submitted)
- One-click Dispatch and Resolve buttons

---

## 7. Backend Security & Data Protection

### 7.1 Rate Limiting

Implemented using `flask-limiter` with in-memory storage:

| Endpoint | Limit | Reason |
|---|---|---|
| All endpoints (default) | 300 / hour | General DoS protection |
| `POST /api/demo/inject` | 10 / hour | Prevent demo abuse |
| `POST /api/rescue/request` | 5 / hour | Prevent SOS spam |
| `POST /api/push/register` | 20 / hour | Prevent token flooding |

### 7.2 Dashboard Key Guard

The demo inject endpoint is optionally protected by a server-side secret:

```python
_DASHBOARD_KEY = os.getenv("DASHBOARD_KEY", "")
```

When `DASHBOARD_KEY` is set in the Render environment:
- Requests must include `X-Dashboard-Key: <key>` header
- Dashboard JS receives the key via Jinja2 server-side injection (never hardcoded in source)
- Requests without the correct key receive HTTP 401

When not set (local dev): guard is skipped automatically.

### 7.3 SOS Zone Gate

Rescue requests are only accepted from flood-affected zones:

```python
if status == "SAFE":
    return jsonify({"error": "sos_blocked", ...}), 403
```

If GPS coordinates are submitted, the system derives the **GPS-verified district** (nearest centroid) and uses that for the gate check — harder to spoof than a dropdown selection.

### 7.4 Firebase / Firestore

- **Authentication**: Firebase Auth handles citizen login (email/password)
- **Persistence**: WARNING and DANGER alerts are written to Firestore `flood_alerts` collection; rescue requests to `rescue_requests` collection
- **Credentials**: Stored as JSON in `FIREBASE_CREDENTIALS_JSON` environment variable (Render) or file path (`FIREBASE_CREDENTIALS`) for local dev. Never committed to source control.
- **Fallback**: If Firebase is unavailable, all data is stored in-memory — the system stays operational

### 7.5 API Key Management

All secrets are environment variables, never in source code:

| Variable | Purpose |
|---|---|
| `ANTHROPIC_API_KEY` | Claude AI API access |
| `WEATHERAPI_KEY` | WeatherAPI.com rainfall data |
| `FIREBASE_CREDENTIALS_JSON` | Firebase service account |
| `DASHBOARD_KEY` | Demo inject endpoint guard |
| `FLASK_DEBUG` | Set to `0` in production |

### 7.6 CORS

`flask-cors` is enabled for all origins (appropriate for a public API consumed by a mobile app). For production hardening, this could be restricted to known origins.

### 7.7 Data Privacy

- No personal data is stored except what citizens voluntarily submit in SOS requests (name optional, GPS optional)
- Push tokens are stored in-memory only (no database) — cleared on restart
- No tracking, analytics, or profiling of app users

---

## 8. Results & Validation

### 8.1 Pipeline Performance

- **Cycle time**: ~2–4 seconds per 60-second cycle (WeatherAPI parallel fetch dominates)
- **Data freshness**: Rainfall data is 5-minute cached; river levels are fetched live each cycle
- **Fallback coverage**: System stays operational with zero external APIs (uses JPS_FALLBACK static data + rule-based classification)

### 8.2 ML Model Validation

The Isolation Forest was trained on a clean SAFE-band baseline representing all normal KL/Selangor river conditions across all hours and months. The model correctly:
- Scores SAFE readings (level < 3m, rain < 20mm) at anomaly_score < 0.5
- Scores WARNING-level readings (level > 4.5m OR rain > 30mm) at anomaly_score > 0.7
- The `contamination=0.05` parameter is consistent with observed annual flood frequency in the region

### 8.3 Demo Scenarios Tested

| Scenario | Injected | Claude Decision | Push Sent |
|---|---|---|---|
| Klang DANGER | 65mm/hr, 5.8m | DANGER — Flash flood, drainage overwhelmed | ✅ |
| Gombak WARNING | 35mm/hr, 4.2m | WARNING — Heavy rain, drainage stressed | ✅ |
| Sepang river DANGER | 5.9m level | DANGER — River overflow imminent | ✅ |
| Shah Alam WATCH | 18mm/hr | WATCH — Moderate rain, monitor | ❌ (below threshold) |
| All districts SAFE | baseline | SAFE — No action required | ❌ |

### 8.4 Forecast Warning Validation

The ForecastAgent successfully detects:
- "Light rain now (8mm), 45mm forecast in 1h at 75% chance" → storm cell flagged, WATCH → WARNING escalation
- "Moderate rain (20mm), 60mm forecast in 2h at 80% chance" → DANGER flag 2 hours ahead

### 8.5 SOS Priority Scoring Example

Given three active SOS cases:
| Case | District Status | People | Wait (min) | Score |
|---|---|---|---|---|
| SOS-070001-KLG | DANGER | 5 | 15 | 3 × 5 × 1.41 = **21.2** |
| SOS-070002-GOM | WARNING | 8 | 45 | 2 × 8 × 1.65 = **26.4** |
| SOS-070003-CHE | DANGER | 2 | 90 | 3 × 2 × 2.20 = **13.2** |

Priority dispatch → SOS-070002-GOM (8 people in WARNING, waiting 45 min)

---

## 9. Market & Impact

### 9.1 Addressable Population

- **Kuala Lumpur + Selangor**: ~8 million residents
- **High-risk flood zones**: ~600,000 in monitored districts
- **Potential near-term expansion**: All 14 Malaysian states (40+ major river systems)

### 9.2 Socioeconomic Impact

| Metric | Value |
|---|---|
| Annual flood damage (Malaysia) | RM 2–4 billion |
| 2021/22 KL floods economic loss | RM 6.1 billion |
| People displaced in 2021/22 | 150,000+ |
| Average warning time (current) | < 30 minutes |
| FloodSense warning time | 1–2 hours (forecast-driven) |

A 1–2 hour early warning enables:
- Residents to move vehicles, valuables, and vulnerable family members
- Businesses to protect inventory
- Rescuers to pre-position before requests flood in
- Schools and offices to dismiss early

### 9.3 Monetisation Paths

1. **Government SaaS** — License to state disaster management agencies (JPAM, JKM, state JPS)
2. **Insurance integration** — Real-time flood risk API for property insurers and flood excess products
3. **Property developers** — Risk assessment API for site planning
4. **Telco integration** — Push alert distribution via existing emergency broadcast partnerships
5. **Municipal councils** — Drainage stress monitoring for infrastructure planning

### 9.4 Competitive Landscape

| System | Operator | Limitation |
|---|---|---|
| MyFloodCast | DID / JPS | River levels only, no flash flood model, no AI |
| SELAMAT App | JPAM | Evacuation info only, no live monitoring |
| Weather apps | Private | Rainfall only, no flood risk model |
| **FloodSense** | — | Full stack: live data + ML + AI + rescue coordination |

---

## 10. Challenges & Future Improvements

### 10.1 Current Limitations

| Limitation | Detail |
|---|---|
| **Coverage** | Only KL/Selangor (11 districts). Malaysia has 14 states and 400+ major rivers. |
| **JPS API reliability** | `info.water.gov.my` has intermittent availability. Fallback static data is used when unreachable. |
| **Evacuation GPS** | Only Klang district has verified real-world GPS coordinates. Other districts use estimated centroid coordinates. |
| **Firebase project** | App currently uses a development Firebase project. Production requires a dedicated FloodSense Firebase project. |
| **Push notification scale** | Expo push handles 100 devices per batch. Large-scale deployment would require a queuing system. |
| **Single-instance backend** | Rate limiter uses in-memory storage — resets on restart and doesn't share state across instances. Production would need Redis. |

### 10.2 Planned Improvements

#### Short-term (1–3 months)
- **Real GPS for all evacuation centres** — partner with JKM to get verified coordinates
- **SMS fallback** — Twilio SMS for users without smartphones or data
- **Historical alert log** — Firestore query UI in dashboard for post-event analysis
- **Multi-state expansion** — Add Johor, Kelantan, Pahang (highest flood frequency states)

#### Medium-term (3–6 months)
- **NADMA data integration** — Official National Disaster Management Agency real-time feed
- **Predictive ML upgrade** — LSTM time-series model trained on 10+ years of JPS data for 6–12 hour forecasts
- **Community reports** — Citizens can submit "I see flooding" reports with photos, validated by AI
- **Redis rate limiter** — Horizontal scaling support
- **Telco SMS broadcast** — Partnership with Maxis/Celcom/Digi for cell-broadcast emergency alerts

#### Long-term (6–12 months)
- **National coverage** — All 14 states, all major rivers in the JPS network
- **Satellite integration** — Sentinel-1 SAR flood mapping for rural areas with no gauge stations
- **3D flood mapping** — Integrate with JUPEM elevation data for inundation modelling
- **AI damage assessment** — Post-flood satellite image analysis with computer vision
- **Full government integration** — Direct API integration with JPAM's National Emergency Operations Centre (PKOB)

### 10.3 Technical Debt

- Move all secret management to a proper vault (HashiCorp Vault or AWS Secrets Manager)
- Add comprehensive unit tests (pytest) for agent pipeline and scoring functions
- Add API versioning (`/api/v1/`) for backward compatibility as the system evolves
- Implement WebSocket real-time updates for dashboard (currently polling every 10s)

---

## 11. Deployment & Configuration

### Backend (Render.com)

1. Push code to GitHub
2. Create new **Web Service** on Render
3. Set environment variables:
   ```
   ANTHROPIC_API_KEY=sk-ant-...
   WEATHERAPI_KEY=...
   FIREBASE_CREDENTIALS_JSON={"type":"service_account",...}
   FLASK_DEBUG=0
   DASHBOARD_KEY=your-secret-key
   ```
4. Build command: `pip install -r requirements.txt`
5. Start command: `gunicorn app:app`

### Frontend (Expo)

1. Update `frontend/config.js`:
   ```javascript
   export const BACKEND_URL = "https://floodsense-malaysia.onrender.com";
   ```
2. Set up Firebase project for FloodSense (update `frontend/firebase.js`)
3. Build with EAS: `eas build --platform android`

### API Endpoints Reference

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/flood/levels` | Live readings for all 11 districts |
| POST | `/api/flood/analyze` | On-demand ML + Claude analysis |
| GET | `/api/flood/alerts` | 20 most recent alerts (Firestore) |
| GET | `/api/flood/evacuate?district=X` | Evacuation centres |
| POST | `/api/rescue/request` | Submit SOS rescue request |
| GET | `/api/rescue/cases` | All active rescue cases |
| POST | `/api/rescue/dispatch/<id>` | Mark case as dispatched |
| POST | `/api/rescue/resolve/<id>` | Mark case as resolved |
| POST | `/api/push/register` | Register Expo push token |
| GET | `/api/dashboard/stats` | Aggregated dashboard data |
| POST | `/api/demo/inject` | Demo flood spike injection |
| GET | `/dashboard` | Government dashboard HTML |
| GET | `/health` | Service liveness check |

---

## Appendix: File Structure

```
floodsense-malaysia/
├── backend/
│   ├── app.py              # Main Flask app + all 5 agents + endpoints
│   ├── dashboard.html      # Government operations dashboard (served by Flask)
│   ├── requirements.txt    # Python dependencies
│   └── data/               # CSV training data (gitignored)
│       └── rainfall_cache.json  # WeatherAPI 5-min cache (gitignored)
├── frontend/
│   ├── App.js              # Navigation + auth state
│   ├── app.json            # Expo config (package ID, EAS project)
│   ├── config.js           # Backend URL config
│   ├── firebase.js         # Firebase Auth init
│   ├── context/
│   │   ├── ThemeContext.js
│   │   └── LanguageContext.js
│   ├── screens/
│   │   ├── LoginScreen.js      # Auth (login + signup + forgot password)
│   │   ├── HomeScreen.js       # Main flood map (flash + river tabs)
│   │   ├── AlertDetailScreen.js# Per-district AI analysis detail
│   │   ├── RescueScreen.js     # SOS rescue request form
│   │   ├── RescuerScreen.js    # Rescuer view (cases + dispatch)
│   │   ├── EvacuationScreen.js # Nearest evacuation centres
│   │   └── SplashScreen.js     # App loading screen
│   └── utils/
│       ├── api.js              # All backend API calls
│       └── translations.js     # EN/MY/ZH/TA strings
├── render.yaml             # Render.com deployment config
└── .gitignore
```

---

*FloodSense Malaysia — Built for the 2026 Hackathon. Saving lives through proactive AI-driven flood intelligence.*
