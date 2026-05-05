from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from groq import Groq
import requests
import urllib3
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
import os
import re
import json
from urllib.parse import urlparse
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
CORS(app)

# ── Rate Limiting ─────────────────────────────────────────
# 30 requests/minute per IP, 500/day per IP
limiter = Limiter(
    app=app,
    key_func=get_remote_address,
    default_limits=["500 per day", "30 per minute"],
    storage_uri="memory://",
)

# ── Firebase Token Verification (optional) ────────────────
# Set FIREBASE_CREDENTIALS=/path/to/serviceAccount.json in .env to enable.
# Without it, auth is disabled but rate limiting still works.
_firebase_initialized = False
try:
    import firebase_admin
    from firebase_admin import credentials as fb_credentials, auth as fb_auth

    _creds_json = os.getenv("FIREBASE_CREDENTIALS_JSON")   # full JSON string (Render)
    _creds_path = os.getenv("FIREBASE_CREDENTIALS")        # file path (local dev)

    if _creds_json:
        import json as _json
        fb_cred = fb_credentials.Certificate(_json.loads(_creds_json))
        firebase_admin.initialize_app(fb_cred)
        _firebase_initialized = True
        print("[Security] Firebase token verification: ACTIVE (from env JSON)")
    elif _creds_path and os.path.exists(_creds_path):
        fb_cred = fb_credentials.Certificate(_creds_path)
        firebase_admin.initialize_app(fb_cred)
        _firebase_initialized = True
        print("[Security] Firebase token verification: ACTIVE (from file)")
    else:
        print("[Security] Firebase token verification: DISABLED (no credentials set)")
except Exception as _e:
    print(f"[Security] Firebase Admin init failed: {_e}")

def require_auth():
    """
    Validates Firebase ID token from Authorization header.
    Returns (uid, None) on success, (None, error_response) on failure.
    If Firebase is not configured, returns (None, None) — open access.
    """
    if not _firebase_initialized:
        return None, None
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return None, (jsonify({"error": "Authentication required."}), 401)
    token = auth_header.split("Bearer ", 1)[1].strip()
    try:
        decoded = fb_auth.verify_id_token(token)
        return decoded["uid"], None
    except Exception:
        return None, (jsonify({"error": "Invalid or expired session. Please sign in again."}), 401)

# ── Clients ──────────────────────────────────────────────
groq_client = Groq(api_key=os.getenv("GROQ_API_KEY"))
VIRUSTOTAL_API_KEY = os.getenv("VIRUSTOTAL_API_KEY")
NUMVERIFY_API_KEY = os.getenv("NUMVERIFY_API_KEY")
SERPAPI_KEY = os.getenv("SERPAPI_KEY")
IMGBB_API_KEY = os.getenv("IMGBB_API_KEY")


LANG_NAMES = {
    "en": "English",
    "ms": "Malay (Bahasa Malaysia)",
    "zh": "Chinese (Simplified)",
    "ta": "Tamil",
}


# ── Helper: Extract JSON from AI response ────────────────
def extract_json(raw):
    raw = raw.strip()
    # Try to find a JSON object anywhere in the response
    match = re.search(r'\{.*\}', raw, re.DOTALL)
    if match:
        return json.loads(match.group(0))
    raise ValueError(f"No JSON found in response: {raw[:200]}")


# ── Helper: Resize image ─────────────────────────────────
def resize_image_base64(image_base64, max_size=(512, 512)):
    import base64
    import io
    from PIL import Image
    image_bytes = base64.b64decode(image_base64)
    img = Image.open(io.BytesIO(image_bytes))
    img.thumbnail(max_size, Image.LANCZOS)
    buffer = io.BytesIO()
    img.save(buffer, format="JPEG", quality=60)
    return base64.b64encode(buffer.getvalue()).decode("utf-8")


# ── Helper: Analyze text with Groq AI ───────────────────
def analyze_with_ai(text, lang="en"):
    prompt = f"""You are a scam and fraud detection assistant specialising in Malaysian scams.

The user has submitted the following input for you to analyse:
\"\"\"{text}\"\"\"

Your job is to extract the actual content being referred to (a phone number, URL, message, job offer, IP address, etc.) and analyse THAT for scam indicators.

General rules:
- Ignore spelling or grammar errors made by the person submitting — they may just be typing quickly.
- Focus only on whether the content itself shows signs of being a scam.
- A phone number alone is not a scam unless there is other suspicious context.

Malaysian scam patterns — score 75 to 100 if any of these are detected:
- Macau scam: someone claiming to be polis, SPRM, kastam, mahkamah, or any government officer asking for money or bank details
- Government impersonation: fake LHDN/Hasil tax refund or debt, fake JPJ summons, fake SSM notice
- Bank impersonation: fake Maybank2u, CIMB Clicks, RHB, Public Bank alerts asking to verify account or click a link
- Fake job offers: unrealistic salary (RM3000–8000 kerja dari rumah), no interview, asks for upfront fees or IC copy
- Love/romance scam: overseas person (army officer, doctor, engineer) building relationship then requesting money transfer
- Investment scam: guaranteed high returns, forex/crypto/gold schemes, passive income, MLM-like structure
- Parcel/courier scam: fake Pos Laju, J&T, DHL, Ninja Van notifications with suspicious links
- Lucky draw / prize scam: "tahniah anda terpilih", "anda menang hadiah", claim via link or upfront transfer
- Loan scam: instant approval, no credit check, processing fee required upfront
- E-commerce scam: seller asking payment outside Shopee/Lazada, fake buyer overpaying

Suspicious patterns — score 40 to 74:
- Urgency language: "segera", "dalam masa 24 jam", "akaun anda akan dibekukan", "tindakan undang-undang"
- Requests for OTP, TAC code, or online banking password
- Government or bank business conducted via WhatsApp or Telegram
- Vague job or investment offer with no verifiable company details

Respond ONLY in this exact JSON format with no extra text:
{{
  "score": <number from 0 to 100>,
  "status": "<SAFE or SUSPICIOUS or SCAM>",
  "reason": "<one clear sentence summary of the verdict>",
  "findings": ["<finding 1>", "<finding 2>", "<finding 3>"]
}}

For findings: list 2–4 short bullet points explaining specific indicators found (or not found). Each should be one short sentence.

Scoring guide:
- 0 to 30 = SAFE
- 31 to 69 = SUSPICIOUS
- 70 to 100 = SCAM

Respond with "reason" and all "findings" in {LANG_NAMES.get(lang, "English")}."""

    response = groq_client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.1,
    )

    raw = response.choices[0].message.content.strip()
    return extract_json(raw)


