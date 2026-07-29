import Link from "next/link";

export default function TemplateNotFound() {
  return (
    <main className="not-found-page">
      <span className="section-label">404 · TEMPLATE MISSING</span>
      <h1>This format left the group chat.</h1>
      <p>The template may have moved or is no longer available.</p>
      <Link className="primary-cta" href="/templates">Browse templates</Link>
    </main>
  );
}
