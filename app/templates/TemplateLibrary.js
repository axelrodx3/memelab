"use client";

import { ChevronLeft, ChevronRight, Search, SlidersHorizontal, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "../../lib/supabase/client";
import { TEMPLATE_CATEGORIES } from "../../lib/template-utils";
import TemplateCard from "../components/TemplateCard";

const PAGE_SIZE = 24;
const SORT_OPTIONS = [
  { value: "popular", label: "Most popular" },
  { value: "az", label: "Name: A to Z" },
  { value: "za", label: "Name: Z to A" }
];

function paginationItems(currentPage, totalPages) {
  const items = [];
  let previous = 0;

  for (let page = 1; page <= totalPages; page += 1) {
    if (page === 1 || page === totalPages || Math.abs(page - currentPage) <= 1) {
      if (page - previous > 1) items.push(`ellipsis-${page}`);
      items.push(page);
      previous = page;
    }
  }

  return items;
}

export default function TemplateLibrary({ initialTemplates, viewerId = null, initialCategory = "All", lockedCategory = false }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [favorites, setFavorites] = useState([]);

  const query = searchParams.get("q") || "";
  const requestedCategory = lockedCategory ? initialCategory : (searchParams.get("category") || initialCategory);
  const category = TEMPLATE_CATEGORIES.includes(requestedCategory) ? requestedCategory : "All";
  const requestedSort = searchParams.get("sort") || "popular";
  const sort = SORT_OPTIONS.some((option) => option.value === requestedSort) ? requestedSort : "popular";
  const requestedPage = Math.max(1, Number.parseInt(searchParams.get("page") || "1", 10) || 1);

  useEffect(() => {
    const stored = window.localStorage.getItem("memelab:favorites");
    let local = [];
    try { local = stored ? JSON.parse(stored) : []; } catch {}
    if (!viewerId) {
      setFavorites(local);
      return;
    }

    const supabase = createClient();
    const hydrate = async () => {
      if (local.length) {
        await supabase.from("template_favorites").upsert(
          local.map((template_id) => ({ user_id: viewerId, template_id })),
          { onConflict: "user_id,template_id", ignoreDuplicates: true }
        );
      }
      const { data } = await supabase
        .from("template_favorites")
        .select("template_id")
        .eq("user_id", viewerId);
      const synced = (data || []).map((item) => item.template_id);
      setFavorites(synced);
      window.localStorage.setItem("memelab:favorites", JSON.stringify(synced));
    };
    hydrate();
  }, [viewerId]);

  const updateParams = (updates) => {
    const next = new URLSearchParams(searchParams.toString());

    Object.entries(updates).forEach(([key, value]) => {
      const isDefault =
        value === "" ||
        (key === "category" && value === "All") ||
        (key === "sort" && value === "popular") ||
        (key === "page" && Number(value) === 1);

      if (isDefault) next.delete(key);
      else next.set(key, String(value));
    });

    const suffix = next.toString();
    router.replace(suffix ? `${pathname}?${suffix}` : pathname, { scroll: false });
  };

  const filteredTemplates = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const filtered = initialTemplates.filter((template) => {
      const searchableText = [
        template.name,
        ...(template.aliases || []),
        ...(template.tags || []),
        template.category
      ].join(" ").toLowerCase();
      const matchesQuery = !normalizedQuery || searchableText.includes(normalizedQuery);
      const matchesCategory =
        category === "All" ||
        (category === "Favorites" ? favorites.includes(template.id) : template.category === category);
      return matchesQuery && matchesCategory;
    });

    if (sort === "az") return [...filtered].sort((a, b) => a.name.localeCompare(b.name));
    if (sort === "za") return [...filtered].sort((a, b) => b.name.localeCompare(a.name));
    return filtered;
  }, [category, favorites, initialTemplates, query, sort]);

  const totalPages = Math.max(1, Math.ceil(filteredTemplates.length / PAGE_SIZE));
  const currentPage = Math.min(requestedPage, totalPages);
  const pageStart = (currentPage - 1) * PAGE_SIZE;
  const pageTemplates = filteredTemplates.slice(pageStart, pageStart + PAGE_SIZE);
  const pageNumbers = paginationItems(currentPage, totalPages);

  useEffect(() => {
    if (requestedPage !== currentPage) updateParams({ page: currentPage });
  }, [currentPage, requestedPage]);

  const toggleFavorite = async (id) => {
    const wasFavorite = favorites.includes(id);
    setFavorites((current) => {
      const next = current.includes(id) ? current.filter((item) => item !== id) : [...current, id];
      window.localStorage.setItem("memelab:favorites", JSON.stringify(next));
      return next;
    });
    if (!viewerId) return;
    const supabase = createClient();
    if (wasFavorite) {
      await supabase.from("template_favorites").delete().eq("user_id", viewerId).eq("template_id", id);
    } else {
      await supabase.from("template_favorites").upsert({ user_id: viewerId, template_id: id });
    }
  };

  const hasFilters = query || (!lockedCategory && category !== "All") || sort !== "popular";
  const firstResult = filteredTemplates.length ? pageStart + 1 : 0;
  const lastResult = Math.min(pageStart + PAGE_SIZE, filteredTemplates.length);

  return (
    <section className="catalog-shell shell">
      <div className="catalog-toolbar glass">
        <label className="catalog-search">
          <Search size={18} />
          <input
            value={query}
            onChange={(event) => updateParams({ q: event.target.value, page: 1 })}
            placeholder={`Search ${initialTemplates.length} iconic templates`}
            aria-label="Search meme templates"
          />
          {query && (
            <button type="button" onClick={() => updateParams({ q: "", page: 1 })} aria-label="Clear search">
              <X size={15} />
            </button>
          )}
        </label>

        <label className="catalog-sort">
          <SlidersHorizontal size={16} />
          <select value={sort} onChange={(event) => updateParams({ sort: event.target.value, page: 1 })}>
            {SORT_OPTIONS.map((option) => (
              <option value={option.value} key={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
      </div>

      {!lockedCategory && <div className="catalog-categories" aria-label="Template categories">
        {TEMPLATE_CATEGORIES.map((item) => (
          <button
            type="button"
            key={item}
            className={category === item ? "active" : ""}
            onClick={() => updateParams({ category: item, page: 1 })}
          >
            {item}
            {item === "Favorites" && favorites.length > 0 && <span>{favorites.length}</span>}
          </button>
        ))}
      </div>}

      <div className="catalog-results-row">
        <p>
          Showing <strong>{firstResult} to {lastResult}</strong> of <strong>{filteredTemplates.length}</strong> templates
        </p>
        {hasFilters && (
          <button type="button" onClick={() => router.replace(pathname, { scroll: false })}>
            Clear filters <X size={14} />
          </button>
        )}
      </div>

      <div className="template-grid catalog-grid">
        {pageTemplates.map((template) => (
          <TemplateCard
            template={template}
            key={template.id}
            isFavorite={favorites.includes(template.id)}
            onToggleFavorite={toggleFavorite}
          />
        ))}

        {pageTemplates.length === 0 && (
          <div className="empty-state glass">
            <Search size={24} />
            <h3>{category === "Favorites" ? "No favorites yet" : "No templates found"}</h3>
            <p>{category === "Favorites" ? "Tap the heart on a template to save it here." : "Try another search or category."}</p>
          </div>
        )}
      </div>

      {filteredTemplates.length > PAGE_SIZE && (
        <nav className="pagination" aria-label="Template pages">
          <button
            type="button"
            onClick={() => updateParams({ page: currentPage - 1 })}
            disabled={currentPage === 1}
            aria-label="Previous page"
          >
            <ChevronLeft size={17} /> <span>Previous</span>
          </button>

          <div>
            {pageNumbers.map((item) => (
              typeof item === "number" ? (
                <button
                  type="button"
                  key={item}
                  className={item === currentPage ? "active" : ""}
                  onClick={() => updateParams({ page: item })}
                  aria-current={item === currentPage ? "page" : undefined}
                >
                  {item}
                </button>
              ) : <span key={item}>…</span>
            ))}
          </div>

          <button
            type="button"
            onClick={() => updateParams({ page: currentPage + 1 })}
            disabled={currentPage === totalPages}
            aria-label="Next page"
          >
            <span>Next</span> <ChevronRight size={17} />
          </button>
        </nav>
      )}
    </section>
  );
}
