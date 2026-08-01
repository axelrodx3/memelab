import { createClient } from "./supabase/server";
import { memberPair, relationshipForViewer } from "./social-server";

function memberFromFriendship(friendship, viewerId) {
  return friendship.member_one_id === viewerId ? friendship.member_two : friendship.member_one;
}

function memberFromConversation(conversation, viewerId) {
  return conversation.member_one_id === viewerId ? conversation.member_two : conversation.member_one;
}

export async function getProfileRelationship(viewerId, targetId) {
  if (!viewerId || !targetId || viewerId === targetId) return "none";
  const { memberOneId, memberTwoId } = memberPair(viewerId, targetId);
  const supabase = await createClient();
  const { data } = await supabase
    .from("friendships")
    .select("id,member_one_id,member_two_id,requested_by_id,status,created_at,updated_at,accepted_at")
    .eq("member_one_id", memberOneId)
    .eq("member_two_id", memberTwoId)
    .maybeSingle();
  return relationshipForViewer(data, viewerId);
}

export async function getFriendsForMember(viewerId) {
  if (!viewerId) return { friends: [], incoming: [], outgoing: [] };
  const supabase = await createClient();
  const { data } = await supabase
    .from("friendships")
    .select(`
      id,member_one_id,member_two_id,requested_by_id,status,created_at,updated_at,accepted_at,
      member_one:profiles!friendships_member_one_id_fkey(id,username,display_name,avatar_url,friend_count),
      member_two:profiles!friendships_member_two_id_fkey(id,username,display_name,avatar_url,friend_count)
    `)
    .or(`member_one_id.eq.${viewerId},member_two_id.eq.${viewerId}`)
    .order("updated_at", { ascending: false });

  const groups = { friends: [], incoming: [], outgoing: [] };
  (data || []).forEach((friendship) => {
    const member = memberFromFriendship(friendship, viewerId);
    if (!member) return;
    const item = { ...friendship, member };
    const relationship = relationshipForViewer(friendship, viewerId);
    if (relationship === "friends") groups.friends.push(item);
    else if (relationship === "incoming") groups.incoming.push(item);
    else groups.outgoing.push(item);
  });
  return groups;
}

export async function getConversationsForMember(viewerId) {
  if (!viewerId) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("direct_conversations")
    .select(`
      id,member_one_id,member_two_id,member_one_last_read_at,member_two_last_read_at,
      last_message_at,last_message_preview,created_at,
      member_one:profiles!direct_conversations_member_one_id_fkey(id,username,display_name,avatar_url),
      member_two:profiles!direct_conversations_member_two_id_fkey(id,username,display_name,avatar_url)
    `)
    .or(`member_one_id.eq.${viewerId},member_two_id.eq.${viewerId}`)
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  return (data || []).map((conversation) => ({
    ...conversation,
    member: memberFromConversation(conversation, viewerId)
  }));
}

export async function getConversationForMember(conversationId, viewerId) {
  if (!conversationId || !viewerId) return null;
  const supabase = await createClient();
  const { data: conversation } = await supabase
    .from("direct_conversations")
    .select(`
      id,member_one_id,member_two_id,member_one_last_read_at,member_two_last_read_at,
      last_message_at,last_message_preview,created_at,
      member_one:profiles!direct_conversations_member_one_id_fkey(id,username,display_name,avatar_url),
      member_two:profiles!direct_conversations_member_two_id_fkey(id,username,display_name,avatar_url)
    `)
    .eq("id", conversationId)
    .maybeSingle();
  if (!conversation) return null;

  const { data: messages } = await supabase
    .from("direct_messages")
    .select("id,conversation_id,sender_id,body,created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(100);

  return {
    ...conversation,
    member: memberFromConversation(conversation, viewerId),
    messages: messages || []
  };
}

export async function getMessageTarget(username, viewerId) {
  if (!username || !viewerId) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id,username,display_name,avatar_url,account_status")
    .ilike("username", username)
    .maybeSingle();
  if (!data || data.id === viewerId || data.account_status !== "active") return null;
  return data;
}
