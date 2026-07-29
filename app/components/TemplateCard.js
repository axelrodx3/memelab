"use client";

import { ArrowRight, Heart } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { templateHref } from "../../lib/template-utils";

export default function TemplateCard({ template, isFavorite = false, onToggleFavorite }) {
  const detailHref = templateHref(template);

  return (
    <article className="template-card">
      <div className="thumbnail">
        <Link className="template-preview-link" href={detailHref} aria-label={`View ${template.name} template`}>
          <Image
            className="template-image"
            src={template.url}
            alt={`${template.name} blank meme template`}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 900px) 45vw, 280px"
          />
        </Link>

        {onToggleFavorite && (
          <button
            className={isFavorite ? "favorite active" : "favorite"}
            onClick={() => onToggleFavorite(template.id)}
            aria-label={`${isFavorite ? "Remove" : "Add"} ${template.name} ${isFavorite ? "from" : "to"} favorites`}
            type="button"
          >
            <Heart size={17} fill={isFavorite ? "currentColor" : "none"} />
          </button>
        )}

        <Link className="use-template" href={`/editor/${template.id}`}>
          Use template <ArrowRight size={15} />
        </Link>
      </div>

      <div className="template-info">
        <div>
          <h3><Link href={detailHref}>{template.name}</Link></h3>
          <span>{template.category}</span>
        </div>
        <Link className="template-more" href={detailHref} aria-label={`View details for ${template.name}`}>
          <ArrowRight size={15} />
        </Link>
      </div>
    </article>
  );
}
