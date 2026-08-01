import { NextResponse } from "next/server";
import { canInviteMember, findCircleMemberByUsername, requireCircleMember } from "../../../../../lib/circles-server";

export async function POST(request, { params }) {
  const { slug } = await params;
  const context = await requireCircleMember(slug);
  if (context.error) return NextResponse.json({ error: context.error }, { status: context.status });

  const body = await request.json().catch(() => ({}));
  const target = await findCircleMemberByUsername(context.admin, body.username);
  if (!target) return NextResponse.json({ error: "That active MemeLab member could not be found." }, { status: 404 });

  const permitted = await canInviteMember(context.admin, context.circle, context.membership, target.id);
  if (permitted.error) return NextResponse.json({ error: permitted.error }, { status: permitted.status });

  const { error } = await context.admin.from("circle_invites").insert({
    circle_id: context.circle.id,
    invited_user_id: target.id,
    invited_by_id: context.viewer.id
  });
  if (error?.code === "23505") return NextResponse.json({ error: "This member already has a pending invite." }, { status: 409 });
  if (error) return NextResponse.json({ error: "The Circle invite could not be sent. Try again." }, { status: 500 });
  return NextResponse.json({ invited: target.username }, { status: 201 });
}
