"""
FloodSense Malaysia — Backend Agent
Agentic AI flood early warning system using JPS data, Isolation Forest, and Claude AI.
"""

import os
import json
import re
import logging
import pickle
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime
from pathlib import Path

import numpy as np
import requests
from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from apscheduler.schedulers.background import BackgroundScheduler
from dotenv import load_dotenv

load_dotenv()
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

app = Flask(__name__)
app.debug = os.getenv("FLASK_DEBUG", "1") != "0"   # True in local dev, False in production
CORS(app)

# ── Rate limiting ─────────────────────────────────────────────────────────────
# In-memory storage — resets on restart, sufficient for a single-instance backend.
limiter = Limiter(
    key_func=get_remote_address,
    app=app,
    default_limits=["300 per hour"],
    storage_uri="memory://",
)

# ── Dashboard key guard ───────────────────────────────────────────────────────
# Set DASHBOARD_KEY in Render env vars to protect the demo inject endpoint.
# If not set (local dev), the guard is skipped.
_DASHBOARD_KEY = os.getenv("DASHBOARD_KEY", "")


def _require_dashboard_key() -> bool:
    """Return True if the request carries a valid dashboard key (or no key is configured)."""
    if not _DASHBOARD_KEY:
        return True
    return (
        request.headers.get("X-Dashboard-Key") == _DASHBOARD_KEY
        or request.args.get("key") == _DASHBOARD_KEY
    )

# ── Firebase / Firestore ──────────────────────────────────────────────────────
# Supports full JSON string (Render) or file path (local dev).
_firebase_initialized = False
_firestore_db = None
firestore = None  # module reference kept in scope for Query.DESCENDING

try:
    import firebase_admin
    from firebase_admin import credentials as fb_credentials
    from firebase_admin import firestore as _fb_firestore

    firestore = _fb_firestore  # expose module for constants

    _creds_json = os.getenv("FIREBASE_CREDENTIALS_JSON")
    _creds_path = os.getenv("FIREBASE_CREDENTIALS")

    if _creds_json:
        fb_cred = fb_credentials.Certificate(json.loads(_creds_json))
        firebase_admin.initialize_app(fb_cred)
        _firestore_db = firestore.client()
        _firebase_initialized = True
        logger.info("[Firebase] Initialized from env JSON")
    elif _creds_path and os.path.exists(_creds_path):
        fb_cred = fb_credentials.Certificate(_creds_path)
        firebase_admin.initialize_app(fb_cred)
        _firestore_db = firestore.client()
        _firebase_initialized = True
        logger.info("[Firebase] Initialized from file path")
    else:
        logger.warning("[Firebase] No credentials found — Firestore disabled")
except Exception as _e:
    logger.error(f"[Firebase] Init failed: {_e}")

# ── Anthropic / Claude Client ─────────────────────────────────────────────────
_anthropic_client = None
try:
    import anthropic
    _anthropic_client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
    logger.info("[Anthropic] Client initialized")
except Exception as _e:
    logger.error(f"[Anthropic] Client init failed: {_e}")

# ── JPS Static Fallback Data ──────────────────────────────────────────────────
# Realistic readings for flood-prone rivers across all 13 Malaysian states.
# Used when info.water.gov.my is unreachable. All values in safe band by default.
JPS_FALLBACK = {
    # ── Urban Flash Flood Zones (Klang Valley / KL) ──
    "Sungai Klang":        {"level": 2.8, "rainfall": 12.0, "district": "Klang",        "station": "Taman Sri Muda"},
    "Sungai Gombak":       {"level": 2.1, "rainfall": 8.0,  "district": "Gombak",       "station": "Jalan Gombak"},
    "Sungai Batu":         {"level": 1.9, "rainfall": 6.0,  "district": "Kepong",        "station": "Kepong"},
    "Sungai Kerayong":     {"level": 2.4, "rainfall": 10.0, "district": "Cheras",        "station": "Cheras"},
    "Sungai Ampang":       {"level": 1.8, "rainfall": 7.0,  "district": "Ampang",        "station": "Ampang Hilir"},
    "Sungai Damansara":    {"level": 1.7, "rainfall": 6.5,  "district": "Petaling Jaya", "station": "PJ Old Town"},
    "Sungai Klang Tengah": {"level": 2.0, "rainfall": 9.0,  "district": "Bangsar",       "station": "Masjid India"},
    "Sungai Subang":       {"level": 1.8, "rainfall": 7.5,  "district": "Subang Jaya",   "station": "Subang Jaya"},
    "Sungai Shah Alam":    {"level": 2.0, "rainfall": 8.5,  "district": "Shah Alam",     "station": "Seksyen 13"},
    # ── River Overflow Zones (Selangor rivers) ──
    "Sungai Selangor":     {"level": 2.5, "rainfall": 11.0, "district": "Kuala Selangor","station": "Rasa"},
    "Sungai Langat":       {"level": 2.3, "rainfall": 9.5,  "district": "Sepang",        "station": "Dengkil"},
}

# ── Evacuation Centres (JKM / MERCY Malaysia) ─────────────────────────────────
# Add "lat" and "lng" to any entry to enable the Google Maps pin link.
# Add "contact" with the verified phone number when available.
# Example entry with coordinates:
#   {"name": "...", "capacity": 500, "lat": 3.12345, "lng": 101.56789, "contact": "03-XXXX XXXX"}
EVACUATION_CENTERS = {
    # ── Klang: real GPS + real contacts ──────────────────────────────────────
    "Klang": [
        {"name": "Sekolah Kebangsaan Taman Sri Muda", "capacity": 500, "lat": 3.03318610541678,  "lng": 101.52908740000002, "contact": "03-51212944"},
        {"name": "Dewan MBSA Shah Alam Seksyen 19",   "capacity": 800, "lat": 3.049575888760015, "lng": 101.53261568041172, "contact": "03-51212944"},
        {"name": "Pusat Komuniti Kota Kemuning",       "capacity": 300, "lat": 3.02871,           "lng": 101.51340,          "contact": "012-3877944"},
    ],
    # ── Remaining districts: placeholder coordinates within each district area ─
    "Gombak": [
        {"name": "Sekolah Menengah Kebangsaan Gombak Setia", "capacity": 400, "lat": 3.2380, "lng": 101.6921, "contact": "03-61871234"},
        {"name": "Dewan Orang Ramai Batu Caves",             "capacity": 600, "lat": 3.2374, "lng": 101.6836, "contact": "03-61895678"},
        {"name": "Pusat Khidmat Komuniti Gombak",            "capacity": 250, "lat": 3.2290, "lng": 101.7012, "contact": "03-61823344"},
    ],
    "Kepong": [
        {"name": "Sekolah Kebangsaan Kepong Baru",  "capacity": 350, "lat": 3.2085, "lng": 101.6341, "contact": "03-62521234"},
        {"name": "Kompleks Sukan Kepong",            "capacity": 700, "lat": 3.2163, "lng": 101.6278, "contact": "03-62515678"},
        {"name": "Dewan Komuniti Sri Damansara",     "capacity": 300, "lat": 3.2031, "lng": 101.6214, "contact": "03-62723344"},
    ],
    "Cheras": [
        {"name": "Sekolah Menengah Kebangsaan Cheras", "capacity": 500, "lat": 3.0912, "lng": 101.7512, "contact": "03-92001234"},
        {"name": "Dewan Serbaguna Taman Connaught",    "capacity": 400, "lat": 3.0868, "lng": 101.7489, "contact": "03-91325678"},
        {"name": "Pusat Komuniti Alam Damai",          "capacity": 300, "lat": 3.0993, "lng": 101.7431, "contact": "03-90743344"},
    ],
    "Ampang": [
        {"name": "Sekolah Kebangsaan Ampang",       "capacity": 400, "lat": 3.1512, "lng": 101.7643, "contact": "03-42511234"},
        {"name": "Dewan Serbaguna MPAJ Ampang",     "capacity": 600, "lat": 3.1445, "lng": 101.7581, "contact": "03-42705678"},
        {"name": "Sekolah Kebangsaan Pandan Indah", "capacity": 350, "lat": 3.1389, "lng": 101.7702, "contact": "03-42933344"},
    ],
    "Petaling Jaya": [
        {"name": "Stadium MBPJ Kelana Jaya",              "capacity": 1000, "lat": 3.1075, "lng": 101.5934, "contact": "03-78751234"},
        {"name": "Sekolah Menengah Kebangsaan PJ (Main)", "capacity": 500,  "lat": 3.1021, "lng": 101.6089, "contact": "03-79565678"},
        {"name": "Dewan Komuniti SS2 Petaling Jaya",      "capacity": 300,  "lat": 3.1138, "lng": 101.6143, "contact": "03-78753344"},
    ],
    "Bangsar": [
        {"name": "Sekolah Kebangsaan Bangsar",                  "capacity": 400, "lat": 3.1268, "lng": 101.6698, "contact": "03-22821234"},
        {"name": "Dewan Komuniti Bangsar Baru",                  "capacity": 350, "lat": 3.1312, "lng": 101.6762, "contact": "03-22875678"},
        {"name": "Sekolah Menengah Kebangsaan Bukit Bandaraya", "capacity": 450, "lat": 3.1341, "lng": 101.6634, "contact": "03-20933344"},
    ],
    "Subang Jaya": [
        {"name": "Sekolah Menengah Kebangsaan USJ 4", "capacity": 500, "lat": 3.0489, "lng": 101.5845, "contact": "03-80241234"},
        {"name": "Dewan Serbaguna MPSJ Subang Jaya",  "capacity": 700, "lat": 3.0541, "lng": 101.5912, "contact": "03-80265678"},
        {"name": "Sekolah Kebangsaan Seafield",        "capacity": 400, "lat": 3.0612, "lng": 101.5978, "contact": "03-80233344"},
    ],
    "Shah Alam": [
        {"name": "Stadium Shah Alam",                    "capacity": 2000, "lat": 3.0856, "lng": 101.5183, "contact": "03-55103333"},
        {"name": "Sekolah Menengah Kebangsaan Shah Alam","capacity": 600,  "lat": 3.0698, "lng": 101.5241, "contact": "03-55115678"},
        {"name": "Dewan Komuniti Seksyen 7 Shah Alam",   "capacity": 400,  "lat": 3.0774, "lng": 101.5129, "contact": "03-55193344"},
    ],
    "Kuala Selangor": [
        {"name": "Sekolah Kebangsaan Kuala Selangor", "capacity": 350, "lat": 3.3512, "lng": 101.2468, "contact": "03-32891234"},
        {"name": "Dewan Orang Ramai Kuala Selangor",  "capacity": 400, "lat": 3.3445, "lng": 101.2389, "contact": "03-32895678"},
    ],
    "Sepang": [
        {"name": "Sekolah Kebangsaan Dengkil",   "capacity": 300, "lat": 2.7389, "lng": 101.7089, "contact": "03-87681234"},
        {"name": "Dewan Serbaguna MDSEP Sepang", "capacity": 500, "lat": 2.7241, "lng": 101.7213, "contact": "03-87065678"},
    ],
}

