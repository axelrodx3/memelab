import { cache } from "react";
import { createAdminClient } from "./supabase/server";

const memberFields = "circle_id,user_id,role,status,muted_until,joined_at,updated_at,member:profiles!circle_members_user_id_fkey(id,username,display_name,avatar_url,karma)";
const postFields = "id,circle_id,author_id,title,body,status,vote_score,comments_count,is_pinned,created_at,updated_at,edited_at,author:profiles!circle_posts_author_id_fkey(id,username,display_name,avatar_url,karma)";

function serializePost(post, viewerVote = 0) {
  return { ...post, viewerVote };
}

export async function getCirclesHome(viewerId) {
  const admin = createAdminClient();
  if (!admin || !viewerId) return { circles: [], invites: [] };

  const [membershipResult, inviteResult] = await Promise.all([
    admin.from("circle_members").select(`${memberFields},circle:circles!circle_members_circle_id_fkey(id,slug,name,description,member_count,owner_id,created_at,updated_at)`).eq("user_id", viewerId).eq("status", "active").order("updated_at", { ascending: false }),
    admin.from("circle_invites").select("id,circle_id,invited_user_id,invited_by_id,status,created_at,responded_at,circle:circles!circle_invites_circle_id_fkey(id,slug,name,description,member_count),inviter:profiles!circle_invites_invited_by_id_fkey(id,username,display_name,avatar_url)").eq("invited_user_id", viewerId).eq("status", "pending").order("created_at", { ascending: false })
  ]);

  return {
    circles: (membershipResult.data || []).map((membership) => ({ ...membership.circle, membership })),
    invites: inviteResult.data || []
  };
}

export const getCirclePage = cache(async (slug, viewerId) => {
  const admin = createAdminClient();
  if (!admin || !slug || !viewerId) return null;
  const { data: circle } = await admin
    .from("circles")
    .select("id,owner_id,slug,name,description,member_count,created_at,updated_at")
    .eq("slug", slug)
    .maybeSingle();
  if (!circle) return null;

  const { data: membership } = await admin
    .from("circle_members")
    .select(memberFields)
    .eq("circle_id", circle.id)
    .eq("user_id", viewerId)
    .eq("status", "active")
    .maybeSingle();
  if (!membership) return null;

  const canRestoreMembers = ["owner", "admin"].includes(membership.role);
  const [membersResult, bannedMembersResult, postsResult] = await Promise.all([
    admin.from("circle_members").select(memberFields).eq("circle_id", circle.id).eq("status", "active").order("role", { ascending: false }).order("joined_at", { ascending: true }),
    canRestoreMembers
      ? admin.from("circle_members").select(memberFields).eq("circle_id", circle.id).eq("status", "banned").order("updated_at", { ascending: false })
      : Promise.resolve({ data: [] }),
    admin.from("circle_posts").select(postFields).eq("circle_id", circle.id).eq("status", "active").order("is_pinned", { ascending: false }).order("created_at", { ascending: false }).limit(40)
  ]);

  const posts = postsResult.data || [];
  let voteMap = new Map();
  if (posts.length) {
    const { data: votes } = await admin.from("circle_post_votes").select("post_id,value").eq("user_id", viewerId).in("post_id", posts.map((post) => post.id));
    voteMap = new Map((votes || []).map((vote) => [vote.post_id, vote.value]));
  }

  return {
    circle,
    membership,
    members: membersResult.data || [],
    bannedMembers: bannedMembersResult.data || [],
    posts: posts.map((post) => serializePost(post, voteMap.get(post.id) || 0))
  };
});

export const getCirclePostPage = cache(async (slug, postId, viewerId) => {
  const base = await getCirclePage(slug, viewerId);
  if (!base) return null;
  const admin = createAdminClient();
  const { data: post } = await admin
    .from("circle_posts")
    .select(postFields)
    .eq("id", postId)
    .eq("circle_id", base.circle.id)
    .eq("status", "active")
    .maybeSingle();
  if (!post) return null;

  const [voteResult, commentsResult] = await Promise.all([
    admin.from("circle_post_votes").select("value").eq("post_id", post.id).eq("user_id", viewerId).maybeSingle(),
    admin.from("circle_comments").select("id,post_id,author_id,body,created_at,updated_at,edited_at,author:profiles!circle_comments_author_id_fkey(id,username,display_name,avatar_url,karma)").eq("post_id", post.id).order("created_at", { ascending: true }).limit(120)
  ]);

  return { ...base, post: serializePost(post, voteResult.data?.value || 0), comments: commentsResult.data || [] };
});
