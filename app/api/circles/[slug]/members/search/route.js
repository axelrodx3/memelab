import { NextResponse } from "next/server";
import { getCircleInviteSuggestions, requireCircleMember } from "../../../../../../lib/circles-server";

export async function GET(request, { params }) {
  const { slug } = await params;
  const context = await requireCircleMember(slug);
  if (context.error) return NextResponse.json({ error: context.error }, { status: context.status });

  const query = new URL(request.url).searchParams.get("q") || "";
  const result = await getCircleInviteSuggestions(context, query);
  if (result.error) return NextResponse.json({ error: result.error }, { status: result.status || 500 });
  return NextResponse.json({ members: result.members });
}
