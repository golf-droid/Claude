import { useMemo, useState } from 'react'
import { useData } from '../lib/store.jsx'
import {
  currentMonthKey, fmtMoney, fmtMoneyShort, monthKeyOf, shiftMonth, shortMonthLabel
} from '../lib/format.js'
import { BarRow, MonthlyBars } from '../components/Charts.jsx'
import MonthPicker from '../components/MonthPicker.jsx'

const MEMBER_COLORS = ['#2563eb', '#16a34a', '#f97316', '#8b5cf6', '#0891b2', '#ec4899']

export default function Reports() {
  const { transactions, categoryById, memberById, members, monthSummary } = useData()
  const [month, setMonth] = useState(currentMonthKey())
  const [range, setRange] = useState(6)

  const trend = useMemo(() => {
    const out = []
    for (let i = range - 1; i >= 0; i--) {
      const key = shiftMonth(month, -i)
      const s = monthSummary(key)
      out.push({ key, label: shortMonthLabel(key), income: s.income, expense: s.expense, net: s.net })
    }
    return out
  }, [month, range, monthSummary])

  const avg = useMemo(() => {
    const withData = trend.filter((t) => t.income > 0 || t.expense > 0)
    if (!withData.length) return { income: 0, expense: 0, net: 0 }
    const sum = withData.reduce(
      (a, t) => ({ income: a.income + t.income, expense: a.expense + t.expense, net: a.net + t.net }),
      { income: 0, expense: 0, net: 0 }
    )
    return {
      income: sum.income / withData.length,
      expense: sum.expense / withData.length,
      net: sum.net / withData.length
    }
  }, [trend])

  const monthTxns = useMemo(
    () => transactions.filter((t) => monthKeyOf(t.txn_date) === month),
    [transactions, month]
  )

  const byCategory = useMemo(() => {
    const make = (kind) => {
      const m = new Map()
      for (const t of monthTxns) {
        if (t.type !== kind || !t.category_id) continue
        m.set(t.category_id, (m.get(t.category_id) ?? 0) + Number(t.amount))
      }
      const rows = [...m.entries()]
        .map(([id, value]) => ({ id, value, cat: categoryById[id] }))
        .sort((a, b) => b.value - a.value)
      const total = rows.reduce((s, r) => s + r.value, 0)
      return { rows, total }
    }
    return { expense: make('expense'), income: make('income') }
  }, [monthTxns, categoryById])

  const byMember = useMemo(() => {
    const m = new Map()
    for (const t of monthTxns) {
      if (t.type !== 'expense') continue
      const key = t.paid_by ?? '_shared'
      m.set(key, (m.get(key) ?? 0) + Number(t.amount))
    }
    const rows = [...m.entries()]
      .map(([id, value], i) => ({
        id,
        value,
        name: id === '_shared' ? 'ส่วนกลาง' : memberById[id]?.display_name ?? 'ไม่ระบุ',
        color: MEMBER_COLORS[i % MEMBER_COLORS.length]
      }))
      .sort((a, b) => b.value - a.value)
    const total = rows.reduce((s, r) => s + r.value, 0)
    return { rows, total }
  }, [monthTxns, memberById, members])

  return (
    <div className="page">
      <MonthPicker value={month} onChange={setMonth} />

      <section className="card">
        <div className="card-head">
          <h2 className="card-title">แนวโน้มรับ-จ่าย</h2>
          <div className="seg tiny">
            {[3, 6, 12].map((r) => (
              <button key={r} className={`seg-item ${range === r ? 'active' : ''}`} onClick={() => setRange(r)}>
                {r} เดือน
              </button>
            ))}
          </div>
        </div>
        <MonthlyBars data={trend} />
        <div className="legend-inline">
          <span><i className="dot" style={{ background: '#16a34a' }} /> รายรับ</span>
          <span><i className="dot" style={{ background: '#ef4444' }} /> รายจ่าย</span>
        </div>
        <div className="stat-grid">
          <div>
            <span className="muted small">รับเฉลี่ย/เดือน</span>
            <strong className="pos">{fmtMoney(avg.income)}</strong>
          </div>
          <div>
            <span className="muted small">จ่ายเฉลี่ย/เดือน</span>
            <strong className="neg">{fmtMoney(avg.expense)}</strong>
          </div>
          <div>
            <span className="muted small">เหลือเฉลี่ย/เดือน</span>
            <strong className={avg.net >= 0 ? 'pos' : 'neg'}>{fmtMoney(avg.net)}</strong>
          </div>
        </div>
      </section>

      <section className="card">
        <h2 className="card-title">รายจ่ายแยกตามหมวด</h2>
        {byCategory.expense.rows.length ? (
          byCategory.expense.rows.map((r) => (
            <BarRow
              key={r.id}
              icon={r.cat?.icon}
              label={r.cat?.name ?? '—'}
              value={r.value}
              max={byCategory.expense.rows[0].value}
              color={r.cat?.color ?? '#94a3b8'}
              right={`${fmtMoneyShort(r.value)} · ${Math.round((r.value / byCategory.expense.total) * 100)}%`}
            />
          ))
        ) : (
          <p className="empty">เดือนนี้ยังไม่มีรายจ่าย</p>
        )}
      </section>

      <section className="card">
        <h2 className="card-title">รายรับแยกตามหมวด</h2>
        {byCategory.income.rows.length ? (
          byCategory.income.rows.map((r) => (
            <BarRow
              key={r.id}
              icon={r.cat?.icon}
              label={r.cat?.name ?? '—'}
              value={r.value}
              max={byCategory.income.rows[0].value}
              color={r.cat?.color ?? '#16a34a'}
              right={`${fmtMoneyShort(r.value)} · ${Math.round((r.value / byCategory.income.total) * 100)}%`}
            />
          ))
        ) : (
          <p className="empty">เดือนนี้ยังไม่มีรายรับ</p>
        )}
      </section>

      <section className="card">
        <h2 className="card-title">ใครใช้เท่าไหร่</h2>
        {byMember.rows.length ? (
          byMember.rows.map((r) => (
            <BarRow
              key={r.id}
              label={r.name}
              value={r.value}
              max={byMember.rows[0].value}
              color={r.color}
              right={`${fmtMoneyShort(r.value)} · ${Math.round((r.value / byMember.total) * 100)}%`}
            />
          ))
        ) : (
          <p className="empty">เดือนนี้ยังไม่มีรายจ่าย</p>
        )}
      </section>
    </div>
  )
}
