import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import SiteHeader from "../../components/SiteHeader";
import { getCommunityPost, getPostComments } from "../../../lib/community";
import { getViewer } from "../../../lib/supabase/server";
import PostCard from "../PostCard";
import CommentSection from "./CommentSection";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }) {
  const { id } = await params;
  const post = await getCommunityPost(id);
  if (!post) return { title: "Post not found — MemeLab" };
  return {
    title: `${post.title} — MemeLab Community`,
    description: post.caption || "View this post and join the conversation on MemeLab."
  };
}

export default async function CommunityPostPage({ params }) {
  const { id } = await params;
  const viewer = await getViewer();
  const [post, comments] = await Promise.all([
    getCommunityPost(id, viewer?.id),
    getPostComments(id, viewer?.id)
  ]);
  if (!post) notFound();

  return (
    <main className="community-post-page">
      <div className="ambient ambient-one" />
      <SiteHeader />
      <div className="post-detail-shell shell">
        <Link className="back-to-feed" href="/community"><ArrowLeft size={15} /> Back to the feed</Link>
        <PostCard
          post={post}
          viewerId={viewer?.id || null}
          showMature={viewer?.mature_content_enabled || false}
          detail
        />
        <CommentSection postId={post.id} comments={comments} viewer={viewer} />
      </div>
    </main>
  );
}
