import { fmtMoneyShort } from '../lib/format.js'

/** โดนัทชาร์ตวาดด้วย SVG ล้วน ไม่พึ่งไลบรารีภายนอก */
export function Donut({ slices, size = 168, thickness = 26, centerTop, centerBottom }) {
  const total = slices.reduce((s, x) => s + x.value, 0)
  const r = (size - thickness) / 2
  const c = 2 * Math.PI * r
  let offset = 0

  return (
    <div className="donut-wrap" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img">
        <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
          <circle
            cx={size / 2} cy={size / 2} r={r}
            fill="none" stroke="var(--track)" strokeWidth={thickness}
          />
          {total > 0 && slices.map((s) => {
            const len = (s.value / total) * c
            const el = (
              <circle
                key={s.key}
                cx={size / 2} cy={size / 2} r={r}
                fill="none"
                stroke={s.color}
                strokeWidth={thickness}
                strokeDasharray={`${Math.max(len - 1.5, 0)} ${c}`}
                strokeDashoffset={-offset}
                strokeLinecap="butt"
              >
                <title>{`${s.label}: ${fmtMoneyShort(s.value)} บาท`}</title>
              </circle>
            )
            offset += len
            return el
          })}
        </g>
      </svg>
      <div className="donut-center">
        <span className="donut-top">{centerTop}</span>
        <span className="donut-bottom">{centerBottom}</span>
      </div>
    </div>
  )
}

/** แท่งคู่ รายรับ/รายจ่าย ต่อเดือน */
export function MonthlyBars({ data, height = 150 }) {
  const max = Math.max(1, ...data.flatMap((d) => [d.income, d.expense]))
  return (
    <div className="bars" style={{ height: height + 34 }}>
      {data.map((d) => (
        <div className="bar-col" key={d.key} title={`${d.label}\nรับ ${fmtMoneyShort(d.income)} / จ่าย ${fmtMoneyShort(d.expense)}`}>
          <div className="bar-pair" style={{ height }}>
            <div className="bar income" style={{ height: `${(d.income / max) * 100}%` }} />
            <div className="bar expense" style={{ height: `${(d.expense / max) * 100}%` }} />
          </div>
          <span className="bar-label">{d.label}</span>
        </div>
      ))}
    </div>
  )
}

/** แถบสัดส่วนแนวนอน ใช้กับหมวดหมู่และงบประมาณ */
export function BarRow({ icon, label, value, max, color, right, sub }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0
  return (
    <div className="barrow">
      <div className="barrow-head">
        <span className="barrow-label">
          {icon && <span className="barrow-icon">{icon}</span>}
          {label}
        </span>
        <span className="barrow-value">{right}</span>
      </div>
      <div className="barrow-track">
        <div className="barrow-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
      {sub && <div className="barrow-sub">{sub}</div>}
    </div>
  )
}
