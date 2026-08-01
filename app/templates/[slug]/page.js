import { ArrowLeft, ArrowRight, Download, Maximize2, Sparkles, WandSparkles } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getRelatedTemplates, templateHref, templateIdFromSlug } from "../../../lib/template-utils";
import { getTemplates } from "../../../lib/templates";
import SiteHeader from "../../components/SiteHeader";
import TemplateCard from "../../components/TemplateCard";

async function resolveTemplate(slug) {
  const id = templateIdFromSlug(slug);
  if (!id) return { template: null, templates: [] };
  const templates = await getTemplates();
  return { template: templates.find((item) => item.id === id) || null, templates };
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const { template } = await resolveTemplate(slug);
  if (!template) return { title: "Template not found | MemeLab" };

  return {
    title: `${template.name} Meme Template | MemeLab`,
    description: `Edit or download the blank ${template.name} meme template. Add captions, characters and logos with MemeLab.`
  };
}

export default async function TemplateDetailPage({ params }) {
  const { slug } = await params;
  const { template, templates } = await resolveTemplate(slug);
  if (!template) notFound();

  const related = getRelatedTemplates(template, templates, 4);
  const downloadName = `${template.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-blank.jpg`;

  return (
    <main className="template-detail-page">
      <div className="ambient ambient-one" />
      <SiteHeader />

      <div className="detail-shell shell">
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <Link href="/templates"><ArrowLeft size={14} /> Templates</Link>
          <span>/</span>
          <Link href={`/templates?category=${encodeURIComponent(template.category)}`}>{template.category}</Link>
          <span>/</span>
          <strong>{template.name}</strong>
        </nav>

        <section className="template-detail">
          <div className="detail-preview glass">
            <div className="detail-image-frame">
              <Image
                src={template.url}
                alt={`${template.name} blank meme template`}
                fill
                priority
                sizes="(max-width: 900px) 100vw, 58vw"
              />
            </div>
          </div>

          <div className="detail-copy">
            <div className="detail-badges">
              <span>{template.category}</span>
              <span><Sparkles size={12} /> Popular template</span>
            </div>

            <h1>{template.name}</h1>
            <p>{template.description || "Start with the blank format, add your captions, upload a character or logo, and export without a watermark."}</p>

            {template.tags?.length > 0 && (
              <div className="detail-tags" aria-label="Template tags">
                {template.tags.slice(0, 6).map((tag) => (
                  <Link href={`/templates?q=${encodeURIComponent(tag)}`} key={tag}>#{tag}</Link>
                ))}
              </div>
            )}

            <div className="detail-meta">
              <div>
                <Maximize2 size={16} />
                <span>Dimensions<strong>{template.width && template.height ? `${template.width} × ${template.height}` : "Original resolution"}</strong></span>
              </div>
              <div><WandSparkles size={16} /><span>Text areas<strong>{template.boxCount || 2} suggested</strong></span></div>
            </div>

            <div className="detail-actions">
              <Link className="primary-cta" href={`/editor/${template.id}`}>
                Use this template <ArrowRight size={17} />
              </Link>
              <a className="secondary-cta" href={template.url} download={downloadName}>
                <Download size={17} /> Download blank
              </a>
            </div>

            <div className="detail-note">
              <span className="status-dot" /> Free to edit · Projects sync with an account · No watermark
            </div>
          </div>
        </section>

        <section className="related-templates">
          <div className="section-heading">
            <div>
              <span className="section-label">KEEP EXPLORING</span>
              <h2>Related templates.</h2>
            </div>
            <Link href="/templates">Browse all <ArrowRight size={16} /></Link>
          </div>

          <div className="template-grid">
            {related.map((item) => <TemplateCard template={item} key={item.id} />)}
          </div>
        </section>
      </div>

      <footer className="catalog-footer shell">
        <Link href={templateHref(template)}>{template.name}</Link>
        <p>Ready when inspiration hits.</p>
      </footer>
    </main>
  );
}
