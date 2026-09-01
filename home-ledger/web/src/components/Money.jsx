import { fmtMoney } from '../lib/format.js'

export default function Money({ value, sign, className = '' }) {
  const n = Number(value) || 0
  const tone = sign ?? (n > 0 ? 'pos' : n < 0 ? 'neg' : '')
  const prefix = sign === 'pos' ? '+' : sign === 'neg' ? '−' : n < 0 ? '−' : ''
  return (
    <span className={`money ${tone} ${className}`}>
      {prefix}{fmtMoney(Math.abs(n))}
    </span>
  )
}
