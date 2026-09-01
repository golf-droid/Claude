import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useData } from '../lib/store.jsx'
import { currentMonthKey, fmtMoney, fmtMoneyShort, monthKeyOf } from '../lib/format.js'
import MonthPicker from '../components/MonthPicker.jsx'
import TransactionList from '../components/TransactionList.jsx'
import { BarRow, Donut } from '../components/Charts.jsx'
import Money from '../components/Money.jsx'

export default function Dashboard() {
  const { transactions, balances, totalBalance, categoryById, budgets, monthSummary } = useData()
  const [month, setMonth] = useState(currentMonthKey())

  const summary = monthSummary(month)

  const topCategories = useMemo(() => {
    const totals = new Map()
    for (const t of summary.list) {
      if (t.type !== 'expense' || !t.category_id) continue
      totals.set(t.category_id, (totals.get(t.category_id) ?? 0) + Number(t.amount))
    }
    return [...totals.entries()]
      .map(([id, value]) => ({ id, value, cat: categoryById[id] }))
      .sort((a, b) => b.value - a.value)
  }, [summary.list, categoryById])

  const monthBudgets = useMemo(() => {
    const key = `${month}-01`
    const spent = new Map()
    for (const t of summary.list) {
      if (t.type !== 'expense' || !t.category_id) continue
      spent.set(t.category_id, (spent.get(t.category_id) ?? 0) + Number(t.amount))
    }
    return budgets
      .filter((b) => b.month === key && Number(b.amount) > 0)
      .map((b) => ({
        ...b,
        cat: categoryById[b.category_id],
        spent: spent.get(b.category_id) ?? 0
      }))
      .sort((a, b) => b.spent / b.amount - a.spent / a.amount)
  }, [budgets, month, summary.list, categoryById])

  const recent = useMemo(
    () => transactions.filter((t) => monthKeyOf(t.txn_date) === month).slice(0, 8),
    [transactions, month]
  )

  const slices = topCategories.slice(0, 6).map((x, i) => ({
    key: x.id,
    label: x.cat?.name ?? 'อื่น ๆ',
    value: x.value,
    color: x.cat?.color ?? ['#f97316', '#3b82f6', '#16a34a', '#eab308', '#ec4899', '#8b5cf6'][i % 6]
  }))
  const otherTotal = topCategories.slice(6).reduce((s, x) => s + x.value, 0)
  if (otherTotal > 0) slices.push({ key: '_other', label: 'อื่น ๆ', value: otherTotal, color: '#94a3b8' })

  return (
    <div className="page">
      <MonthPicker value={month} onChange={setMonth} />

      <section className="card hero">
        <span className="hero-label">ยอดเงินคงเหลือรวม</span>
        <strong className="hero-value">{fmtMoney(totalBalance)} ฿</strong>
        <div className="hero-split">
          <div>
            <span className="muted small">รายรับเดือนนี้</span>
            <Money value={summary.income} sign="pos" />
          </div>
          <div>
            <span className="muted small">รายจ่ายเดือนนี้</span>
            <Money value={summary.expense} sign="neg" />
          </div>
          <div>
            <span className="muted small">คงเหลือ</span>
            <Money value={summary.net} />
          </div>
        </div>
      </section>

      <section className="card">
        <h2 className="card-title">กระเป๋าเงิน</h2>
        <ul className="account-list">
          {balances.filter((a) => a.is_active !== false).map((a) => (
            <li key={a.id}>
              <span className="acc-icon">{a.icon}</span>
              <span className="acc-name">{a.name}</span>
              <Money value={a.balance} />
            </li>
          ))}
        </ul>
      </section>

      <section className="card">
        <h2 className="card-title">รายจ่ายตามหมวด</h2>
        {summary.expense > 0 ? (
          <div className="donut-row">
            <Donut
              slices={slices}
              centerTop="จ่ายรวม"
              centerBottom={`${fmtMoneyShort(summary.expense)} ฿`}
            />
            <ul className="legend">
              {slices.map((s) => (
                <li key={s.key}>
                  <span className="dot" style={{ background: s.color }} />
                  <span className="legend-label">{s.label}</span>
                  <span className="legend-value">
                    {Math.round((s.value / summary.expense) * 100)}% · {fmtMoneyShort(s.value)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="empty">เดือนนี้ยังไม่มีรายจ่าย</p>
        )}
      </section>

      {monthBudgets.length > 0 && (
        <section className="card">
          <h2 className="card-title">งบประมาณเดือนนี้</h2>
          {monthBudgets.map((b) => {
            const over = b.spent > Number(b.amount)
            return (
              <BarRow
                key={b.id}
                icon={b.cat?.icon}
                label={b.cat?.name ?? '—'}
                value={b.spent}
                max={Number(b.amount)}
                color={over ? '#ef4444' : b.cat?.color ?? '#2563eb'}
                right={`${fmtMoneyShort(b.spent)} / ${fmtMoneyShort(b.amount)}`}
                sub={
                  over
                    ? `เกินงบ ${fmtMoney(b.spent - Number(b.amount))} ฿`
                    : `เหลือ ${fmtMoney(Number(b.amount) - b.spent)} ฿`
                }
              />
            )
          })}
        </section>
      )}

      <section className="card">
        <div className="card-head">
          <h2 className="card-title">รายการล่าสุด</h2>
          <Link className="btn link" to="/transactions">ดูทั้งหมด</Link>
        </div>
        <TransactionList items={recent} emptyText="เดือนนี้ยังไม่มีรายการ กดปุ่ม + เพื่อเริ่มบันทึก" />
      </section>
    </div>
  )
}
