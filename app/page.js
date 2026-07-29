"use client";

import {
  ArrowRight,
  ChevronDown,
  Clock3,
  Download,
  Heart,
  Image as ImageIcon,
  Layers3,
  Menu,
  Plus,
  Search,
  Sparkles,
  Upload,
  WandSparkles,
  X
} from "lucide-react";
import { useMemo, useState } from "react";

const categories = ["Trending", "Classic", "Reaction", "Animals", "Gaming", "Crypto"];

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

function BrandMark() {
  return (
    <span className="brand-mark" aria-hidden="true">
      <span />
      <span />
    </span>
  );
}

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
  const [activeCategory, setActiveCategory] = useState("Trending");
  const [query, setQuery] = useState("");
  const [favorites, setFavorites] = useState([]);
  const [mobileOpen, setMobileOpen] = useState(false);

  const visibleTemplates = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return templates.filter((template) => {
      const matchesQuery = !normalized || template.title.toLowerCase().includes(normalized);
      const matchesCategory =
        activeCategory === "Trending" || template.tag === activeCategory;
      return matchesQuery && matchesCategory;
    });
  }, [activeCategory, query]);

  const toggleFavorite = (id) => {
    setFavorites((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    );
  };

  return (
    <main>
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />

      <nav className="nav shell">
        <a className="brand" href="#">
          <BrandMark />
          <span>MemeLab</span>
        </a>
        <div className="nav-links">
          <a href="#templates">Templates</a>
          <a href="#workspace">Create</a>
          <button className="nav-more">Resources <ChevronDown size={14} /></button>
        </div>
        <div className="nav-actions">
          <button className="icon-button" aria-label="Recent projects"><Clock3 size={18} /></button>
          <button className="login-button">Log in</button>
          <button className="create-button"><Plus size={17} /> Create</button>
        </div>
        <button className="mobile-toggle" onClick={() => setMobileOpen(!mobileOpen)} aria-label="Toggle navigation">
          {mobileOpen ? <X /> : <Menu />}
        </button>
        {mobileOpen && (
          <div className="mobile-menu glass">
            <a href="#templates" onClick={() => setMobileOpen(false)}>Templates</a>
            <a href="#workspace" onClick={() => setMobileOpen(false)}>Create</a>
            <button>Log in <span>Coming soon</span></button>
          </div>
        )}
      </nav>

      <section className="hero shell">
        <div className="eyebrow"><Sparkles size={14} /> Your new creative playground</div>
        <h1>Every meme starts<br />with a <span>good idea.</span></h1>
        <p>Discover iconic templates, remix them in seconds, and make something the internet can’t ignore.</p>
        <div className="hero-actions">
          <a className="primary-cta" href="#templates">Browse templates <ArrowRight size={18} /></a>
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
            <p>From internet classics to what’s trending right now.</p>
          </div>
          <a href="#all">Explore all templates <ArrowRight size={16} /></a>
        </div>

        <div className="library-tools">
          <div className="categories">
            {categories.map((category) => (
              <button
                key={category}
                className={activeCategory === category ? "active" : ""}
                onClick={() => setActiveCategory(category)}
              >
                {category}
              </button>
            ))}
          </div>
          <label className="search-box">
            <Search size={17} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search templates"
            />
            <kbd>⌘ K</kbd>
          </label>
        </div>

        <div className="template-grid" id="all">
          {visibleTemplates.map((template) => (
            <article className="template-card" key={template.id}>
              <div className="thumbnail">
                <TemplateArt template={template} />
                <button
                  className={favorites.includes(template.id) ? "favorite active" : "favorite"}
                  onClick={() => toggleFavorite(template.id)}
                  aria-label={`Favorite ${template.title}`}
                >
                  <Heart size={17} fill={favorites.includes(template.id) ? "currentColor" : "none"} />
                </button>
                <button className="use-template">Use template <ArrowRight size={15} /></button>
              </div>
              <div className="template-info">
                <div><h3>{template.title}</h3><span>{template.tag}</span></div>
                <button aria-label={`More options for ${template.title}`}>•••</button>
              </div>
            </article>
          ))}
          {visibleTemplates.length === 0 && (
            <div className="empty-state glass">
              <Search size={24} />
              <h3>No templates found</h3>
              <p>Try a different search or category.</p>
            </div>
          )}
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
