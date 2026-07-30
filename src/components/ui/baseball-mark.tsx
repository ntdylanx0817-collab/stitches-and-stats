import type { CSSProperties } from "react";

/**
 * A stitched baseball, drawn rather than lettered.
 *
 * The two seams are quadratic curves bulging toward the centre — the shape a
 * ball makes viewed side-on — and the stitch ticks are the same curves redrawn
 * thick and dashed, so each tick sits perpendicular to the seam without having
 * to place thirty little lines by hand.
 *
 * Inherits `currentColor`, so callers set the colour and opacity.
 */
export function BaseballMark({
  className,
  size = 48,
  style,
}: {
  className?: string;
  size?: number;
  /** For absolute placement — `.glass > *` overrides the `absolute` utility. */
  style?: CSSProperties;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      className={className}
      style={style}
      aria-hidden="true"
    >
      <circle cx="24" cy="24" r="20.5" stroke="currentColor" strokeWidth="1.5" />
      {["M12 8.5Q21 24 12 39.5", "M36 8.5Q27 24 36 39.5"].map((d) => (
        <g key={d}>
          <path d={d} stroke="currentColor" strokeWidth="1.25" />
          <path d={d} stroke="currentColor" strokeWidth="5" strokeDasharray="1.4 5" opacity="0.75" />
        </g>
      ))}
    </svg>
  );
}