# ── Helper: Check URL with VirusTotal ────────────────────
def check_url_virustotal(url):
    if not VIRUSTOTAL_API_KEY:
        return None

    headers = {"x-apikey": VIRUSTOTAL_API_KEY}

    response = requests.post(
        "https://www.virustotal.com/api/v3/urls",
        headers=headers,
        data={"url": url}
    )

    if response.status_code != 200:
        return None

    analysis_id = response.json()["data"]["id"]

    result = requests.get(
        f"https://www.virustotal.com/api/v3/analyses/{analysis_id}",
        headers=headers
    )

    if result.status_code != 200:
        return None

    stats = result.json()["data"]["attributes"]["stats"]
    malicious = stats.get("malicious", 0)
    suspicious = stats.get("suspicious", 0)

    return {
        "malicious": malicious,
        "suspicious": suspicious,
        "flagged": malicious > 0 or suspicious > 0
    }


# ── Helper: Check IP with VirusTotal ─────────────────────
def check_ip_virustotal(ip):
    if not VIRUSTOTAL_API_KEY:
        return None

    headers = {"x-apikey": VIRUSTOTAL_API_KEY}
    result = requests.get(
        f"https://www.virustotal.com/api/v3/ip_addresses/{ip}",
        headers=headers
    )

    if result.status_code != 200:
        return None

    stats = result.json()["data"]["attributes"]["last_analysis_stats"]
    malicious = stats.get("malicious", 0)
    suspicious = stats.get("suspicious", 0)

    return {
        "malicious": malicious,
        "suspicious": suspicious,
        "flagged": malicious > 0 or suspicious > 0
    }


# ── Helper: Semak Mule API (PDRM) ────────────────────────
def _semak_mule_query(category, value):
    """Generic Semak Mule query. category: telefon | akaun | email"""
    url = "https://semakmule.rmp.gov.my/api/mule/get_search_data.php"
    field = {"telefon": "telNo", "akaun": "noAkaun", "email": "email"}.get(category, "telNo")
    payload = json.dumps({"data": {"category": category, field: value}}).encode()
    try:
        req = requests.post(url, data=payload, headers={
            "User-Agent": "Mozilla/5.0",
            "Content-Type": "application/json",
            "apikey": "j3j389#nklala2",
            "Referer": "https://semakmule.rmp.gov.my/",
        }, timeout=10, verify=False)
        print(f"[SemakMule] category={category} value={value} status={req.status_code} body={req.text[:200]}")
        if req.status_code == 200:
            data = req.json()
            if data.get("status") == 1 and data.get("table_data"):
                reports = data["table_data"][0][1] if data["table_data"] else 0
                return {"reports": reports, "found": reports > 0}
            return {"reports": 0, "found": False}
    except Exception as e:
        print(f"[SemakMule] failed: {e}")
    return None

def check_semak_mule(phone):
    digits_only = re.sub(r'\D', '', phone)
    local = digits_only
    if local.startswith('60') and len(local) > 10:
        local = '0' + local[2:]
    return _semak_mule_query("telefon", local)

def check_semak_mule_bank(account):
    digits_only = re.sub(r'\D', '', account)
    return _semak_mule_query("akaun", digits_only)

def check_semak_mule_email(email):
    return _semak_mule_query("email", email.strip().lower())


