import { redirect } from "next/navigation";

export default async function DiscussionsPage({ searchParams }) {
  const params = await searchParams;
  const query = new URLSearchParams();
  Object.entries(params || {}).forEach(([key, value]) => { if (typeof value === "string") query.set(key, value); });
  redirect(`/community/rooms${query.size ? `?${query.toString()}` : ""}`);
}
