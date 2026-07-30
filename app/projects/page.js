import { redirect } from "next/navigation";
import { createClient, getViewer } from "../../lib/supabase/server";
import SiteHeader from "../components/SiteHeader";
import ProjectLibrary from "./ProjectLibrary";

export const metadata = { title: "Your Projects — MemeLab Studio" };
export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/auth?next=/projects");

  const supabase = await createClient();
  const { data: projects } = await supabase
    .from("projects")
    .select(`
      id,name,template_id,editor_state,created_at,updated_at,
      template:template_assets(id,name,image_url,category)
    `)
    .eq("user_id", viewer.id)
    .order("updated_at", { ascending: false });

  return (
    <main className="projects-page">
      <div className="ambient ambient-one" />
      <SiteHeader />
      <ProjectLibrary initialProjects={projects || []} viewerId={viewer.id} />
    </main>
  );
}

