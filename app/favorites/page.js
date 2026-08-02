import { Suspense } from "react";
import { getTemplates } from "../../lib/templates";
import { getViewer } from "../../lib/supabase/server";
import SiteHeader from "../components/SiteHeader";
import TemplateLibrary from "../templates/TemplateLibrary";

export const metadata = {
  title: "Favorites | MemeLab",
  description: "Your saved MemeLab templates."
};

function FavoritesSkeleton() {
  return <section className="catalog-shell shell"><div className="catalog-loading-tools glass" /></section>;
}

export default async function FavoritesPage() {
  const [templates, viewer] = await Promise.all([getTemplates(), getViewer()]);

  return (
    <main className="catalog-page favorites-page">
      <div className="ambient ambient-one" />
      <SiteHeader />
      <header className="catalog-hero catalog-hero-quiet shell">
        <div><h1>Favorites</h1><p>Your saved templates, ready whenever inspiration hits.</p></div>
      </header>
      <Suspense fallback={<FavoritesSkeleton />}>
        <TemplateLibrary initialTemplates={templates} viewerId={viewer?.id || null} initialCategory="Favorites" lockedCategory />
      </Suspense>
    </main>
  );
}
