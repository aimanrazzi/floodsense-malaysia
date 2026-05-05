# Project Documentation

**Project Title:** Combat. — AI-Powered Scam Detector
**Date:** April 2026

---

## 1. Basic Information

| Field | Details |
|---|---|
| Project Title | Combat. — AI-Powered Scam & Fraud Detection App |
| Category | AI / Mobile Application |
| Platform | Android (APK) + iOS (Expo Go) |
| Backend | Python Flask, deployed on Render |
| Repository | https://github.com/aimanrazzi/scam-detector |

---

## 2. Problem Statement

### What problem are we solving?

Malaysia is one of the most scam-affected countries in Southeast Asia. In 2023, Malaysians lost over **RM2.6 billion** to scams. Common scam types include:

- **Macau Scams** — impersonating police, SPRM, or customs officers
- **Fake Job Offers** — unrealistic salaries, work-from-home with upfront fees
- **Investment Scams** — guaranteed returns on crypto, forex, or gold schemes
- **Parcel/Courier Scams** — fake Pos Laju / J&T notifications with phishing links
- **Love/Romance Scams** — fake overseas relationships leading to money transfers
- **Bank Impersonation** — fake Maybank, CIMB, RHB alerts asking for credentials

### Why it matters

Most people encounter suspicious messages, unknown phone numbers, or unusual links and have no quick way to verify them. Existing resources (like PDRM's Semak Mule) require manual searching. There is no unified, AI-powered tool that checks everything in one place and returns a clear verdict in seconds.

### Target users

- General Malaysian public, especially elderly and less tech-savvy users
- People who receive suspicious WhatsApp messages, phone calls, or emails
- Users who want to verify a profile photo before trusting someone online
- Anyone who receives a QR code from an unknown source

---

## 3. Solution Overview

### What we built

**Combat.** is a mobile application that lets users check any suspicious input — a message, phone number, URL, email, bank account, screenshot, profile photo, or QR code — and returns an instant AI-powered risk verdict with a score and explanation.

### Key features

| Feature | Description |
|---|---|
| Text Analysis | Paste any suspicious text — phone number, URL, message, bank account, email, or social handle |
| Screenshot Analysis | Upload or photograph a suspicious message for AI vision analysis |
| QR Code Scanner | Point the camera at any QR code to extract and scan its embedded URL instantly |
| Profile Checker | Upload a profile photo to detect AI-generated faces, stock photos, or public figure impersonation |
| Scan History | All scans saved to cloud (Firebase) or locally — filterable by status and date |
| Community Reports | Users flag confirmed scams; warning shown on repeat scans of the same input |
| Multi-language | English, Bahasa Malaysia, Chinese (Simplified), Tamil |
| Dark / Light Theme | Full theme toggle across all screens |

### QR Code Scanner — How It Works

The QR Scanner uses the device camera via `expo-camera` to continuously scan for QR codes. When a QR code is detected:

1. The embedded URL is extracted from the QR code data
2. The URL is sent to the backend `/analyze` endpoint (same as text input)
3. Backend runs: AI analysis + VirusTotal URL check + safe domain check
4. Result returned: score, status, reason, and findings

This catches malicious QR codes used in phishing attacks — a common scam method where a fake QR code redirects to a credential-stealing website.

### Profile Checker — How It Works

The Profile Checker is designed to help users verify profile photos sent by strangers (e.g. on dating apps, WhatsApp, Telegram). The user uploads the photo, and the backend:

1. Resizes the image to 512×512 (to reduce token usage)
2. Sends to Groq Vision (`llama-4-scout`) with a detailed prompt
3. AI detects: AI-generated faces, stock photos, public figure impersonation, visible social handles
4. Backend applies score adjustments based on what was detected
5. Returns a verdict with specific findings

**Profile Checker verdicts:**

| Finding | Score Effect | Status |
|---|---|---|
| Public figure identified by name | Score forced to 90 | SCAM — impersonation warning shown |
| AI-generated photo detected | +15 added, if ≥70 | SCAM |
| Stock photo detected | Score capped at 60 | SUSPICIOUS |
| Real person selfie | Score −20 applied | SAFE (if score < 31) |
| Non-person image (cartoon, object) | Rejected | Error returned |

### How it solves the problem

Instead of manually checking Semak Mule, searching VirusTotal, and googling a phone number separately, Combat. does all of this automatically in one tap. The app cross-references:

1. AI analysis (Malaysian scam pattern recognition)
2. PDRM Semak Mule (official government scam registry)
3. VirusTotal (URL and IP threat database)
4. NumVerify (phone number validation)
5. SerpAPI (social handle scam search)
6. Community reports (crowdsourced warnings)

The result is a single clear verdict: **SAFE / SUSPICIOUS / SCAM** with a score and explanation in the user's language.

---

## 4. Technical Approach

### AI / ML Models Used

| Task | Model | Provider |
|---|---|---|
| Text scam analysis | `llama-3.3-70b-versatile` | Groq |
| Image / screenshot analysis | `meta-llama/llama-4-scout-17b-16e-instruct` | Groq |
| Profile photo analysis | `meta-llama/llama-4-scout-17b-16e-instruct` | Groq |

**Why Groq?**
Groq's inference hardware delivers sub-second response times on large language models. For a real-time scam detection app where users expect instant results, this is critical. The free tier is also generous enough for a hackathon prototype.

### Tools & Frameworks

| Tool | Purpose |
|---|---|
| React Native + Expo SDK 54 | Cross-platform mobile app (Android + iOS) |
| Python Flask | REST API backend |
| Firebase Firestore | Cloud database for scan history and community reports |
| Firebase Authentication | User accounts (email/password + Google Sign-In) |
| EAS Build | Compiling the Android APK |
| EAS Update | Over-the-air JS bundle updates (no re-install needed) |
| Flask-Limiter | API rate limiting |
| firebase-admin | Server-side Firebase token verification |
| Gunicorn | Production WSGI server |
| Render | Backend cloud hosting |

### Data Used

| Source | Type | Used For |
|---|---|---|
| PDRM Semak Mule API | Live government API | Phone, bank account, email scam registry |
| VirusTotal API | Live threat intelligence API | URL and IP reputation check |
| NumVerify API | Live API | Phone number carrier and country validation |
| SerpAPI | Live Google Search API | Social handle scam mention search |
| User community reports | Crowdsourced (Firestore) | Community warning counts |

---

## 5. System Architecture

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    MOBILE APP (React Native)                │
│                                                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │  Home    │  │   QR     │  │ Profile  │  │ History  │   │
│  │  Screen  │  │  Scanner │  │ Checker  │  │ Screen   │   │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘   │
│       │              │              │              │         │
│       └──────────────┴──────────────┘              │         │
│                      │                              │         │
│              securePost() — Bearer Token           │         │
│                      │                    Firebase  │         │
│                      │                    Firestore │         │
└──────────────────────┼─────────────────────────────┼─────────┘
                       │                             │
              HTTPS    │                             │ SDK
                       ▼                             ▼
┌──────────────────────────────┐      ┌──────────────────────────┐
│  FLASK BACKEND (Render)      │      │  FIREBASE (Google)       │
│                              │      │                          │
│  ┌────────────────────────┐  │      │  ┌────────────────────┐  │
│  │ Firebase Token Verify  │  │      │  │  Authentication    │  │
│  │ Rate Limiter           │  │      │  │  (email + Google)  │  │
│  └────────────────────────┘  │      │  └────────────────────┘  │
│                              │      │  ┌────────────────────┐  │
│  ┌────────────────────────┐  │      │  │  Firestore DB      │  │
│  │  Groq AI               │  │      │  │  - Scan history    │  │
│  │  (Text + Vision)       │  │      │  │  - Reports         │  │
│  └────────────────────────┘  │      │  └────────────────────┘  │
│                              │      └──────────────────────────┘
│  ┌────────────────────────┐  │
│  │  External APIs         │  │
│  │  - Semak Mule (PDRM)   │  │
│  │  - VirusTotal          │  │
│  │  - NumVerify           │  │
│  │  - SerpAPI             │  │
│  │  - ImgBB               │  │
│  └────────────────────────┘  │
└──────────────────────────────┘
```

### Data Flow

1. User inputs text, image, or QR code in the app
2. App attaches a Firebase ID token to the request (Bearer auth)
3. Flask backend verifies the token, checks rate limits
4. Backend runs Groq AI analysis → external API checks → computes final score
5. Score, status, reason, and findings returned to app in JSON
6. App displays result and saves to Firebase Firestore (or AsyncStorage if guest)
7. On repeat scans of the same input, community report count is fetched from Firestore and displayed alongside the AI result

---

## 6. Implementation Details

### Modules & Components

**Frontend (`frontend/screens/`)**

| Screen | Purpose |
|---|---|
| `HomeScreen.js` | Main scan screen — text input + image upload |
| `QRScreen.js` | QR code scanner using device camera |
| `ProfileCheckScreen.js` | Profile photo scam checker |
| `HistoryScreen.js` | Scan history with filters (status, date) |
| `LoginScreen.js` | Email/password + Google sign-in, forgot password |
| `ResourcesScreen.js` | Links to official Malaysian anti-scam resources |
| `ReportScreen.js` | How to report scams to PDRM, NSRC, BNM, MCMC |
| `MainScreen.js` | Bottom tab navigator |

**Frontend (`frontend/context/`)**

| Context | Purpose |
|---|---|
| `AuthContext.js` | Firebase auth state (user object, sign-out) |
| `ThemeContext.js` | Dark / light theme tokens |
| `LanguageContext.js` | Language selection and persistence |

**Backend (`backend/app.py`)**

| Section | Purpose |
|---|---|
| Firebase Admin init | Token verification using `FIREBASE_CREDENTIALS_JSON` env var |
| `require_auth()` | Validates Bearer token on every request |
| Flask-Limiter | Rate limits per IP address |
| `analyze_with_ai()` | Sends text prompt to Groq, parses JSON response |
| `analyze_image_with_ai()` | Sends base64 image to Groq Vision |
| `check_virustotal_url()` | Submits URL to VirusTotal, reads vendor flags |
| `check_semak_mule()` | Queries PDRM Semak Mule for phone/bank/email |
| `check_phone_number()` | NumVerify validation + Malaysian prefix fallback |
| `check_social_handle()` | SerpAPI search for scam mentions |
| `/analyze` route | Main endpoint — orchestrates all checks, computes final score |
| `/check-profile` route | Profile photo endpoint |

### APIs & Integrations

| API | Endpoint / Method | What we use it for |
|---|---|---|
| Groq | `POST /openai/v1/chat/completions` | AI text + vision scam analysis |
| VirusTotal | `POST /api/v3/urls` + `GET /api/v3/analyses/{id}` | URL reputation scan |
| VirusTotal | `GET /api/v3/ip_addresses/{ip}` | IP reputation check |
| Semak Mule (PDRM) | `GET /semak?value=...` | Check phone/bank/email against scam registry |
| NumVerify | `GET /validate?number=...` | Phone number carrier and country info |
| SerpAPI | Google Search JSON API | Search for scam mentions of social handles |
| ImgBB | `POST /upload` | Temporary public URL for profile images |
| Firebase Auth | `verifyIdToken()` (Admin SDK) | Server-side token verification |
| Firebase Firestore | `collection/doc` SDK | Scan history and community reports |

### Database (Firebase Firestore)

All data is stored in Firebase Firestore. Users must be signed in to use the app — every request to the backend requires a valid Firebase ID token.

#### Firestore Structure

```
Firestore
│
├── scans/
│   └── {userUID}/                        ← one document per user (by Firebase UID)
│       └── entries/
│           └── {autoID}                  ← one document per scan
│               ├── input                 — original text or "[Screenshot]"
│               ├── status                — "SAFE" | "SUSPICIOUS" | "SCAM"
│               ├── score                 — integer 0–100
│               ├── reason                — one-line AI summary
│               ├── date                  — ISO 8601 timestamp
│               └── localImagePath        — device file URI (image scans only)
│
└── reports/
    └── {inputKey}                        ← document ID = normalized input text
        ├── input                         — original input text
        ├── count                         — total number of community reports
        ├── reportedBy                    — array of UIDs who reported (prevents duplicates)
        └── lastReportedAt                — ISO 8601 timestamp of most recent report
```

#### How scan history is saved

1. User submits input → app calls backend `/analyze` with Firebase Bearer token
2. Backend verifies token, runs analysis, returns result
3. App saves a scan record to Firestore: `scans/{uid}/entries/{autoID}` via `addDoc()`
4. History screen reads all entries back on every tab focus using `useFocusEffect`, ordered by date descending

#### How community reports work

1. After a scan result, a **Report as Scam** button appears
2. Tapping it writes to `reports/{inputKey}` in Firestore:
   - If document doesn't exist: creates it with `count: 1`, `reportedBy: [uid]`
   - If document exists: increments `count`, appends uid to `reportedBy` (one report per user)
3. Before each scan, the app queries `reports/{inputKey}` to fetch the current count
4. If count ≥ 1, a community warning is shown alongside the AI result:
   - 1–4 reports: amber warning — "X users reported this as suspicious"
   - 5+ reports: red warning — "X users flagged this as a scam — high risk"

#### Firestore Security Rules

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Users can only read/write their own scan history
    match /scans/{uid}/entries/{entry} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }

    // Reports — anyone authenticated can read (needed to check count before scan)
    // Only signed-in users can write (prevents anonymous spam)
    match /reports/{key} {
      allow read: if true;
      allow write: if request.auth != null;
    }
  }
}
```

---

## 7. Score Calculation

### Score Ranges

| Score | Status | Colour | Meaning |
|---|---|---|---|
| 0 – 30 | SAFE | Green | Low risk — likely legitimate |
| 31 – 69 | SUSPICIOUS | Amber | Proceed with caution — some risk indicators found |
| 70 – 100 | SCAM | Red | High risk — do not proceed, likely a scam |

### Final Score Formula

```
Final Score = (AI Base Score × 0.5) + (External Signals Score × 0.5)
```

The AI and external APIs each contribute 50% to the final score. Neither alone decides the result — both must agree for a high or low score. After the formula, hard overrides can force the score higher if confirmed scam signals are found.

---

### Step-by-Step Calculation

**Step 1 — Groq AI Base Score (0–100)**

The AI reads the full input text and returns a base score from 0–100 based on Malaysian scam pattern recognition. The AI is instructed with the following patterns:

*SCAM patterns (score 75–100):*
- Macau scam — impersonating police (PDRM), SPRM, kastam, mahkamah, or government officers
- Government impersonation — fake LHDN tax refund/debt, fake JPJ summons, fake SSM notice
- Bank impersonation — fake Maybank2u, CIMB, RHB alerts asking to verify account or click a link
- Fake job offers — unrealistic salary (RM3,000–8,000 work-from-home), no interview, upfront fees or IC copy required
- Love/romance scam — overseas person (army officer, doctor, engineer) requesting money transfer
- Investment scam — guaranteed high returns, forex/crypto/gold, passive income, MLM structure
- Parcel/courier scam — fake Pos Laju, J&T, DHL, Ninja Van notifications with suspicious links
- Lucky draw / prize scam — "tahniah anda terpilih", "anda menang hadiah", claim via link or upfront transfer
- Loan scam — instant approval, no credit check, processing fee required upfront
- E-commerce scam — seller asking payment outside Shopee/Lazada

*SUSPICIOUS patterns (score 40–74):*
- Urgency language: "segera", "dalam masa 24 jam", "akaun anda akan dibekukan"
- Requests for OTP, TAC code, or online banking password
- Government or bank business conducted via WhatsApp or Telegram
- Vague job or investment offer with no verifiable company details

**Step 2 — VirusTotal URL Check (+0 to +25)**

If a URL is detected in the input, it is submitted to VirusTotal for analysis across 70+ security vendor engines.

- If flagged by any vendor: `+10 + (malicious_count × 3)`, capped at **+25**
- If 3 or more vendors flag it as malicious: hard override forces score ≥ 75 (SCAM)

**Step 3 — VirusTotal IP Check (+0 to +25)**

If an IP address is detected (and no URL was found), it is checked against VirusTotal's IP reputation database.

- Same boost formula as URL: `+10 + (malicious_count × 3)`, capped at **+25**

**Step 4 — PDRM Semak Mule Check (+0 to +60, with hard overrides)**

If a phone number, bank account number, or email address is detected, it is queried against PDRM's official Semak Mule scam database.

| Reports in Semak Mule | Score Boost | Hard Minimum Score |
|---|---|---|
| 1 report | +20 | Forced ≥ 75 (SCAM) |
| 2 reports | +40 | Forced ≥ 85 |
| 3+ reports | +60 | Forced ≥ 92 |

**Why hard overrides?** Semak Mule is PDRM's official scam database — entries are reported by real Malaysian scam victims. A number in Semak Mule is confirmed scam evidence. The formula alone (50/50 split) could produce a borderline score if the AI gave a low base — so we override to guarantee SCAM status for any registered number.

**Step 5 — Phone Number Baseline Rule**

If the input is a bare phone number with no other context and AI score < 25: score is raised to **25** and a note is added: *"Phone number detected — cannot determine safety from number alone."*

The AI cannot judge a plain phone number by itself. External checks (Semak Mule, NumVerify) must inform the result. This prevents false SAFE verdicts on unknown numbers.

**Step 6 — Social Handle Check (+0 to +15)**

If a social media handle is detected (`@username` or `platform.com/username`): SerpAPI performs a Google search:

```
"@handle" platform scam OR penipu OR fraud OR fake
```

- If scam-related results are found: **+5 per result**, capped at **+15**
- Findings from search results are added to the output

**Legitimacy Signals (score reduction)**

If a recognised safe domain is detected (e.g. `google.com`, `maybank.com`, `gov.my`): **−20** from external score.

If a valid phone number is found (via NumVerify) with no Semak Mule reports: **−10** from external score.

---

### Actual Groq AI Prompts Used

**Text Analysis Prompt** (sent to `llama-3.3-70b-versatile`):

```
You are a scam and fraud detection assistant specialising in Malaysian scams.

The user has submitted the following input for you to analyse:
"""[USER INPUT]"""

Your job is to extract the actual content being referred to (a phone number, URL, message,
job offer, IP address, etc.) and analyse THAT for scam indicators.

General rules:
- Ignore spelling or grammar errors made by the person submitting — they may just be typing quickly.
- Focus only on whether the content itself shows signs of being a scam.
- A phone number alone is not a scam unless there is other suspicious context.

Malaysian scam patterns — score 75 to 100 if any of these are detected:
- Macau scam: someone claiming to be polis, SPRM, kastam, mahkamah, or any government officer
  asking for money or bank details
- Government impersonation: fake LHDN/Hasil tax refund or debt, fake JPJ summons, fake SSM notice
- Bank impersonation: fake Maybank2u, CIMB Clicks, RHB, Public Bank alerts asking to verify
  account or click a link
- Fake job offers: unrealistic salary (RM3000–8000 kerja dari rumah), no interview, asks for
  upfront fees or IC copy
- Love/romance scam: overseas person (army officer, doctor, engineer) building relationship
  then requesting money transfer
- Investment scam: guaranteed high returns, forex/crypto/gold schemes, passive income, MLM
- Parcel/courier scam: fake Pos Laju, J&T, DHL, Ninja Van notifications with suspicious links
- Lucky draw / prize scam: "tahniah anda terpilih", "anda menang hadiah"
- Loan scam: instant approval, no credit check, processing fee required upfront
- E-commerce scam: seller asking payment outside Shopee/Lazada, fake buyer overpaying

Suspicious patterns — score 40 to 74:
- Urgency language: "segera", "dalam masa 24 jam", "akaun anda akan dibekukan"
- Requests for OTP, TAC code, or online banking password
- Government or bank business conducted via WhatsApp or Telegram
- Vague job or investment offer with no verifiable company details

Respond ONLY in this exact JSON format with no extra text:
{
  "score": <number from 0 to 100>,
  "status": "<SAFE or SUSPICIOUS or SCAM>",
  "reason": "<one clear sentence summary of the verdict>",
  "findings": ["<finding 1>", "<finding 2>", "<finding 3>"]
}

Scoring guide:
- 0 to 30 = SAFE
- 31 to 69 = SUSPICIOUS
- 70 to 100 = SCAM

Respond with "reason" and all "findings" in [USER SELECTED LANGUAGE].
```

**Screenshot / Image Analysis Prompt** (sent to `meta-llama/llama-4-scout-17b-16e-instruct`):

```
You are a scam and fraud detection assistant.
Analyze this screenshot for any scam indicators — suspicious messages, phishing links,
fake offers, urgent requests, or fraud.

Respond ONLY in this exact JSON format with no extra text:
{
  "score": <number from 0 to 100>,
  "status": "<SAFE or SUSPICIOUS or SCAM>",
  "reason": "<one clear sentence summary of the verdict>",
  "findings": ["<finding 1>", "<finding 2>", "<finding 3>"]
}

Scoring guide:
- 0 to 30 = SAFE
- 31 to 69 = SUSPICIOUS
- 70 to 100 = SCAM

Respond with "reason" and all "findings" in [USER SELECTED LANGUAGE].
```

**Profile Photo Analysis Prompt** (sent to `meta-llama/llama-4-scout-17b-16e-instruct`):

```
You are a scam detection assistant analyzing a profile photo.

FIRST — determine if this image contains a real human person (face OR body).
If the image contains NO human person at all (cartoon, anime, game character, artwork,
screenshot of text, meme, logo, animal, building, landscape with no person, or object),
respond with status: "INVALID".

KEY RULE — Background analysis:
- A REAL selfie background, even when blurred, shows identifiable real-world elements:
  furniture shapes, wall colors, trees, streets, people, windows, etc.
- An AI-generated portrait background is a perfectly uniform, featureless blur or gradient —
  no identifiable location, no shapes. This is a strong AI indicator.

Strong AI-generated signs:
- Perfectly featureless blurred background
- Skin is flawless with zero pores or blemishes
- Hair is impossibly perfect with every strand rendered uniformly
- Unnaturally perfect facial symmetry
- Perfectly even lighting from all directions

Stock photo signs:
- Professional studio lighting against a plain solid background
- Subject poses like a commercial model

Real person selfie signs (score low):
- Background shows a real place even if slightly blurry
- Candid or casual pose
- Natural, directional lighting
- Minor skin imperfections, natural hair

Also look for any visible social media username in the image.
Also check: Is this person a well-known public figure or celebrity?

Respond ONLY in this JSON format:
{
  "score": <0 to 100>,
  "status": "<SAFE or SUSPICIOUS or SCAM or INVALID>",
  "reason": "<one sentence>",
  "ai_generated": <true or false>,
  "looks_like_stock": <true or false>,
  "detected_handle": "<@username if visible, or null>",
  "detected_platform": "<platform name, or null>",
  "known_person": "<full name if public figure, or null>",
  "known_person_type": "<Singer/Actor/etc, or null>",
  "findings": ["<finding 1>", "<finding 2>", "<finding 3>"]
}

Scoring guide:
- 0 to 30 = SAFE (genuine real person photo)
- 31 to 69 = SUSPICIOUS (ambiguous, some signs)
- 70 to 100 = SCAM (AI-generated or stock photo)
```

---

### Profile Checker Score Adjustments (applied after AI response)

| AI Returns | Score Effect |
|---|---|
| `ai_generated: true` | +15 added to score; if ≥70 → status forced SCAM |
| `looks_like_stock: true` | Score capped at 60; status forced SUSPICIOUS |
| Neither (real selfie) | −20 applied to score; if <31 → status forced SAFE |
| `known_person` identified | Score forced to 90; status forced SCAM; impersonation warning shown |
| `status: INVALID` (no person) | Request rejected with error message |

---

## 8. Results & Validation

### Testing Approach

| Test Case | Input | Expected | Result |
|---|---|---|---|
| Known scam number (in Semak Mule) | Registered scam phone number | SCAM ≥ 75 | SCAM 88/100 |
| Phishing URL | Known malicious URL | SCAM | SCAM 90/100 |
| Safe number | Personal phone number | SAFE or SUSPICIOUS | SUSPICIOUS 25/100 |
| Macau scam message | "Encik, saya dari SPRM, ada kes anda..." | SCAM | SCAM 92/100 |
| Fake job offer | "Kerja dari rumah RM5000 sebulan, tiada pengalaman perlu" | SCAM | SCAM 85/100 |
| Normal message | "Hi, boleh jumpa esok?" | SAFE | SAFE 5/100 |
| AI-generated profile photo | AI face image | SUSPICIOUS/SCAM | SCAM 82/100 |
| Real selfie | Normal photo | SAFE | SAFE 15/100 |

### Output Sample

```json
{
  "status": "SCAM",
  "score": 88,
  "reason": "Number registered in PDRM Semak Mule scam database with 2 reports",
  "findings": [
    "Phone number found in PDRM Semak Mule (2 reports)",
    "Malaysian mobile number — registered carrier detected",
    "High-risk: confirmed scam activity linked to this number"
  ]
}
```

### Security Validation

| Security Layer | Status |
|---|---|
| Firebase token verification on every API request | Active |
| Rate limiting (20 req/min on /analyze) | Active |
| Firestore rules (users can only access own data) | Active |
| API keys in environment variables (not in code) | Active |
| No secrets committed to git | Verified via .gitignore |

---

## 9. Team Contribution

| Member | Role |
|---|---|
| Aiman Razzi | Full-stack development — React Native frontend, Flask backend, Firebase integration, EAS build/deployment, all API integrations |

---

## 10. Market Feasibility

### Real-World Use

Combat. addresses a real, growing problem in Malaysia. With RM2.6 billion lost to scams in 2023 and increasing digital financial crime, there is strong demand for a quick, accessible scam verification tool.

**Who will use it:**
- General Malaysian public receiving suspicious messages on WhatsApp, Telegram, or SMS
- Elderly users who are prime targets for phone and Macau scams
- People verifying a contact before transferring money
- Users on dating apps verifying a profile before meeting someone

### Why It Matters

Existing tools require users to:
1. Go to Semak Mule website manually
2. Search VirusTotal separately
3. Google the phone number separately

Combat. combines all of these in one tap, with AI context added on top.

### Scalability

| Layer | Current (Free Tier) | Production Scale |
|---|---|---|
| Backend | Render free (512MB, 1 worker) | Render paid / AWS EC2 |
| AI | Groq free tier | Groq Pro or self-hosted Llama |
| Database | Firebase Spark (free) | Firebase Blaze or Supabase |
| Mobile | EAS free tier (30 builds/month) | EAS Production plan |
| Auth | Firebase free (10K users/month) | Scales automatically |

The app architecture is stateless — the Flask backend holds no session data. Scaling is simply adding more workers or switching to a larger compute instance.

---

## 11. Limitations & Future Improvements

### Current Limitations

| Limitation | Reason |
|---|---|
| Images not synced across devices | Firebase Storage requires paid plan (Blaze). Images stored as local device path only |
| Google Sign-In fails on emulators | SHA-1 certificate mismatch — must test on real device |
| Render free tier cold start | First request after idle period takes 10–15 seconds |
| react-native-share (image+text share) only works in APK | Native module not available in Expo Go |
| Semak Mule limited to phone/bank/email | PDRM API does not cover URLs or IPs |
| Community reports susceptible to spam | Mitigated by: one report per UID, 5+ threshold for strong warning, AI always runs independently |

### Future Improvements

**Short Term**
- Firebase Storage (Blaze plan) — images persist across devices
- Native iOS build (EAS Build) — full feature parity, no Expo Go dependency
- Admin dashboard — manage community reports, remove false ones

**Medium Term**
- Push notifications — alert users when a scam number they've seen gets reported
- Pre-loaded Malaysia scam number database — instant offline check
- Browser extension — real-time URL warning while browsing

**Long Term**
- Custom ML model trained on Malaysian scam datasets — faster, cheaper, fully offline
- Partnership with PDRM / MCMC for official API access with higher rate limits
- Public community scam feed — browse recent community reports across Malaysia

---

## 12. Deployment

### Backend — Render

- Platform: Render (free tier, Python 3.14)
- WSGI Server: Gunicorn
- Start command: `gunicorn app:app --bind 0.0.0.0:$PORT --timeout 120 --workers 1 --threads 2`
- All API keys stored as Render environment variables (never in code or git)
- Auto-deploys on every push to `main` branch

### Frontend — Expo EAS

| Distribution | Method |
|---|---|
| Android APK | `eas build --profile preview --platform android` |
| OTA JS Updates | `eas update --branch preview` — no new APK needed |
| iOS (Expo Go) | Share Expo update link — open in Safari on iPhone |

**Runtime version:** `exposdk:54.0.0`

---

## 13. Project File Structure

```
scam-detector/
├── README.md                        Setup and run instructions
├── PROJECT_DOCUMENTATION.md         This file
├── render.yaml                      Render deployment config
│
├── frontend/
│   ├── app.json                     Expo config (EAS project ID, runtime version)
│   ├── eas.json                     EAS build profiles
│   ├── firebase.js                  Firebase SDK init
│   ├── config.js                    Backend URL
│   │
│   ├── screens/
│   │   ├── HomeScreen.js            Main scan screen (text + image)
│   │   ├── QRScreen.js              QR code scanner
│   │   ├── ProfileCheckScreen.js    Profile photo checker
│   │   ├── HistoryScreen.js         Scan history
│   │   ├── LoginScreen.js           Auth screen
│   │   ├── ResourcesScreen.js       Anti-scam resource links
│   │   ├── ReportScreen.js          How to report scams
│   │   ├── MainScreen.js            Tab navigator
│   │   ├── AccountScreen.js         User account + sign out
│   │   ├── SplashScreen.js          Loading screen
│   │   └── TipsScreen.js            Scam awareness tips
│   │
│   ├── context/
│   │   ├── AuthContext.js           Auth state provider
│   │   ├── ThemeContext.js          Theme provider (dark/light)
│   │   └── LanguageContext.js       Language provider
│   │
│   └── utils/
│       ├── api.js                   securePost() — attaches Firebase Bearer token
│       └── translations.js          EN / MY / ZH / TA string definitions
│
└── backend/
    ├── app.py                       All Flask routes + AI/API logic
    ├── requirements.txt             Python dependencies
    └── render.yaml                  Render service config
```

---

*Combat. — Hackathon Submission | April 2026*
