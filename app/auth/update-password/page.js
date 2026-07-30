import { redirect } from "next/navigation";
import SiteHeader from "../../components/SiteHeader";
import { getViewer } from "../../../lib/supabase/server";
import UpdatePasswordForm from "./UpdatePasswordForm";

export const metadata = { title: "Choose a new password — MemeLab" };
export const dynamic = "force-dynamic";

export default async function UpdatePasswordPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/auth");

  return (
    <main className="confirmation-page">
      <div className="ambient ambient-one" />
      <SiteHeader />
      <section className="confirmation-shell shell">
        <UpdatePasswordForm />
      </section>
    </main>
  );
}
