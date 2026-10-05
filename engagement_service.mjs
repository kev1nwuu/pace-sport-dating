import { getSportById } from "./sport_catalog.mjs?v=pace-release-audit-58";

export class EngagementError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.name = "EngagementError";
    this.code = code;
    this.status = status;
  }
}

const copy = (value) => structuredClone(value);
const pairKey = (left, right) => JSON.stringify([left, right].sort());
const reject = (code, message, status) => { throw new EngagementError(code, message, status); };

function textValue(value, name, maxLength, optional = false) {
  if (optional && value == null) return "";
  if (typeof value !== "string" || (!optional && !value.trim()) || value.trim().length > maxLength) {
    reject("VALIDATION_ERROR", `${name} must be ${optional ? "at most" : "between 1 and"} ${maxLength} characters.`);
  }
  return value.trim();
}

function futureDate(value, now) {
  if (typeof value !== "string" || !/T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value) || !Number.isFinite(Date.parse(value)) || Date.parse(value) <= now) {
    reject("VALIDATION_ERROR", "Choose a future start time with a timezone.");
  }
  return new Date(value).toISOString();
}

function sessionFields(input, now) {
  if (!input || typeof input !== "object" || Array.isArray(input)) reject("VALIDATION_ERROR", "Session details are required.");
  if (!getSportById(input.sportId)) reject("VALIDATION_ERROR", "Choose a supported sport.");
  return {
    sportId: input.sportId,
    startsAt: futureDate(input.startsAt, now),
    location: textValue(input.location, "Location", 160),
  };
}

/** Membership records must come from trusted server storage, never request bodies. */
export function resolveMembership(record, now = Date.now()) {
  const expiresAt = record?.expiresAt ?? null;
  const unexpired = Number.isFinite(Date.parse(expiresAt)) && Date.parse(expiresAt) > now;
  const eligible = record?.tier === "plus" && ["active", "cancelled", "grace_period"].includes(record.status);
  const active = Boolean(eligible && unexpired && !record.revokedAt);
  let status = record?.status ?? "free";
  if (record?.revokedAt || status === "revoked") status = "revoked";
  else if (record?.tier === "plus" && !unexpired) status = "expired";
  return {
    tier: active ? "plus" : "free",
    status,
    expiresAt,
    autoRenews: active && record.autoRenews === true && status !== "cancelled",
    entitlements: { directInvites: active, hostActivities: active, seeLikes: active },
    source: record?.source ?? "none",
  };
}

/**
 * Trusted seed / reference store. A deployed backend must persist this data,
 * enforce unique constraints, and run capacity + idempotency mutations in one
 * database transaction. Never populate this store from client profile fields.
 * matches / blocks contain pairs of user IDs; blocks are enforced in both directions.
 */
export function createEngagementStore({ users = [], memberships = {}, matches = [], blocks = [], likes = [], activities = [], invites = [], appAccountTokens = {} } = {}) {
  return {
    users: new Map(users.map((user) => [user.id, copy(user)])),
    memberships: new Map(Object.entries(copy(memberships))),
    matches: new Set(matches.map(([left, right]) => pairKey(left, right))),
    blocks: new Set(blocks.map(([left, right]) => pairKey(left, right))),
    likes: copy(likes),
    activities: new Map(activities.map((activity) => {
      const attendees = new Set(activity.attendeeIds ?? []);
      attendees.add(activity.host.id);
      return [activity.id, { ...copy(activity), attendeeIds: attendees }];
    })),
    invites: new Map(invites.map((invite) => [invite.id, copy(invite)])),
    appAccountTokens: new Map(Object.entries(appAccountTokens)),
    transactionOwners: new Map(),
    appleEvents: new Map(),
    idempotency: new Map(),
  };
}

/**
 * Actor comes from the authenticated server session. There is deliberately no
 * actorId / isMatched / membership argument on a mutation. The local repository
 * uses this same reference policy for preview only, not as a security boundary.
 *
 * appleVerifier.verifyAndGetSubscription({ signedTransaction }) is a SERVER-ONLY
 * dependency: verify Apple's JWS certificate chain and query current subscription
 * status, then return the normalized fields validated in syncAppleTransaction.
 * Decoding a JWS or trusting a native success callback is not verification.
 */
