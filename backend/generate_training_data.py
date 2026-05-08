#!/usr/bin/env python3
"""
FloodSense — Training Data Generator
=====================================
Pulls 4 years of real Malaysian hydrology data from two free APIs
(no API keys required) and saves to backend/data/training_data.csv.

Sources:
  GloFAS river discharge  → flood-api.open-meteo.com/v1/flood
  ERA5 historical rainfall → archive-api.open-meteo.com/v1/archive

Output columns (matches what the Isolation Forest expects):
  river_level (m) | rainfall_rate (mm/hr) | hour_of_day | month

Usage:
  cd backend
  python generate_training_data.py

Then restart the backend (or delete flood_model.pkl) to retrain the model.
"""

import csv
import sys
import time
import requests
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime
from pathlib import Path

START_DATE = "2021-01-01"
END_DATE   = "2024-12-31"

# All 43 monitored districts across Peninsula Malaysia
DISTRICT_COORDS = {
    # Selangor / KL
    "Klang":             (3.0449, 101.4468),
    "Gombak":            (3.2353, 101.7044),
    "Kepong":            (3.2119, 101.6293),
    "Cheras":            (3.0945, 101.7455),
    "Ampang":            (3.1478, 101.7618),
    "Petaling Jaya":     (3.1073, 101.6067),
    "Bangsar":           (3.1302, 101.6741),
    "Subang Jaya":       (3.0565, 101.5897),
    "Shah Alam":         (3.0733, 101.5185),
    "Kuala Selangor":    (3.3474, 101.2442),
    "Sepang":            (2.7305, 101.7164),
    # Johor
    "Johor Bahru":       (1.4927, 103.7414),
    "Kota Tinggi":       (1.7337, 103.9017),
    "Batu Pahat":        (1.8547, 102.9346),
    "Muar":              (2.0444, 102.5689),
    # Perak
    "Ipoh":              (4.5975, 101.0901),
    "Teluk Intan":       (4.0229, 101.0227),
    "Taiping":           (4.8500, 100.7333),
    # Kelantan
    "Kota Bharu":        (6.1254, 102.2381),
    "Pasir Mas":         (6.0500, 102.1333),
    "Kuala Krai":        (5.5333, 102.2000),
    # Terengganu
    "Kuala Terengganu":  (5.3302, 103.1408),
    "Kemaman":           (4.2333, 103.4167),
    # Pahang
    "Kuantan":           (3.8077, 103.3260),
    "Temerloh":          (3.4500, 102.4167),
    "Pekan":             (3.4883, 103.3887),
    # Negeri Sembilan
    "Seremban":          (2.7297, 101.9381),
    "Port Dickson":      (2.5234, 101.7966),
    # Melaka
    "Melaka Tengah":     (2.1972, 102.2501),
    "Alor Gajah":        (2.3799, 102.2061),
    # Kedah
    "Alor Setar":        (6.1184, 100.3686),
    "Sungai Petani":     (5.6479, 100.4883),
    "Baling":            (5.6833, 100.9167),
    # Pulau Pinang
    "Georgetown":        (5.4141, 100.3288),
    "Seberang Perai":    (5.3971, 100.3985),
    # Perlis
    "Kangar":            (6.4414, 100.1986),
}

# Climatological normal discharge per district (m³/s) — same as _DISTRICT_CLIM_DISCHARGE in app.py
CLIM_DISCHARGE = {
    "Klang": 60.0, "Gombak": 25.0, "Kepong": 20.0, "Cheras": 18.0,
    "Ampang": 22.0, "Petaling Jaya": 15.0, "Bangsar": 12.0,
    "Subang Jaya": 18.0, "Shah Alam": 25.0, "Kuala Selangor": 45.0, "Sepang": 35.0,
    "Johor Bahru": 15.0, "Kota Tinggi": 120.0, "Batu Pahat": 85.0, "Muar": 100.0,
    "Ipoh": 45.0, "Teluk Intan": 250.0, "Taiping": 40.0,
    "Kota Bharu": 300.0, "Pasir Mas": 250.0, "Kuala Krai": 180.0,
    "Kuala Terengganu": 150.0, "Kemaman": 90.0,
    "Kuantan": 60.0, "Temerloh": 350.0, "Pekan": 400.0,
    "Seremban": 30.0, "Port Dickson": 20.0,
    "Melaka Tengah": 25.0, "Alor Gajah": 30.0,
    "Alor Setar": 55.0, "Sungai Petani": 80.0, "Baling": 60.0,
    "Georgetown": 12.0, "Seberang Perai": 35.0,
    "Kangar": 25.0,
}