# ── Helper: Malaysian phone number local lookup (no API needed) ──
MY_PREFIXES = {
    # Mobile
    "0111": ("Celcom",   "mobile"), "0112": ("Celcom",   "mobile"),
    "0113": ("Celcom",   "mobile"), "0114": ("Celcom",   "mobile"),
    "0115": ("Celcom",   "mobile"), "0116": ("Celcom",   "mobile"),
    "0117": ("Celcom",   "mobile"), "0118": ("Celcom",   "mobile"),
    "0119": ("Celcom",   "mobile"),
    "0120": ("Maxis",    "mobile"), "0121": ("Maxis",    "mobile"),
    "0122": ("Maxis",    "mobile"), "0123": ("Maxis",    "mobile"),
    "0124": ("Maxis",    "mobile"), "0125": ("Maxis",    "mobile"),
    "0126": ("Maxis",    "mobile"), "0127": ("Maxis",    "mobile"),
    "0128": ("Maxis",    "mobile"), "0129": ("Maxis",    "mobile"),
    "0130": ("Maxis",    "mobile"), "0132": ("Maxis",    "mobile"),
    "0133": ("Maxis",    "mobile"),
    "0140": ("Celcom",   "mobile"), "0142": ("Celcom",   "mobile"),
    "0143": ("Celcom",   "mobile"), "0144": ("Celcom",   "mobile"),
    "0145": ("Celcom",   "mobile"), "0146": ("Celcom",   "mobile"),
    "0147": ("Celcom",   "mobile"),
    "0150": ("U Mobile", "mobile"), "0151": ("U Mobile", "mobile"),
    "0152": ("U Mobile", "mobile"), "0153": ("U Mobile", "mobile"),
    "0154": ("U Mobile", "mobile"), "0155": ("U Mobile", "mobile"),
    "0156": ("U Mobile", "mobile"), "0158": ("U Mobile", "mobile"),
    "0160": ("Maxis",    "mobile"), "0162": ("Maxis",    "mobile"),
    "0163": ("Maxis",    "mobile"), "0164": ("Maxis",    "mobile"),
    "0165": ("Maxis",    "mobile"), "0166": ("Maxis",    "mobile"),
    "0167": ("Maxis",    "mobile"),
    "0170": ("Celcom",   "mobile"), "0172": ("Celcom",   "mobile"),
    "0173": ("Celcom",   "mobile"), "0174": ("Celcom",   "mobile"),
    "0175": ("Celcom",   "mobile"), "0176": ("Celcom",   "mobile"),
    "0177": ("Celcom",   "mobile"),
    "0180": ("U Mobile", "mobile"), "0182": ("U Mobile", "mobile"),
    "0183": ("U Mobile", "mobile"),
    "0190": ("Digi",     "mobile"), "0192": ("Digi",     "mobile"),
    "0193": ("Digi",     "mobile"), "0194": ("Digi",     "mobile"),
    "0195": ("Digi",     "mobile"), "0196": ("Digi",     "mobile"),
    "0197": ("Digi",     "mobile"),
}

MY_AREA_CODES = {
    "03": ("Kuala Lumpur / Selangor", "landline"),
    "04": ("Penang / Kedah / Perlis", "landline"),
    "05": ("Perak / Kelantan",        "landline"),
    "06": ("Negeri Sembilan / Melaka / Johor", "landline"),
    "07": ("Johor",                   "landline"),
    "082": ("Kuching, Sarawak",       "landline"),
    "083": ("Sri Aman, Sarawak",      "landline"),
    "084": ("Sibu, Sarawak",          "landline"),
    "085": ("Miri, Sarawak",          "landline"),
    "086": ("Kapit, Sarawak",         "landline"),
    "087": ("Kota Kinabalu, Sabah",   "landline"),
    "088": ("Kota Kinabalu, Sabah",   "landline"),
    "089": ("Tawau, Sabah",           "landline"),
    "09": ("Pahang / Terengganu / Kelantan", "landline"),
}

def _local_my_lookup(digits):
    """Fallback: look up carrier/location from Malaysian prefix tables."""
    # Normalise to local format (0xx...)
    local = digits
    if local.startswith('60') and len(local) > 10:
        local = '0' + local[2:]
    if not local.startswith('0'):
        return {"valid": False}
    for prefix_len in (4, 3, 2):
        prefix = local[:prefix_len]
        if prefix in MY_PREFIXES:
            carrier, line_type = MY_PREFIXES[prefix]
            return {"valid": True, "country": "Malaysia", "country_code": "MY",
                    "carrier": carrier, "line_type": line_type, "location": "Malaysia",
                    "international_format": "+60" + local[1:]}
        if prefix in MY_AREA_CODES:
            location, line_type = MY_AREA_CODES[prefix]
            return {"valid": True, "country": "Malaysia", "country_code": "MY",
                    "carrier": "TM / Fixed Line", "line_type": line_type, "location": location,
                    "international_format": "+60" + local[1:]}
    return {"valid": False}

def check_phone_numverify(phone):
    if not NUMVERIFY_API_KEY:
        return _local_my_lookup(re.sub(r'\D', '', phone))

    digits = re.sub(r'\D', '', phone)

    # Build candidates to try: raw digits, with +, with +60 for MY locals
    candidates = [digits]
    if not phone.strip().startswith('+'):
        candidates.append('+' + digits)
    # If looks like Malaysian local (starts with 0), try +60 format
    if digits.startswith('0') and 9 <= len(digits) <= 11:
        candidates.append('+60' + digits[1:])

    for candidate in candidates:
        try:
            response = requests.get(
                "http://apilayer.net/api/validate",
                params={"access_key": NUMVERIFY_API_KEY, "number": candidate, "format": 1},
                timeout=8,
            )
            if response.status_code == 200:
                data = response.json()
                if data.get("valid"):
                    return {
                        "valid": True,
                        "country": data.get("country_name", "Unknown"),
                        "country_code": data.get("country_code", ""),
                        "location": data.get("location") or data.get("country_name", ""),
                        "carrier": data.get("carrier") or "Unknown",
                        "line_type": data.get("line_type") or "Unknown",
                        "international_format": data.get("international_format", candidate),
                    }
        except Exception:
            pass

    # Fallback to local prefix lookup for Malaysian numbers
    return _local_my_lookup(digits)


