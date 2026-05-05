# Combat. — AI-Powered Scam Detector

A mobile application that helps Malaysians detect scams in real time using AI, government databases, and threat intelligence APIs.

---

## Features

- **Text Analysis** — Paste any suspicious message, phone number, URL, email, or bank account number
- **Screenshot Analysis** — Upload or photograph a suspicious message for AI vision analysis
- **QR Code Scanner** — Scan QR codes to check embedded URLs instantly
- **Profile Checker** — Upload a profile photo to detect AI-generated, stock photos, or public figure impersonation
- **Scan History** — All scans saved to cloud (Firebase) for signed-in users, or locally for guests
- **Community Reports** — Users can report confirmed scams; counts shown alongside AI verdict
- **Multi-language** — English, Bahasa Malaysia, Chinese (Simplified), Tamil
- **Dark / Light Theme**

---

## Tech Stack

| Layer | Technology |
|---|---|
| Mobile Frontend | React Native + Expo SDK 54 |
| Backend API | Python Flask, deployed on Render |
| AI (Text) | Groq `llama-3.3-70b-versatile` |
| AI (Vision) | Groq `meta-llama/llama-4-scout-17b-16e-instruct` |
| Database | Firebase Firestore |
| Auth | Firebase Authentication |
| Scam Registry | PDRM Semak Mule (official Malaysian gov API) |
| URL/IP Threat | VirusTotal API |
| Phone Validation | NumVerify API |
| Social Handle | SerpAPI |

---

## Project Structure

```
scam-detector/
├── frontend/                   React Native (Expo) app
│   ├── screens/                App screens
│   ├── context/                Auth, Theme, Language providers
│   ├── utils/                  API helper, translations
│   └── firebase.js             Firebase init
│
├── backend/
│   ├── app.py                  Flask API — all AI and external API logic
│   └── requirements.txt        Python dependencies
│
└── render.yaml                 Render deployment config
```

---

## Setup & Running Locally

### Prerequisites

- Node.js 18+
- Python 3.10+
- Expo CLI (`npm install -g expo-cli`)
- EAS CLI (`npm install -g eas-cli`)

---

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

Create a `.env` file in `backend/`:

```env
GROQ_API_KEY=your_groq_api_key
VIRUSTOTAL_API_KEY=your_virustotal_key
NUMVERIFY_API_KEY=your_numverify_key
SERPAPI_KEY=your_serpapi_key
IMGBB_API_KEY=your_imgbb_key
FIREBASE_CREDENTIALS=/path/to/serviceAccount.json
```

Run the server:

```bash
python app.py
```

---

### Frontend

```bash
cd frontend
npm install
```

Create `frontend/config.js`:

```js
export const BACKEND_URL = "http://YOUR_LOCAL_IP:5000";
```

Start the app:

```bash
npx expo start
```

Scan the QR code with **Expo Go** (Android/iOS).

---

## Building the APK

```bash
cd frontend
npx eas build --profile preview --platform android
```

Download the `.apk` from the EAS dashboard and install on any Android device.

---

## Deployment (Production)

**Backend:** Deployed on Render. Set all API keys as environment variables in the Render dashboard. Use `FIREBASE_CREDENTIALS_JSON` (full JSON string) instead of a file path.

**Frontend:** OTA updates via EAS Update. New APK only needed when native dependencies change.

---

## Environment Variables (Render)

| Variable | Description |
|---|---|
| `GROQ_API_KEY` | Groq AI API key |
| `VIRUSTOTAL_API_KEY` | VirusTotal API key |
| `NUMVERIFY_API_KEY` | NumVerify phone validation key |
| `SERPAPI_KEY` | SerpAPI key |
| `IMGBB_API_KEY` | ImgBB image hosting key |
| `FIREBASE_CREDENTIALS_JSON` | Full Firebase service account JSON as a string |

---

## Security

- **Firebase Token Verification** — Every API request requires a valid Firebase ID token (Bearer token in Authorization header)
- **Rate Limiting** — 20 requests/min on `/analyze`, 10 requests/min on `/check-profile`, 500 requests/day per IP
- **Firestore Rules** — Users can only read/write their own scan history
- **No secrets in code** — All API keys stored in environment variables, never committed to git

---

## License

MIT
