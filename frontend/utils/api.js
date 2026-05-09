import { BACKEND_URL } from "../config";

// ── HTTP helpers ─────────────────────────────────────────────────────────────

async function get(path) {
  const res = await fetch(`${BACKEND_URL}${path}`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} on GET ${path}`);
  return res.json();
}

async function post(path, body) {
  const res = await fetch(`${BACKEND_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} on POST ${path}`);
  return res.json();
}

// ── Flood API ─────────────────────────────────────────────────────────────────

export const floodApi = {
  /** Current JPS readings per district with colour-coded risk status. */
  getLevels: () => get("/api/flood/levels"),

  /** Run ML + Claude on provided readings (or latest cached ones if omitted). */
  analyze: (readings) => post("/api/flood/analyze", readings ? { readings } : {}),

  /** Run a Claude analysis scoped to one specific district. */
  analyzeDistrict: (district, reading) =>
    post("/api/flood/analyze/district", { district, reading }),

  /** Last 20 alert events from Firestore (or in-memory fallback). */
  getAlerts: () => get("/api/flood/alerts"),

  /** Nearest evacuation centres. Pass district string or omit for all. */
  getEvacuationCenters: (district) =>
    get(`/api/flood/evacuate${district ? `?district=${encodeURIComponent(district)}` : ""}`),

  /**
   * Submit a rescue / help request on behalf of a citizen in distress.
   * Returns { case_id, message, nearest_centre, emergency_contacts }.
   */
  requestRescue: (district, situation, peopleCount, notes, latitude, longitude, phone) =>
    post("/api/rescue/request", {
      district,
      situation,
      people_count: peopleCount,
      notes: notes || "",
      phone: phone || "",
      ...(latitude  != null && { latitude }),
      ...(longitude != null && { longitude }),
    }),

  /** All active SOS rescue cases — for the rescuer dashboard. */
  getRescueCases: () => get("/api/rescue/cases"),

  /** Volunteer commits to responding — moves status from received → responding. */
  respondToCase: (caseId, responderName, responderPhone) =>
    post(`/api/rescue/respond/${caseId}`, {
      responder_name:  responderName  || "",
      responder_phone: responderPhone || "",
    }),

  /** Mark a case as resolved — only valid after responding. */
  resolveCase: (caseId, outcome = "Rescued successfully") =>
    post(`/api/rescue/resolve/${caseId}`, { outcome, officer: "Rescuer App" }),

  /** Report a false positive prediction for a district. */
  reportFeedback: (district, reportedRiskLevel, reason) =>
    post("/api/feedback/report", {
      district,
      reported_risk_level: reportedRiskLevel,
      reason: reason || "",
    }),

  /** Liveness check. */
  health: () => get("/health"),
};
