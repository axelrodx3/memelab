"use client";

import { ImageOff } from "lucide-react";
import PostCard from "./PostCard";

export default function CommunityFeed({ posts, viewerId, showMature }) {
  if (!posts.length) {
    return (
      <div className="community-empty glass">
        <ImageOff size={26} />
        <h2>The feed is getting ready.</h2>
        <p>Once the storage import completes, MemeLab’s first posts will appear here.</p>
      </div>
    );
  }

  return (
    <div className="community-feed">
      {posts.map((post) => (
        <PostCard
          key={post.id}
          post={post}
          viewerId={viewerId}
          showMature={showMature}
        />
      ))}
    </div>
  );
}
