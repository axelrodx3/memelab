import { NextResponse } from "next/server";
import { cleanCircleText, isMuted, requireCirclePost } from "../../../../../../lib/circles-server";

export async function POST(request, { params }) {
  const { id } = await params;
  const context = await requireCirclePost(id);
  if (context.error) return NextResponse.json({ error: context.error }, { status: context.status });
  if (isMuted(context.membership)) return NextResponse.json({ error: "Your Circle commenting is temporarily muted." }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  const comment = cleanCircleText(body.body, 4000);
  if (!comment) return NextResponse.json({ error: "Write something before commenting." }, { status: 400 });

  const { data, error } = await context.admin
    .from("circle_comments")
    .insert({ post_id: context.post.id, author_id: context.viewer.id, body: comment })
    .select("id")
    .single();
  if (error || !data) return NextResponse.json({ error: "The Circle comment could not be posted. Try again." }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
