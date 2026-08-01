import { NextResponse } from "next/server";
import { createAdminClient, createClient } from "../../../../../lib/supabase/server";

export async function DELETE(_request, { params }) {
  const { id } = await params;
  const session = await createClient();
  const { data: claimsData, error: claimsError } = await session.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (claimsError || !userId) return NextResponse.json({ error: "Sign in to delete a post." }, { status: 401 });

  const { data: post, error: postError } = await session
    .from("posts")
    .select("id,author_id,storage_path")
    .eq("id", id)
    .maybeSingle();
  if (postError || !post) return NextResponse.json({ error: "Post not found." }, { status: 404 });
  if (post.author_id !== userId) return NextResponse.json({ error: "Only the creator can delete this post." }, { status: 403 });

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "Post deletion is temporarily unavailable." }, { status: 503 });

  if (post.storage_path) {
    const { error: storageError } = await admin.storage.from("community").remove([post.storage_path]);
    if (storageError) return NextResponse.json({ error: "The post image could not be removed. Please try again." }, { status: 500 });
  }

  const { error: deleteError } = await admin.from("posts").delete().eq("id", id).eq("author_id", userId);
  if (deleteError) return NextResponse.json({ error: "The post could not be deleted. Please try again." }, { status: 500 });
  return NextResponse.json({ deleted: true });
}