# ── Flood Type Classification ─────────────────────────────────────────────────
# Urban districts: flooding is primarily caused by heavy rainfall overwhelming
# drainage infrastructure (flash floods / banjir kilat). Rainfall rate is the
# leading indicator — river level is a lagging secondary signal.
#
# Rural/coastal districts: flooding is primarily caused by rivers exceeding their
# banks after sustained upstream rainfall. River level is the primary indicator.
URBAN_DISTRICTS = {
    # All KL/Selangor urban districts — flash flood risk (drainage-driven)
    "Klang", "Gombak", "Kepong", "Cheras",
    "Ampang", "Petaling Jaya", "Bangsar",
    "Subang Jaya", "Shah Alam",
}

# Flash flood rainfall thresholds — calibrated for KL/Selangor urban drainage reality.
# WeatherAPI returns accumulated mm per hour (hourly average rate).
# KL's ageing drainage network starts failing at much lower intensities than JPS rural gauges:
#   15mm/hr = moderate rain, surface pooling begins in low-lying streets
#   30mm/hr = heavy rain, JPS Alert Level 1, localised flash flooding expected
#   50mm/hr = very heavy, JPS Alert Level 2/3, widespread flash flood imminent
FLASH_FLOOD_THRESHOLDS = {"watch": 15.0, "warning": 30.0, "danger": 50.0}

# JPS river level alert thresholds (same for all overflow stations in KL/Selangor)
# Normal < 3.0m | Watch 3.0–4.5m | Warning 4.5–5.5m | Danger > 5.5m
RIVER_OVERFLOW_THRESHOLDS = {"watch": 3.0, "warning": 4.5, "danger": 5.5}

# GPS coordinates for each monitored district — used by WeatherAPI rainfall fetch
DISTRICT_COORDS = {
    # Urban flash flood zones — Klang Valley / KL
    "Klang":          (3.0449, 101.4468),
    "Gombak":         (3.2353, 101.7044),
    "Kepong":         (3.2119, 101.6293),
    "Cheras":         (3.0945, 101.7455),
    "Ampang":         (3.1478, 101.7618),
    "Petaling Jaya":  (3.1073, 101.6067),
    "Bangsar":        (3.1302, 101.6741),
    "Subang Jaya":    (3.0565, 101.5897),
    "Shah Alam":      (3.0733, 101.5185),
    # River overflow zones — Selangor
    "Kuala Selangor": (3.3474, 101.2442),
    "Sepang":         (2.7305, 101.7164),
}


def _compute_station_status(
    level: float, rainfall: float, district: str,
    forecast_2h: float = 0.0, rain_chance: int = 0,
) -> str:
    """
    Return JPS risk status for a single station using composite scoring.

    Flash flood (urban): rainfall is the primary trigger. forecast_2h + rain_chance
    amplify risk so that "light rain now, heavy storm incoming" is caught early.

    River overflow (rural): river level is primary. Rainfall + forecast accelerate risk.

    Composite score = current_rainfall + (forecast_2h * probability_weight)
    where probability_weight = rain_chance/100 capped at 0.8 (never fully trust forecast).
    """
    prob_weight = min(rain_chance / 100.0, 0.8) if rain_chance >= 40 else 0.0
    composite   = rainfall + forecast_2h * prob_weight

    if district in URBAN_DISTRICTS:
        # ── Flash flood — drainage-driven ──────────────────────────────────────
        # Hard DANGER: immediate extreme rainfall OR river already backed up
        if rainfall >= FLASH_FLOOD_THRESHOLDS["danger"] or level >= 5.5:
            return "DANGER"
        # Composite DANGER: moderate current + very heavy incoming
        if composite >= FLASH_FLOOD_THRESHOLDS["danger"] + 10:
            return "DANGER"

        # Hard WARNING: heavy current rain OR river elevated
        if rainfall >= FLASH_FLOOD_THRESHOLDS["warning"] or level >= 4.5:
            return "WARNING"
        # Composite WARNING: light/moderate current + heavy incoming
        if (composite >= FLASH_FLOOD_THRESHOLDS["warning"]
                or (rainfall >= 8 and forecast_2h >= 25 and rain_chance >= 60)
                or (level >= 3.5 and rainfall >= FLASH_FLOOD_THRESHOLDS["watch"])):
            return "WARNING"

        # Hard WATCH: moderate current rain OR river slightly elevated
        if rainfall >= FLASH_FLOOD_THRESHOLDS["watch"] or level >= 3.0:
            return "WATCH"
        # Composite WATCH: light rain + notable forecast
        if (rainfall >= 5 and forecast_2h >= 15 and rain_chance >= 60):
            return "WATCH"

        return "SAFE"

    else:
        # ── River overflow — level-driven ──────────────────────────────────────
        if (level >= RIVER_OVERFLOW_THRESHOLDS["danger"]
                or (level >= RIVER_OVERFLOW_THRESHOLDS["warning"] and rainfall >= 15)):
            return "DANGER"
        if (level >= RIVER_OVERFLOW_THRESHOLDS["warning"]
                or (level >= RIVER_OVERFLOW_THRESHOLDS["watch"] and rainfall >= 20)
                or (level >= 2.0 and composite >= FLASH_FLOOD_THRESHOLDS["warning"])):
            return "WARNING"
        if (level >= RIVER_OVERFLOW_THRESHOLDS["watch"]
                or (level >= 2.0 and rainfall >= 15 and rain_chance >= 60)):
            return "WATCH"
        return "SAFE"


# ── ML Model: Isolation Forest ────────────────────────────────────────────────
MODEL_PATH = Path("flood_model.pkl")
DATA_DIR   = Path("data")   # place real CSV files here before first run

# Column name aliases — handles both the Kaggle Malaysia Flood Dataset
# (rajatjurel) and direct JPS/publicinfobanjir CSV exports.
_LEVEL_ALIASES = ["river_level", "water_level", "level", "stage", "wl",
                  "aras_air", "gauge_height", "water level (m)", "level (m)"]
_RAIN_ALIASES  = ["rainfall_rate", "rainfall", "rain", "precip",
                  "precipitation", "rain_mm", "hujan", "rainfall (mm)",
                  "rain (mm/hr)", "rain (mm)"]
_DT_ALIASES    = ["datetime", "date_time", "timestamp", "date", "time",
                  "tarikh", "dt", "date/time"]


def _detect_column(df, aliases: list[str]) -> str | None:
    """Return the first df column that matches any alias (case-insensitive)."""
    normalised = {c.lower().strip().replace(" ", "_"): c for c in df.columns}
    for alias in aliases:
        key = alias.lower().strip().replace(" ", "_")
        if key in normalised:
            return normalised[key]
    return None


