import { redirect } from "next/navigation";
import SiteHeader from "../../components/SiteHeader";
import CircleCreateForm from "./CircleCreateForm";
import { getViewer } from "../../../lib/supabase/server";

export const metadata = { title: "Create a Circle — MemeLab" };
export const dynamic = "force-dynamic";

export default async function NewCirclePage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/auth?next=/circles/new");
  return <main className="circles-page"><div className="ambient ambient-one" /><SiteHeader /><CircleCreateForm /></main>;
}
