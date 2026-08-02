import { redirect } from "next/navigation";
import { getViewer } from "../../../../lib/supabase/server";
import SiteHeader from "../../../components/SiteHeader";
import DiscussionForm from "../../discuss/create/DiscussionForm";

export const metadata = { title: "Start a Room Post | MemeLab" };

export default async function CreateRoomPostPage({ searchParams }) {
  const viewer = await getViewer();
  if (!viewer) redirect("/auth?next=/community/rooms/create");
  const params = await searchParams;
  const allowed = new Set(["general", "meme-talk", "studio-help", "ideas", "off-topic"]);
  const channel = allowed.has(params.channel) ? params.channel : "general";
  return <main className="create-post-page"><div className="ambient ambient-one" /><SiteHeader /><section className="discussion-create-shell discussion-create-shell-quiet shell"><header><h1>New Room post</h1><p>Choose a room and start a conversation.</p></header><DiscussionForm viewer={viewer} initialChannel={channel} /></section></main>;
}
