import { redirect } from "next/navigation";
import SiteHeader from "../components/SiteHeader";
import { getViewer } from "../../lib/supabase/server";
import AuthForm from "./AuthForm";

export const metadata = {
  title: "Join MemeLab",
  description: "Create your MemeLab account to post, vote, comment and join the community."
};
export const dynamic = "force-dynamic";

export default async function AuthPage({ searchParams }) {
  const viewer = await getViewer();
  const query = await searchParams;
  if (viewer) redirect(query.next || "/community");

  return (
    <main className="auth-page">
      <div className="ambient ambient-one" />
      <SiteHeader />
      <section className="auth-shell shell">
        <div className="auth-intro">
          <span className="section-label">MEMELAB COMMUNITY</span>
          <h1>Make something.<br /><span>Become known for it.</span></h1>
          <p>Post images, join conversations and help decide what rises through the Stream.</p>
          <div className="auth-benefits">
            <span>Post images and memes</span>
            <span>Vote and comment</span>
            <span>Build your profile and karma</span>
          </div>
        </div>
        <AuthForm nextPath={query.next || "/community"} />
      </section>
    </main>
  );
}
