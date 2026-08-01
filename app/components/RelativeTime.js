"use client";

import { useEffect, useState } from "react";
import { formatRelativeTime } from "../../lib/relative-time";

function fallbackDate(value) {
  return typeof value === "string" ? value.slice(0, 10) : "";
}

export default function RelativeTime({ value, prefix = "" }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!value) return null;

  const label = mounted ? formatRelativeTime(value) : fallbackDate(value);
  return <time dateTime={value} title={fallbackDate(value)}>{prefix}{label}</time>;
}