# ── Helper: Extract URL ───────────────────────────────────
def extract_url(text):
    pattern = r'https?://[^\s]+'
    match = re.search(pattern, text)
    return match.group(0) if match else None


# ── Helper: Extract IP address ────────────────────────────
def extract_ip(text):
    pattern = r'\b(?:\d{1,3}\.){3}\d{1,3}\b'
    match = re.search(pattern, text)
    return match.group(0) if match else None


# ── Helper: Extract phone number ──────────────────────────
def extract_phone(text):
    # Must start with 0 (local MY) or + (international) — bank accounts don't
    pattern = r'(\+[\d\s\-\(\)]{7,18}|0[\d\s\-\(\)]{7,13})'
    matches = re.findall(pattern, text)
    for match in matches:
        digits = re.sub(r'\D', '', match)
        if 7 <= len(digits) <= 15:
            return match.strip()
    return None

# ── Helper: Extract bank account number ───────────────────
BANK_KEYWORDS = {"bank", "akaun", "account", "acc", "maybank", "cimb", "rhb",
                 "public bank", "hong leong", "ambank", "bsn", "affin", "alliance",
                 "ocbc", "hsbc", "standard chartered", "uob", "shopee", "touch n go"}

def extract_bank_account(text):
    text_lower = text.lower()
    has_bank_keyword = any(k in text_lower for k in BANK_KEYWORDS)
    # Match 10-16 digit standalone numbers not starting with 0 or +
    matches = re.findall(r'\b([1-9]\d{9,15})\b', text)
    for m in matches:
        # If text has bank keywords OR number is clearly too long for a phone (>12 digits)
        if has_bank_keyword or len(m) > 12:
            return m
    return None

# ── Helper: Extract email ─────────────────────────────────
def extract_email(text):
    match = re.search(r'[\w.+-]+@[\w-]+\.[a-zA-Z]{2,}', text)
    return match.group(0) if match else None

# ── Helper: Extract social media handle ───────────────────
SOCIAL_PLATFORMS = {
    "instagram.com": "Instagram",
    "tiktok.com": "TikTok",
    "facebook.com": "Facebook",
    "twitter.com": "Twitter/X",
    "x.com": "Twitter/X",
    "t.me": "Telegram",
    "youtube.com": "YouTube",
    "shopee.com.my": "Shopee",
    "shopee.com": "Shopee",
}

def extract_social_handle(text):
    """Returns (platform, handle) or None."""
    # Match platform URLs: instagram.com/handle, tiktok.com/@handle
    for domain, platform in SOCIAL_PLATFORMS.items():
        pattern = rf'(?:https?://)?(?:www\.)?{re.escape(domain)}/(?:@?)([A-Za-z0-9_.]+)'
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            return {"platform": platform, "handle": match.group(1), "domain": domain}
    # Match bare @handle
    match = re.search(r'(?<!\w)@([A-Za-z0-9_.]{3,30})(?!\w)', text)
    if match:
        return {"platform": "Unknown", "handle": match.group(1), "domain": None}
    return None

def check_social_handle(platform, handle):
    """Search SerpAPI for scam reports about this handle."""
    if not SERPAPI_KEY:
        return None
    try:
        query = f'"{handle}" {platform} scam OR penipu OR fraud OR fake'
        resp = requests.get("https://serpapi.com/search", params={
            "engine": "google",
            "q": query,
            "num": 5,
            "api_key": SERPAPI_KEY,
        }, timeout=15)
        if resp.status_code != 200:
            return None
        results = resp.json().get("organic_results", [])
        scam_keywords = ["scam", "penipu", "fraud", "fake", "tipu", "report", "penipuan"]
        hits = []
        for r in results:
            title = (r.get("title") or "").lower()
            snippet = (r.get("snippet") or "").lower()
            if any(k in title or k in snippet for k in scam_keywords):
                hits.append(r.get("title", ""))
        return {
            "found_reports": len(hits) > 0,
            "report_count": len(hits),
            "snippets": hits[:3],
        }
    except Exception as e:
        print(f"[SocialCheck] failed: {e}")
        return None


# ── Helper: Analyze image with Gemini Vision ─────────────
def analyze_image_with_ai(image_base64, mime_type, lang="en"):
    image_base64 = resize_image_base64(image_base64, max_size=(800, 800))

    prompt = """You are a scam and fraud detection assistant.
Analyze this screenshot for any scam indicators — suspicious messages, phishing links, fake offers, urgent requests, or fraud.

Respond ONLY in this exact JSON format with no extra text:
{
  "score": <number from 0 to 100>,
  "status": "<SAFE or SUSPICIOUS or SCAM>",
  "reason": "<one clear sentence summary of the verdict>",
  "findings": ["<finding 1>", "<finding 2>", "<finding 3>"]
}

For findings: list 2-4 short bullet points of specific indicators found (or not found). Each should be one short sentence.

Scoring guide:
- 0 to 30 = SAFE
- 31 to 69 = SUSPICIOUS
- 70 to 100 = SCAM

Respond with "reason" and all "findings" in """ + LANG_NAMES.get(lang, "English") + "."

    response = groq_client.chat.completions.create(
        model="meta-llama/llama-4-scout-17b-16e-instruct",
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:{mime_type};base64,{image_base64}"
                        }
                    },
                    {
                        "type": "text",
                        "text": prompt
                    }
                ]
            }
        ],
        temperature=0.1,
    )

    raw = response.choices[0].message.content.strip()
    return extract_json(raw)


