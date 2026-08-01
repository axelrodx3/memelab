import { redirect } from "next/navigation";
import SiteHeader from "../components/SiteHeader";
import FriendsCenter from "./FriendsCenter";
import { getFriendsForMember } from "../../lib/social";
import { getViewer } from "../../lib/supabase/server";

export const metadata = { title: "Friends | MemeLab" };
export const dynamic = "force-dynamic";

export default async function FriendsPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/auth?next=/friends");

  const groups = await getFriendsForMember(viewer.id);

  return (
    <main className="social-page">
      <div className="ambient ambient-one" />
      <SiteHeader />
      <FriendsCenter groups={groups} />
    </main>
  );
}