def _load_csv_data() -> np.ndarray | None:
    """
    Load real training data from backend/data/*.csv.

    Supports two dataset formats:
      1. Malaysia Flood Dataset 2000-2010 (Kaggle — rajatjurel)
         Typical columns: Year, Month, State, Max_River_Level, Total_Rainfall …
      2. JPS publicinfobanjir direct exports
         Typical columns: DateTime, Level (m), Rainfall (mm) …

    Returns float array of shape (N, 4): [river_level, rainfall_rate, hour, month]
    or None if no usable CSV is found.
    """
    try:
        import pandas as pd
    except ImportError:
        logger.error("[ML] pandas not installed — cannot load CSV data. Run: pip install pandas")
        return None

    if not DATA_DIR.exists():
        return None

    csv_files = list(DATA_DIR.glob("*.csv"))
    if not csv_files:
        return None

    frames = []
    for csv_path in csv_files:
        try:
            df = pd.read_csv(csv_path, low_memory=False)
            df.columns = df.columns.str.strip()
            logger.info(f"[ML] Reading {csv_path.name} — columns: {list(df.columns)}")

            level_col = _detect_column(df, _LEVEL_ALIASES)
            rain_col  = _detect_column(df, _RAIN_ALIASES)
            dt_col    = _detect_column(df, _DT_ALIASES)

            # Kaggle Malaysia Flood Dataset uses "Month" as a separate column
            month_col = next((c for c in df.columns if c.strip().lower() == "month"), None)

            if level_col is None and rain_col is None:
                logger.warning(f"[ML] {csv_path.name}: no level/rainfall columns found — skipping")
                continue

            row: dict = {}

            if level_col:
                df[level_col] = pd.to_numeric(df[level_col], errors="coerce")
                row["river_level"] = df[level_col]

            if rain_col:
                df[rain_col] = pd.to_numeric(df[rain_col], errors="coerce")
                row["rainfall_rate"] = df[rain_col]

            # Prefer explicit datetime column; fall back to separate Month column
            if dt_col:
                dt = pd.to_datetime(df[dt_col], errors="coerce")
                row["hour"]  = dt.dt.hour.fillna(12)
                row["month"] = dt.dt.month.fillna(6)
            elif month_col:
                row["month"] = pd.to_numeric(df[month_col], errors="coerce").fillna(6)
                row["hour"]  = 12  # daily/monthly data has no hour — use noon
            else:
                row["hour"]  = 12
                row["month"] = 6

            chunk = pd.DataFrame(row).dropna()

            # Fill any still-missing feature columns with safe defaults
            if "river_level" not in chunk.columns:
                chunk["river_level"] = 1.5
            if "rainfall_rate" not in chunk.columns:
                chunk["rainfall_rate"] = 5.0

            chunk = chunk[["river_level", "rainfall_rate", "hour", "month"]]

            # Drop physically impossible readings
            chunk = chunk[
                (chunk["river_level"] >= 0) & (chunk["river_level"] <= 20) &
                (chunk["rainfall_rate"] >= 0) & (chunk["rainfall_rate"] <= 500)
            ]

            if len(chunk) < 10:
                logger.warning(f"[ML] {csv_path.name}: only {len(chunk)} valid rows after filtering — skipping")
                continue

            frames.append(chunk.values.astype(float))
            logger.info(f"[ML] Loaded {len(chunk):,} rows from {csv_path.name}")

        except Exception as e:
            logger.warning(f"[ML] Failed to read {csv_path.name}: {e}")

    if not frames:
        return None

    combined = np.vstack(frames)
    logger.info(f"[ML] Total real training rows: {len(combined):,}")
    return combined


def _jps_threshold_baseline() -> np.ndarray:
    """
    Fallback training set of NORMAL (SAFE-band only) readings.

    Isolation Forest must be trained on NORMAL data only — not on labelled
    classes. The model learns what "normal" looks like; anything outside that
    distribution is flagged as anomalous.

    All readings are below the JPS SAFE threshold (< 3.0 m, < 20 mm/hr),
    derived from real reported ranges at Klang Valley telemetry stations.
    WATCH/WARNING/DANGER readings are NOT included here — they are what the
    model learns to detect as anomalies.

    Features: [river_level (m), rainfall_rate (mm/hr), hour_of_day, month]
    """
    rows = []

    # Concrete level-rainfall pairs representing normal KL river conditions.
    # Each pair appears for every hour and every month so the model learns the
    # full seasonal and diurnal normal range.
    normal_readings = [
        # (level_m, rain_mm_hr)  — all strictly below JPS SAFE threshold
        (0.5,  0.0), (0.6,  0.0), (0.7,  1.0), (0.8,  0.0), (0.9,  2.0),
        (1.0,  0.0), (1.1,  1.0), (1.2,  3.0), (1.3,  0.0), (1.4,  5.0),
        (1.5,  0.0), (1.6,  8.0), (1.7,  2.0), (1.8,  0.0), (1.9,  6.0),
        (2.0,  0.0), (2.1, 10.0), (2.2,  4.0), (2.3,  0.0), (2.4, 12.0),
        (2.5,  5.0), (2.6,  0.0), (2.7,  8.0), (2.8, 15.0), (2.9,  3.0),
        # Monsoon season — rivers run higher but still safe (Nov–Jan baseline)
        (1.8, 18.0), (2.0, 20.0), (2.2, 16.0), (2.4, 19.0), (2.6, 14.0),
        (2.7, 17.0), (2.9, 18.0),
    ]

    for level, rain in normal_readings:
        for hour in range(0, 24):          # every hour of day
            for month in range(1, 13):     # every month of year
                rows.append([level, rain, float(hour), float(month)])

    arr = np.array(rows, dtype=float)
    logger.info(f"[ML] JPS threshold baseline: {len(arr):,} normal-condition readings (SAFE-band only)")
    return arr


def load_or_train_model():
    """
    Model loading priority:
      1. flood_model.pkl already exists → load it (fastest startup)
      2. backend/data/*.csv present     → train on real data, save pkl
      3. No CSV                         → train on JPS threshold baseline, save pkl

    Delete flood_model.pkl to force a retrain after adding new CSV data.
    """
    if MODEL_PATH.exists():
        with open(MODEL_PATH, "rb") as f:
            model = pickle.load(f)
        logger.info("[ML] Loaded existing flood_model.pkl")
        return model

    from sklearn.ensemble import IsolationForest

    training_data = _load_csv_data()
    source = "real CSV data"

    if training_data is None or len(training_data) < 50:
        if training_data is not None:
            logger.warning(f"[ML] Only {len(training_data)} rows from CSV — falling back to JPS baseline")
        else:
            logger.warning("[ML] No CSV in backend/data/ — using JPS threshold baseline (add real data for production)")
        training_data = _jps_threshold_baseline()
        source = "JPS threshold baseline"

    # contamination=0.05: ~5% of readings expected to be anomalous in real-world data
    model = IsolationForest(n_estimators=200, contamination=0.05, random_state=42)
    model.fit(training_data)

    with open(MODEL_PATH, "wb") as f:
        pickle.dump(model, f)
    logger.info(f"[ML] Trained and saved flood_model.pkl — source: {source} ({len(training_data):,} rows)")
    return model


_ml_model = load_or_train_model()


def compute_anomaly_score(
    river_level: float,
    rainfall_rate: float,
    hour: int | None = None,
    month: int | None = None,
) -> tuple[float, bool]:
    """
    Run the Isolation Forest on a single reading.
    Returns (anomaly_score: 0.0-1.0, is_anomaly: bool).

    Uses decision_function (already offset-corrected by sklearn):
      df > 0  → inlier  (normal/SAFE)
      df < 0  → outlier (WATCH/WARNING/DANGER)

    Mapping to [0,1]:  anomaly_score = clip(0.7 - df * 5.0, 0, 1)
      df = +0.12  →  0.10  (clearly safe,   not flagged)
      df =  0.00  →  0.70  (at threshold,   boundary)
      df = -0.02  →  0.80  (anomalous,      flagged)
    Threshold 0.7 aligns exactly with the model's own decision boundary.
    """
    if hour is None:
        hour = datetime.now().hour
    if month is None:
        month = datetime.now().month

    features = np.array([[river_level, rainfall_rate, float(hour), float(month)]])
    # decision_function = score_samples - offset_  (positive = normal, negative = anomaly)
    df = float(_ml_model.decision_function(features)[0])
    anomaly_score = float(np.clip(0.7 - df * 5.0, 0.0, 1.0))
    return anomaly_score, anomaly_score > 0.7


# ── JPS Live Data Fetch ───────────────────────────────────────────────────────
_JPS_BASE = "https://info.water.gov.my/index.php/publicwebservices/getStation"


def _fetch_jps_wl() -> dict:
    """Fetch live water-level readings from JPS (Selangor). Returns {district: {level, station}}."""
    resp = requests.get(
        _JPS_BASE,
        params={"state": "Selangor", "district": "all", "type": "WL"},
        timeout=10,
    )
    resp.raise_for_status()
    wl: dict = {}
    for station in resp.json().get("data", []):
        district = station.get("district", "").strip()
        if not district:
            continue
        try:
            level = float(station.get("value", 0) or 0)
        except (TypeError, ValueError):
            continue
        # Keep the highest-level station per district
        if district not in wl or level > wl[district]["level"]:
            wl[district] = {"level": level, "station": station.get("stationname", district)}
    return wl


_RAINFALL_TTL        = 300  # 5-minute cache — WeatherAPI free tier: 1M calls/month
_RAINFALL_CACHE_FILE = Path(__file__).parent / "data" / "rainfall_cache.json"
_WEATHERAPI_KEY      = os.getenv("WEATHERAPI_KEY", "")


def _load_rainfall_file_cache() -> dict:
    try:
        if _RAINFALL_CACHE_FILE.exists():
            cached = json.loads(_RAINFALL_CACHE_FILE.read_text())
            if time.time() - cached.get("ts", 0) < _RAINFALL_TTL:
                data = cached.get("data", {})
                # Reject all-zero cache — it was written during an auth failure
                if data and any(v > 0 for v in data.values()):
                    age = int(time.time() - cached["ts"])
                    logger.info(f"[WeatherAPI] Restored cache from disk ({age}s old)")
                    return cached
                else:
                    logger.info("[WeatherAPI] Cached data is all-zero — forcing fresh fetch")
    except Exception:
        pass
    return {"data": {}, "ts": 0.0}


def _save_rainfall_file_cache(data: dict) -> None:
    try:
        _RAINFALL_CACHE_FILE.parent.mkdir(parents=True, exist_ok=True)
        _RAINFALL_CACHE_FILE.write_text(json.dumps({"data": data, "ts": time.time()}))
    except Exception as e:
        logger.warning(f"[WeatherAPI] Could not save cache: {e}")


