"use client";

import { ChevronDown, FolderKanban, Heart, Menu, MessageCircle, Plus, Users, X } from "lucide-react";
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
  const [moreOpen, setMoreOpen] = useState(false);
  const closeMenus = () => {
    setMobileOpen(false);
    setMoreOpen(false);
  };

  return (
    <nav className="nav shell">
      <Link className="brand" href="/">
        <BrandMark />
        <span>MemeLab</span>
      </Link>

      <div className="nav-links nav-primary">
        <Link href="/templates">Templates</Link>
        <Link href="/community">Community</Link>
        <Link href="/studio">Studio</Link>
      </div>

      <div className="nav-actions">
        <NotificationBell />
        <AuthControls />
        <div className="nav-overflow">
          <button type="button" className="nav-more" onClick={() => setMoreOpen((current) => !current)} aria-expanded={moreOpen}>
            More <ChevronDown size={13} />
          </button>
          {moreOpen ? (
            <div className="nav-overflow-menu glass">
              <Link href="/projects" onClick={closeMenus}><FolderKanban size={15} /> Projects</Link>
              <Link href="/templates?category=Favorites" onClick={closeMenus}><Heart size={15} /> Favorites</Link>
              <Link href="/friends" onClick={closeMenus}><Users size={15} /> Friends</Link>
              <Link href="/messages" onClick={closeMenus}><MessageCircle size={15} /> Messages</Link>
            </div>
          ) : null}
        </div>
        <Link className="create-button" href="/community/create"><Plus size={17} /> Post</Link>
      </div>

      <div className="mobile-actions">
        <Link className="mobile-post" href="/community/create" aria-label="Create a post"><Plus size={19} /></Link>
        <button
          className="mobile-toggle"
          type="button"
          onClick={() => setMobileOpen((current) => !current)}
          aria-label="Toggle navigation"
          aria-expanded={mobileOpen}
        >
          {mobileOpen ? <X /> : <Menu />}
        </button>
      </div>

      {mobileOpen && (
        <div className="mobile-menu glass">
          <div className="mobile-menu-primary">
            <Link href="/templates" onClick={closeMenus}>Templates</Link>
            <Link href="/community" onClick={closeMenus}>Community</Link>
            <Link href="/studio" onClick={closeMenus}>Studio</Link>
          </div>
          <div className="mobile-menu-tools">
            <Link href="/projects" onClick={closeMenus}><FolderKanban size={16} /><span>Projects</span></Link>
            <Link href="/friends" onClick={closeMenus}><Users size={16} /><span>Friends</span></Link>
            <Link href="/messages" onClick={closeMenus}><MessageCircle size={16} /><span>Messages</span></Link>
            <Link href="/templates?category=Favorites" onClick={closeMenus}><Heart size={16} /><span>Favorites</span></Link>
          </div>
          <div className="mobile-menu-account">
            <NotificationBell />
            <span>Updates</span>
          </div>
          <AuthControls compact />
        </div>
      )}
    </nav>
  );
}
