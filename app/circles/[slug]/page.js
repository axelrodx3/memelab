import { redirect } from "next/navigation";
import SiteHeader from "../../components/SiteHeader";
import CircleRoom from "./CircleRoom";
import { getCirclePage } from "../../../lib/circles";
import { getViewer } from "../../../lib/supabase/server";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }) {
  const { slug } = await params;
  return { title: `${slug} — MemeLab Circle` };
}

export default async function CirclePage({ params }) {
  const { slug } = await params;
  const viewer = await getViewer();
  if (!viewer) redirect(`/auth?next=/circles/${slug}`);
  const data = await getCirclePage(slug, viewer.id);
  if (!data) redirect("/circles");
  return <main className="circles-page"><div className="ambient ambient-one" /><SiteHeader /><CircleRoom {...data} viewer={viewer} /></main>;
}
