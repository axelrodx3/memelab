import { NextResponse } from "next/server";
import {
  canMessageMember,
  cleanMessageBody,
  getActiveMember,
  getConversation,
  isUuid,
  memberPair,
  requireSocialMember
} from "../../../lib/social-server";

async function resolveConversation(admin, viewerId, recipientId) {
  const existing = await getConversation(admin, viewerId, recipientId);
  if (existing) return existing;
  const pair = memberPair(viewerId, recipientId);
  const { data, error } = await admin
    .from("direct_conversations")
    .insert({
      member_one_id: pair.memberOneId,
      member_two_id: pair.memberTwoId,
      created_by_id: viewerId
    })
    .select("id,member_one_id,member_two_id,member_one_last_read_at,member_two_last_read_at,last_message_at,last_message_preview,created_at")
    .single();

  if (!error) return data;
  if (error.code === "23505") return getConversation(admin, viewerId, recipientId);
  throw error;
}

export async function POST(request) {
  const context = await requireSocialMember();
  if (context.error) return NextResponse.json({ error: context.error }, { status: context.status });

  const body = await request.json().catch(() => ({}));
  if (body.action === "mark-read") {
    const conversationId = body.conversationId;
    if (!isUuid(conversationId)) return NextResponse.json({ error: "Conversation not found." }, { status: 400 });
    const { data: conversation } = await context.admin
      .from("direct_conversations")
      .select("id,member_one_id,member_two_id")
      .eq("id", conversationId)
      .maybeSingle();
    if (!conversation || (conversation.member_one_id !== context.viewer.id && conversation.member_two_id !== context.viewer.id)) {
      return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
    }
    const column = conversation.member_one_id === context.viewer.id ? "member_one_last_read_at" : "member_two_last_read_at";
    const { error } = await context.admin.from("direct_conversations").update({ [column]: new Date().toISOString() }).eq("id", conversationId);
    if (error) return NextResponse.json({ error: "The conversation could not be marked read." }, { status: 500 });
    return NextResponse.json({ markedRead: true });
  }

  const recipientId = body.recipientId;
  const message = cleanMessageBody(body.body);
  if (!isUuid(recipientId) || recipientId === context.viewer.id) {
    return NextResponse.json({ error: "Choose another active MemeLab member." }, { status: 400 });
  }
  if (!message) return NextResponse.json({ error: "Write a message before sending it." }, { status: 400 });

  const recipient = await getActiveMember(context.admin, recipientId);
  if (!recipient) return NextResponse.json({ error: "That member is no longer available." }, { status: 404 });

  let allowed = false;
  try {
    allowed = await canMessageMember(context.admin, context.viewer.id, recipientId);
  } catch {
    return NextResponse.json({ error: "Messaging is temporarily unavailable. Try again in a moment." }, { status: 503 });
  }
  if (!allowed) {
    return NextResponse.json({ error: "This member is not accepting messages from you right now." }, { status: 403 });
  }

  let conversation;
  try {
    conversation = await resolveConversation(context.admin, context.viewer.id, recipientId);
  } catch {
    return NextResponse.json({ error: "The conversation could not be opened. Try again." }, { status: 500 });
  }
  if (!conversation) return NextResponse.json({ error: "The conversation could not be opened. Try again." }, { status: 500 });

  const { data: sent, error: messageError } = await context.admin
    .from("direct_messages")
    .insert({ conversation_id: conversation.id, sender_id: context.viewer.id, body: message })
    .select("id,conversation_id,sender_id,body,created_at")
    .single();
  if (messageError) {
    return NextResponse.json({ error: messageError.message || "The message could not be sent. Try again." }, { status: 500 });
  }

  const readerColumn = conversation.member_one_id === context.viewer.id
    ? "member_one_last_read_at"
    : "member_two_last_read_at";
  await context.admin
    .from("direct_conversations")
    .update({ [readerColumn]: sent.created_at })
    .eq("id", conversation.id);

  return NextResponse.json({ conversationId: conversation.id, message: sent }, { status: 201 });
}
