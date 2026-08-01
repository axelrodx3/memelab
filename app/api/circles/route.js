import { NextResponse } from "next/server";
import { createCircleForViewer } from "../../../lib/circles-server";
import { requireSocialMember } from "../../../lib/social-server";

export async function POST(request) {
  const context = await requireSocialMember();
  if (context.error) return NextResponse.json({ error: context.error }, { status: context.status });

  const body = await request.json().catch(() => ({}));
  const result = await createCircleForViewer(context.viewer.id, body.name, body.description);
  if (result.error) return NextResponse.json({ error: result.error }, { status: result.status || 500 });
  return NextResponse.json(result.circle, { status: 201 });
}
