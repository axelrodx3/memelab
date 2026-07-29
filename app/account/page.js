import { redirect } from "next/navigation";
import SiteHeader from "../components/SiteHeader";
import { getViewer } from "../../lib/supabase/server";
import AccountForm from "./AccountForm";

export const metadata = { title: "Your account — MemeLab" };
export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/auth?next=/account");

  return (
    <main className="account-page">
      <div className="ambient ambient-one" />
      <SiteHeader />
      <section className="account-shell shell">
        <div className="account-heading">
          <span className="section-label">YOUR MEMELAB IDENTITY</span>
          <h1>{viewer.display_name || viewer.username}</h1>
          <p>@{viewer.username} · {viewer.karma} karma</p>
        </div>
        <AccountForm profile={viewer} />
      </section>
    </main>
  );
}
