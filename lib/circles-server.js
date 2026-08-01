import { createAdminClient } from "./supabase/server";
import { getActiveMember, hasBlockBetween, isUuid, requireSocialMember } from "./social-server";

export const CIRCLE_ROLE_RANK = { member: 0, moderator: 1, admin: 2, owner: 3 };

export function roleRank(role) {
  return CIRCLE_ROLE_RANK[role] ?? -1;
}

export function canInvite(role) {
  return roleRank(role) >= CIRCLE_ROLE_RANK.admin;
}

export function canModerate(role) {
  return roleRank(role) >= CIRCLE_ROLE_RANK.moderator;
}

export function canManageMember(actorRole, targetRole) {
  return roleRank(actorRole) > roleRank(targetRole);
}

export function cleanCircleName(value) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, 48) : "";
}

export function cleanCircleDescription(value) {
  return typeof value === "string" ? value.trim().slice(0, 360) : "";
}

export function cleanCircleText(value, maxLength) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

export function cleanCircleSearch(value) {
  return typeof value === "string"
    ? value.trim().replace(/[^a-zA-Z0-9 _-]/g, "").slice(0, 32)
    : "";
}

export function circleSlugBase(name) {
  const slug = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24);
  return slug.length >= 3 ? slug : "circle";
}

export async function requireCircleMember(slug) {
  const context = await requireSocialMember();
  if (context.error) return context;

  const { data: circle, error: circleError } = await context.admin
    .from("circles")
    .select("id,owner_id,slug,name,description,avatar_url,banner_url,member_count,created_at,updated_at")
    .eq("slug", slug)
    .maybeSingle();
  if (circleError || !circle) return { error: "This Circle is unavailable.", status: 404 };

  const { data: membership, error: membershipError } = await context.admin
    .from("circle_members")
    .select("circle_id,user_id,role,status,muted_until,joined_at,updated_at")
    .eq("circle_id", circle.id)
    .eq("user_id", context.viewer.id)
    .eq("status", "active")
    .maybeSingle();
  if (membershipError || !membership) return { error: "You need an active Circle invite to enter this space.", status: 403 };

  return { ...context, circle, membership };
}

export async function requireCirclePost(postId) {
  const context = await requireSocialMember();
  if (context.error) return context;
  if (!isUuid(postId)) return { error: "That Circle post was not found.", status: 404 };

  const { data: post, error: postError } = await context.admin
    .from("circle_posts")
    .select("id,circle_id,author_id,title,body,status,vote_score,comments_count,is_pinned,created_at,updated_at,edited_at")
    .eq("id", postId)
    .maybeSingle();
  if (postError || !post || post.status !== "active") return { error: "That Circle post was not found.", status: 404 };

  const { data: membership, error: membershipError } = await context.admin
    .from("circle_members")
    .select("circle_id,user_id,role,status,muted_until,joined_at,updated_at")
    .eq("circle_id", post.circle_id)
    .eq("user_id", context.viewer.id)
    .eq("status", "active")
    .maybeSingle();
  if (membershipError || !membership) return { error: "You need an active Circle invite to interact here.", status: 403 };

  return { ...context, post, membership };
}

export async function circleMemberFor(admin, circleId, userId) {
  if (!isUuid(circleId) || !isUuid(userId)) return null;
  const { data } = await admin
    .from("circle_members")
    .select("circle_id,user_id,role,status,muted_until,joined_at,updated_at")
    .eq("circle_id", circleId)
    .eq("user_id", userId)
    .maybeSingle();
  return data || null;
}

export async function findCircleMemberByUsername(admin, username) {
  const normalized = typeof username === "string" ? username.trim().replace(/^@/, "") : "";
  if (!normalized) return null;
  const { data } = await admin
    .from("profiles")
    .select("id,username,display_name,avatar_url,account_status")
    .ilike("username", normalized)
    .maybeSingle();
  return data?.account_status === "active" ? data : null;
}

function matchesSearch(member, query) {
  if (!query) return true;
  const needle = query.toLowerCase();
  return [member?.username, member?.display_name].some((value) => String(value || "").toLowerCase().includes(needle));
}

function searchScore(member, query) {
  if (!query) return 0;
  const needle = query.toLowerCase();
  const username = String(member?.username || "").toLowerCase();
  const displayName = String(member?.display_name || "").toLowerCase();
  if (username === needle) return 0;
  if (username.startsWith(needle)) return 1;
  if (displayName.startsWith(needle)) return 2;
  if (username.includes(needle)) return 3;
  return 4;
}