# ── Helper: Upload image to ImgBB for temporary hosting ──
def upload_to_imgbb(image_base64):
    if not IMGBB_API_KEY:
        return None
    try:
        response = requests.post(
            "https://api.imgbb.com/1/upload",
            data={"key": IMGBB_API_KEY, "image": image_base64},
            timeout=15
        )
        if response.status_code == 200:
            return response.json()["data"]["url"]
    except Exception:
        pass
    return None


# ── Helper: Reverse image search with SerpApi ────────────
PROFILE_PLATFORMS = {
    "Instagram": "instagram.com",
    "Facebook": "facebook.com",
    "Twitter/X": "twitter.com",
    "TikTok": "tiktok.com",
    "LinkedIn": "linkedin.com",
}

def _extract_platforms_from_sites(sites):
    found = []
    for site in sites:
        for platform, domain in PROFILE_PLATFORMS.items():
            if domain in site and platform not in found:
                found.append(platform)
    return found

def _parse_knowledge_graph(kg):
    """Extract person name, type, and social platforms from a SerpApi knowledge graph."""
    person_name = kg.get("title") or kg.get("name")
    person_type = kg.get("type") or kg.get("description", "")
    social = []
    for profile in kg.get("social_profiles", []):
        name = profile.get("name", "")
        link = profile.get("link", "")
        if name and name not in social:
            social.append(name)
        # Also check the link URL
        for platform, domain in PROFILE_PLATFORMS.items():
            if domain in link and platform not in social:
                social.append(platform)
    return person_name, person_type, social

def reverse_image_search(image_base64):
    if not SERPAPI_KEY:
        return None

    # Upload to ImgBB to get a public URL for SerpApi
    image_url = upload_to_imgbb(image_base64)
    if not image_url:
        return None

    person_name = None
    person_type = ""
    found_platforms = []
    total_found = 0

    # ── Try Google Lens first (better at face/celebrity recognition) ──
    try:
        lens_resp = requests.get(
            "https://serpapi.com/search",
            params={
                "engine": "google_lens",
                "url": image_url,
                "api_key": SERPAPI_KEY,
            },
            timeout=20
        )
        if lens_resp.status_code == 200:
            lens_data = lens_resp.json()

            # Knowledge graph from Lens
            kg = lens_data.get("knowledge_graph", {})
            if kg:
                person_name, person_type, kg_social = _parse_knowledge_graph(kg)
                found_platforms.extend(p for p in kg_social if p not in found_platforms)

            # related_searches fallback — e.g. "Aliff Aziz" shown as related search
            if not person_name:
                for item in lens_data.get("related_searches", []):
                    query = item.get("query", "")
                    # Person names are typically Title Case with 2+ words
                    words = query.strip().split()
                    if len(words) >= 2 and all(w[0].isupper() for w in words if w):
                        person_name = query
                        break
                # Also check knowledge_graph in related_content
                for item in lens_data.get("related_content", []):
                    title = item.get("title", "")
                    words = title.strip().split()
                    if len(words) >= 2 and all(w[0].isupper() for w in words if w):
                        person_name = title
                        break

            # Visual matches — only count social media sites, ignore retail/product pages
            visual_matches = lens_data.get("visual_matches", [])
            match_sites = [m.get("link", "") for m in visual_matches[:15]]
            social_match_sites = [s for s in match_sites if any(
                domain in s for domain in PROFILE_PLATFORMS.values()
            )]
            total_found = len(social_match_sites)
            for p in _extract_platforms_from_sites(match_sites):
                if p not in found_platforms:
                    found_platforms.append(p)
    except Exception:
        pass

    # ── Also run google_reverse_image for extra coverage ──
    try:
        rev_resp = requests.get(
            "https://serpapi.com/search",
            params={
                "engine": "google_reverse_image",
                "image_url": image_url,
                "api_key": SERPAPI_KEY,
            },
            timeout=20
        )
        if rev_resp.status_code == 200:
            rev_data = rev_resp.json()

            # Knowledge graph fallback
            if not person_name:
                kg = rev_data.get("knowledge_graph", {})
                if kg:
                    person_name, person_type, kg_social = _parse_knowledge_graph(kg)
                    found_platforms.extend(p for p in kg_social if p not in found_platforms)

            # image_results (near-exact matches)
            image_results = rev_data.get("image_results", [])
            if not total_found:
                total_found = len(image_results)
            rev_sites = [r.get("link", "") for r in image_results[:15]]
            for p in _extract_platforms_from_sites(rev_sites):
                if p not in found_platforms:
                    found_platforms.append(p)
    except Exception:
        pass

    return {
        "total_found": total_found,
        "sites": [],
        "found_online": len(found_platforms) > 0 or bool(person_name),
        "social_platforms": found_platforms,
        "found_on_social": len(found_platforms) > 0,
        "person_name": person_name,
        "person_type": person_type,
        "is_public_figure": bool(person_name),
    }


