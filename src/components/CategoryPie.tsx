import type { CategorySlice } from "../lib/stats";
import { won } from "../lib/format";

type Props = { slices: CategorySlice[]; size?: number };

export default function CategoryPie({ slices, size = 160 }: Props) {
  const total = slices.reduce((a, s) => a + s.amount, 0);
  if (total === 0) {
    return <div className="pie-empty">아직 데이터가 없어요</div>;
  }
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 4;
  const inner = r * 0.6;

  let acc = 0;
  const arcs = slices.map((s) => {
    const start = acc;
    const end = acc + s.ratio;
    acc = end;
    const a0 = start * Math.PI * 2 - Math.PI / 2;
    const a1 = end * Math.PI * 2 - Math.PI / 2;
    const x0 = cx + Math.cos(a0) * r;
    const y0 = cy + Math.sin(a0) * r;
    const x1 = cx + Math.cos(a1) * r;
    const y1 = cy + Math.sin(a1) * r;
    const ix0 = cx + Math.cos(a0) * inner;
    const iy0 = cy + Math.sin(a0) * inner;
    const ix1 = cx + Math.cos(a1) * inner;
    const iy1 = cy + Math.sin(a1) * inner;
    const large = s.ratio > 0.5 ? 1 : 0;
    const d = [
      `M ${x0} ${y0}`,
      `A ${r} ${r} 0 ${large} 1 ${x1} ${y1}`,
      `L ${ix1} ${iy1}`,
      `A ${inner} ${inner} 0 ${large} 0 ${ix0} ${iy0}`,
      "Z",
    ].join(" ");
    return { d, color: s.color };
  });

  return (
    <div className="pie-wrap">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {arcs.map((a, i) => (
          <path key={i} d={a.d} fill={a.color} />
        ))}
        <text
          x={cx}
          y={cy - 4}
          textAnchor="middle"
          className="pie-label"
          style={{ fontSize: 10, fill: "#8a6a4a" }}
        >
          총 지출
        </text>
        <text
          x={cx}
          y={cy + 12}
          textAnchor="middle"
          style={{ fontSize: 13, fontWeight: 700, fill: "#1a120a" }}
        >
          {won(total)}
        </text>
      </svg>
      <ul className="pie-legend">
        {slices.slice(0, 6).map((s) => (
          <li key={s.name}>
            <span className="dot" style={{ background: s.color }} />
            <span className="name">{s.name}</span>
            <span className="ratio">{(s.ratio * 100).toFixed(0)}%</span>
            <span className="amount">{won(s.amount)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
