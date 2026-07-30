import { cache } from "react";
import { createAdminClient, createClient } from "./supabase/server";

function serializePost(post, viewerVote = 0) {
  return {
    id: post.id,
    title: post.title,
    caption: post.caption,
    imageUrl: post.image_url,
    isMature: post.is_mature,
    voteScore: post.vote_score,
    upvotesCount: post.upvotes_count,
    downvotesCount: post.downvotes_count,
    commentsCount: post.comments_count,
    createdAt: post.created_at,
    sourceLabel: post.source_label,
    postKind: post.post_kind || "image",
    channelSlug: post.channel_slug || null,
    author: post.author || null,
    viewerVote
  };
}

export async function getCommunityPosts(sort = "hot", viewerId = null) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return [];
  const supabase = await createClient();
  let query = supabase
    .from("posts")
    .select(`
      id,title,caption,image_url,is_mature,vote_score,upvotes_count,
      downvotes_count,comments_count,created_at,source_label,
      post_kind,channel_slug,
      author:profiles!posts_author_id_fkey(username,display_name,avatar_url,karma)
    `)
    .eq("status", "active")
    .eq("post_kind", "image")
    .limit(30);

  if (sort === "new") query = query.order("created_at", { ascending: false });
  else if (sort === "top") query = query.order("vote_score", { ascending: false }).order("created_at", { ascending: false });
  else query = query.order("vote_score", { ascending: false }).order("comments_count", { ascending: false }).order("created_at", { ascending: false });

  const { data: posts, error } = await query;
  if (error || !posts?.length) return [];

  let voteMap = new Map();
  if (viewerId) {
    const { data: votes } = await supabase
      .from("post_votes")
      .select("post_id,value")
      .eq("user_id", viewerId)
      .in("post_id", posts.map((post) => post.id));
    voteMap = new Map((votes || []).map((vote) => [vote.post_id, vote.value]));
  }

  return posts.map((post) => serializePost(post, voteMap.get(post.id) || 0));
}

export const getCommunityPost = cache(async (id, viewerId = null) => {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return null;
  const supabase = await createClient();
  const { data: post, error } = await supabase
    .from("posts")
    .select(`
      id,title,caption,image_url,is_mature,vote_score,upvotes_count,
      downvotes_count,comments_count,created_at,source_label,
      post_kind,channel_slug,
      author:profiles!posts_author_id_fkey(username,display_name,avatar_url,karma)
    `)
    .eq("id", id)
    .eq("status", "active")
    .maybeSingle();
  if (error || !post) return null;

  let viewerVote = 0;
  if (viewerId) {
    const { data: vote } = await supabase
      .from("post_votes")
      .select("value")
      .eq("post_id", id)
      .eq("user_id", viewerId)
      .maybeSingle();
    viewerVote = vote?.value || 0;
  }

  return serializePost(post, viewerVote);
});

export async function getDiscussions(channel = "general", sort = "new", viewerId = null) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return [];
  const supabase = await createClient();
  let query = supabase
    .from("posts")
    .select(`
      id,title,caption,image_url,is_mature,vote_score,upvotes_count,
      downvotes_count,comments_count,created_at,source_label,post_kind,channel_slug,
      author:profiles!posts_author_id_fkey(username,display_name,avatar_url,karma)
    `)
    .eq("status", "active")
    .eq("post_kind", "discussion")
    .eq("channel_slug", channel)
    .limit(40);

  query = sort === "top"
    ? query.order("vote_score", { ascending: false }).order("created_at", { ascending: false })
    : query.order("created_at", { ascending: false });
  const { data: posts, error } = await query;
  if (error || !posts?.length) return [];

  let voteMap = new Map();
  if (viewerId) {
    const { data: votes } = await supabase
      .from("post_votes")
      .select("post_id,value")
      .eq("user_id", viewerId)
      .in("post_id", posts.map((post) => post.id));
    voteMap = new Map((votes || []).map((vote) => [vote.post_id, vote.value]));
  }
  return posts.map((post) => serializePost(post, voteMap.get(post.id) || 0));
}

export async function getCommunityStats() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return { members: 0, postsToday: 0, commentsToday: 0, votesToday: 0 };
  const supabase = createAdminClient();
  if (!supabase) return { members: 0, postsToday: 0, commentsToday: 0, votesToday: 0 };
  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);
  const [members, posts, comments, votes] = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("account_status", "active"),
    supabase.from("posts").select("id", { count: "exact", head: true }).eq("status", "active").gte("created_at", since.toISOString()),
    supabase.from("comments").select("id", { count: "exact", head: true }).eq("status", "active").gte("created_at", since.toISOString()),
    supabase.from("post_votes").select("post_id", { count: "exact", head: true }).gte("created_at", since.toISOString())
  ]);
  return {
    members: members.count || 0,
    postsToday: posts.count || 0,
    commentsToday: comments.count || 0,
    votesToday: votes.count || 0
  };
}

export async function getPostComments(postId, viewerId = null) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return [];
  const supabase = await createClient();
  const { data: comments } = await supabase
    .from("comments")
    .select(`
      id,body,score,parent_id,created_at,
      author:profiles!comments_author_id_fkey(username,display_name,avatar_url,karma)
    `)
    .eq("post_id", postId)
    .eq("status", "active")
    .order("score", { ascending: false })
    .order("created_at", { ascending: true });
  if (!comments?.length || !viewerId) return comments || [];

  const { data: votes } = await supabase
    .from("comment_votes")
    .select("comment_id,value")
    .eq("user_id", viewerId)
    .in("comment_id", comments.map((comment) => comment.id));
  const voteMap = new Map((votes || []).map((vote) => [vote.comment_id, vote.value]));
  return comments.map((comment) => ({ ...comment, viewerVote: voteMap.get(comment.id) || 0 }));
}

export const getPublicProfile = cache(async (username) => {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return null;
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("id,username,display_name,avatar_url,banner_url,bio,karma,created_at,profile_visibility,show_activity,account_status")
    .ilike("username", username)
    .maybeSingle();
  if (!profile || profile.account_status !== "active") return null;

  if (profile.profile_visibility !== "public") {
    return { ...profile, isPrivate: true, posts: [], comments: [], favorites: [] };
  }

  let posts = [];
  let comments = [];
  let favorites = [];
  if (profile.show_activity) {
    const [postsResult, commentsResult, favoritesResult] = await Promise.all([
      supabase
        .from("posts")
        .select("id,title,image_url,vote_score,comments_count,created_at,is_mature")
        .eq("author_id", profile.id)
        .eq("status", "active")
        .eq("post_kind", "image")
        .order("created_at", { ascending: false })
        .limit(24),
      supabase
        .from("comments")
        .select("id,body,score,created_at,post:posts!comments_post_id_fkey(id,title)")
        .eq("author_id", profile.id)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(24),
      supabase
        .from("template_favorites")
        .select("created_at,template:template_assets!template_favorites_template_id_fkey(id,name,image_url,category,aliases,box_count)")
        .eq("user_id", profile.id)
        .order("created_at", { ascending: false })
        .limit(24)
    ]);
    posts = postsResult.data || [];
    comments = commentsResult.data || [];
    favorites = (favoritesResult.data || []).map((item) => ({ ...item.template, favorited_at: item.created_at }));
  }

  return { ...profile, isPrivate: false, posts, comments, favorites };
});
