import { redirect } from "next/navigation";

export default async function CirclePostPage({ params }) {
  const { slug, id } = await params;
  redirect(`/community/circles/${slug}/posts/${id}`);
}
