import { NextResponse } from "next/server";

export async function GET(request) {
  const asset = request.nextUrl.searchParams.get("asset");
  if (!asset) return NextResponse.json({ error: "Missing image asset." }, { status: 400 });

  if (!/^[a-zA-Z0-9._-]+\.(jpg|jpeg|png|webp)$/i.test(asset)) {
    return NextResponse.json({ error: "Invalid image asset." }, { status: 400 });
  }

  const response = await fetch(`https://i.imgflip.com/${asset}`, { next: { revalidate: 86400 } });
  if (!response.ok) return NextResponse.json({ error: "Image unavailable." }, { status: response.status });

  return new NextResponse(await response.arrayBuffer(), {
    headers: {
      "Content-Type": response.headers.get("content-type") || "image/jpeg",
      "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800"
    }
  });
}
