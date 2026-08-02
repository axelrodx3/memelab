"use client";

import {
  Check, Clock3, Copy, FolderKanban, LockKeyhole, MoreHorizontal,
  Pencil, Plus, Search, Trash2, X
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { createClient } from "../../lib/supabase/client";

function formatUpdated(value) {
  const date = new Date(value);
  const elapsed = Date.now() - date.getTime();
  if (elapsed < 60_000) return "Just now";
  if (elapsed < 3_600_000) return `${Math.floor(elapsed / 60_000)}m ago`;
  if (elapsed < 86_400_000) return `${Math.floor(elapsed / 3_600_000)}h ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: date.getFullYear() === new Date().getFullYear() ? undefined : "numeric" });
}

export default function ProjectLibrary({ initialProjects, viewerId }) {
  const [projects, setProjects] = useState(initialProjects);
  const [query, setQuery] = useState("");
  const [menuId, setMenuId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState("");
  const [deleteId, setDeleteId] = useState(null);
  const [error, setError] = useState("");

  const filtered = useMemo(() => {
    const search = query.trim().toLowerCase();
    if (!search) return projects;
    return projects.filter((project) =>
      `${project.name} ${project.template?.name || ""}`.toLowerCase().includes(search)
    );
  }, [projects, query]);

  const beginRename = (project) => {
    setEditingId(project.id);
    setEditingName(project.name);
    setMenuId(null);
  };

  const saveRename = async (project) => {
    const name = editingName.trim();
    if (!name || name === project.name) {
      setEditingId(null);
      return;
    }
    const supabase = createClient();
    const { data, error: updateError } = await supabase
      .from("projects")
      .update({ name })
      .eq("id", project.id)
      .eq("user_id", viewerId)
      .select("updated_at")
      .single();
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setProjects((current) => current.map((item) =>
      item.id === project.id ? { ...item, name, updated_at: data.updated_at } : item
    ));
    setEditingId(null);
  };

  const duplicateProject = async (project) => {
    setMenuId(null);
    setError("");
    const supabase = createClient();
    const { data, error: duplicateError } = await supabase
      .from("projects")
      .insert({
        user_id: viewerId,
        template_id: project.template_id,
        name: `${project.name} copy`.slice(0, 80),
        editor_state: project.editor_state
      })
      .select(`
        id,name,template_id,editor_state,created_at,updated_at,
        template:template_assets(id,name,image_url,category)
      `)
      .single();
    if (duplicateError) {
      setError(duplicateError.message);
      return;
    }
    setProjects((current) => [data, ...current]);
  };

  const deleteProject = async (project) => {
    const supabase = createClient();
    const { error: deleteError } = await supabase
      .from("projects")
      .delete()
      .eq("id", project.id)
      .eq("user_id", viewerId);
    if (deleteError) {
      setError(deleteError.message);
      return;
    }
    setProjects((current) => current.filter((item) => item.id !== project.id));
    setDeleteId(null);
  };

  return (
    <section className="projects-shell shell">
      <header className="projects-hero projects-hero-quiet">
        <div>
          <h1>Projects</h1>
          <p>Your saved edits, ready to pick back up.</p>
        </div>
        <Link href="/templates" className="primary-cta"><Plus size={17} /> New project</Link>
      </header>

      <div className="projects-toolbar glass">
        <label>
          <Search size={17} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search your projects"
            aria-label="Search projects"
          />
          {query && <button type="button" onClick={() => setQuery("")} aria-label="Clear search"><X size={14} /></button>}
        </label>
        <div><LockKeyhole size={14} /> Private to you</div>
      </div>

      {error && <div className="project-error" role="alert">{error}<button onClick={() => setError("")}><X size={14} /></button></div>}

      <div className="project-grid">
        {filtered.map((project) => {
          const editorHref = project.template_id ? `/editor/${project.template_id}?project=${project.id}` : "/templates";
          const captions = [project.editor_state?.topText, project.editor_state?.bottomText].filter(Boolean);
          return (
            <article className="project-card glass" key={project.id}>
              <Link href={editorHref} className="project-preview">
                {project.template?.image_url ? (
                  <Image
                    src={project.template.image_url}
                    alt=""
                    fill
                    sizes="(max-width: 700px) 100vw, (max-width: 1050px) 50vw, 33vw"
                  />
                ) : (
                  <div><FolderKanban size={28} /><span>Template unavailable</span></div>
                )}
                {captions.length > 0 && (
                  <div className="project-caption-preview">
                    <strong>{captions[0]}</strong>
                    {captions[1] && <strong>{captions[1]}</strong>}
                  </div>
                )}
                <span>Continue editing</span>
              </Link>

              <div className="project-card-body">
                {editingId === project.id ? (
                  <div className="project-rename">
                    <input
                      autoFocus
                      value={editingName}
                      maxLength={80}
                      onChange={(event) => setEditingName(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") saveRename(project);
                        if (event.key === "Escape") setEditingId(null);
                      }}
                    />
                    <button onClick={() => saveRename(project)} aria-label="Save name"><Check size={14} /></button>
                    <button onClick={() => setEditingId(null)} aria-label="Cancel rename"><X size={14} /></button>
                  </div>
                ) : (
                  <>
                    <div>
                      <h2><Link href={editorHref}>{project.name}</Link></h2>
                      <p>{project.template?.name || "Choose a new template"}</p>
                    </div>
                    <button
                      className="project-menu-button"
                      onClick={() => setMenuId((current) => current === project.id ? null : project.id)}
                      aria-label={`Project actions for ${project.name}`}
                      aria-expanded={menuId === project.id}
                    >
                      <MoreHorizontal size={17} />
                    </button>
                  </>
                )}
              </div>

              <footer>
                <span><Clock3 size={12} /> {formatUpdated(project.updated_at)}</span>
                <span><LockKeyhole size={11} /> Private</span>
              </footer>

              {menuId === project.id && (
                <div className="project-menu glass">
                  <button onClick={() => beginRename(project)}><Pencil size={14} /> Rename</button>
                  <button onClick={() => duplicateProject(project)}><Copy size={14} /> Duplicate</button>
                  <button className="danger" onClick={() => { setDeleteId(project.id); setMenuId(null); }}><Trash2 size={14} /> Delete</button>
                </div>
              )}

              {deleteId === project.id && (
                <div className="project-delete-confirm">
                  <strong>Delete this project?</strong>
                  <span>This cannot be undone.</span>
                  <div>
                    <button onClick={() => setDeleteId(null)}>Cancel</button>
                    <button onClick={() => deleteProject(project)}>Delete</button>
                  </div>
                </div>
              )}
            </article>
          );
        })}

        {filtered.length === 0 && (
          <div className="projects-empty glass">
            <FolderKanban size={28} />
            <h2>{projects.length ? "No projects match that search." : "Your next idea starts here."}</h2>
            <p>{projects.length ? "Try a different project or template name." : "Choose any template, start editing, and your work will appear here automatically."}</p>
            {!projects.length && <Link href="/templates" className="primary-cta"><Plus size={16} /> Browse templates</Link>}
          </div>
        )}
      </div>
    </section>
  );
}