# ── Helper: Analyze profile photo with Groq Vision ───────
def analyze_profile_photo(image_base64, lang="en"):
    image_base64 = resize_image_base64(image_base64)
    prompt = """You are a scam detection assistant analyzing a profile photo.

FIRST — determine if this image contains a real human person (face OR body).
If the image contains NO human person at all (e.g. it is a cartoon, anime, game character, artwork, screenshot of text, meme, logo, animal, building, landscape with no person, or object), respond with:
{
  "score": 0,
  "status": "INVALID",
  "reason": "This image does not appear to contain a real person.",
  "ai_generated": false,
  "looks_like_stock": false
}

NOTE: Photos where the face is not clearly visible are still valid — underwater photos, silhouettes, photos from behind, action shots, and full-body photos with obscured faces should all be analyzed. Only reject if there is truly no human present.

KEY RULE — Background analysis:
- A REAL selfie background, even when blurred, shows identifiable real-world elements: furniture shapes, wall colors, trees, streets, people, windows, etc. You can tell WHERE the person is.
- An AI-generated portrait background is a perfectly uniform, featureless blur or gradient — no identifiable location, no shapes, no context. This is a strong AI indicator.
- A plain studio background (solid color, no environment) = stock or AI.

Strong AI-generated signs:
- Perfectly featureless blurred background — smooth gradient with zero identifiable real-world elements
- Skin is flawless with zero pores, blemishes, or texture variation (not just smooth — completely poreless)
- Hair is impossibly perfect with every strand rendered uniformly, no flyaways
- Facial symmetry is unnaturally perfect
- Lighting is perfectly even from all directions with no real light source visible
- The overall image looks like a rendered portrait, not a photograph

Stock photo signs:
- Professional studio lighting against a plain solid or minimal background
- Subject poses like a commercial model
- No real-world environment visible

Real person selfie signs (score low):
- Background shows a real place even if slightly blurry (you can identify WHERE they are)
- Candid or casual pose, selfie angle
- Natural, directional lighting (from a window, lamp, outdoors)
- Minor skin imperfections, natural hair
- Everyday clothing, cultural attire

Smartphone portrait mode creates NATURAL background blur that still shows environmental shapes. AI blur is a perfect featureless gradient.

IMPORTANT — Dark or studio backgrounds:
- A dark/black background in a gym, fitness, or portrait photo is NORMAL and does NOT indicate AI.
- A fitness promotional photo, sports photo, or branded content photo with studio lighting is a REAL PHOTO, not AI — even if it looks professional.
- Only flag as AI if you see multiple clear AI artifacts (merged features, warped elements, plastic skin texture).

Also look for any visible social media UI in the image:
- If you can see an Instagram, Facebook, TikTok, Twitter, or other social media username or handle (e.g. "@username", a verified badge, a profile name), extract it.

Also check: Is this person a well-known public figure, celebrity, athlete, artist, or influencer that you recognise?

Respond ONLY in this exact JSON format with no extra text:
{
  "score": <number from 0 to 100>,
  "status": "<SAFE or SUSPICIOUS or SCAM>",
  "reason": "<one clear sentence about the photo>",
  "ai_generated": <true or false>,
  "looks_like_stock": <true or false>,
  "detected_handle": "<social media username if visible in image, or null>",
  "detected_platform": "<platform name e.g. Instagram, or null>",
  "known_person": "<full name of the person if you recognise them as a public figure, or null>",
  "known_person_type": "<their role e.g. Singer, Actor, Athlete, or null>",
  "findings": ["<finding 1>", "<finding 2>", "<finding 3>"]
}

Scoring guide:
- 0 to 30 = SAFE — Looks like a genuine real person photo
- 31 to 69 = SUSPICIOUS — Some suspicious signs, ambiguous
- 70 to 100 = SCAM — Strong evidence of AI-generation or stock photo

Respond with "reason" and all "findings" in """ + LANG_NAMES.get(lang, "English") + "."

    response = groq_client.chat.completions.create(
        model="meta-llama/llama-4-scout-17b-16e-instruct",
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "image_url",
                        "image_url": {"url": f"data:image/jpeg;base64,{image_base64}"}
                    },
                    {"type": "text", "text": prompt}
                ]
            }
        ],
        temperature=0.1,
    )

    raw = response.choices[0].message.content.strip()
    return extract_json(raw)


# ── Profile Check Route ──────────────────────────────────
@app.route("/check-profile", methods=["POST"])
@limiter.limit("10 per minute")
def check_profile():
    _, err = require_auth()
    if err:
        return err
    data = request.get_json()
    if not data or "image" not in data:
        return jsonify({"error": "Please provide an image."}), 400

    try:
        lang = data.get("lang", "en")
        ai_result = analyze_profile_photo(data["image"], lang)

        # Reject non-person images
        if ai_result.get("status") == "INVALID":
            return jsonify({"error": "No person detected in this image. Please upload a photo that contains a real person (face, body, or action shot)."}), 400

        # Adjust score based on AI vision flags
        if ai_result.get("ai_generated"):
            ai_result["score"] = min(100, ai_result["score"] + 15)
            if ai_result["score"] >= 70:
                ai_result["status"] = "SCAM"
        elif ai_result.get("looks_like_stock"):
            ai_result["score"] = min(60, ai_result["score"])
            ai_result["status"] = "SUSPICIOUS"
        else:
            ai_result["score"] = max(0, ai_result["score"] - 20)
            if ai_result["score"] < 31:
                ai_result["status"] = "SAFE"

        impersonation_warning = None
        person_name = ai_result.get("known_person")
        person_type = ai_result.get("known_person_type", "")
        detected_handle = ai_result.get("detected_handle")
        detected_platform = ai_result.get("detected_platform")

        # Public figure detected by Groq vision — always SCAM
        if person_name:
            type_str = f" ({person_type})" if person_type else ""
            impersonation_warning = (
                f"This photo appears to be of {person_name}{type_str}, a known public figure. "
                f"If someone sent you this photo claiming to be them, they may be impersonating this person."
            )
            ai_result["score"] = 90
            ai_result["status"] = "SCAM"

        # Visible social media handle in screenshot
        if detected_handle and not impersonation_warning and not ai_result.get("ai_generated"):
            impersonation_warning = (
                f"This appears to be a screenshot from {detected_platform or 'social media'} "
                f"showing {detected_handle}. If someone sent you this as their profile photo, verify their identity directly."
            )

        return jsonify({
            "score": ai_result["score"],
            "status": ai_result["status"],
            "reason": ai_result["reason"],
            "findings": ai_result.get("findings", []),
            "ai_generated": ai_result.get("ai_generated", False),
            "looks_like_stock": ai_result.get("looks_like_stock", False),
            "impersonation_warning": impersonation_warning,
            "detected_handle": detected_handle,
            "detected_platform": detected_platform,
            "person_name": person_name,
            "person_type": person_type,
        })

    except Exception as e:
        return jsonify({"error": f"Profile check failed: {str(e)}"}), 500


