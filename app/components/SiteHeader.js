"use client";

import { FolderKanban, Menu, MessageCircle, Plus, Users, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import AuthControls from "./AuthControls";
import NotificationBell from "./NotificationBell";

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
        <Link href="/community">Community</Link>
        <Link href="/circles">Circles</Link>
        <Link href="/studio">Studio</Link>
        <Link href="/projects">Projects</Link>
        <Link href="/templates?category=Favorites">Favorites</Link>
      </div>

      <div className="nav-actions">
        <NotificationBell />
        <Link className="icon-button" href="/messages" aria-label="Private messages">
          <MessageCircle size={18} />
        </Link>
        <Link className="icon-button" href="/friends" aria-label="Friends">
          <Users size={18} />
        </Link>
        <Link className="icon-button" href="/projects" aria-label="Your projects">
          <FolderKanban size={18} />
        </Link>
        <AuthControls />
        <Link className="create-button" href="/community/create"><Plus size={17} /> Post</Link>
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
          <Link href="/community" onClick={() => setMobileOpen(false)}>Community</Link>
          <Link href="/circles" onClick={() => setMobileOpen(false)}>Circles</Link>
          <Link href="/studio" onClick={() => setMobileOpen(false)}>MemeLab Studio</Link>
          <Link href="/projects" onClick={() => setMobileOpen(false)}>Projects</Link>
          <Link href="/friends" onClick={() => setMobileOpen(false)}>Friends</Link>
          <Link href="/messages" onClick={() => setMobileOpen(false)}>Messages</Link>
          <Link href="/templates?category=Favorites" onClick={() => setMobileOpen(false)}>Favorites</Link>
          <AuthControls compact />
        </div>
      )}
    </nav>
  );
}
