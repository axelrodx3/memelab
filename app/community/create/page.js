import { redirect } from "next/navigation";
import SiteHeader from "../../components/SiteHeader";
import { getViewer } from "../../../lib/supabase/server";
import CreatePostForm from "./CreatePostForm";

export const metadata = {
  title: "Create a post | MemeLab",
  description: "Upload an image or meme to the MemeLab community."
};
export const dynamic = "force-dynamic";

export default async function CreatePostPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/auth?next=/community/create");
  if (viewer.account_status === "deactivated") redirect("/account");

  return (
    <main className="create-post-page">
      <div className="ambient ambient-one" />
      <SiteHeader />
      <section className="create-post-shell shell">
        <header>
          <span className="section-label">CREATE A COMMUNITY POST</span>
          <h1>Put something<br /><span>into the world.</span></h1>
          <p>Upload an image, add context and decide whether it needs a mature-content warning.</p>
        </header>
        <CreatePostForm viewer={viewer} />
      </section>
    </main>
  );
}