export function createEngagementService({ actorId, store = createEngagementStore(), now = Date.now, appleVerifier = null, appleConfig = null } = {}) {
  function actor() {
    const value = store.users.get(actorId);
    if (!value || value.disabled) reject("UNAUTHENTICATED", "Sign in to continue.", 401);
    return value;
  }

  function membership() {
    actor();
    return resolveMembership(store.memberships.get(actorId), now());
  }

  function requirePlus(entitlement) {
    if (!membership().entitlements[entitlement]) reject("PLUS_REQUIRED", "PACE Plus is required for this feature.", 403);
  }

  function directInviteAccess(recipientId) {
    actor();
    textValue(recipientId, "Recipient", 128);
    const recipient = store.users.get(recipientId);
    if (recipientId === actorId) reject("VALIDATION_ERROR", "Choose another person to invite.");
    if (!recipient || recipient.disabled || store.blocks.has(pairKey(actorId, recipientId))) reject("RECIPIENT_UNAVAILABLE", "This person cannot receive invitations.", 403);
    const matched = store.matches.has(pairKey(actorId, recipientId));
    return { allowed: matched || membership().entitlements.directInvites, matched };
  }

  function activityById(id) {
    actor();
    const activity = store.activities.get(id);
    if (!activity || store.blocks.has(pairKey(actorId, activity.host.id))) reject("ACTIVITY_NOT_FOUND", "This activity is no longer available.", 404);
    return activity;
  }

  function activityView(activity) {
    return copy({
      id: activity.id, title: activity.title, sportId: activity.sportId, startsAt: activity.startsAt,
      location: activity.location, description: activity.description ?? "", pace: activity.pace ?? "",
      distanceKm: activity.distanceKm ?? null, capacity: activity.capacity, status: activity.status ?? "open",
      host: { id: activity.host.id, name: activity.host.name, verified: activity.host.verified === true },
      attendeeCount: activity.attendeeIds.size, joined: activity.attendeeIds.has(actorId), isHost: activity.host.id === actorId,
    });
  }

  function appleConfigured() {
    return typeof appleVerifier?.verifyAndGetSubscription === "function" && typeof appleConfig?.bundleId === "string" && Boolean(appleConfig.bundleId) && ["Sandbox", "Production"].includes(appleConfig.environment) && Array.isArray(appleConfig.products) && appleConfig.products.length > 0 && appleConfig.products.every((product) => typeof product.id === "string" && product.id);
  }

  function mutate(operation, payload, { idempotencyKey } = {}, action) {
    actor();
    const key = textValue(idempotencyKey, "Idempotency key", 128);
    const storageKey = JSON.stringify([actorId, operation, key]);
    const fingerprint = JSON.stringify(payload);
    const previous = store.idempotency.get(storageKey);
    if (previous) {
      if (previous.fingerprint !== fingerprint) reject("IDEMPOTENCY_CONFLICT", "This request key was already used for different details.", 409);
      return copy(previous.result);
    }
    // No await between policy checks and writes: atomic in this reference store.
    const result = action();
    store.idempotency.set(storageKey, { fingerprint, result: copy(result) });
    return copy(result);
  }

  return Object.freeze({
    async getMembership() { return membership(); },

    async getDirectInviteAccess(recipientId) { return directInviteAccess(recipientId); },

    async listIncomingLikes() {
      requirePlus("seeLikes");
      return [...new Set(store.likes.filter(([, recipientId]) => recipientId === actorId).map(([senderId]) => senderId))]
        .filter((id) => id !== actorId && !store.blocks.has(pairKey(actorId, id)))
        .map((id) => store.users.get(id))
        .filter((user) => user && !user.disabled)
        .map((user) => copy({
          id: user.id, name: user.name, age: user.age ?? null, verified: user.verified === true,
          photoUrl: user.photoUrl ?? null, sportIds: user.sportIds ?? [], bio: user.bio ?? "", distanceKm: user.distanceKm ?? null,
        }));
    },

    async getBillingContext() {
      actor();
      if (!appleConfigured()) return { appAccountToken: null, products: [] };
      return {
        appAccountToken: store.appAccountTokens.get(actorId) ?? null,
        products: copy(appleConfig.products.map(({ id, period }) => ({ id, period }))),
        termsUrl: appleConfig.termsUrl ?? null,
        privacyUrl: appleConfig.privacyUrl ?? null,
      };
    },

    async listActivities({ sportId = null, scope = "discover" } = {}) {
      actor();
      if (sportId !== null && !getSportById(sportId)) reject("VALIDATION_ERROR", "Choose a supported sport.");
      if (!["discover", "joined", "hosting"].includes(scope)) reject("VALIDATION_ERROR", "Unknown activity list.");
      return [...store.activities.values()]
        .filter((activity) => !store.blocks.has(pairKey(actorId, activity.host.id)))
        .filter((activity) => activity.status !== "cancelled" && Date.parse(activity.startsAt) > now())
        .filter((activity) => !sportId || activity.sportId === sportId)
        .filter((activity) => scope === "discover" || (scope === "joined" ? activity.attendeeIds.has(actorId) : activity.host.id === actorId))
        .sort((left, right) => Date.parse(left.startsAt) - Date.parse(right.startsAt))
        .map(activityView);
    },

    async getActivity(id) { return activityView(activityById(id)); },

    async joinActivity(id, options) {
      const activity = activityById(id);
      if (activity.status === "cancelled" || Date.parse(activity.startsAt) <= now()) reject("ACTIVITY_CLOSED", "This activity is no longer accepting participants.", 409);
      return mutate("joinActivity", { id }, options, () => {
        if (activity.attendeeIds.has(actorId)) return activityView(activity);
        if (activity.attendeeIds.size >= activity.capacity) reject("ACTIVITY_FULL", "This activity is full.", 409);
        activity.attendeeIds.add(actorId);
        return activityView(activity);
      });
    },

    async leaveActivity(id, options) {
      const activity = activityById(id);
      if (activity.host.id === actorId) reject("HOST_CANNOT_LEAVE", "The host cannot leave their own activity.", 409);
      return mutate("leaveActivity", { id }, options, () => {
        activity.attendeeIds.delete(actorId);
        return activityView(activity);
      });
    },

    async createActivity(input, options) {
      requirePlus("hostActivities");
      if (actor().verified !== true) reject("HOST_VERIFICATION_REQUIRED", "Complete selfie verification before hosting.", 403);
      return mutate("createActivity", input, options, () => {
        const fields = sessionFields(input, now());
        const title = textValue(input.title, "Title", 80);
        const description = textValue(input.description, "Description", 1200, true);
        const pace = textValue(input.pace, "Pace", 80, true);
        if (!Number.isInteger(input.capacity) || input.capacity < 2 || input.capacity > 100) reject("VALIDATION_ERROR", "Capacity must be between 2 and 100 people.");
        const user = actor();
        const activity = {
          id: `activity_${crypto.randomUUID()}`, ...fields, title, description, pace,
          capacity: input.capacity, distanceKm: null, status: "open",
          host: { id: actorId, name: user.name, verified: user.verified === true },
          attendeeIds: new Set([actorId]),
        };
        store.activities.set(activity.id, activity);
        return activityView(activity);
      });
    },

    async sendDirectInvite(input, options) {
      const recipientId = textValue(input?.recipientId, "Recipient", 128);
      if (!directInviteAccess(recipientId).allowed) requirePlus("directInvites");
      return mutate("sendDirectInvite", input, options, () => {
        const fields = sessionFields(input, now());
        const note = textValue(input.note, "Invitation note", 300, true);
        const pending = [...store.invites.values()].some((invite) => invite.senderId === actorId && invite.recipientId === recipientId && invite.status === "pending" && Date.parse(invite.startsAt) > now());
        if (pending) reject("ALREADY_INVITED", "You already have a pending invitation to this person.", 409);
        const invite = { id: `invite_${crypto.randomUUID()}`, senderId: actorId, recipientId, ...fields, note, status: "pending", createdAt: new Date(now()).toISOString() };
        store.invites.set(invite.id, invite);
        // An invitation never creates a match or opens a message conversation.
        return invite;
      });
    },

    async syncAppleTransaction({ signedTransaction, appAccountToken } = {}) {
      actor();
      if (!appleConfigured()) {
        reject("APP_STORE_UNAVAILABLE", "App Store verification is not configured. No purchase has been applied.", 503);
      }
      const expectedToken = store.appAccountTokens.get(actorId);
      if (!expectedToken || appAccountToken !== expectedToken) reject("TRANSACTION_ACCOUNT_MISMATCH", "The purchase does not belong to this account.", 403);
      if (typeof signedTransaction !== "string" || !signedTransaction || signedTransaction.length > 65536) reject("VALIDATION_ERROR", "A signed App Store transaction is required.");
      const requestedAt = now();
      const verified = await appleVerifier.verifyAndGetSubscription({ signedTransaction });
      actor();
      if (store.appAccountTokens.get(actorId) !== expectedToken) reject("TRANSACTION_ACCOUNT_MISMATCH", "The account billing identity changed during verification. Please try again.", 403);
      if (!verified || verified.appAccountToken !== expectedToken || verified.bundleId !== appleConfig.bundleId || verified.environment !== appleConfig.environment || !appleConfig.products.some((product) => product.id === verified.productId)) {
        reject("TRANSACTION_INVALID", "The App Store transaction could not be verified for this app and account.", 403);
      }
      if (typeof verified.originalTransactionId !== "string" || !verified.originalTransactionId || typeof verified.transactionId !== "string" || !verified.transactionId || !["active", "cancelled", "expired", "revoked", "grace_period"].includes(verified.status) || !Number.isFinite(Date.parse(verified.expiresAt)) || !Number.isFinite(Date.parse(verified.signedAt)) || Date.parse(verified.signedAt) > now() + 300000 || (verified.revokedAt != null && !Number.isFinite(Date.parse(verified.revokedAt)))) {
        reject("TRANSACTION_INVALID", "The verified subscription status is incomplete.", 403);
      }
      const checkedAt = Date.parse(verified.statusCheckedAt);
      if (!Number.isFinite(checkedAt) || checkedAt < Math.max(requestedAt - 5000, now() - 60000) || checkedAt > now() + 5000) {
        reject("TRANSACTION_INVALID", "A fresh verified App Store subscription status is required.", 403);
      }
      const owner = store.transactionOwners.get(verified.originalTransactionId);
      if (owner && owner !== actorId) reject("TRANSACTION_ACCOUNT_MISMATCH", "This subscription is already linked to another account.", 403);
      const previous = store.appleEvents.get(verified.originalTransactionId);
      if (previous) {
        const version = Date.parse(verified.signedAt) - Date.parse(previous.signedAt);
        if (version < 0 || checkedAt < Date.parse(previous.statusCheckedAt)) return membership();
        // A conflicting response at the same signed version can remove access,
        // but restoring access requires newer signed evidence (e.g. refund reversal).
        const grantsAccess = (snapshot) => resolveMembership({ ...snapshot, tier: "plus" }, now()).tier === "plus";
        if (version === 0 && grantsAccess(verified) && !grantsAccess(previous)) return membership();
      }
      store.transactionOwners.set(verified.originalTransactionId, actorId);
      store.appleEvents.set(verified.originalTransactionId, copy(verified));
      // Refunding an older subscription chain must not erase another valid one.
      const subscriptions = [...store.appleEvents.values()]
        .filter((snapshot) => store.transactionOwners.get(snapshot.originalTransactionId) === actorId)
        .map((snapshot) => ({ ...snapshot, tier: "plus", source: "app_store", verifiedAt: snapshot.signedAt }))
        .sort((left, right) => {
          const activeDifference = Number(resolveMembership(right, now()).tier === "plus") - Number(resolveMembership(left, now()).tier === "plus");
          return activeDifference || Date.parse(right.expiresAt) - Date.parse(left.expiresAt) || Date.parse(right.signedAt) - Date.parse(left.signedAt);
        });
      store.memberships.set(actorId, subscriptions[0]);
      return membership();
    },
  });
}
