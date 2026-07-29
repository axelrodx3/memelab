"use client";

import {
  ArrowRight,
  Download,
  Image as ImageIcon,
  Layers3,
  Sparkles,
  Upload,
  WandSparkles
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import SiteHeader, { BrandMark } from "./components/SiteHeader";
import TemplateCard from "./components/TemplateCard";

const categories = ["Trending", "Classic", "Reaction", "Animals", "Movies"];

const templates = [
  { id: 1, title: "Distracted Boyfriend", tag: "Classic", tone: "violet", caption: "ME / A NEW PROJECT" },
  { id: 2, title: "Drake Hotline Bling", tag: "Reaction", tone: "amber", caption: "NO THANKS / THAT'S IT" },
  { id: 3, title: "Two Buttons", tag: "Classic", tone: "cyan", caption: "CHOICES / CONSEQUENCES" },
  { id: 4, title: "This Is Fine", tag: "Reaction", tone: "orange", caption: "EVERYTHING IS FINE" },
  { id: 5, title: "Expanding Brain", tag: "Trending", tone: "indigo", caption: "LEVEL ONE / LEVEL FOUR" },
  { id: 6, title: "Change My Mind", tag: "Classic", tone: "rose", caption: "CHANGE MY MIND" },
  { id: 7, title: "Always Has Been", tag: "Trending", tone: "blue", caption: "WAIT, IT'S ALL MEMES?" },
  { id: 8, title: "Success Kid", tag: "Classic", tone: "green", caption: "NAILED IT" }
];

function TemplateArt({ template, large = false }) {
  return (
    <div className={`template-art ${template.tone} ${large ? "large" : ""}`}>
      <div className="art-glow" />
      <div className="art-frame">
        <div className="art-subject">
          <div className="subject-head" />
          <div className="subject-body" />
        </div>
        <div className="art-subject second">
          <div className="subject-head" />
          <div className="subject-body" />
        </div>
      </div>
      <span>{template.caption}</span>
    </div>
  );
}

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
        <p>Discover iconic templates, remix them in seconds, and make something the internet can’t ignore.</p>
        <div className="hero-actions">
          <Link className="primary-cta" href="/templates">Browse templates <ArrowRight size={18} /></Link>
          <a className="secondary-cta" href="#workspace"><Upload size={18} /> Upload your own</a>
        </div>
        <div className="trust-row">
          <span><span className="status-dot" /> Free to use</span>
          <span>No watermarks</span>
          <span>No account required</span>
        </div>
      </section>

      <section className="showcase shell" aria-label="Featured templates">
        <div className="floating-card card-left glass">
          <Layers3 size={17} />
          <div><strong>Full control</strong><span>Text, layers & more</span></div>
        </div>
        <div className="showcase-card glass">
          <div className="showcase-toolbar">
            <div className="window-dots"><i /><i /><i /></div>
            <span>Untitled meme</span>
            <div className="tool-pills"><i /><i /><i /></div>
          </div>
          <div className="showcase-canvas">
            <TemplateArt template={templates[0]} large />
            <div className="selection-box"><i /><i /><i /><i /></div>
          </div>
          <div className="showcase-bottom">
            <span><WandSparkles size={15} /> Smart caption</span>
            <button><Download size={15} /> Export</button>
          </div>
        </div>
        <div className="floating-card card-right glass">
          <Download size={17} />
          <div><strong>Export anywhere</strong><span>PNG, JPG & more</span></div>
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
                href={`/templates?category=${category}`}
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
          <Link className="secondary-cta" href="/templates">Browse all 100 templates <ArrowRight size={17} /></Link>
        </div>
      </section>

      <section className="workspace-cta shell" id="workspace">
        <div>
          <span className="section-label">START FROM SCRATCH</span>
          <h2>Your image.<br />Your rules.</h2>
          <p>Drop in any image, logo, or character and turn it into something worth sharing.</p>
          <button className="primary-cta"><Upload size={18} /> Upload an image</button>
        </div>
        <div className="drop-zone glass">
          <div className="upload-icon"><ImageIcon size={28} /></div>
          <strong>Drop anything here</strong>
          <span>PNG, JPG or WEBP · Up to 25MB</span>
          <div className="format-row"><i>PNG</i><i>JPG</i><i>WEBP</i></div>
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
