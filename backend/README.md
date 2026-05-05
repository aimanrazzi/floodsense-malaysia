# Scam Detector — Backend

Python Flask backend for the AI-Powered Scam & Fraud Detection app.

## Setup

### 1. Install dependencies
```bash
cd backend
pip install -r requirements.txt
```

### 2. Set up API keys
```bash
cp .env.example .env
```
Then open `.env` and paste your actual API keys.

### 3. Run the server
```bash
python app.py
```
Server runs at: http://localhost:5000

---

## API Endpoints

### POST /analyze
Send text to be analyzed.

**Request body:**
```json
{ "text": "Congratulations! You won RM10,000. Click here to claim now!" }
```

**Response:**
```json
{
  "score": 92,
  "status": "SCAM",
  "reason": "Detected classic lottery scam pattern with urgency and prize claim language.",
  "url_scanned": null,
  "url_flagged": null
}
```

### GET /health
Check if backend is running.

**Response:**
```json
{ "status": "Backend is running!" }
```

---

## Status Labels
| Status | Score Range | Meaning |
|--------|-------------|---------|
| SAFE | 0 – 30 | Normal message, no threat |
| SUSPICIOUS | 31 – 69 | Some red flags, be careful |
| SCAM | 70 – 100 | Clear scam detected |
