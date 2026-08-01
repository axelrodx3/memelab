"use client";

import { createPortal } from "react-dom";
import { useEffect, useState } from "react";

/**
 * Render destructive/report dialogs at the document level so they are not
 * clipped by a feed card's overflow or trapped in its stacking context.
 */
export default function ContentActionPortal({ children }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  return mounted ? createPortal(children, document.body) : null;
}
