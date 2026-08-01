import { NextResponse } from "next/server";
import { canManageMember, circleMemberFor, roleRank, requireCircleMember } from "../../../../../lib/circles-server";
import { isUuid } from "../../../../../lib/social-server";

const ROLE_OPTIONS = new Set(["admin", "moderator", "member"]);

export async function POST(request, { params }) {
  const { slug } = await params;
  const context = await requireCircleMember(slug);
  if (context.error) return NextResponse.json({ error: context.error }, { status: context.status });

  const body = await request.json().catch(() => ({}));
  const action = body.action;
  const targetUserId = body.targetUserId;
  if (!isUuid(targetUserId) || targetUserId === context.viewer.id) return NextResponse.json({ error: "Choose another Circle member." }, { status: 400 });
  const target = await circleMemberFor(context.admin, context.circle.id, targetUserId);
  if (!target) return NextResponse.json({ error: "That Circle member is no longer available." }, { status: 404 });

  if (action === "unban") {
    if (roleRank(context.membership.role) < roleRank("admin") || target.status !== "banned") return NextResponse.json({ error: "Only Circle owners and admins can restore a banned member." }, { status: 403 });
    const { error } = await context.admin.from("circle_members").update({ status: "active", muted_until: null }).eq("circle_id", context.circle.id).eq("user_id", targetUserId);
    if (error) return NextResponse.json({ error: "That member could not be restored. Try again." }, { status: 500 });
    return NextResponse.json({ restored: true });
  }

  if (target.status !== "active" || !canManageMember(context.membership.role, target.role)) {
    return NextResponse.json({ error: "You don’t have permission to manage this Circle member." }, { status: 403 });
  }

  if (action === "role") {
    const role = body.role;
    if (!ROLE_OPTIONS.has(role) || role === "owner" || roleRank(context.membership.role) <= roleRank(role)) {
      return NextResponse.json({ error: "That role change is not available to you." }, { status: 403 });
    }
    const { error } = await context.admin.from("circle_members").update({ role }).eq("circle_id", context.circle.id).eq("user_id", targetUserId);
    if (error) return NextResponse.json({ error: "That member role could not be updated. Try again." }, { status: 500 });
    return NextResponse.json({ role });
  }

  if (action === "mute") {
    const hours = Math.min(Math.max(Number(body.hours) || 1, 1), 168);
    const mutedUntil = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
    const { error } = await context.admin.from("circle_members").update({ muted_until: mutedUntil }).eq("circle_id", context.circle.id).eq("user_id", targetUserId);
    if (error) return NextResponse.json({ error: "That member could not be muted. Try again." }, { status: 500 });
    return NextResponse.json({ mutedUntil });
  }

  if (action === "unmute") {
    const { error } = await context.admin.from("circle_members").update({ muted_until: null }).eq("circle_id", context.circle.id).eq("user_id", targetUserId);
    if (error) return NextResponse.json({ error: "That member could not be unmuted. Try again." }, { status: 500 });
    return NextResponse.json({ unmuted: true });
  }

  if (action === "kick") {
    const { error } = await context.admin.from("circle_members").delete().eq("circle_id", context.circle.id).eq("user_id", targetUserId);
    if (error) return NextResponse.json({ error: "That member could not be removed. Try again." }, { status: 500 });
    return NextResponse.json({ kicked: true });
  }

  if (action === "ban") {
    if (roleRank(context.membership.role) < roleRank("admin")) return NextResponse.json({ error: "Only Circle owners and admins can ban members." }, { status: 403 });
    const { error } = await context.admin.from("circle_members").update({ status: "banned", muted_until: null }).eq("circle_id", context.circle.id).eq("user_id", targetUserId);
    if (error) return NextResponse.json({ error: "That member could not be banned. Try again." }, { status: 500 });
    return NextResponse.json({ banned: true });
  }

  return NextResponse.json({ error: "That Circle moderation action is not available." }, { status: 400 });
}
