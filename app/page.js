"use client";

import {
  ArrowRight,
  Flame,
  MessageCircle,
  Sparkles,
  TrendingUp,
  UsersRound
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import SiteHeader, { BrandMark } from "./components/SiteHeader";
import TemplateCard from "./components/TemplateCard";

const categories = ["Trending", "Classic", "Reaction", "Animals", "Movies & TV"];

export default function Home() {
  const [favorites, setFavorites] = useState([]);
  const [liveTemplates, setLiveTemplates] = useState([]);
  const [templatesLoading, setTemplatesLoading] = useState(true);

  useEffect(() => {
    const stored = window.localStorage.getItem("memelab:favorites");
    if (stored) {
      try { setFavorites(JSON.parse(stored)); } catch {}
    }

    fetch("/api/templates")
      .then((response) => response.json())
      .then((payload) => setLiveTemplates(payload.templates || []))
      .finally(() => setTemplatesLoading(false));
  }, []);

  const featuredTemplates = liveTemplates.slice(0, 8);

  const toggleFavorite = (id) => {
    setFavorites((current) => {
      const next = current.includes(id) ? current.filter((item) => item !== id) : [...current, id];
      window.localStorage.setItem("memelab:favorites", JSON.stringify(next));
      return next;
    });
  };

  return (
    <main>
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />

      <SiteHeader />

      <section className="hero shell">
        <div className="eyebrow"><Sparkles size={14} /> Your new creative playground</div>
        <h1>Every meme starts<br />with a <span>good idea.</span></h1>
        <div className="hero-actions">
          <Link className="primary-cta" href="/templates">Browse templates <ArrowRight size={18} /></Link>
          <Link className="secondary-cta" href="/community"><UsersRound size={18} /> Enter the community</Link>
        </div>
        <div className="trust-row">
          <span><span className="status-dot" /> Free to use</span>
          <span>No watermarks</span>
          <span>Built for creators</span>
        </div>
      </section>

      <section className="home-community shell glass">
        <div className="home-community-copy">
          <span className="section-label">THE COMMUNITY FEED</span>
          <h2>Post it. Rank it.<br /><span>Talk about it.</span></h2>
          <p>A living image community where memes, art and internet culture rise through real votes and conversation.</p>
          <div className="home-community-actions">
            <Link className="primary-cta" href="/community">Explore the feed <ArrowRight size={17} /></Link>
            <Link className="secondary-cta" href="/community/create">Create a post</Link>
          </div>
        </div>
        <div className="home-community-preview">
          <div className="home-feed-card active">
            <Flame size={18} />
            <div><strong>Hot</strong><span>What the community is moving now</span></div>
          </div>
          <div className="home-feed-card">
            <TrendingUp size={18} />
            <div><strong>Community-ranked</strong><span>Upvotes and downvotes decide what rises</span></div>
          </div>
          <div className="home-feed-card">
            <MessageCircle size={18} />
            <div><strong>Real conversations</strong><span>Comments, profiles and creator karma</span></div>
          </div>
        </div>
      </section>

      <section className="library shell" id="templates">
        <div className="section-heading">
          <div>
            <span className="section-label">THE TEMPLATE LIBRARY</span>
            <h2>Find your format.</h2>
            <p>A featured mix from the full MemeLab archive.</p>
          </div>
          <Link href="/templates">Explore all templates <ArrowRight size={16} /></Link>
        </div>

        <div className="library-tools featured-tools">
          <div className="categories">
            {categories.map((category) => (
              <Link
                key={category}
                href={`/templates?category=${encodeURIComponent(category)}`}
              >
                {category}
              </Link>
            ))}
          </div>
          <Link className="view-library-link" href="/templates">View the full library <ArrowRight size={15} /></Link>
        </div>

        <div className="template-grid" id="all">
          {templatesLoading && Array.from({ length: 8 }).map((_, index) => (
            <div className="template-skeleton" key={index}><div /><span /></div>
          ))}
          {featuredTemplates.map((template) => (
            <TemplateCard
              template={template}
              key={template.id}
              isFavorite={favorites.includes(template.id)}
              onToggleFavorite={toggleFavorite}
            />
          ))}
        </div>

        <div className="featured-library-cta">
          <Link className="secondary-cta" href="/templates">Browse the full library <ArrowRight size={17} /></Link>
        </div>
      </section>

      <footer className="footer shell">
        <a className="brand" href="#"><BrandMark /><span>MemeLab</span></a>
        <p>The internet’s meme studio.</p>
        <div><a href="#">Privacy</a><a href="#">Terms</a><a href="#">Feedback</a></div>
      </footer>
    </main>
  );
}
