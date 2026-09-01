import { currentMonthKey, monthLabel, shiftMonth } from '../lib/format.js'

export default function MonthPicker({ value, onChange }) {
  const isCurrent = value === currentMonthKey()
  return (
    <div className="monthpicker">
      <button className="icon-btn" onClick={() => onChange(shiftMonth(value, -1))} aria-label="เดือนก่อนหน้า">‹</button>
      <button
        className="month-label"
        onClick={() => onChange(currentMonthKey())}
        title="กดเพื่อกลับมาเดือนปัจจุบัน"
      >
        {monthLabel(value)}
      </button>
      <button
        className="icon-btn"
        onClick={() => onChange(shiftMonth(value, 1))}
        disabled={isCurrent}
        aria-label="เดือนถัดไป"
      >›</button>
    </div>
  )
}