_RAINFALL_CACHE: dict = _load_rainfall_file_cache()


def _fetch_one_district(district: str) -> tuple[str, dict]:
    """
    Fetch current + 2-hour forecast for one district via WeatherAPI forecast endpoint.
    Returns (district, {precip, condition, forecast_1h, forecast_2h, rain_chance_max})
    """
    lat, lng = DISTRICT_COORDS[district]
    resp = requests.get(
        "https://api.weatherapi.com/v1/forecast.json",
        params={"key": _WEATHERAPI_KEY, "q": f"{lat},{lng}", "days": 1, "aqi": "no"},
        timeout=10,
    )
    resp.raise_for_status()
    body = resp.json()

    cur       = body.get("current", {})
    precip    = float(cur.get("precip_mm", 0) or 0)
    condition = cur.get("condition", {}).get("text", "")

    # Extract the next 2 hourly slots from the forecast
    now_hour = datetime.now().hour
    hours    = body.get("forecast", {}).get("forecastday", [{}])[0].get("hour", [])
    upcoming = [h for h in hours if int(h.get("time", "00:00").split(" ")[1].split(":")[0]) > now_hour][:2]

    forecast_1h      = float(upcoming[0].get("precip_mm", 0)) if len(upcoming) > 0 else 0.0
    forecast_2h      = float(upcoming[1].get("precip_mm", 0)) if len(upcoming) > 1 else 0.0
    rain_chance_max  = max(
        int(upcoming[0].get("chance_of_rain", 0)) if len(upcoming) > 0 else 0,
        int(upcoming[1].get("chance_of_rain", 0)) if len(upcoming) > 1 else 0,
    )

    return district, {
        "precip":         precip,
        "condition":      condition,
        "forecast_1h":    forecast_1h,
        "forecast_2h":    forecast_2h,
        "rain_chance_max": rain_chance_max,
    }


def _fetch_weatherapi_rainfall() -> dict:
    """
    Fetch live precipitation (mm) for all districts in parallel via WeatherAPI.com.
    Fuses station obs + radar + model — accurately captures localized KL thunderstorms.
    Cached 5 min with file persistence across restarts.
    On failure, returns last cached data rather than inaccurate zeros.
    """
    global _RAINFALL_CACHE
    age = time.time() - _RAINFALL_CACHE["ts"]
    if _RAINFALL_CACHE["data"] and any(v.get("precip", 0) > 0 if isinstance(v, dict) else v > 0
                                       for v in _RAINFALL_CACHE["data"].values()) and age < _RAINFALL_TTL:
        logger.info(f"[WeatherAPI] Cache hit ({int(age)}s old)")
        return _RAINFALL_CACHE["data"]

    _EMPTY = {"precip": 0.0, "condition": "", "forecast_1h": 0.0, "forecast_2h": 0.0, "rain_chance_max": 0}
    try:
        result = {}
        with ThreadPoolExecutor(max_workers=10) as pool:
            futures = {pool.submit(_fetch_one_district, d): d for d in DISTRICT_COORDS}
            for future in as_completed(futures):
                try:
                    district, data = future.result()
                    result[district] = data
                except Exception as e:
                    district = futures[future]
                    logger.warning(f"[WeatherAPI] {district}: {e}")
                    prev = _RAINFALL_CACHE["data"].get(district, {})
                    result[district] = prev if isinstance(prev, dict) else _EMPTY.copy()
        nonzero = sum(1 for v in result.values() if v.get("precip", 0) > 0)
        logger.info(f"[WeatherAPI] Live data for {len(result)} districts ({nonzero} raining now)")
    except Exception as e:
        logger.error(f"[WeatherAPI] Fetch failed: {e} — serving stale cache")
        return _RAINFALL_CACHE["data"] or {d: _EMPTY.copy() for d in DISTRICT_COORDS}

    # Only persist to disk if at least one district has rainfall — avoids caching
    # a batch of zeros caused by an auth error, which would poison subsequent restarts.
    if any(v.get("precip", 0) > 0 for v in result.values()) or not _RAINFALL_CACHE["data"]:
        _RAINFALL_CACHE = {"data": result, "ts": time.time()}
        _save_rainfall_file_cache(result)
    else:
        # Don't reset the TTL for an all-zero result — retry next cycle
        _RAINFALL_CACHE["data"] = result

    return result


def fetch_jps_data() -> dict:
    """
    Fetch live data from two sources:
      - JPS WL API    → river_level for Selangor districts (live if reachable)
      - WeatherAPI.com → precipitation mm/hr for ALL districts (station + radar fusion)

    Merges both into the full JPS_FALLBACK structure so all 13 states are
    always present. Falls back gracefully if either source fails.
    """
    wl_data: dict = {}
    rf_data: dict = {}

    try:
        wl_data = _fetch_jps_wl()
        logger.info(f"[JPS-WL] Live river levels for {len(wl_data)} districts")
    except Exception as e:
        logger.warning(f"[JPS-WL] Unreachable ({e}) — using fallback levels")

    try:
        rf_data = _fetch_weatherapi_rainfall()
        logger.info(f"[WeatherAPI] Rainfall data for {len(rf_data)} districts")
    except Exception as e:
        logger.warning(f"[WeatherAPI] Unreachable ({e}) — using fallback rainfall")

    rng = np.random.default_rng(int(time.time()) % 10000)
    result: dict = {}

    for river, base in JPS_FALLBACK.items():
        district = base["district"]
        wl = wl_data.get(district)
        rf_entry = rf_data.get(district)
        if isinstance(rf_entry, dict):
            rf_precip       = rf_entry.get("precip", None)
            rf_condition    = rf_entry.get("condition", "")
            rf_forecast_1h  = rf_entry.get("forecast_1h", 0.0)
            rf_forecast_2h  = rf_entry.get("forecast_2h", 0.0)
            rf_chance_max   = rf_entry.get("rain_chance_max", 0)
        else:
            rf_precip = rf_entry
            rf_condition = rf_forecast_1h = rf_forecast_2h = ""
            rf_chance_max = 0

        if wl:
            level   = wl["level"]
            station = wl["station"]
        else:
            level   = round(float(base["level"]) + float(rng.uniform(-0.1, 0.2)), 2)
            station = base["station"]

        if rf_precip is not None:
            rainfall = rf_precip
        else:
            rainfall = round(max(0.0, float(base["rainfall"]) + float(rng.uniform(-2, 5))), 1)

        result[river] = {
            "level":          level,
            "rainfall":       rainfall,
            "condition":      rf_condition,
            "forecast_1h":    rf_forecast_1h,
            "forecast_2h":    rf_forecast_2h,
            "rain_chance_max": rf_chance_max,
            "district":       district,
            "station":        station,
            "live_wl":        wl is not None,
            "live_rainfall":  rf_precip is not None,
        }

    return result


# ── Claude AI Risk Classification ─────────────────────────────────────────────
def classify_risk_with_claude(readings: dict, anomaly_score: float) -> dict:
    """
    Send current river readings and ML anomaly score to Claude for structured
    risk classification. Falls back to rule-based assessment if API is unavailable.
    """
    if not _anthropic_client:
        return _rule_based_fallback(readings)

    readings_str = json.dumps(readings, indent=2)

    prompt = f"""You are a flood risk assessment agent for Malaysia. You understand two distinct flood types:

1. FLASH FLOOD (banjir kilat) — KL/Selangor urban districts (Klang, Gombak, Kepong, Cheras, Ampang, Petaling Jaya, Bangsar, Subang Jaya, Shah Alam)
   - Caused by heavy rainfall overwhelming KL's drainage infrastructure
   - Thresholds (hourly accumulated mm): Watch ≥15mm/hr | Warning ≥30mm/hr | Danger ≥50mm/hr
   - Use composite score: if current rain is moderate (≥5mm) AND forecast_2h shows heavy incoming (≥25mm), raise risk proactively
   - River level is a secondary lagging indicator

2. RIVER OVERFLOW FLOOD — Selangor rural zones (Kuala Selangor, Sepang)
   - Caused by rivers exceeding banks after sustained upstream rainfall
   - Primary trigger: JPS river level — Watch ≥3.0m | Warning ≥4.5m | Danger ≥5.5m
   - Rainfall + forecast accelerate river rise but level is the key metric

Current readings (includes live rainfall + 2-hour forecast per district): {readings_str}
ML anomaly score: {anomaly_score:.3f}

Rules:
- For FLASH FLOOD districts: base reasoning on rainfall AND forecast_1h/forecast_2h. If forecast shows significantly more rain incoming (e.g. >15mm in next 2h), raise risk proactively.
- For RIVER OVERFLOW districts: base reasoning on river level vs JPS thresholds. Forecast rain accelerates river rise.
- Use forecast_1h, forecast_2h, and rain_chance_max to decide if risk is RISING even if current rain is low.
- reasoning must clearly state the flood type, primary metric, AND whether risk is current or forecast-driven.

Respond ONLY in this exact JSON format:
{{
  "risk_level": "SAFE|WATCH|WARNING|DANGER",
  "affected_districts": ["list of districts"],
  "estimated_time_to_critical": "X hours or N/A",
  "confidence": 0.0-1.0,
  "recommended_action": "one clear action for residents",
  "reasoning": "2-3 sentences giving an overall situational summary for the government operations centre. List EVERY district currently at WARNING or DANGER level by name, their flood type (flash flood / river overflow), and their key metric (e.g. 58mm/hr rainfall or 5.2m river level). If no districts are at WARNING or DANGER, summarise the watch-level districts or state that all monitored areas are currently safe. End with whether the overall situation is stable, escalating, or easing."
}}"""

    try:
        message = _anthropic_client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=768,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = message.content[0].text.strip()
        match = re.search(r"\{.*\}", raw, re.DOTALL)
        if match:
            return json.loads(match.group(0))
    except Exception as e:
        logger.error(f"[Claude] API call failed: {e}")

    return _rule_based_fallback(readings)


