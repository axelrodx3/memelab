import { NextResponse } from "next/server";
import { requireCircleMember } from "../../../../lib/circles-server";

export async function DELETE(_request, { params }) {
  const { slug } = await params;
  const context = await requireCircleMember(slug);
  if (context.error) return NextResponse.json({ error: context.error }, { status: context.status });
  if (context.membership.role !== "owner" || context.circle.owner_id !== context.viewer.id) {
    return NextResponse.json({ error: "Only the Circle owner can delete this Circle." }, { status: 403 });
  }

  const folder = `${context.viewer.id}/circles/${context.circle.id}`;
  const { data: assets } = await context.admin.storage.from("avatars").list(folder, { limit: 100 });
  const { error } = await context.admin.from("circles").delete().eq("id", context.circle.id).eq("owner_id", context.viewer.id);
  if (error) return NextResponse.json({ error: "This Circle could not be deleted. Try again." }, { status: 500 });

  if (assets?.length) await context.admin.storage.from("avatars").remove(assets.map((asset) => `${folder}/${asset.name}`));
  return NextResponse.json({ deleted: true });
}
