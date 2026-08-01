import { redirect } from "next/navigation";

export default async function CreateDiscussionPage({ searchParams }) {
  const params = await searchParams;
  const channel = typeof params.channel === "string" ? `?channel=${encodeURIComponent(params.channel)}` : "";
  redirect(`/community/rooms/create${channel}`);
}
