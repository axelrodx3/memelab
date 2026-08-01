import { NextResponse } from "next/server";
import { canModerate, requireCirclePost } from "../../../../../lib/circles-server";

export async function DELETE(_request, { params }) {
  const { id } = await params;
  const context = await requireCirclePost(id);
  if (context.error) return NextResponse.json({ error: context.error }, { status: context.status });
  const canDelete = context.post.author_id === context.viewer.id || canModerate(context.membership.role);
  if (!canDelete) return NextResponse.json({ error: "You don’t have permission to remove this Circle post." }, { status: 403 });

  const { error } = await context.admin.from("circle_posts").delete().eq("id", context.post.id);
  if (error) return NextResponse.json({ error: "This Circle post could not be deleted. Try again." }, { status: 500 });
  return NextResponse.json({ deleted: true });
}
