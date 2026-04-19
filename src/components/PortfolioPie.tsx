import { useMemo } from "react";
import type { PieSlice } from "../lib/palette";

type Props = {
  slices: PieSlice[];
  size?: number;
  strokeWidth?: number;
};

export default function PortfolioPie({ slices, size = 180, strokeWidth = 28 }: Props) {
  const total = useMemo(() => slices.reduce((s, x) => s + x.value, 0), [slices]);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const rendered = useMemo(() => {
    if (total <= 0) return [];
    let cumulative = 0;
    return slices.map((s) => {
      const pct = s.value / total;
      const length = pct * circumference;
      const offset = cumulative * circumference;
      cumulative += pct;
      return { ...s, length, offset };
    });
  }, [slices, total, circumference]);

  if (total <= 0) return null;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="rgba(255,255,255,0.06)"
        strokeWidth={strokeWidth}
      />
      {rendered.map((s) => (
        <circle
          key={s.id}
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={s.color}
          strokeWidth={strokeWidth}
          strokeDasharray={`${s.length} ${circumference - s.length}`}
          strokeDashoffset={-s.offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      ))}
    </svg>
  );
}
