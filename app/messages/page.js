import { redirect } from "next/navigation";
import SiteHeader from "../components/SiteHeader";
import MessagesShell from "./MessagesShell";
import { getConversationsForMember, getMessageTarget } from "../../lib/social";
import { getViewer } from "../../lib/supabase/server";

export const metadata = { title: "Messages | MemeLab" };
export const dynamic = "force-dynamic";

export default async function MessagesPage({ searchParams }) {
  const viewer = await getViewer();
  if (!viewer) redirect("/auth?next=/messages");

  const query = await searchParams;
  const username = typeof query?.with === "string" ? query.with : "";
  const [conversations, startTarget] = await Promise.all([
    getConversationsForMember(viewer.id),
    getMessageTarget(username, viewer.id)
  ]);

  return (
    <main className="messages-page">
      <div className="ambient ambient-one" />
      <SiteHeader />
      <MessagesShell viewer={viewer} conversations={conversations} startTarget={startTarget} />
    </main>
  );
}
