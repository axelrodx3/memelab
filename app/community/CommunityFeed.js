"use client";

import { ImageOff } from "lucide-react";
import PostCard from "./PostCard";

export default function CommunityFeed({ posts, viewerId, showMature, emptyTitle = "The feed is getting ready.", emptyText = "New community posts will appear here." }) {
  if (!posts.length) {
    return (
      <div className="community-empty glass">
        <ImageOff size={26} />
        <h2>{emptyTitle}</h2>
        <p>{emptyText}</p>
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
