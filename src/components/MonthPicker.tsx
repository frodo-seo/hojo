import { getMonthLabel, prevMonth, nextMonth } from "../lib/format";

type Props = {
  month: string;
  onChange: (m: string) => void;
};

function ChevronLeft() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function ChevronRight() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

export default function MonthPicker({ month, onChange }: Props) {
  return (
    <div className="month-picker">
      <button className="mp-arrow" onClick={() => onChange(prevMonth(month))}>
        <ChevronLeft />
      </button>
      <span className="mp-label">{getMonthLabel(month)}</span>
      <button className="mp-arrow" onClick={() => onChange(nextMonth(month))}>
        <ChevronRight />
      </button>
    </div>
  );
}
