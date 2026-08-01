import { NextResponse } from "next/server";
import { requireCirclePost } from "../../../../../../lib/circles-server";

export async function POST(request, { params }) {
  const { id } = await params;
  const context = await requireCirclePost(id);
  if (context.error) return NextResponse.json({ error: context.error }, { status: context.status });
  const body = await request.json().catch(() => ({}));
  const value = Number(body.value);
  if (value !== 1 && value !== -1) return NextResponse.json({ error: "Choose an upvote or downvote." }, { status: 400 });

  const { data: previous } = await context.admin
    .from("circle_post_votes")
    .select("value")
    .eq("post_id", context.post.id)
    .eq("user_id", context.viewer.id)
    .maybeSingle();
  const nextValue = previous?.value === value ? 0 : value;
  const operation = nextValue === 0
    ? context.admin.from("circle_post_votes").delete().eq("post_id", context.post.id).eq("user_id", context.viewer.id)
    : context.admin.from("circle_post_votes").upsert({ post_id: context.post.id, user_id: context.viewer.id, value: nextValue });
  const { error } = await operation;
  if (error) return NextResponse.json({ error: "Your Circle vote could not be saved. Try again." }, { status: 500 });

  const { data: post } = await context.admin.from("circle_posts").select("vote_score").eq("id", context.post.id).single();
  return NextResponse.json({ value: nextValue, score: post?.vote_score || 0 });
}
