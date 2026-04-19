const PALETTE = [
  "#F5B32E", // brand gold
  "#4DA3FF",
  "#7BD389",
  "#E27396",
  "#B788E8",
  "#F08A5D",
  "#56C4C4",
  "#D4D4D8",
];

export function colorForIndex(i: number): string {
  return PALETTE[i % PALETTE.length];
}

export interface PieSlice {
  id: string;
  label: string;
  value: number;
  color: string;
}
