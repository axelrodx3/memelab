import { redirect } from "next/navigation";
import SiteHeader from "../../components/SiteHeader";
import MessagesShell from "../MessagesShell";
import { getConversationForMember, getConversationsForMember } from "../../../lib/social";
import { getViewer } from "../../../lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function MessageThreadPage({ params }) {
  const viewer = await getViewer();
  if (!viewer) redirect("/auth?next=/messages");

  const { id } = await params;
  const [conversations, selectedConversation] = await Promise.all([
    getConversationsForMember(viewer.id),
    getConversationForMember(id, viewer.id)
  ]);
  if (!selectedConversation) redirect("/messages");

  return (
    <main className="messages-page">
      <div className="ambient ambient-one" />
      <SiteHeader />
      <MessagesShell viewer={viewer} conversations={conversations} selectedConversation={selectedConversation} />
    </main>
  );
}