def _rule_based_fallback(readings: dict) -> dict:
    """
    Flood-type-aware fallback used when Claude is unavailable.
    Urban districts trigger on rainfall (flash flood); rural on river level (overflow).
    """
    risk_order = {"SAFE": 0, "WATCH": 1, "WARNING": 2, "DANGER": 3}
    worst_risk = "SAFE"
    affected = []

    for v in readings.values():
        level = v.get("level", 0.0)
        rainfall = v.get("rainfall", 0.0)
        district = v.get("district", "")
        station_risk = _compute_station_status(level, rainfall, district)
        if risk_order[station_risk] > risk_order[worst_risk]:
            worst_risk = station_risk
        if risk_order[station_risk] >= risk_order["WATCH"]:
            affected.append(district)

    flood_type_note = ""
    if any(v.get("district", "") in URBAN_DISTRICTS for v in readings.values()):
        flood_type_note = " Urban districts assessed for flash flood risk (rainfall-driven)."

    actions = {
        "DANGER":  "Evacuate immediately to the nearest relief centre. Do not wait.",
        "WARNING": "Prepare your go-bag, move valuables to higher ground, and monitor alerts closely.",
        "WATCH":   "Monitor water levels closely and stay informed via official channels.",
        "SAFE":    "No action required. Conditions are within normal range.",
    }

    return {
        "risk_level": worst_risk,
        "affected_districts": list(set(affected)),
        "estimated_time_to_critical": "N/A",
        "confidence": 0.75,
        "recommended_action": actions[worst_risk],
        "reasoning": f"Rule-based assessment using JPS thresholds and flood-type classification.{flood_type_note}",
    }


# ── In-memory State ───────────────────────────────────────────────────────────
_active_alerts:   list = []
_latest_readings: dict = {}
_demo_expiry:     float = 0.0   # epoch time after which demo-injected readings are cleared
_agent_comms:     list = []   # rolling log of inter-agent messages for dashboard
_push_tokens:     list = []   # Expo push tokens registered by citizen app users
_latest_storm_warnings: list = []  # most recent ForecastAgent storm cell warnings


def _agent_msg(from_agent: str, to_agent: str, summary: str, payload: dict = None) -> dict:
    """Record a message passed between agents and return it."""
    msg = {
        "from":      from_agent,
        "to":        to_agent,
        "timestamp": datetime.now().strftime("%H:%M:%S"),
        "summary":   summary,
        "payload":   payload or {},
    }
    _agent_comms.insert(0, msg)
    if len(_agent_comms) > 50:
        _agent_comms.pop()
    logger.info(f"[{from_agent}→{to_agent}] {summary}")
    return msg


# ── Firestore Persistence ─────────────────────────────────────────────────────
def _persist_alert(alert: dict) -> None:
    """Write a WARNING or DANGER alert to Firestore for cross-device delivery."""
    if not (_firebase_initialized and _firestore_db):
        logger.warning("[Firestore] Not initialized — alert stored in memory only")
        return
    try:
        _firestore_db.collection("flood_alerts").document(alert["id"]).set(alert)
        logger.info(f"[Firestore] Alert {alert['id']} persisted")
    except Exception as e:
        logger.error(f"[Firestore] Write failed: {e}")


# ── Multi-Agent Pipeline ──────────────────────────────────────────────────────
#
#  DataAgent ──► AnalysisAgent ──► DecisionAgent ──► ActionAgent
#
#  Each agent does one job, passes a structured message to the next.
#  All messages are logged to _agent_comms for the government dashboard.
# ─────────────────────────────────────────────────────────────────────────────

def _send_push_notifications(risk: str, affected: list, action: str) -> None:
    """Send Expo push notifications to all registered citizen devices."""
    if not _push_tokens or risk not in ("WARNING", "DANGER"):
        return
    icon  = "🚨" if risk == "DANGER" else "⚠️"
    areas = ", ".join(affected[:3]) + (" + more" if len(affected) > 3 else "")
    msgs  = [{"to": t, "title": f"{icon} FloodSense {risk} — {areas}",
               "body": action, "sound": "default", "priority": "high",
               "data": {"risk_level": risk, "districts": affected}}
             for t in _push_tokens]
    try:
        for i in range(0, len(msgs), 100):
            requests.post("https://exp.host/--/api/v2/push/send",
                          json=msgs[i:i+100], timeout=10)
        logger.info(f"[Push] Sent {len(msgs)} notifications — {risk}")
    except Exception as e:
        logger.warning(f"[Push] Failed: {e}")


def _data_agent() -> dict:
    """
    DataAgent — COLLECT
    Specialist: live data ingestion for KL/Selangor.
    Pulls current rainfall + 2h forecast from WeatherAPI and river levels from JPS WL API.
    Packages everything into a unified readings dict for the ForecastAgent.
    """
    readings = fetch_jps_data()
    raining  = sum(1 for v in readings.values() if v.get("rainfall", 0) > 0)
    elevated = sum(1 for v in readings.values() if v.get("level", 0) > 3.0)
    all_rf   = [v.get("rainfall", 0) for v in readings.values()]
    avg_rf   = round(sum(all_rf) / len(all_rf), 1) if all_rf else 0.0
    _agent_msg(
        "DataAgent", "ForecastAgent",
        f"Ingested {len(readings)} KL/Selangor districts — {raining} currently raining, {elevated} with elevated river levels",
        {"districts_collected": len(readings), "raining_now": raining,
         "elevated_rivers": elevated, "avg_rainfall": avg_rf},
    )
    return readings


def _forecast_agent(readings: dict) -> dict:
    """
    ForecastAgent — PREDICT
    Specialist: storm trajectory and arrival time estimation.
    Analyses WeatherAPI 2h forecast per district to detect incoming storm cells
    before they hit. Flags districts where forecast rain significantly exceeds
    current conditions — giving 1–2 hour advance warning.
    """
    global _latest_storm_warnings
    storm_warnings = []
    max_incoming   = 0.0

    for river, data in readings.items():
        district    = data.get("district", "")
        current_rf  = data.get("rainfall", 0.0)
        forecast_1h = data.get("forecast_1h", 0.0)
        forecast_2h = data.get("forecast_2h", 0.0)
        chance      = data.get("rain_chance_max", 0)
        peak        = max(forecast_1h, forecast_2h)

        if peak > max_incoming:
            max_incoming = peak

        # Flag districts where a significant storm is building
        if peak > 10.0 and peak > current_rf * 1.5 and chance >= 60:
            eta_h = 1 if forecast_1h >= forecast_2h else 2
            storm_warnings.append({
                "district":   district,
                "current_mm": round(current_rf, 1),
                "peak_mm":    round(peak, 1),
                "eta_hours":  eta_h,
                "chance_pct": chance,
            })

    if storm_warnings:
        districts_str = ", ".join(f"{w['district']} ({w['peak_mm']}mm in {w['eta_hours']}h)" for w in storm_warnings)
        _agent_msg(
            "ForecastAgent", "AnalysisAgent",
            f"Storm cells detected approaching {len(storm_warnings)} district(s): {districts_str}",
            {"storm_warnings": len(storm_warnings), "max_incoming_mm": round(max_incoming, 1)},
        )
    else:
        _agent_msg(
            "ForecastAgent", "AnalysisAgent",
            f"No significant incoming storms detected. Max 2h forecast: {max_incoming:.1f}mm across KL/Selangor.",
            {"storm_warnings": 0, "max_incoming_mm": round(max_incoming, 1)},
        )

    _latest_storm_warnings = storm_warnings
    return {**readings, "__forecast_warnings": storm_warnings, "__max_incoming": max_incoming}


def _analysis_agent(readings: dict) -> dict:
    """
    AnalysisAgent — DETECT ANOMALIES
    Specialist: Isolation Forest ML model for statistical anomaly detection.
    Scores every KL/Selangor station against historical JPS baselines.
    Combines ML score with ForecastAgent storm warnings to decide if Claude is needed.
    """
    forecast_warnings = readings.pop("__forecast_warnings", [])
    max_incoming      = readings.pop("__max_incoming", 0.0)

    now    = datetime.now()
    scored = {}
    for river, data in readings.items():
        score, _ = compute_anomaly_score(
            data.get("level", 0), data.get("rainfall", 0), now.hour, now.month
        )
        scored[river] = {**data, "anomaly_score": round(score, 3)}

    max_score    = max((v["anomaly_score"] for v in scored.values()), default=0.0)
    flagged      = [v["district"] for v in scored.values() if v["anomaly_score"] > 0.5]
    # Escalate to Claude if ML detects anomaly OR ForecastAgent flagged incoming storms
    needs_claude = max_score > 0.7 or len(forecast_warnings) > 0

    reason = []
    if max_score > 0.7:   reason.append(f"ML anomaly {max_score:.3f}")
    if forecast_warnings: reason.append(f"{len(forecast_warnings)} storm(s) incoming")
    reason_str = " + ".join(reason) if reason else "conditions normal"

    _agent_msg(
        "AnalysisAgent", "DecisionAgent",
        f"Score: {max_score:.3f} | {reason_str} — {'⚠ Escalating to Claude AI' if needs_claude else 'Rule-based sufficient'}",
        {"max_anomaly": round(max_score, 3), "flagged_districts": flagged,
         "invoke_claude": needs_claude, "storm_warnings": forecast_warnings},
    )
    return {"readings": scored, "max_anomaly": max_score, "flagged": flagged,
            "invoke_claude": needs_claude, "storm_warnings": forecast_warnings}


