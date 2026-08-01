import { NextResponse } from "next/server";
import { canModerate, requireCircleMember } from "../../../../../lib/circles-server";
import { isUuid, requireSocialMember } from "../../../../../lib/social-server";

export async function DELETE(_request, { params }) {
  const { id } = await params;
  const social = await requireSocialMember();
  if (social.error) return NextResponse.json({ error: social.error }, { status: social.status });
  if (!isUuid(id)) return NextResponse.json({ error: "That Circle comment was not found." }, { status: 404 });

  const { data: comment } = await social.admin
    .from("circle_comments")
    .select("id,post_id,author_id")
    .eq("id", id)
    .maybeSingle();
  if (!comment) return NextResponse.json({ error: "That Circle comment was not found." }, { status: 404 });

  const { data: post } = await social.admin
    .from("circle_posts")
    .select("circle_id")
    .eq("id", comment.post_id)
    .maybeSingle();
  const { data: circle } = await social.admin
    .from("circles")
    .select("slug")
    .eq("id", post?.circle_id)
    .maybeSingle();
  if (!circle?.slug) return NextResponse.json({ error: "That Circle comment was not found." }, { status: 404 });

  const context = await requireCircleMember(circle.slug);
  if (context.error) return NextResponse.json({ error: context.error }, { status: context.status });
  const canDelete = comment.author_id === context.viewer.id || canModerate(context.membership.role);
  if (!canDelete) return NextResponse.json({ error: "You don’t have permission to remove this Circle comment." }, { status: 403 });

  const { error } = await context.admin.from("circle_comments").delete().eq("id", comment.id);
  if (error) return NextResponse.json({ error: "This Circle comment could not be deleted. Try again." }, { status: 500 });
  return NextResponse.json({ deleted: true });
}
