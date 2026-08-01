import { NextResponse } from "next/server";
import { createClient } from "../../../../lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: claimsData, error } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (error || !userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [profile, settings, projects, favorites, posts, comments, postVotes, commentVotes, reports, notifications, friendships, conversations] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
    supabase.from("account_settings").select("*").eq("user_id", userId).maybeSingle(),
    supabase.from("projects").select("*").eq("user_id", userId).order("updated_at"),
    supabase.from("template_favorites").select("*").eq("user_id", userId).order("created_at"),
    supabase.from("posts").select("*").eq("author_id", userId).order("created_at"),
    supabase.from("comments").select("*").eq("author_id", userId).order("created_at"),
    supabase.from("post_votes").select("*").eq("user_id", userId).order("created_at"),
    supabase.from("comment_votes").select("*").eq("user_id", userId).order("created_at"),
    supabase.from("reports").select("*").eq("reporter_id", userId).order("created_at"),
    supabase.from("notifications").select("*").eq("user_id", userId).order("created_at"),
    supabase.from("friendships").select("*").or(`member_one_id.eq.${userId},member_two_id.eq.${userId}`).order("created_at"),
    supabase.from("direct_conversations").select("*").or(`member_one_id.eq.${userId},member_two_id.eq.${userId}`).order("created_at")
  ]);

  const conversationIds = (conversations.data || []).map((conversation) => conversation.id);
  const { data: messages } = conversationIds.length
    ? await supabase.from("direct_messages").select("*").in("conversation_id", conversationIds).order("created_at")
    : { data: [] };

  const archive = {
    exported_at: new Date().toISOString(),
    account_email: claimsData.claims.email || null,
    profile: profile.data || null,
    settings: settings.data || null,
    projects: projects.data || [],
    template_favorites: favorites.data || [],
    posts: posts.data || [],
    comments: comments.data || [],
    post_votes: postVotes.data || [],
    comment_votes: commentVotes.data || [],
    reports: reports.data || [],
    notifications: notifications.data || [],
    friendships: friendships.data || [],
    direct_conversations: conversations.data || [],
    direct_messages: messages || []
  };

  return new NextResponse(JSON.stringify(archive, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="memelab-data-${new Date().toISOString().slice(0, 10)}.json"`,
      "cache-control": "no-store"
    }
  });
}