export async function getCircleInviteSuggestions(context, rawQuery) {
  if (!canInvite(context.membership.role)) return { error: "Only Circle owners and admins can invite members.", status: 403 };
  const query = cleanCircleSearch(rawQuery);
  const viewerId = context.viewer.id;
  const [membersResult, invitesResult, friendshipsResult, blocksResult] = await Promise.all([
    context.admin.from("circle_members").select("user_id,status").eq("circle_id", context.circle.id),
    context.admin.from("circle_invites").select("invited_user_id").eq("circle_id", context.circle.id).eq("status", "pending"),
    context.admin.from("friendships").select("member_one_id,member_two_id").eq("status", "accepted").or(`member_one_id.eq.${viewerId},member_two_id.eq.${viewerId}`),
    context.admin.from("user_blocks").select("blocker_id,blocked_id").or(`blocker_id.eq.${viewerId},blocked_id.eq.${viewerId}`)
  ]);

  const friendIds = (friendshipsResult.data || []).map((friendship) => friendship.member_one_id === viewerId ? friendship.member_two_id : friendship.member_one_id);
  const excluded = new Set([
    viewerId,
    ...(membersResult.data || []).map((member) => member.user_id),
    ...(invitesResult.data || []).map((invite) => invite.invited_user_id),
    ...(blocksResult.data || []).map((block) => block.blocker_id === viewerId ? block.blocked_id : block.blocker_id)
  ]);

  const memberFields = "id,username,display_name,avatar_url,account_status";
  const friendResult = friendIds.length
    ? await context.admin.from("profiles").select(memberFields).in("id", friendIds).eq("account_status", "active")
    : { data: [] };
  let search = context.admin.from("profiles").select(memberFields).eq("account_status", "active").neq("id", viewerId).limit(20);
  if (query) search = search.or(`username.ilike.%${query}%,display_name.ilike.%${query}%`);
  else search = search.order("created_at", { ascending: false });
  const searchResult = await search;

  const seen = new Set();
  const withFriendFlag = (member, isFriend) => ({ ...member, isFriend });
  const candidates = [
    ...(friendResult.data || []).filter((member) => matchesSearch(member, query)).sort((a, b) => searchScore(a, query) - searchScore(b, query)).map((member) => withFriendFlag(member, true)),
    ...(searchResult.data || []).sort((a, b) => searchScore(a, query) - searchScore(b, query)).map((member) => withFriendFlag(member, friendIds.includes(member.id)))
  ];
  const members = candidates.filter((member) => {
    if (excluded.has(member.id) || seen.has(member.id)) return false;
    seen.add(member.id);
    return true;
  }).slice(0, 8);
  return { members, status: 200 };
}

function isCircleAssetUrl(value, viewerId) {
  if (!value) return true;
  if (typeof value !== "string" || !process.env.NEXT_PUBLIC_SUPABASE_URL) return false;
  const prefix = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/${viewerId}/circles/`;
  return value.startsWith(prefix);
}

export async function updateCircleIdentity(context, values) {
  if (context.membership.role !== "owner") return { error: "Only the Circle owner can customize its identity.", status: 403 };
  const updates = {};
  if (Object.hasOwn(values, "name")) {
    const name = cleanCircleName(values.name);
    if (name.length < 3) return { error: "Give your Circle a name with at least 3 characters.", status: 400 };
    updates.name = name;
  }
  if (Object.hasOwn(values, "description")) updates.description = cleanCircleDescription(values.description);
  if (Object.hasOwn(values, "avatarUrl")) {
    if (!isCircleAssetUrl(values.avatarUrl, context.viewer.id)) return { error: "Use an image uploaded from this Circle.", status: 400 };
    updates.avatar_url = values.avatarUrl || null;
  }
  if (Object.hasOwn(values, "bannerUrl")) {
    if (!isCircleAssetUrl(values.bannerUrl, context.viewer.id)) return { error: "Use an image uploaded from this Circle.", status: 400 };
    updates.banner_url = values.bannerUrl || null;
  }
  if (!Object.keys(updates).length) return { circle: context.circle, status: 200 };
  const { data: circle, error } = await context.admin
    .from("circles")
    .update(updates)
    .eq("id", context.circle.id)
    .select("id,owner_id,slug,name,description,avatar_url,banner_url,member_count,created_at,updated_at")
    .single();
  if (error || !circle) return { error: "Your Circle identity could not be saved. Try again.", status: 500 };
  return { circle, status: 200 };
}

export async function createCircleForViewer(viewerId, name, description) {
  const admin = createAdminClient();
  if (!admin) return { error: "MemeLab Circles are temporarily unavailable.", status: 503 };
  const viewer = await getActiveMember(admin, viewerId);
  if (!viewer) return { error: "Reactivate your MemeLab account before creating a Circle.", status: 403 };

  const cleanName = cleanCircleName(name);
  if (cleanName.length < 3) return { error: "Give your Circle a name with at least 3 characters.", status: 400 };
  const cleanDescription = cleanCircleDescription(description);
  const base = circleSlugBase(cleanName);

  for (let attempt = 0; attempt < 12; attempt += 1) {
    const slug = attempt ? `${base.slice(0, Math.max(3, 28 - String(attempt + 1).length))}-${attempt + 1}` : base;
    const { data: circle, error } = await admin
      .from("circles")
      .insert({ owner_id: viewer.id, slug, name: cleanName, description: cleanDescription })
      .select("id,slug")
      .maybeSingle();
    if (error?.code === "23505") continue;
    if (error || !circle) return { error: "That Circle could not be created. Try a different name.", status: 500 };

    const { error: memberError } = await admin
      .from("circle_members")
      .insert({ circle_id: circle.id, user_id: viewer.id, role: "owner", status: "active" });
    if (!memberError) return { circle, status: 201 };

    await admin.from("circles").delete().eq("id", circle.id);
    return { error: "Your Circle could not be initialized. Try again.", status: 500 };
  }
  return { error: "That Circle name is taken. Try a different one.", status: 409 };
}

export async function canInviteMember(admin, circle, inviter, targetId) {
  if (!canInvite(inviter.role)) return { error: "Only Circle owners and admins can invite members.", status: 403 };
  if (!isUuid(targetId) || targetId === inviter.user_id) return { error: "Choose another active MemeLab member.", status: 400 };
  if (await hasBlockBetween(admin, inviter.user_id, targetId)) return { error: "You can’t invite this member right now.", status: 403 };
  const existing = await circleMemberFor(admin, circle.id, targetId);
  if (existing?.status === "banned") return { error: "This member is banned from the Circle.", status: 403 };
  if (existing?.status === "active") return { error: "This member is already in the Circle.", status: 409 };
  return { status: 200 };
}

export function isMuted(membership) {
  return Boolean(membership?.muted_until && new Date(membership.muted_until).getTime() > Date.now());
}
