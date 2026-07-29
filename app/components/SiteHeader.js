"use client";

import { Clock3, Menu, Plus, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

export function BrandMark() {
  return (
    <span className="brand-mark" aria-hidden="true">
      <span />
      <span />
    </span>
  );
}

export default function SiteHeader() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav className="nav shell">
      <Link className="brand" href="/">
        <BrandMark />
        <span>MemeLab</span>
      </Link>

      <div className="nav-links">
        <Link href="/templates">Templates</Link>
        <Link href="/#workspace">Create</Link>
        <Link href="/templates?category=Favorites">Favorites</Link>
      </div>

      <div className="nav-actions">
        <Link className="icon-button" href="/templates?category=Favorites" aria-label="Favorite templates">
          <Clock3 size={18} />
        </Link>
        <button className="login-button" type="button">Log in</button>
        <Link className="create-button" href="/templates"><Plus size={17} /> Create</Link>
      </div>

      <button
        className="mobile-toggle"
        type="button"
        onClick={() => setMobileOpen((current) => !current)}
        aria-label="Toggle navigation"
        aria-expanded={mobileOpen}
      >
        {mobileOpen ? <X /> : <Menu />}
      </button>

      {mobileOpen && (
        <div className="mobile-menu glass">
          <Link href="/templates" onClick={() => setMobileOpen(false)}>Templates</Link>
          <Link href="/#workspace" onClick={() => setMobileOpen(false)}>Create</Link>
          <Link href="/templates?category=Favorites" onClick={() => setMobileOpen(false)}>Favorites</Link>
          <button type="button">Log in <span>Coming soon</span></button>
        </div>
      )}
    </nav>
  );
}
