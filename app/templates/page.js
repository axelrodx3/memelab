import { Suspense } from "react";
import { getTemplates } from "../../lib/templates";
import { getViewer } from "../../lib/supabase/server";
import SiteHeader from "../components/SiteHeader";
import TemplateLibrary from "./TemplateLibrary";

export const metadata = {
  title: "Meme Templates | MemeLab",
  description: "Browse, search, favorite and remix iconic meme templates without watermarks."
};

function CatalogSkeleton() {
  return (
    <section className="catalog-shell shell">
      <div className="catalog-loading-tools glass" />
      <div className="template-grid catalog-grid">
        {Array.from({ length: 8 }).map((_, index) => (
          <div className="template-skeleton" key={index}><div /><span /></div>
        ))}
      </div>
    </section>
  );
}

export default async function TemplatesPage() {
  const [templates, viewer] = await Promise.all([getTemplates(), getViewer()]);

  return (
    <main className="catalog-page">
      <div className="ambient ambient-one" />
      <SiteHeader />

      <header className="catalog-hero catalog-hero-quiet shell">
        <div>
          <h1>Templates</h1>
          <p>{templates.length} formats, ready to edit.</p>
        </div>
      </header>

      <Suspense fallback={<CatalogSkeleton />}>
        <TemplateLibrary initialTemplates={templates} viewerId={viewer?.id || null} />
      </Suspense>
    </main>
  );
}