def _decision_agent(analysis: dict) -> dict:
    """
    DecisionAgent — CLASSIFY RISK
    Uses Claude AI (when anomaly is high) or rule-based logic to produce a
    structured risk assessment with reasoning the public and government can act on.
    """
    readings     = analysis["readings"]
    max_anomaly  = analysis["max_anomaly"]
    invoke_claude = analysis["invoke_claude"]

    if invoke_claude:
        assessment = classify_risk_with_claude(readings, max_anomaly)
        method = "Claude AI"
    else:
        assessment = _rule_based_fallback(readings)
        method = "Rule-based"

    risk = assessment.get("risk_level", "SAFE")
    _agent_msg(
        "DecisionAgent", "ActionAgent",
        f"[{method}] Decision: {risk} — {assessment.get('reasoning', '')[:120]}",
        {
            "method": method,
            "risk_level": risk,
            "affected_districts": assessment.get("affected_districts", []),
            "confidence": assessment.get("confidence", 0),
            "reasoning": assessment.get("reasoning", ""),
        },
    )
    return {**assessment, "readings": readings, "max_anomaly": max_anomaly}


def _action_agent(decision: dict) -> None:
    """
    ActionAgent — ACT
    Persists alerts, updates the global readings state, and logs the outcome.
    In production this would also trigger push notifications and SMS.
    """
    global _latest_readings, _active_alerts, _demo_expiry

    risk     = decision.get("risk_level", "SAFE")
    readings = decision.pop("readings", {})
    # Only overwrite if the demo spike has expired; otherwise keep injected data
    if time.time() >= _demo_expiry:
        _latest_readings = readings
        _demo_expiry = 0.0

    alert = {
        "id":                       f"alert_{int(datetime.now().timestamp())}",
        "timestamp":                datetime.now().isoformat(),
        "risk_level":               risk,
        "affected_districts":       decision.get("affected_districts", []),
        "confidence":               decision.get("confidence", 0.0),
        "recommended_action":       decision.get("recommended_action", ""),
        "estimated_time_to_critical": decision.get("estimated_time_to_critical", "N/A"),
        "reasoning":                decision.get("reasoning", ""),
        "anomaly_score":            round(decision.get("max_anomaly", 0), 3),
        "readings":                 readings,
    }

    if risk in ("WARNING", "DANGER"):
        _persist_alert(alert)

    _active_alerts.insert(0, alert)
    _active_alerts = _active_alerts[:20]

    actions_taken = ["Alert stored"]
    if risk in ("WARNING", "DANGER"):
        _persist_alert(alert)
        actions_taken.append("Firestore write triggered")
        affected  = decision.get("affected_districts", [])
        action_msg = decision.get("recommended_action", "")
        _send_push_notifications(risk, affected, action_msg)
        actions_taken.append(f"Push sent to {len(_push_tokens)} devices")

    _agent_msg(
        "ActionAgent", "Dashboard",
        f"Cycle complete — {risk}. Actions: {', '.join(actions_taken)}",
        {"risk_level": risk, "alert_id": alert["id"], "actions": actions_taken,
         "push_recipients": len(_push_tokens)},
    )


def run_flood_agent() -> None:
    """
    Orchestrates the 5-agent pipeline:
    DataAgent → ForecastAgent → AnalysisAgent → DecisionAgent → ActionAgent
    """
    logger.info("[Pipeline] ── Starting KL/Selangor flood assessment cycle ──")
    try:
        raw        = _data_agent()
        forecasted = _forecast_agent(raw)
        analysis   = _analysis_agent(forecasted)
        decision   = _decision_agent(analysis)
        _action_agent(decision)
    except Exception as e:
        logger.error(f"[Pipeline] Cycle failed: {e}")


# ── APScheduler: 60-second Background Loop ────────────────────────────────────
_scheduler = BackgroundScheduler(daemon=True)
_scheduler.add_job(run_flood_agent, "interval", seconds=60, id="flood_agent")

# Flask debug mode runs two processes (parent reloader + child worker).
# Only start the scheduler in the child (WERKZEUG_RUN_MAIN=true) or in production.
if not app.debug or os.environ.get("WERKZEUG_RUN_MAIN") == "true":
    _scheduler.start()
    logger.info("[Scheduler] Started in process %s", os.getpid())
    run_flood_agent()  # initial cycle so the app isn't empty on first request


# ── API Endpoints ─────────────────────────────────────────────────────────────

@app.route("/api/flood/levels", methods=["GET"])
def get_flood_levels():
    """
    GET /api/flood/levels
    Returns current JPS readings for all monitored rivers with colour-coded risk status.
    """
    readings = _latest_readings if _latest_readings else fetch_jps_data()
    result = []

    STATUS_COLORS = {"DANGER": "#DC2626", "WARNING": "#D97706", "WATCH": "#EAB308", "SAFE": "#16A34A"}

    for river, data in readings.items():
        level    = data.get("level", 0.0)
        rainfall = data.get("rainfall", 0.0)
        district = data.get("district", "")

        forecast_1h = data.get("forecast_1h", 0.0)
        forecast_2h = data.get("forecast_2h", 0.0)
        chance_max  = data.get("rain_chance_max", 0)

        status     = _compute_station_status(level, rainfall, district, forecast_2h, chance_max)
        color      = STATUS_COLORS[status]
        flood_type = "flash_flood" if district in URBAN_DISTRICTS else "river_overflow"

        # Rain trend for UI badge: compare peak forecast to current
        peak_forecast = max(forecast_1h, forecast_2h)
        if peak_forecast > max(rainfall * 1.5, 2.0):
            trend = "rising"
        elif peak_forecast < rainfall * 0.5 and rainfall > 1.0:
            trend = "easing"
        else:
            trend = "stable"

        result.append({
            "river":           river,
            "district":        data.get("district", "Unknown"),
            "station":         data.get("station", ""),
            "condition":       data.get("condition", ""),
            "forecast_1h":     forecast_1h,
            "forecast_2h":     forecast_2h,
            "rain_chance_max": chance_max,
            "trend":           trend,
            "river_level":     level,
            "rainfall_rate":   rainfall,
            "status":          status,
            "color":           color,
            "flood_type":      flood_type,
            "last_updated":    datetime.now().isoformat(),
        })

    return jsonify({"success": True, "data": result})


@app.route("/api/flood/analyze", methods=["POST"])
def analyze_flood():
    """
    POST /api/flood/analyze
    Run ML + Claude on provided readings (or latest cached readings).
    Body: { "readings": { ... } }  (optional — uses latest if omitted)
    """
    data = request.get_json() or {}
    readings = data.get("readings") or _latest_readings

    if not readings:
        return jsonify({"error": "No readings available — please provide readings or wait for the agent to run"}), 400

    now = datetime.now()
    scores = [
        compute_anomaly_score(
            v.get("level", 0),
            v.get("rainfall", 0),
            now.hour,
            now.month,
        )[0]
        for v in readings.values()
    ]
    max_anomaly = max(scores) if scores else 0.0
    assessment = classify_risk_with_claude(readings, max_anomaly)

    return jsonify({
        "success": True,
        "anomaly_score": round(max_anomaly, 3),
        "is_anomaly": max_anomaly > 0.7,
        "assessment": assessment,
    })


@app.route("/api/flood/alerts", methods=["GET"])
def get_alerts():
    """
    GET /api/flood/alerts
    Returns the 20 most recent alert events.
    Reads from Firestore when available; falls back to in-memory store.
    """
    alerts: list = []

    if _firebase_initialized and _firestore_db and firestore:
        try:
            docs = (
                _firestore_db.collection("flood_alerts")
                .order_by("timestamp", direction=firestore.Query.DESCENDING)
                .limit(20)
                .stream()
            )
            alerts = [doc.to_dict() for doc in docs]
            logger.info(f"[Alerts] Returned {len(alerts)} alerts from Firestore")
        except Exception as e:
            logger.error(f"[Firestore] Read failed: {e}")

    if not alerts:
        alerts = _active_alerts

    return jsonify({"success": True, "data": alerts, "count": len(alerts)})


@app.route("/api/flood/evacuate", methods=["GET"])
def get_evacuation_centers():
    """
    GET /api/flood/evacuate?district=Klang
    Returns nearest evacuation centres.
    Omit district param to get all centres across every district.
    """
    district = request.args.get("district", "").strip()

    if district and district in EVACUATION_CENTERS:
        centers = [{"district": district, **c} for c in EVACUATION_CENTERS[district]]
    else:
        centers = [
            {"district": dist, **center}
            for dist, clist in EVACUATION_CENTERS.items()
            for center in clist
        ]

    return jsonify({"success": True, "district": district or "all", "data": centers})


