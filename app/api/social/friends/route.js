import { NextResponse } from "next/server";
import {
  getActiveMember,
  getFriendship,
  hasBlockBetween,
  isUuid,
  memberPair,
  relationshipForViewer,
  requireSocialMember
} from "../../../../lib/social-server";

function responseRelationship(friendship, viewerId) {
  return {
    relationship: relationshipForViewer(friendship, viewerId),
    friendship: friendship || null
  };
}

export async function POST(request) {
  const context = await requireSocialMember();
  if (context.error) return NextResponse.json({ error: context.error }, { status: context.status });

  const body = await request.json().catch(() => ({}));
  const action = body.action;
  const targetUserId = body.targetUserId;
  if (!isUuid(targetUserId) || targetUserId === context.viewer.id) {
    return NextResponse.json({ error: "Choose another active MemeLab member." }, { status: 400 });
  }

  const target = await getActiveMember(context.admin, targetUserId);
  if (!target) return NextResponse.json({ error: "That member is no longer available." }, { status: 404 });
  if (await hasBlockBetween(context.admin, context.viewer.id, targetUserId)) {
    return NextResponse.json({ error: "You can’t use friend requests with this member." }, { status: 403 });
  }

  const pair = memberPair(context.viewer.id, targetUserId);
  let friendship = await getFriendship(context.admin, context.viewer.id, targetUserId);

  if (action === "send") {
    if (friendship?.status === "accepted") return NextResponse.json(responseRelationship(friendship, context.viewer.id));
    if (friendship?.status === "pending") {
      if (friendship.requested_by_id === context.viewer.id) return NextResponse.json(responseRelationship(friendship, context.viewer.id));
      return NextResponse.json({ error: "This member already sent you a request. Accept it from Friends." }, { status: 409 });
    }
    const { data, error } = await context.admin
      .from("friendships")
      .insert({
        member_one_id: pair.memberOneId,
        member_two_id: pair.memberTwoId,
        requested_by_id: context.viewer.id
      })
      .select("id,member_one_id,member_two_id,requested_by_id,status,created_at,updated_at,accepted_at")
      .single();
    if (error) return NextResponse.json({ error: "The friend request could not be sent. Try again." }, { status: 500 });
    return NextResponse.json(responseRelationship(data, context.viewer.id), { status: 201 });
  }

  if (!friendship) return NextResponse.json({ error: "That friend request no longer exists." }, { status: 404 });

  if (action === "accept") {
    if (friendship.status !== "pending" || friendship.requested_by_id === context.viewer.id) {
      return NextResponse.json({ error: "There is no incoming request to accept." }, { status: 409 });
    }
    const { data, error } = await context.admin
      .from("friendships")
      .update({ status: "accepted", accepted_at: new Date().toISOString() })
      .eq("id", friendship.id)
      .eq("status", "pending")
      .select("id,member_one_id,member_two_id,requested_by_id,status,created_at,updated_at,accepted_at")
      .single();
    if (error) return NextResponse.json({ error: "The request could not be accepted. Try again." }, { status: 500 });
    return NextResponse.json(responseRelationship(data, context.viewer.id));
  }

  const canRemove = (action === "decline" && friendship.status === "pending" && friendship.requested_by_id !== context.viewer.id)
    || (action === "cancel" && friendship.status === "pending" && friendship.requested_by_id === context.viewer.id)
    || (action === "remove" && friendship.status === "accepted");
  if (!canRemove) return NextResponse.json({ error: "That friend action is no longer available." }, { status: 409 });

  const { error } = await context.admin.from("friendships").delete().eq("id", friendship.id);
  if (error) return NextResponse.json({ error: "The friend connection could not be updated. Try again." }, { status: 500 });
  friendship = null;
  return NextResponse.json(responseRelationship(friendship, context.viewer.id));
}
