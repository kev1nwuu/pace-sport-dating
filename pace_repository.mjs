import { discoverOrWaitlist } from "./app_logic.mjs?v=pace-release-audit-58";
import { addConnectionPostComment, prependConnectionPost, toggleConnectionPostLike } from "./connection_feed.mjs?v=pace-release-audit-58";
import { createEngagementService, createEngagementStore } from "./engagement_service.mjs?v=pace-release-audit-58";

function clone(value) {
  return structuredClone(value);
}

function requirePost(posts, postId) {
  const post = posts.find((item) => item.id === postId);
  if (!post) throw new RangeError(`Unknown connection post: ${postId}`);
  return post;
}

const PREVIEW_SESSION_KEY = "pace-preview-session-v1";
const PREVIEW_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

// Preview continuity only: this marker is never an identity or paid entitlement.
function createPreviewSession(storage, now) {
  let marker = null;
  let canUseStorage = storage != null;

  function clear() {
    marker = null;
    if (storage == null) return;
    try {
      storage.removeItem(PREVIEW_SESSION_KEY);
    } catch {
      canUseStorage = false;
    }
  }

  return {
    markAuthenticated() {
      marker = { version: 1, expiresAt: now() + PREVIEW_SESSION_TTL_MS };
      if (!canUseStorage) return;
      try {
        storage.setItem(PREVIEW_SESSION_KEY, JSON.stringify(marker));
      } catch {
        canUseStorage = false;
      }
    },
    restore() {
      if (canUseStorage) {
        try {
          const saved = storage.getItem(PREVIEW_SESSION_KEY);
          try {
            marker = saved == null ? null : JSON.parse(saved);
          } catch {
            clear();
          }
        } catch {
          canUseStorage = false;
        }
      }
      if (!marker || Array.isArray(marker) || marker.version !== 1
        || Object.keys(marker).length !== 2 || !Number.isFinite(marker.expiresAt)
        || marker.expiresAt <= now()) {
        clear();
        return null;
      }
      return { authenticated: true };
    },
    clear,
  };
}

/**
 * Local preview Adapter for the PACE data seam. Product data stays in memory;
 * injected storage can remember only the non-sensitive preview session marker.
 * The asynchronous interface also matches the HTTP Adapter.
 */
export function createLocalPaceRepository({ candidates = [], posts = [], profile = {}, actor = { id: "user_kevin", name: "Kevin" }, users = [], membership = null, activities = [], matches = [], blocks = [], likes = [], now = Date.now, sessionStorage = null } = {}) {
  let storedCandidates = clone(candidates);
  let storedPosts = clone(posts);
  let storedProfile = clone(profile);
  const session = createPreviewSession(sessionStorage, now);
  // Explicit constructor seeds are for local previews/tests only. No browser
  // storage, profile form, or purchase callback can grant paid entitlement.
  const engagement = createEngagementService({
    actorId: actor.id,
    now,
    store: createEngagementStore({
      users: [...candidates.map((candidate) => ({ ...candidate, name: candidate.name ?? candidate.id })), ...users, actor],
      memberships: membership ? { [actor.id]: membership } : {},
      activities,
      matches,
      blocks,
      likes,
    }),
  });

  return Object.freeze({
    async authenticate({ email }) {
      session.markAuthenticated();
      return { email };
    },

    async completeOnboarding() {
      session.markAuthenticated();
      return { authenticated: true };
    },

    async restoreSession() {
      return session.restore();
    },

    async signOut() {
      session.clear();
      return null;
    },

    async discover({ distanceKm, sportId = null }) {
      const matchingSport = sportId
        ? storedCandidates.filter((candidate) => candidate.sportIds?.includes(sportId))
        : storedCandidates;
      return clone(discoverOrWaitlist(matchingSport, distanceKm));
    },

    async listFeed() {
      return clone(storedPosts);
    },

    async setPostLike(postId, liked) {
      const current = requirePost(storedPosts, postId);
      if (Boolean(current.liked_by_me) !== Boolean(liked)) {
        storedPosts = toggleConnectionPostLike(storedPosts, postId);
      }
      return clone(requirePost(storedPosts, postId));
    },

    async addComment(postId, text) {
      requirePost(storedPosts, postId);
      const comment = {
        id: `comment_local_${crypto.randomUUID()}`,
        author_name: "Kevin",
        text: String(text ?? "").trim(),
      };
      if (!comment.text) throw new TypeError("Comment text is required");
      storedPosts = addConnectionPostComment(storedPosts, postId, comment);
      return clone(comment);
    },

    async publish(post) {
      const next = prependConnectionPost(storedPosts, post);
      if (next === storedPosts) throw new TypeError("Connection post is invalid");
      storedPosts = next;
      return clone(storedPosts[0]);
    },

    async saveProfile(profileValue) {
      storedProfile = clone(profileValue);
      return clone(storedProfile);
    },

    getMembership: engagement.getMembership,
    listIncomingLikes: engagement.listIncomingLikes,
    getDirectInviteAccess: engagement.getDirectInviteAccess,
    getBillingContext: engagement.getBillingContext,
    syncAppleTransaction: engagement.syncAppleTransaction,
    listActivities: engagement.listActivities,
    getActivity: engagement.getActivity,
    joinActivity: engagement.joinActivity,
    leaveActivity: engagement.leaveActivity,
    createActivity: engagement.createActivity,
    sendDirectInvite: engagement.sendDirectInvite,
  });
}

