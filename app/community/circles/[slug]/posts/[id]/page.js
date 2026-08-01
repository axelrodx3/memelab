import { redirect } from "next/navigation";
import SiteHeader from "../../../../../components/SiteHeader";
import CirclePostThread from "../../../../../circles/[slug]/posts/[id]/CirclePostThread";
import { getCirclePostPage } from "../../../../../../lib/circles";
import { getViewer } from "../../../../../../lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function CommunityCirclePostPage({ params }) {
  const { slug, id } = await params;
  const viewer = await getViewer();
  if (!viewer) redirect(`/auth?next=/community/circles/${slug}/posts/${id}`);
  const data = await getCirclePostPage(slug, id, viewer.id);
  if (!data) redirect("/community/circles");
  return <main className="community-page circles-page"><div className="ambient ambient-one" /><SiteHeader /><CirclePostThread {...data} viewer={viewer} basePath="/community/circles" /></main>;
}
