import { redirect } from "next/navigation";
import SiteHeader from "../../../components/SiteHeader";
import CircleRoom from "../../../circles/[slug]/CircleRoom";
import { getCirclePage } from "../../../../lib/circles";
import { getViewer } from "../../../../lib/supabase/server";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }) {
  const { slug } = await params;
  return { title: `${slug} | MemeLab Circle` };
}

export default async function CommunityCirclePage({ params }) {
  const { slug } = await params;
  const viewer = await getViewer();
  if (!viewer) redirect(`/auth?next=/community/circles/${slug}`);
  const data = await getCirclePage(slug, viewer.id);
  if (!data) redirect("/community/circles");
  return <main className="community-page circles-page"><div className="ambient ambient-one" /><SiteHeader /><CircleRoom {...data} viewer={viewer} basePath="/community/circles" /></main>;
}
