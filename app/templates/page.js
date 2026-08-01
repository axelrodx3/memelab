import { Sparkles } from "lucide-react";
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

      <header className="catalog-hero shell">
        <div className="eyebrow"><Sparkles size={14} /> The template archive</div>
        <h1>Find the format.<br /><span>Make it yours.</span></h1>
        <p>Browse iconic formats, current favorites and reaction classics, organized for fast remixing.</p>
        <div className="catalog-stat-row">
          <span><strong>{templates.length}</strong> templates</span>
          <span><strong>5</strong> collections</span>
          <span><strong>0</strong> watermarks</span>
        </div>
      </header>

      <Suspense fallback={<CatalogSkeleton />}>
        <TemplateLibrary initialTemplates={templates} viewerId={viewer?.id || null} />
      </Suspense>

      <footer className="catalog-footer shell">
        <span>MemeLab</span>
        <p>More formats. Better tools. Faster ideas.</p>
      </footer>
    </main>
  );
}
