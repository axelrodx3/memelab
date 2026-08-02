import { useId } from "react";

export default function InterlockMark({ className = "", title = "" }) {
  const gradientId = `interlock-gradient-${useId().replace(/:/g, "")}`;

  return (
    <svg className={`interlock-mark ${className}`} viewBox="0 0 120 72" fill="none" aria-hidden={title ? undefined : true} role={title ? "img" : undefined}>
      {title && <title>{title}</title>}
      <defs>
        <linearGradient id={gradientId} x1="22" y1="15" x2="99" y2="59" gradientUnits="userSpaceOnUse">
          <stop stopColor="#F1ECFF" />
          <stop offset="0.47" stopColor="#C6A8FF" />
          <stop offset="1" stopColor="#8C64F3" />
        </linearGradient>
      </defs>
      <g className="interlock-link interlock-link-left">
        <rect x="20" y="16" width="40" height="40" rx="9" transform="rotate(45 40 36)" stroke={`url(#${gradientId})`} strokeWidth="8" />
      </g>
      <g className="interlock-link interlock-link-right">
        <rect x="60" y="16" width="40" height="40" rx="9" transform="rotate(45 80 36)" stroke={`url(#${gradientId})`} strokeWidth="8" />
      </g>
    </svg>
  );
}
