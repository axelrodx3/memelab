import { ArrowRight, CheckCircle2, MailWarning, RefreshCw } from "lucide-react";
import Link from "next/link";
import SiteHeader from "../../components/SiteHeader";
import { getViewer } from "../../../lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Email confirmation | MemeLab",
  description: "Finish setting up your MemeLab account."
};

function safeNextPath(value) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/community";
  return value;
}

export default async function ConfirmationResultPage({ searchParams }) {
  const query = await searchParams;
  const viewer = await getViewer();
  const next = safeNextPath(query.next);
  const hasError = Boolean(query.error) || !viewer;

  return (
    <main className="confirmation-page">
      <div className="ambient ambient-one" />
      <SiteHeader />
      <section className="confirmation-shell shell">
        <div className={`confirmation-card glass ${hasError ? "error" : "success"}`}>
          <div className="confirmation-icon">
            {hasError ? <MailWarning size={34} /> : <CheckCircle2 size={34} />}
          </div>
          <span className="section-label">{hasError ? "LINK COULDN’T BE VERIFIED" : "YOU’RE IN"}</span>
          <h1>{hasError ? "That confirmation link has expired." : "Email confirmed."}</h1>
          <p>
            {hasError
              ? "Confirmation links can only be used once and may expire. Return to login and request a fresh signup email if needed."
              : `Welcome to MemeLab${viewer?.display_name ? `, ${viewer.display_name}` : ""}. Your account is verified and ready.`}
          </p>
          <div className="confirmation-actions">
            {hasError ? (
              <Link className="primary-cta" href="/auth"><RefreshCw size={16} /> Return to login</Link>
            ) : (
              <Link className="primary-cta" href={next}>Enter MemeLab <ArrowRight size={17} /></Link>
            )}
            <Link className="secondary-cta" href="/">Go home</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
