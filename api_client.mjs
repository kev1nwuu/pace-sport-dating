export const API_VERSION = "v1";

export class PaceApiError extends Error {
  constructor(code, message, status) {
    super(message);
    this.name = "PaceApiError";
    this.code = code;
    this.status = status;
  }
}

function mutationOptions(body, { idempotencyKey } = {}) {
  if (typeof idempotencyKey !== "string" || !idempotencyKey.trim() || idempotencyKey.length > 128) {
    throw new PaceApiError("VALIDATION_ERROR", "An idempotency key is required.", 400);
  }
  return { method: "POST", headers: { "Idempotency-Key": idempotencyKey }, body: JSON.stringify(body) };
}

export function buildDiscoveryQuery({ distanceKm, sportId = null, goal = null, schedule = null }) {
  if (!Number.isFinite(distanceKm) || distanceKm <= 0) throw new TypeError("distanceKm must be a positive finite number");
  const query = new URLSearchParams({ distance_km: String(distanceKm) });
  if (sportId) query.set("sport_id", sportId);
  if (goal) query.set("goal", goal);
  if (schedule) query.set("schedule", schedule);
  return query;
}

export class PaceApiClient {
  constructor({ baseUrl = `/api/${API_VERSION}`, fetchImpl = globalThis.fetch } = {}) {
    if (typeof fetchImpl !== "function") throw new TypeError("PaceApiClient requires a fetch implementation");
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.fetchImpl = fetchImpl;
  }

  async request(path, options = {}) {
    if (typeof path !== "string" || !path.startsWith("/")) throw new TypeError("API paths must start with /");
    const headers = new Headers(options.headers);
    if (!headers.has("Accept")) headers.set("Accept", "application/json");
    if (options.body != null && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
    const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
      credentials: "same-origin",
      ...options,
      headers,
    });
    if (!response.ok) {
      const payload = typeof response.json === "function" ? await response.json().catch(() => null) : null;
      const failure = payload?.error ?? payload;
      throw new PaceApiError(
        typeof failure?.code === "string" ? failure.code : "API_ERROR",
        typeof failure?.message === "string" ? failure.message : `PACE API ${options.method ?? "GET"} ${path} failed with ${response.status}`,
        response.status,
      );
    }
    return response.status === 204 ? null : response.json();
  }

  listSports(locale) {
    return this.request(`/sports?locale=${encodeURIComponent(locale)}`);
  }

  authenticate(credentials) {
    return this.request("/auth/login", { method: "POST", body: JSON.stringify(credentials) });
  }

  getSession() {
    return this.request("/auth/session", { method: "GET", cache: "no-store", signal: AbortSignal.timeout(10000) });
  }

  completeOnboarding() {
    return this.request("/auth/onboarding/complete", { method: "POST" });
  }

  signOut() {
    return this.request("/auth/logout", { method: "POST" });
  }

  discover(filters) {
    return this.request(`/discover?${buildDiscoveryQuery(filters)}`);
  }

  getConnectionFeed({ cursor = null, limit = 20 } = {}) {
    const query = new URLSearchParams({ limit: String(limit) });
    if (cursor) query.set("cursor", cursor);
    return this.request(`/connections/feed?${query}`);
  }

  setConnectionPostLike(postId, liked) {
    return this.request(`/connections/feed/${encodeURIComponent(postId)}/like`, { method: "PUT", body: JSON.stringify({ liked }) });
  }

  createConnectionPostComment(postId, text) {
    return this.request(`/connections/feed/${encodeURIComponent(postId)}/comments`, { method: "POST", body: JSON.stringify({ text }) });
  }

  requestConnectionMediaUpload(file) {
    return this.request("/connections/feed/media-uploads", { method: "POST", body: JSON.stringify({ file_name: file.name, mime_type: file.type, size_bytes: file.size }) });
  }

  createConnectionPost(post) {
    return this.request("/connections/feed", { method: "POST", body: JSON.stringify(post) });
  }

  updateProfile(profile) {
    return this.request("/me/profile", { method: "PATCH", body: JSON.stringify(profile) });
  }

  getMembership() {
    return this.request("/me/membership");
  }

  listIncomingLikes() {
    return this.request("/me/likes");
  }

  getDirectInviteAccess(recipientId) {
    return this.request(`/invitations/direct/access?recipient_id=${encodeURIComponent(recipientId)}`);
  }

  getBillingContext() {
    return this.request("/billing/apple/context");
  }

  syncAppleTransaction({ signedTransaction, appAccountToken }) {
    return this.request("/billing/apple/transactions", { method: "POST", body: JSON.stringify({ signedTransaction, appAccountToken }) });
  }

  listActivities({ sportId = null, scope = "discover" } = {}) {
    const query = new URLSearchParams({ scope });
    if (sportId) query.set("sport_id", sportId);
    return this.request(`/activities?${query}`);
  }

  getActivity(id) {
    return this.request(`/activities/${encodeURIComponent(id)}`);
  }

  joinActivity(id, options) {
    return this.request(`/activities/${encodeURIComponent(id)}/join`, mutationOptions({}, options));
  }

  leaveActivity(id, options) {
    return this.request(`/activities/${encodeURIComponent(id)}/leave`, mutationOptions({}, options));
  }

  createActivity(input, options) {
    return this.request("/activities", mutationOptions(input, options));
  }

  sendDirectInvite(input, options) {
    return this.request("/invitations/direct", mutationOptions(input, options));
  }
}
