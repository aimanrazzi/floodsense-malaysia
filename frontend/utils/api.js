import { auth } from "../firebase";
import { BACKEND_URL } from "../config";

/**
 * Authenticated POST to the backend.
 * Automatically attaches the Firebase ID token as Authorization: Bearer <token>.
 * Falls back gracefully if user is not signed in.
 */
export async function securePost(path, body, signal) {
  const headers = { "Content-Type": "application/json" };

  try {
    const currentUser = auth.currentUser;
    if (currentUser) {
      const token = await currentUser.getIdToken(true);
      headers["Authorization"] = `Bearer ${token}`;
    }
  } catch {
    // Token fetch failed — send without auth (backend will reject if auth is enforced)
  }

  return fetch(`${BACKEND_URL}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal,
  });
}
