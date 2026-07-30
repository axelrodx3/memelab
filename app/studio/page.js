import { ArrowRight, Clock3, FolderKanban, Sparkles } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { getTemplates } from "../../lib/templates";
import { createClient, getViewer } from "../../lib/supabase/server";
import SiteHeader from "../components/SiteHeader";
import StudioStarter from "./StudioStarter";

export const metadata = { title: "MemeLab Studio — Create something worth sharing" };
export const dynamic = "force-dynamic";

export default async function StudioPage() {
  const [templates, viewer] = await Promise.all([getTemplates(), getViewer()]);
  let projects = [];
  if (viewer) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("projects")
      .select("id,name,template_id,updated_at,template:template_assets(id,name,image_url)")
      .eq("user_id", viewer.id)
      .order("updated_at", { ascending: false })
      .limit(3);
    projects = data || [];
  }
  const featured = templates.slice(0, 6);

  return (
    <main className="studio-page">
      <div className="ambient ambient-one" />
      <SiteHeader />
      <section className="studio-shell shell">
        <header className="studio-hero">
          <div>
            <span className="section-label">MEMELAB STUDIO</span>
            <h1>Make the idea.<br /><em>Own the punchline.</em></h1>
            <p>Start with an iconic format or bring your own image. Everything you need is one click away.</p>
          </div>
          <Link className="primary-cta" href="/templates"><Sparkles size={17} /> Browse every template</Link>
        </header>

        <div className="studio-start-grid">
          <StudioStarter />
          <Link className="studio-template-card glass" href="/templates">
            <div><Sparkles size={24} /></div>
            <span>TEMPLATE LIBRARY</span>
            <h2>Remix a classic.</h2>
            <p>Search {templates.length} curated formats and jump straight into the editor.</p>
            <strong>Explore templates <ArrowRight size={15} /></strong>
          </Link>
        </div>

        {viewer && (
          <section className="studio-section">
            <header><div><span className="section-label">PICK UP WHERE YOU LEFT OFF</span><h2>Recent projects</h2></div><Link href="/projects">View all <ArrowRight size={14} /></Link></header>
            <div className="studio-project-row">
              {projects.map((project) => (
                <Link className="studio-project glass" href={`/editor/${project.template_id}?project=${project.id}`} key={project.id}>
                  <div>{project.template?.image_url ? <Image src={project.template.image_url} alt="" fill sizes="320px" /> : <FolderKanban size={24} />}</div>
                  <strong>{project.name}</strong>
                  <span><Clock3 size={12} /> Edited {new Date(project.updated_at).toLocaleDateString()}</span>
                </Link>
              ))}
              {!projects.length && <div className="studio-empty-projects glass"><FolderKanban size={24} /><strong>No saved projects yet.</strong><span>Your signed-in edits will autosave here.</span></div>}
            </div>
          </section>
        )}

        <section className="studio-section">
          <header><div><span className="section-label">FAST STARTS</span><h2>Popular right now</h2></div><Link href="/templates">See the archive <ArrowRight size={14} /></Link></header>
          <div className="studio-template-row">
            {featured.map((template) => (
              <Link href={`/editor/${template.id}`} className="studio-mini-template glass" key={template.id}>
                <div><Image src={template.url} alt={template.name} fill sizes="240px" /></div>
                <strong>{template.name}</strong><span>{template.category}</span>
              </Link>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}
