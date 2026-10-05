// The local MVP follows the same shape expected from GET /api/v1/connections/feed.
const LOCAL_POSTS = [
  {
    id: "post_maya_20260814_intervals",
    author_id: "user_maya",
    author: { name: "Maya", verified: true, connection_status: "connected" },
    created_at: "2026-08-14T18:36:00-04:00",
    visibility: "connections",
    sport_id: "running",
    caption: "Sunset laps and a conversation I didn’t want to end. Same time next week?",
    media: { type: "image", url: "assets/moments/runners-training.jpg", alt: "Runners training at sunset" },
    workout: { distance_km: 8.2, duration: "42:18", pace: "5:09 /km" },
    reaction_count: 18,
    liked_by_me: false,
    comments: [
      { id: "comment_1", author_name: "Noah", text: "That finish looks strong 🔥" },
      { id: "comment_2", author_name: "Kevin", text: "See you at the start line." },
    ],
  },
  {
    id: "post_noah_20260814_bouldering",
    author_id: "user_noah",
    author: { name: "Noah", verified: true, connection_status: "connected" },
    created_at: "2026-08-14T15:10:00-04:00",
    visibility: "connections",
    sport_id: "climbing",
    caption: "Finally sent the blue V5. Looking for someone to cheer on next time—coffee after?",
    media: { type: "image", url: "assets/moments/climbing-outdoors.jpg", alt: "A person climbing outdoors" },
    workout: { duration: "01:24:00", grade: "V5", sessions_this_week: 3 },
    reaction_count: 11,
    liked_by_me: true,
    comments: [{ id: "comment_3", author_name: "Maya", text: "I’m in for Saturday morning." }],
  },
  {
    id: "post_lea_20260813_ride",
    author_id: "user_lea",
    author: { name: "Léa", verified: true, connection_status: "connected" },
    created_at: "2026-08-13T20:05:00-04:00",
    visibility: "connections",
    sport_id: "cycling",
    caption: "Found a quiet lake loop with a perfect picnic stop. Saving this one to share.",
    media: { type: "image", url: "assets/moments/cycling-landscape.jpg", alt: "Cyclist riding through a landscape" },
    workout: { distance_km: 36.4, duration: "01:38:12", elevation_m: 284 },
    reaction_count: 24,
    liked_by_me: false,
    comments: [],
  },
];

export function createConnectionFeed() {
  return LOCAL_POSTS.map((post) => ({
    ...post,
    author: { ...post.author },
    media: Array.isArray(post.media) ? post.media.map((item) => ({ ...item })) : post.media ? { ...post.media } : null,
    workout: { ...post.workout, metrics: post.workout.metrics?.map((metric) => ({ ...metric })) },
    comments: post.comments.map((comment) => ({ ...comment })),
  }));
}

export function visibleConnectedPosts(posts) {
  if (!Array.isArray(posts)) return [];
  return posts.filter((post) => post?.visibility === "connections" && (post.is_my_post || post.author?.connection_status === "connected"));
}

export function prependConnectionPost(posts, post) {
  const hasCustomSport = typeof post?.sport_name === "string" && Boolean(post.sport_name.trim());
  if (!Array.isArray(posts) || !post?.id || !post.author_id || post.visibility !== "connections" || (!post.sport_id && !hasCustomSport)) return posts;
  return [{ ...post, is_my_post: true, reaction_count: 0, liked_by_me: false, comments: [] }, ...posts];
}

export function toggleConnectionPostLike(posts, postId) {
  if (!Array.isArray(posts)) return [];
  return posts.map((post) => post.id === postId ? {
    ...post,
    liked_by_me: !post.liked_by_me,
    reaction_count: Math.max(0, (Number.isFinite(post.reaction_count) ? post.reaction_count : 0) + (post.liked_by_me ? -1 : 1)),
  } : post);
}

export function addConnectionPostComment(posts, postId, comment) {
  if (!Array.isArray(posts)) return [];
  const text = typeof comment?.text === "string" ? comment.text.trim() : "";
  if (!text) return posts;
  return posts.map((post) => post.id === postId ? {
    ...post,
    comments: [...(Array.isArray(post.comments) ? post.comments : []), { id: comment.id, author_name: comment.author_name, text }],
  } : post);
}
