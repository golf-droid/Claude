import { useState } from 'react'
import { useData } from '../lib/store.jsx'
import { dayLabel, fmtMoney } from '../lib/format.js'
import TransactionSheet from './TransactionSheet.jsx'

export default function TransactionList({ items, emptyText = 'ยังไม่มีรายการ' }) {
  const { categoryById, accountById, memberById } = useData()
  const [editing, setEditing] = useState(null)

  if (!items.length) return <p className="empty">{emptyText}</p>

  // จัดกลุ่มตามวัน
  const groups = []
  for (const t of items) {
    const last = groups[groups.length - 1]
    if (last && last.date === t.txn_date) last.items.push(t)
    else groups.push({ date: t.txn_date, items: [t] })
  }

  return (
    <>
      {groups.map((g) => {
        const dayTotal = g.items.reduce(
          (s, t) => s + (t.type === 'income' ? Number(t.amount) : t.type === 'expense' ? -Number(t.amount) : 0),
          0
        )
        return (
          <section key={g.date} className="day-group">
            <header className="day-head">
              <span>{dayLabel(g.date)}</span>
              <span className={dayTotal >= 0 ? 'pos' : 'neg'}>
                {dayTotal >= 0 ? '+' : '−'}{fmtMoney(Math.abs(dayTotal))}
              </span>
            </header>
            <ul className="txn-list">
              {g.items.map((t) => {
                const cat = t.category_id ? categoryById[t.category_id] : null
                const acc = accountById[t.account_id]
                const toAcc = t.to_account_id ? accountById[t.to_account_id] : null
                const who = t.paid_by ? memberById[t.paid_by] : null
                return (
                  <li key={t.id}>
                    <button className="txn" onClick={() => setEditing(t)}>
                      <span
                        className="txn-icon"
                        style={{ background: (cat?.color ?? '#64748b') + '1f' }}
                      >
                        {t.type === 'transfer' ? '🔄' : cat?.icon ?? '📌'}
                      </span>
                      <span className="txn-main">
                        <span className="txn-title">
                          {t.type === 'transfer'
                            ? `โอน: ${acc?.name ?? '?'} → ${toAcc?.name ?? '?'}`
                            : cat?.name ?? 'ไม่ระบุหมวด'}
                        </span>
                        <span className="txn-sub">
                          {[t.note, acc?.name, who?.display_name].filter(Boolean).join(' · ')}
                        </span>
                      </span>
                      <span className={`txn-amount ${t.type}`}>
                        {t.type === 'income' ? '+' : t.type === 'expense' ? '−' : ''}
                        {fmtMoney(t.amount)}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </section>
        )
      })}
      {editing && <TransactionSheet editing={editing} onClose={() => setEditing(null)} />}
    </>
  )
}
