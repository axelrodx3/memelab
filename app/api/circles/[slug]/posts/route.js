import { NextResponse } from "next/server";
import { cleanCircleText, isMuted, requireCircleMember } from "../../../../../lib/circles-server";

export async function POST(request, { params }) {
  const { slug } = await params;
  const context = await requireCircleMember(slug);
  if (context.error) return NextResponse.json({ error: context.error }, { status: context.status });
  if (isMuted(context.membership)) return NextResponse.json({ error: "Your Circle posting is temporarily muted." }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const title = cleanCircleText(body.title, 140);
  const postBody = cleanCircleText(body.body, 4000);
  if (!title) return NextResponse.json({ error: "Give the Circle post a title." }, { status: 400 });

  const { data: post, error } = await context.admin
    .from("circle_posts")
    .insert({ circle_id: context.circle.id, author_id: context.viewer.id, title, body: postBody })
    .select("id")
    .single();
  if (error || !post) return NextResponse.json({ error: "The Circle post could not be published. Try again." }, { status: 500 });
  return NextResponse.json(post, { status: 201 });
}
