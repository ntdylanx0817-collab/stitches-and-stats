import type { CSSProperties } from "react";

/**
 * A simplified ballpark plan used as a quiet, baseball-specific illustration.
 * It inherits currentColor so it can sit behind content as a watermark or act
 * as a small diagram without introducing another image asset.
 */
export function BaseballFieldMark({
  className,
  size = 240,
  style,
}: {
  className?: string;
  size?: number;
  style?: CSSProperties;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      className={className}
      style={style}
      aria-hidden="true"
    >
      <path d="M60 108 12 60 60 12l48 48-48 48Z" fill="currentColor" opacity="0.035" />
      <path d="M14 62A64 64 0 0 1 106 62" stroke="currentColor" strokeWidth="1.5" />
      <path d="M6 48 60 108l54-60" stroke="currentColor" strokeWidth="1.25" />
      <path d="M60 96 24 60l36-36 36 36-36 36Z" stroke="currentColor" strokeWidth="1.25" strokeDasharray="2.5 3" />
      <circle cx="60" cy="60" r="3.5" stroke="currentColor" strokeWidth="1.25" />
      <path d="m55 104 5-3 5 3-1 5h-8l-1-5Z" fill="currentColor" opacity="0.8" />
      {[{ x: 60, y: 23 }, { x: 96, y: 59 }, { x: 24, y: 59 }].map((base) => (
        <rect
          key={`${base.x}-${base.y}`}
          x={base.x - 2.5}
          y={base.y - 2.5}
          width="5"
          height="5"
          rx="0.5"
          fill="currentColor"
          opacity="0.8"
          transform={`rotate(45 ${base.x} ${base.y})`}
        />
      ))}
      <path d="M20 74A48 48 0 0 0 100 74" stroke="currentColor" strokeWidth="1" opacity="0.55" />
    </svg>
  );
}
