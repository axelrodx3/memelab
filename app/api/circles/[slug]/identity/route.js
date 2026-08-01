import { NextResponse } from "next/server";
import { requireCircleMember, updateCircleIdentity } from "../../../../../lib/circles-server";

export async function PATCH(request, { params }) {
  const { slug } = await params;
  const context = await requireCircleMember(slug);
  if (context.error) return NextResponse.json({ error: context.error }, { status: context.status });

  const values = await request.json().catch(() => ({}));
  const result = await updateCircleIdentity(context, values);
  if (result.error) return NextResponse.json({ error: result.error }, { status: result.status || 500 });
  return NextResponse.json(result.circle);
}