def discharge_to_level(discharge, clim, fallback=2.0):
    if discharge is None or clim <= 0:
        return fallback
    ratio = discharge / clim
    if   ratio >= 4.0: return round(min(6.5, 5.5 + (ratio - 4.0) * 0.1), 2)
    elif ratio >= 2.5: return round(3.5 + (ratio - 2.5) / 1.5 * 2.0,     2)
    elif ratio >= 1.8: return round(3.0 + (ratio - 1.8) / 0.7 * 0.5,     2)
    else:              return round(max(0.5, 1.5 + ratio * 0.35),          2)


def fetch_district(district, lat, lng):
    clim = CLIM_DISCHARGE.get(district, 30.0)

    # GloFAS historical river discharge
    r1 = requests.get(
        "https://flood-api.open-meteo.com/v1/flood",
        params={"latitude": lat, "longitude": lng,
                "daily": "river_discharge",
                "start_date": START_DATE, "end_date": END_DATE},
        timeout=30,
    )
    r1.raise_for_status()
    glo = r1.json()["daily"]

    # ERA5 historical precipitation (daily sum in mm)
    r2 = requests.get(
        "https://archive-api.open-meteo.com/v1/archive",
        params={"latitude": lat, "longitude": lng,
                "daily": "precipitation_sum",
                "start_date": START_DATE, "end_date": END_DATE},
        timeout=30,
    )
    r2.raise_for_status()
    arc = r2.json()["daily"]

    rows = []
    for i, date_str in enumerate(glo["time"]):
        discharge = glo["river_discharge"][i]
        precip    = arc["precipitation_sum"][i] or 0.0

        level = discharge_to_level(discharge, clim)
        month = int(date_str[5:7])

        # Daily precip → hourly rate with realistic Malaysian diurnal pattern.
        # KL-type thunderstorms: ~60% of rain falls 14:00–17:00.
        # Monsoon coasts (east): morning rain more common but afternoon still peaks.
        avg_hr = precip / 24.0
        hour_weights = [
            0.2, 0.2, 0.2, 0.2, 0.2, 0.3,   # 00-05 quiet night
            0.5, 0.7, 0.9, 1.0, 1.1, 1.2,   # 06-11 morning buildup
            1.3, 1.5, 3.5, 4.0, 3.0, 2.0,   # 12-17 peak (14-16 = KL thunder)
            1.5, 1.2, 1.0, 0.8, 0.6, 0.4,   # 18-23 evening taper
        ]
        total_w = sum(hour_weights)

        for hour in range(24):
            # Scale the hourly weight so the sum over 24h equals daily precip
            rf = round((hour_weights[hour] / total_w) * precip, 2)
            rows.append([round(level, 2), rf, hour, month])

    return rows


def main():
    out_dir = Path(__file__).parent / "data"
    out_dir.mkdir(exist_ok=True)
    out_path = out_dir / "training_data.csv"

    print(f"FloodSense Training Data Generator")
    print(f"Period  : {START_DATE} to {END_DATE}")
    print(f"Districts: {len(DISTRICT_COORDS)}")
    print(f"Output  : {out_path}\n")

    all_rows = []
    failed   = []
    done     = 0

    with ThreadPoolExecutor(max_workers=6) as pool:
        futures = {
            pool.submit(fetch_district, d, lat, lng): d
            for d, (lat, lng) in DISTRICT_COORDS.items()
        }
        for fut in as_completed(futures):
            d = futures[fut]
            try:
                rows = fut.result()
                all_rows.extend(rows)
                done += 1
                print(f"  [{done:2d}/{len(DISTRICT_COORDS)}] {d}: {len(rows):,} rows")
            except Exception as exc:
                failed.append(d)
                print(f"  [!!] {d}: {exc}", file=sys.stderr)

    if not all_rows:
        print("\nNo data fetched — check your internet connection.", file=sys.stderr)
        sys.exit(1)

    # Write CSV
    with open(out_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["river_level", "rainfall_rate", "hour_of_day", "month"])
        writer.writerows(all_rows)

    print(f"\n{'='*50}")
    print(f"Saved {len(all_rows):,} rows  ->  {out_path}")
    if failed:
        print(f"Failed districts ({len(failed)}): {', '.join(failed)}")
    print(f"\nNext steps:")
    print(f"  1. Delete backend/flood_model.pkl  (forces retrain)")
    print(f"  2. Restart the backend")
    print(f"  The model will auto-train on this data at startup.")


if __name__ == "__main__":
    t0 = time.time()
    main()
    print(f"\nDone in {time.time() - t0:.1f}s")
