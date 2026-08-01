import { createAdminClient, createClient } from "./supabase/server";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value) {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

export function memberPair(firstId, secondId) {
  return firstId < secondId
    ? { memberOneId: firstId, memberTwoId: secondId }
    : { memberOneId: secondId, memberTwoId: firstId };
}

export function relationshipForViewer(friendship, viewerId) {
  if (!friendship) return "none";
  if (friendship.status === "accepted") return "friends";
  return friendship.requested_by_id === viewerId ? "outgoing" : "incoming";
}

export async function requireSocialMember() {
  const session = await createClient();
  const { data: claimsData, error: claimsError } = await session.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (claimsError || !userId) return { error: "Sign in to use MemeLab social." , status: 401 };

  const admin = createAdminClient();
  if (!admin) return { error: "MemeLab social is temporarily unavailable.", status: 503 };

  const { data: viewer, error: viewerError } = await admin
    .from("profiles")
    .select("id,username,display_name,avatar_url,account_status")
    .eq("id", userId)
    .maybeSingle();
  if (viewerError || !viewer || viewer.account_status !== "active") {
    return { error: "Reactivate your MemeLab account before using social features.", status: 403 };
  }

  return { session, admin, viewer };
}

export async function getActiveMember(admin, userId) {
  if (!isUuid(userId)) return null;
  const { data } = await admin
    .from("profiles")
    .select("id,username,display_name,avatar_url,account_status,friend_count")
    .eq("id", userId)
    .maybeSingle();
  return data?.account_status === "active" ? data : null;
}

export async function hasBlockBetween(admin, firstId, secondId) {
  const [first, second] = await Promise.all([
    admin.from("user_blocks").select("blocker_id").eq("blocker_id", firstId).eq("blocked_id", secondId).maybeSingle(),
    admin.from("user_blocks").select("blocker_id").eq("blocker_id", secondId).eq("blocked_id", firstId).maybeSingle()
  ]);
  return Boolean(first.data || second.data);
}

export async function getFriendship(admin, firstId, secondId) {
  const { memberOneId, memberTwoId } = memberPair(firstId, secondId);
  const { data, error } = await admin
    .from("friendships")
    .select("id,member_one_id,member_two_id,requested_by_id,status,created_at,updated_at,accepted_at")
    .eq("member_one_id", memberOneId)
    .eq("member_two_id", memberTwoId)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

export async function getConversation(admin, firstId, secondId) {
  const { memberOneId, memberTwoId } = memberPair(firstId, secondId);
  const { data, error } = await admin
    .from("direct_conversations")
    .select("id,member_one_id,member_two_id,member_one_last_read_at,member_two_last_read_at,last_message_at,last_message_preview,created_at")
    .eq("member_one_id", memberOneId)
    .eq("member_two_id", memberTwoId)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

export async function canMessageMember(admin, senderId, recipientId) {
  const { data, error } = await admin.rpc("can_send_direct_message", {
    sender_id: senderId,
    recipient_id: recipientId
  });
  if (error) throw error;
  return Boolean(data);
}

export function cleanMessageBody(value) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, 2000);
}