/** HTTP Adapter for the same data seam. PaceApiClient owns transport details. */
export function createHttpPaceRepository(client) {
  if (!client) throw new TypeError("HTTP repository requires a PaceApiClient");

  return Object.freeze({
    authenticate(credentials) {
      return client.authenticate(credentials);
    },

    async completeOnboarding() {
      const response = await client.completeOnboarding();
      if (response?.authenticated !== true) throw new Error("The server did not confirm an authenticated account after onboarding.");
      return { authenticated: true };
    },

    async restoreSession() {
      try {
        const response = await client.getSession();
        return response?.authenticated === true ? { authenticated: true } : null;
      } catch (error) {
        if (error?.status === 401) return null;
        throw error;
      }
    },

    signOut() {
      return client.signOut();
    },

    async discover(filters) {
      const response = await client.discover(filters);
      if (Array.isArray(response)) {
        return { state: response.length ? "results" : "waitlist", candidates: response };
      }
      return response;
    },

    async listFeed() {
      const response = await client.getConnectionFeed();
      return Array.isArray(response) ? response : response.items;
    },

    setPostLike(postId, liked) {
      return client.setConnectionPostLike(postId, liked);
    },

    addComment(postId, text) {
      return client.createConnectionPostComment(postId, text);
    },

    publish(post) {
      return client.createConnectionPost(post);
    },

    saveProfile(profile) {
      return client.updateProfile(profile);
    },

    getMembership() { return client.getMembership(); },
    async listIncomingLikes() {
      const response = await client.listIncomingLikes();
      return Array.isArray(response) ? response : response.items;
    },
    getDirectInviteAccess(recipientId) { return client.getDirectInviteAccess(recipientId); },
    getBillingContext() { return client.getBillingContext(); },
    syncAppleTransaction(input) { return client.syncAppleTransaction(input); },
    async listActivities(filters) {
      const response = await client.listActivities(filters);
      return Array.isArray(response) ? response : response.items;
    },
    getActivity(id) { return client.getActivity(id); },
    joinActivity(id, options) { return client.joinActivity(id, options); },
    leaveActivity(id, options) { return client.leaveActivity(id, options); },
    createActivity(input, options) { return client.createActivity(input, options); },
    sendDirectInvite(input, options) { return client.sendDirectInvite(input, options); },
  });
}