# Demo scenario presets — biased toward visible alerts so demos are interesting
_DEMO_SCENARIOS = [
    # (label, rainfall_range, level_range, forecast_mult_range, chance_range)
    ("WATCH",   (12.0, 20.0), (2.8, 3.4), (1.2, 1.8), (55, 70)),
    ("WARNING", (28.0, 42.0), (3.8, 4.8), (1.0, 1.5), (65, 85)),
    ("DANGER",  (48.0, 68.0), (5.0, 6.2), (0.7, 1.2), (75, 95)),
]
_DEMO_CONDITIONS = [
    "Heavy thunderstorm", "Torrential downpour", "Severe thunderstorm",
    "Heavy rain", "Extreme rainfall", "Intense shower",
]


def _random_demo_readings(district: str = None, scenario: str = None) -> tuple[str, str, dict]:
    """
    Generate a randomised flood spike for demo purposes.
    district — pin to a specific district, or None to pick randomly.
    scenario — pin severity label (WATCH/WARNING/DANGER), or None to pick randomly.
    Returns (district, river_name, spike_data_dict, scenario_label).
    """
    import random

    all_districts = list(DISTRICT_COORDS.keys())
    if not district or district not in all_districts:
        district = random.choice(all_districts)
    is_urban = district in URBAN_DISTRICTS

    # Pin scenario if requested; otherwise weight toward WARNING/DANGER for interesting demos
    if scenario and scenario.upper() in ("WATCH", "WARNING", "DANGER"):
        preset = next((s for s in _DEMO_SCENARIOS if s[0] == scenario.upper()), None)
        scenario_label, rf_range, lvl_range, fcst_mult_range, chance_range = preset or _DEMO_SCENARIOS[1]
    else:
        scenario_label, rf_range, lvl_range, fcst_mult_range, chance_range = random.choices(
            _DEMO_SCENARIOS, weights=[1, 2, 2], k=1
        )[0]

    rainfall    = round(random.uniform(*rf_range), 1)
    river_level = round(random.uniform(*lvl_range), 2)

    # Forecast: either escalating or slightly declining from current
    fcst_mult   = random.uniform(*fcst_mult_range)
    forecast_1h = round(rainfall * fcst_mult * random.uniform(0.6, 1.0), 1)
    forecast_2h = round(rainfall * fcst_mult * random.uniform(0.8, 1.2), 1)
    rain_chance = random.randint(*chance_range)
    condition   = random.choice(_DEMO_CONDITIONS)

    river_name = next(
        (r for r, d in JPS_FALLBACK.items() if d.get("district") == district),
        f"Sungai {district}",
    )

    spike = {
        "level":           river_level,
        "rainfall":        rainfall,
        "district":        district,
        "station":         f"{district} [Demo]",
        "condition":       condition,
        "forecast_1h":     forecast_1h,
        "forecast_2h":     forecast_2h,
        "rain_chance_max": rain_chance,
    }
    return district, river_name, spike, scenario_label


@app.route("/api/demo/inject", methods=["POST"])
@limiter.limit("10 per hour")
def demo_inject():
    """
    POST /api/demo/inject
    Bypass the 60-second scheduler to simulate a flood spike immediately.
    Pass an empty body {} (or omit body) to get a fully randomised spike.
    Or supply { "district", "river_level", "rainfall_rate" } to pin values.
    """
    if not _require_dashboard_key():
        return jsonify({"error": "unauthorized", "message": "Valid X-Dashboard-Key header required"}), 401

    global _latest_readings, _active_alerts

    data = request.get_json(silent=True) or {}

    # Full manual override — all three fields supplied
    if data.get("district") and data.get("river_level") is not None and data.get("rainfall_rate") is not None:
        district      = data["district"]
        river_level   = float(data["river_level"])
        rainfall_rate = float(data["rainfall_rate"])
        river_name    = next(
            (r for r, d in JPS_FALLBACK.items() if d.get("district") == district),
            f"Sungai {district}",
        )
        spike = {
            "level": river_level, "rainfall": rainfall_rate,
            "district": district, "station": f"{district} (Demo)",
            "forecast_1h": 0.0, "forecast_2h": 0.0, "rain_chance_max": 0,
        }
        scenario_label = "MANUAL"
    else:
        # District and/or scenario can be pinned; missing ones are randomised
        pin_district = data.get("district") or None
        pin_scenario = data.get("scenario") or None
        district, river_name, spike, scenario_label = _random_demo_readings(pin_district, pin_scenario)
        river_level   = spike["level"]
        rainfall_rate = spike["rainfall"]

    global _demo_expiry
    injected_readings = dict(_latest_readings) if _latest_readings else {}
    for r, d in JPS_FALLBACK.items():
        if r not in injected_readings:
            injected_readings[r] = dict(d)
    injected_readings[river_name] = spike
    _latest_readings = injected_readings
    _demo_expiry = time.time() + 180  # spike visible for 3 minutes then auto-clears

    now = datetime.now()
    anomaly_score, _ = compute_anomaly_score(river_level, rainfall_rate, now.hour, now.month)
    assessment = classify_risk_with_claude(injected_readings, anomaly_score)
    risk = assessment.get("risk_level", "SAFE")

    alert = {
        "id":                         f"demo_{int(now.timestamp())}",
        "timestamp":                  now.isoformat(),
        "risk_level":                 risk,
        "affected_districts":         assessment.get("affected_districts", [district]),
        "confidence":                 assessment.get("confidence", 0.0),
        "recommended_action":         assessment.get("recommended_action", ""),
        "estimated_time_to_critical": assessment.get("estimated_time_to_critical", "N/A"),
        "reasoning":                  assessment.get("reasoning", ""),
        "anomaly_score":              round(anomaly_score, 3),
        "demo":                       True,
        "demo_scenario":              scenario_label,
        "injected_district":          district,
        "injected_rainfall":          rainfall_rate,
        "injected_level":             river_level,
    }

    if risk in ("WARNING", "DANGER"):
        _persist_alert(alert)
        _send_push_notifications(
            risk,
            assessment.get("affected_districts", [district]),
            assessment.get("recommended_action", f"Demo {scenario_label} alert for {district}"),
        )

    _active_alerts.insert(0, alert)
    _active_alerts = _active_alerts[:20]

    return jsonify({
        "success":        True,
        "message":        f"Demo [{scenario_label}] injected — {district} ({rainfall_rate}mm/hr, {river_level}m)",
        "scenario":       scenario_label,
        "district":       district,
        "rainfall_rate":  rainfall_rate,
        "river_level":    river_level,
        "anomaly_score":  round(anomaly_score, 3),
        "assessment":     assessment,
    })


def _nearest_district_from_coords(lat: float, lng: float) -> str | None:
    """Return the monitored district whose centroid is closest to the given GPS point."""
    best, best_dist = None, float("inf")
    for district, (dlat, dlng) in DISTRICT_COORDS.items():
        dist = ((dlat - lat) ** 2 + (dlng - lng) ** 2) ** 0.5
        if dist < best_dist:
            best_dist = dist
            best = district
    return best


def _district_status(district: str) -> str:
    """Return the current flood status for a district using the latest readings."""
    for data in _latest_readings.values():
        if data.get("district") == district:
            return _compute_station_status(
                data.get("level", 0.0), data.get("rainfall", 0.0), district,
                data.get("forecast_2h", 0.0), data.get("rain_chance_max", 0),
            )
    return None  # unknown — no reading available yet


@app.route("/api/rescue/request", methods=["POST"])
@limiter.limit("5 per hour")
def rescue_request():
    """
    POST /api/rescue/request
    Log a rescue coordination request from a citizen in distress.
    Body: { "district": "Klang", "situation": "Stranded", "people_count": 3, "notes": "..." }

    Gate: only accepts submissions from districts that are WATCH / WARNING / DANGER.
    If GPS coords are supplied, the nearest monitored district overrides the
    user-supplied district name for the status check (GPS is harder to fake).
    """
    data = request.get_json() or {}
    district   = data.get("district", "Unknown")
    situation  = data.get("situation", "Stranded")
    people     = int(data.get("people_count", 1))
    notes      = data.get("notes", "")
    latitude   = data.get("latitude")
    longitude  = data.get("longitude")

    # ── Zone-gate: derive authoritative district ──────────────────────────────
    # If GPS is available use it as the ground truth district for the status
    # check — much harder to spoof than a dropdown selection.
    check_district = district
    gps_district   = None
    if latitude is not None and longitude is not None:
        gps_district = _nearest_district_from_coords(float(latitude), float(longitude))
        if gps_district:
            check_district = gps_district

    # Only block when we actually have live readings; skip gate on cold start
    if _latest_readings:
        status = _district_status(check_district)
        if status == "SAFE":
            area_label = f"{check_district} (GPS-verified)" if gps_district else check_district
            logger.warning(f"[Rescue] SOS blocked — {area_label} is SAFE")
            return jsonify({
                "error":           "sos_blocked",
                "district":        check_district,
                "district_status": "SAFE",
                "message":         (
                    f"{area_label} is currently SAFE — no active flood risk detected. "
                    "SOS submissions are only accepted from WATCH, WARNING, or DANGER zones."
                ),
            }), 403

    # ── Accept the case ────────────────────────────────────────────────────────
    now     = datetime.now()
    case_id = f"SOS-{now.strftime('%d%m%H%M')}-{district[:3].upper()}"

    maps_link = None
    if latitude is not None and longitude is not None:
        maps_link = f"https://maps.google.com/maps?q={latitude},{longitude}&z=17"

    rescue_doc = {
        "case_id":      case_id,
        "district":     district,
        "gps_district": gps_district,
        "situation":    situation,
        "people_count": people,
        "notes":        notes,
        "latitude":     latitude,
        "longitude":    longitude,
        "maps_link":    maps_link,
        "timestamp":    now.isoformat(),
        "status":       "received",
    }

    _rescue_cases.append(rescue_doc)

    if _firebase_initialized and _firestore_db:
        try:
            _firestore_db.collection("rescue_requests").document(case_id).set(rescue_doc)
            logger.info(f"[Rescue] Case {case_id} saved to Firestore")
        except Exception as e:
            logger.error(f"[Rescue] Firestore write failed: {e}")
    else:
        logger.info(f"[Rescue] Case {case_id} logged in memory")

    centres = EVACUATION_CENTERS.get(district, [])
    nearest = centres[0] if centres else None

    return jsonify({
        "success":        True,
        "case_id":        case_id,
        "message":        f"Rescue request received. Case ID: {case_id}. Authorities have been notified.",
        "nearest_centre": nearest,
        "maps_link":      maps_link,
        "emergency_contacts": {
            "police_ambulance": "999",
            "bomba":            "994",
            "jkm":              "03-8064 2400",
            "nadma":            "03-8064 2400",
        },
    })