# ── Main Route: Analyze input ────────────────────────────
@app.route("/analyze", methods=["POST"])
@limiter.limit("20 per minute")
def analyze():
    _, err = require_auth()
    if err:
        return err
    data = request.get_json()

    if not data:
        return jsonify({"error": "Please provide text or image to analyze."}), 400

    # Image analysis
    if "image" in data:
        try:
            ai_result = analyze_image_with_ai(data["image"], data.get("mime_type", "image/jpeg"), data.get("lang", "en"))
            return jsonify({
                "score": ai_result["score"],
                "status": ai_result["status"],
                "reason": ai_result["reason"],
                "findings": ai_result.get("findings", []),
                "url_scanned": None,
                "url_flagged": None,
                "ip_scanned": None,
                "ip_flagged": None,
                "phone_scanned": None,
                "phone_info": None,
                "phone_valid": None
            })
        except Exception as e:
            return jsonify({"error": f"Image analysis failed: {str(e)}"}), 500

    if "text" not in data:
        return jsonify({"error": "Please provide text to analyze."}), 400

    text = data["text"].strip()
    lang = data.get("lang", "en")

    if len(text) < 3:
        return jsonify({"error": "Input is too short to analyze."}), 400

    if len(text) > 5000:
        return jsonify({"error": "Input is too long. Max 5000 characters."}), 400

    try:
        # Step 1: AI analysis
        ai_result = analyze_with_ai(text, lang)

        # Step 2: URL scan
        url_result = None
        detected_url = extract_url(text)
        if detected_url:
            url_result = check_url_virustotal(detected_url)

        # Step 3: IP scan
        ip_result = None
        detected_ip = None
        if not detected_url:
            detected_ip = extract_ip(text)
            if detected_ip:
                ip_result = check_ip_virustotal(detected_ip)

        # Step 4: Phone / bank account / email check
        phone_result = None
        semak_result = None
        detected_phone = None
        detected_email = None
        detected_social = None
        email_semak = None
        social_result = None
        if not detected_url and not detected_ip:
            detected_phone = extract_phone(text)
            if detected_phone:
                phone_result = check_phone_numverify(detected_phone)
                semak_result = check_semak_mule(detected_phone)
            detected_email = extract_email(text)
            if detected_email:
                email_semak = check_semak_mule_email(detected_email)
            detected_social = extract_social_handle(text)
            if detected_social:
                social_result = check_social_handle(
                    detected_social["platform"], detected_social["handle"]
                )

        # ── Step 5: Collect external signals with capped contributions ──

        SAFE_DOMAINS = {
            "google.com", "youtube.com", "facebook.com", "instagram.com",
            "twitter.com", "x.com", "tiktok.com", "linkedin.com", "whatsapp.com",
            "maybank.com", "maybank2u.com", "cimb.com", "rhb.com",
            "hongleongbank.com", "publicbank.com.my", "ambank.com.my",
            "bsn.com.my", "bankislam.com.my", "muamalat.com.my", "affinbank.com.my",
            "pdrm.gov.my", "hasil.gov.my", "jpj.gov.my", "bnm.gov.my", "sst.customs.gov.my",
            "gov.my", "edu.my", "shopee.com.my", "lazada.com.my",
            "grab.com", "tngdigital.com.my", "touch-n-go.com", "boost.com.my",
        }

        external_score = 0
        findings = list(ai_result.get("findings", []))

        # VirusTotal URL — max +25
        if url_result and url_result["flagged"]:
            vt_boost = min(25, 10 + url_result.get("malicious", 0) * 3)
            external_score += vt_boost
            findings.append("URL was flagged by VirusTotal threat engines.")

        # VirusTotal IP — max +25
        if ip_result and ip_result["flagged"]:
            ip_boost = min(25, 10 + ip_result.get("malicious", 0) * 3)
            external_score += ip_boost
            findings.append("IP address was flagged by VirusTotal.")

        # Semak Mule phone — 20pts per report, max +60
        semak_boost = 0
        if semak_result and semak_result["found"]:
            semak_boost = min(60, semak_result["reports"] * 20)
            external_score += semak_boost
            findings.append(f"🚨 This phone number has {semak_result['reports']} scam report(s) on Semak Mule (PDRM).")
        elif semak_result and not semak_result["found"]:
            findings.append("✅ This phone number — no reports found on Semak Mule (PDRM).")
        elif semak_result is None and detected_phone:
            findings.append("⚠️ Could not reach Semak Mule to verify this phone number.")

        # Semak Mule email — 20pts per report, max +60
        email_semak_boost = 0
        if email_semak and email_semak["found"]:
            email_semak_boost = min(60, email_semak["reports"] * 20)
            external_score += email_semak_boost
            findings.append(f"🚨 This email has {email_semak['reports']} scam report(s) on Semak Mule (PDRM).")
        elif email_semak and not email_semak["found"]:
            findings.append("✅ This email address — no reports found on Semak Mule (PDRM).")
        elif email_semak is None and detected_email:
            findings.append("⚠️ Could not reach Semak Mule to verify this email.")

        # Social handle — max +15
        if detected_social and social_result:
            handle = detected_social["handle"]
            platform = detected_social["platform"]
            if social_result["found_reports"]:
                count = social_result["report_count"]
                external_score += min(15, count * 5)
                findings.append(f"🚨 @{handle} ({platform}) found in {count} scam-related search result(s).")
                findings += [f"  • {s}" for s in social_result["snippets"][:2]]
            else:
                findings.append(f"✅ @{handle} ({platform}) — no scam reports found online.")

        # Legitimacy signals — reduce external score
        if detected_url:
            try:
                domain = urlparse(detected_url).netloc.lower().removeprefix("www.")
                if any(domain == s or domain.endswith("." + s) for s in SAFE_DOMAINS):
                    external_score -= 20
                    findings.append(f"✅ {domain} is a recognised legitimate domain.")
            except Exception:
                pass

        # Valid phone with no Semak Mule reports — slight negative signal
        if detected_phone and phone_result and phone_result.get("valid") and semak_boost == 0:
            external_score -= 10

        # Phone baseline — AI unreliable for bare numbers
        if detected_phone and ai_result["score"] < 25:
            ai_result["score"] = 25
            findings.append("Phone number detected — cannot determine safety from number alone.")

        # ── Step 6: Weighted formula — AI 50% + external signals 50% ──
        external_score = max(0, min(100, external_score))
        final_score = round((ai_result["score"] * 0.5) + (external_score * 0.5))

        # ── Hard overrides — high-confidence signals force minimum scores ──
        phone_reports = semak_result.get("reports", 0) if semak_result and semak_result["found"] else 0
        email_reports = email_semak.get("reports", 0) if email_semak and email_semak["found"] else 0

        # Semak Mule is PDRM's official database — any report = confirmed scam
        if phone_reports >= 1 or email_reports >= 1:
            final_score = max(final_score, 75)   # SCAM
        if phone_reports >= 2 or email_reports >= 2:
            final_score = max(final_score, 85)
        if phone_reports >= 3 or email_reports >= 3:
            final_score = max(final_score, 92)

        # VirusTotal multiple engines flagged → force ≥ 75
        if (url_result and url_result.get("malicious", 0) >= 3) or \
           (ip_result and ip_result.get("malicious", 0) >= 3):
            final_score = max(final_score, 75)

        # Final clamp and status
        final_score = min(100, max(0, final_score))

        if final_score >= 70:
            final_status = "SCAM"
        elif final_score >= 31:
            final_status = "SUSPICIOUS"
        else:
            final_status = "SAFE"

        return jsonify({
            "score": final_score,
            "status": final_status,
            "reason": ai_result["reason"],
            "findings": findings,
            "url_scanned": detected_url,
            "url_flagged": url_result["flagged"] if url_result else None,
            "ip_scanned": detected_ip,
            "ip_flagged": ip_result["flagged"] if ip_result else None,
            "phone_scanned": detected_phone,
            "phone_info": phone_result.get("info") if phone_result else None,
            "phone_valid": phone_result["valid"] if phone_result else None,
            "phone_country": phone_result.get("country") if phone_result else None,
            "phone_country_code": phone_result.get("country_code") if phone_result else None,
            "phone_location": phone_result.get("location") if phone_result else None,
            "phone_carrier": phone_result.get("carrier") if phone_result else None,
            "phone_line_type": phone_result.get("line_type") if phone_result else None,
            "phone_international": phone_result.get("international_format") if phone_result else None,
            "semak_mule_reports": semak_result["reports"] if semak_result else None,
            "semak_mule_found": semak_result["found"] if semak_result else None,
            "email_scanned": detected_email,
            "email_semak_found": email_semak["found"] if email_semak else None,
            "email_semak_reports": email_semak["reports"] if email_semak else None,
            "social_handle": detected_social["handle"] if detected_social else None,
            "social_platform": detected_social["platform"] if detected_social else None,
            "social_found_reports": social_result["found_reports"] if social_result else None,
            "social_report_count": social_result["report_count"] if social_result else None,
            "social_snippets": social_result["snippets"] if social_result else None,
        })

    except Exception as e:
        return jsonify({"error": f"Analysis failed: {str(e)}"}), 500


# ── Upload Image Route (for profile picture) ─────────────
@app.route("/upload-image", methods=["POST"])
def upload_image():
    try:
        image_b64 = request.form.get("image")
        if not image_b64:
            return jsonify({"error": "No image provided"}), 400
        url = upload_to_imgbb(image_b64)
        if url:
            return jsonify({"url": url})
        return jsonify({"error": "Upload failed"}), 500
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ── Health Check Route ───────────────────────────────────
@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "Backend is running!"})


# ── Run Server ───────────────────────────────────────────
if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5000)
