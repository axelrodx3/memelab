import { NextResponse } from "next/server";

export async function GET(request) {
  const source = request.nextUrl.searchParams.get("url");
  if (!source) return NextResponse.json({ error: "Missing image URL." }, { status: 400 });

  let parsed;
  try {
    parsed = new URL(source);
  } catch {
    return NextResponse.json({ error: "Invalid image URL." }, { status: 400 });
  }

  if (parsed.protocol !== "https:" || parsed.hostname !== "i.imgflip.com") {
    return NextResponse.json({ error: "Image host is not allowed." }, { status: 403 });
  }

  const response = await fetch(parsed.toString(), { next: { revalidate: 86400 } });
  if (!response.ok) return NextResponse.json({ error: "Image unavailable." }, { status: response.status });

  return new NextResponse(await response.arrayBuffer(), {
    headers: {
      "Content-Type": response.headers.get("content-type") || "image/jpeg",
      "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800"
    }
  });
}
