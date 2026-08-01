import { redirect } from "next/navigation";
import SiteHeader from "../components/SiteHeader";
import CircleHub from "./CircleHub";
import { getCirclesHome } from "../../lib/circles";
import { getViewer } from "../../lib/supabase/server";

export const metadata = { title: "Circles — MemeLab" };
export const dynamic = "force-dynamic";

export default async function CirclesPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/auth?next=/circles");
  const { circles, invites } = await getCirclesHome(viewer.id);
  return <main className="circles-page"><div className="ambient ambient-one" /><SiteHeader /><CircleHub circles={circles} invites={invites} /></main>;
}
