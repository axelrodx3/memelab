import { redirect } from "next/navigation";
import SiteHeader from "../../../components/SiteHeader";
import CircleCreateForm from "../../../circles/new/CircleCreateForm";
import { getViewer } from "../../../../lib/supabase/server";

export const metadata = { title: "Create a Circle | MemeLab Community" };
export const dynamic = "force-dynamic";

export default async function CommunityNewCirclePage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/auth?next=/community/circles/new");
  return <main className="community-page circles-page"><div className="ambient ambient-one" /><SiteHeader /><CircleCreateForm basePath="/community/circles" /></main>;
}