# In-memory store for rescue cases (Firestore is primary if available)
_rescue_cases: list = []

@app.route("/api/rescue/cases", methods=["GET"])
def get_rescue_cases():
    """
    GET /api/rescue/cases
    Returns all active rescue requests for the rescuer dashboard.
    Pulls from Firestore if available, falls back to in-memory list.
    """
    if _firebase_initialized and _firestore_db:
        try:
            docs = _firestore_db.collection("rescue_requests") \
                .order_by("timestamp", direction="DESCENDING") \
                .limit(50) \
                .stream()
            cases = [doc.to_dict() for doc in docs]
            return jsonify({"cases": cases})
        except Exception as e:
            logger.error(f"[Rescue] Firestore read failed: {e}")

    return jsonify({"cases": _rescue_cases[-50:]})


@app.route("/api/push/register", methods=["POST"])
@limiter.limit("20 per hour")
def register_push_token():
    """POST /api/push/register — Store an Expo push token from the citizen app."""
    token = (request.json or {}).get("token", "").strip()
    if not token:
        return jsonify({"error": "token required"}), 400
    if token not in _push_tokens:
        _push_tokens.append(token)
        logger.info(f"[Push] Registered token — total: {len(_push_tokens)}")
    return jsonify({"success": True, "registered": len(_push_tokens)})


@app.route("/api/rescue/dispatch/<case_id>", methods=["POST"])
def dispatch_rescue(case_id):
    """POST /api/rescue/dispatch/<case_id> — Government marks a case as help dispatched."""
    body = request.json or {}
    for case in _rescue_cases:
        if case.get("id") == case_id or case.get("case_id") == case_id:
            case["status"]        = "dispatched"
            case["dispatched"]    = True
            case["dispatched_at"] = datetime.now().isoformat()
            case["team"]          = body.get("team", "Operations Centre")
            case["notes"]         = body.get("notes", "")
            if _firebase_initialized and _firestore_db:
                try:
                    _firestore_db.collection("rescue_requests").document(case_id).update({
                        "status": "dispatched", "team": case["team"],
                        "dispatched_at": case["dispatched_at"],
                    })
                except Exception:
                    pass
            return jsonify({"success": True, "case": case})
    return jsonify({"error": "Case not found"}), 404


@app.route("/api/rescue/resolve/<case_id>", methods=["POST"])
def resolve_rescue(case_id):
    """POST /api/rescue/resolve/<case_id> — Government marks a rescued case as resolved."""
    body = request.json or {}
    for case in _rescue_cases:
        if case.get("id") == case_id or case.get("case_id") == case_id:
            case["status"]      = "resolved"
            case["resolved_at"] = datetime.now().isoformat()
            case["resolved_by"] = body.get("officer", "Operations Centre")
            case["outcome"]     = body.get("outcome", "Rescued successfully")
            if _firebase_initialized and _firestore_db:
                try:
                    _firestore_db.collection("rescue_requests").document(case_id).update({
                        "status": "resolved", "resolved_at": case["resolved_at"],
                        "outcome": case["outcome"],
                    })
                except Exception:
                    pass
            logger.info(f"[Rescue] Case {case_id} resolved — {case['outcome']}")
            return jsonify({"success": True, "case": case})
    return jsonify({"error": "Case not found"}), 404


@app.route("/api/dashboard/stats", methods=["GET"])
def dashboard_stats():
    """
    GET /api/dashboard/stats
    Aggregated stats for the government operations dashboard.
    """
    readings = _latest_readings if _latest_readings else {}
    STATUS_ORDER = {"DANGER": 3, "WARNING": 2, "WATCH": 1, "SAFE": 0}

    districts_summary = []
    for river, data in readings.items():
        district    = data.get("district", "")
        level       = data.get("level", 0.0)
        rainfall    = data.get("rainfall", 0.0)
        forecast_2h = data.get("forecast_2h", 0.0)
        rain_chance = data.get("rain_chance_max", 0)
        status      = _compute_station_status(level, rainfall, district, forecast_2h, rain_chance)
        flood_type  = "flash_flood" if district in URBAN_DISTRICTS else "river_overflow"
        centres    = EVACUATION_CENTERS.get(district, [])
        evac_count = len(centres)
        evac_cap   = sum(c.get("capacity", 0) for c in centres)
        districts_summary.append({
            "district":    district,
            "river":       river,
            "status":      status,
            "flood_type":  flood_type,
            "rainfall":    rainfall,
            "river_level": level,
            "forecast_2h": data.get("forecast_2h", 0.0),
            "condition":   data.get("condition", ""),
            "trend":       data.get("trend", "stable"),
            "evac_centers": evac_count,
            "evac_capacity": evac_cap,
            "evac_centre_list": [
                {
                    "name":     c.get("name", ""),
                    "capacity": c.get("capacity", 0),
                    "contact":  c.get("contact", ""),
                    "lat":      c.get("lat"),
                    "lng":      c.get("lng"),
                }
                for c in centres
            ],
        })

    districts_summary.sort(key=lambda x: STATUS_ORDER.get(x["status"], 0), reverse=True)

    at_risk   = [d for d in districts_summary if d["status"] in ("WARNING", "DANGER")]
    watching  = [d for d in districts_summary if d["status"] == "WATCH"]
    safe      = [d for d in districts_summary if d["status"] == "SAFE"]
    total_evac_cap = sum(d["evac_capacity"] for d in districts_summary)
    latest = _active_alerts[0] if _active_alerts else {}

    # SOS priority scoring: district risk weight × people count × log time-waiting
    active_cases = [c for c in _rescue_cases if c.get("status") not in ("resolved",)]
    sos_priority = None
    if active_cases:
        d_weight_map = {"DANGER": 3, "WARNING": 2, "WATCH": 1}
        scored = []
        for case in active_cases:
            dist     = case.get("district", "")
            d_status = _district_status(dist) or "WATCH"
            d_wt     = d_weight_map.get(d_status, 1)
            people   = max(1, int(case.get("people_count", 1)))
            try:
                ts_dt   = datetime.fromisoformat(case["timestamp"])
                minutes = max(1, int((datetime.now() - ts_dt).total_seconds() / 60))
            except Exception:
                minutes = 1
            score = d_wt * people * (1.0 + float(np.log1p(minutes / 10.0)))
            scored.append({
                "case_id":        case.get("case_id", case.get("id")),
                "district":       dist,
                "people_count":   people,
                "minutes_waiting": minutes,
                "district_status": d_status,
                "priority_score": round(score, 1),
                "situation":      case.get("situation", ""),
                "status":         case.get("status", "received"),
            })
        sos_priority = max(scored, key=lambda x: x["priority_score"])

    return jsonify({
        "overall_risk":       latest.get("risk_level", "SAFE"),
        "reasoning":          latest.get("reasoning", ""),
        "recommended_action": latest.get("recommended_action", ""),
        "confidence":         latest.get("confidence", 0),
        "last_updated":       latest.get("timestamp", ""),
        "affected_districts": latest.get("affected_districts", []),
        "districts":          districts_summary,
        "storm_warnings":     _latest_storm_warnings,
        "sos_priority":       sos_priority,
        "summary": {
            "total":           len(districts_summary),
            "at_risk":         len(at_risk),
            "watching":        len(watching),
            "safe":            len(safe),
            "flash_flood_zones": sum(1 for d in districts_summary if d["flood_type"] == "flash_flood"),
            "river_zones":     sum(1 for d in districts_summary if d["flood_type"] == "river_overflow"),
            "total_evac_capacity": total_evac_cap,
            "active_sos":      sum(1 for c in _rescue_cases if c.get("status") != "resolved"),
        },
        "agent_comms": _agent_comms[:20],
    })


@app.route("/dashboard")
def government_dashboard():
    """Serves the government-facing operations dashboard HTML page."""
    from flask import render_template_string
    html = (Path(__file__).parent / "dashboard.html").read_text(encoding="utf-8")
    # Inject the dashboard key so the browser JS can authenticate demo inject calls.
    # Jinja2 escapes the value automatically; empty string when key is not configured.
    return render_template_string(html, dashboard_key=_DASHBOARD_KEY)


@app.route("/health", methods=["GET"])
def health():
    """Quick liveness check used by Render and the mobile app."""
    return jsonify({
        "status": "FloodSense backend running",
        "firebase": _firebase_initialized,
        "claude": _anthropic_client is not None,
        "model_loaded": _ml_model is not None,
        "alerts_cached": len(_active_alerts),
        "last_cycle": _active_alerts[0]["timestamp"] if _active_alerts else None,
    })


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
