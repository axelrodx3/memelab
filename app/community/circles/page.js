import { redirect } from "next/navigation";
import SiteHeader from "../../components/SiteHeader";
import CircleHub from "../../circles/CircleHub";
import { getCirclesHome } from "../../../lib/circles";
import { getViewer } from "../../../lib/supabase/server";

export const metadata = { title: "Circles | MemeLab Community" };
export const dynamic = "force-dynamic";

export default async function CommunityCirclesPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/auth?next=/community/circles");
  const { circles, invites } = await getCirclesHome(viewer.id);
  return <main className="community-page circles-page"><div className="ambient ambient-one" /><SiteHeader /><CircleHub circles={circles} invites={invites} basePath="/community/circles" /></main>;
}
