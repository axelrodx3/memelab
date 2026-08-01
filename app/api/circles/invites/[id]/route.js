import { NextResponse } from "next/server";
import { circleMemberFor } from "../../../../../lib/circles-server";
import { isUuid, requireSocialMember } from "../../../../../lib/social-server";

export async function POST(request, { params }) {
  const { id } = await params;
  const context = await requireSocialMember();
  if (context.error) return NextResponse.json({ error: context.error }, { status: context.status });
  if (!isUuid(id)) return NextResponse.json({ error: "That Circle invite was not found." }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const action = body.action;
  if (action !== "accept" && action !== "decline") return NextResponse.json({ error: "Choose to accept or decline this invite." }, { status: 400 });

  const { data: invite } = await context.admin
    .from("circle_invites")
    .select("id,circle_id,invited_user_id,invited_by_id,status")
    .eq("id", id)
    .eq("invited_user_id", context.viewer.id)
    .eq("status", "pending")
    .maybeSingle();
  if (!invite) return NextResponse.json({ error: "That Circle invite is no longer available." }, { status: 404 });

  if (action === "decline") {
    const { error } = await context.admin.from("circle_invites").update({ status: "declined", responded_at: new Date().toISOString() }).eq("id", invite.id);
    if (error) return NextResponse.json({ error: "The invite could not be declined. Try again." }, { status: 500 });
    return NextResponse.json({ declined: true });
  }

  const existing = await circleMemberFor(context.admin, invite.circle_id, context.viewer.id);
  if (existing?.status === "banned") return NextResponse.json({ error: "You cannot join this Circle." }, { status: 403 });
  if (!existing) {
    const { error: memberError } = await context.admin.from("circle_members").insert({
      circle_id: invite.circle_id,
      user_id: context.viewer.id,
      invited_by_id: invite.invited_by_id,
      role: "member",
      status: "active"
    });
    if (memberError) return NextResponse.json({ error: "The Circle could not be joined. Try again." }, { status: 500 });
  }

  const { error } = await context.admin.from("circle_invites").update({ status: "accepted", responded_at: new Date().toISOString() }).eq("id", invite.id);
  if (error) return NextResponse.json({ error: "The Circle was joined, but the invite could not be finalized. Refresh once." }, { status: 500 });
  return NextResponse.json({ accepted: true });
}
