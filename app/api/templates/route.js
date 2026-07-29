import { NextResponse } from "next/server";
import { getTemplates } from "../../../lib/templates";

export async function GET() {
  const templates = await getTemplates();
  return NextResponse.json(
    templates.length ? { templates } : { templates, error: "Templates are temporarily unavailable." },
    {
      status: templates.length ? 200 : 502,
      headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" }
    }
  );
}
