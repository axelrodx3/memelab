import { redirect } from "next/navigation";

export default async function CirclePage({ params }) {
  const { slug } = await params;
  redirect(`/community/circles/${slug}`);
}
