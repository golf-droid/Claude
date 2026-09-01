import { useMemo, useState } from 'react'
import { useData } from '../lib/store.jsx'
import { currentMonthKey, fmtMoney, monthKeyOf } from '../lib/format.js'
import MonthPicker from '../components/MonthPicker.jsx'
import TransactionList from '../components/TransactionList.jsx'

export default function Transactions() {
  const { transactions, categories, accounts, members } = useData()
  const [month, setMonth] = useState(currentMonthKey())
  const [type, setType] = useState('all')
  const [categoryId, setCategoryId] = useState('all')
  const [accountId, setAccountId] = useState('all')
  const [memberId, setMemberId] = useState('all')
  const [q, setQ] = useState('')

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return transactions.filter((t) => {
      if (monthKeyOf(t.txn_date) !== month) return false
      if (type !== 'all' && t.type !== type) return false
      if (categoryId !== 'all' && t.category_id !== categoryId) return false
      if (accountId !== 'all' && t.account_id !== accountId && t.to_account_id !== accountId) return false
      if (memberId !== 'all' && (t.paid_by ?? '') !== (memberId === 'shared' ? '' : memberId)) return false
      if (needle && !String(t.note).toLowerCase().includes(needle)) return false
      return true
    })
  }, [transactions, month, type, categoryId, accountId, memberId, q])

  const totals = useMemo(() => {
    let income = 0, expense = 0
    for (const t of filtered) {
      if (t.type === 'income') income += Number(t.amount)
      else if (t.type === 'expense') expense += Number(t.amount)
    }
    return { income, expense, net: income - expense, count: filtered.length }
  }, [filtered])

  return (
    <div className="page">
      <MonthPicker value={month} onChange={setMonth} />

      <section className="card">
        <input
          className="search"
          placeholder="ค้นหาจากบันทึกช่วยจำ…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <div className="filters">
          <select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="all">ทุกประเภท</option>
            <option value="expense">รายจ่าย</option>
            <option value="income">รายรับ</option>
            <option value="transfer">โอนเงิน</option>
          </select>
          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="all">ทุกหมวดหมู่</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
            ))}
          </select>
          <select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
            <option value="all">ทุกกระเป๋า</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>{a.icon} {a.name}</option>
            ))}
          </select>
          <select value={memberId} onChange={(e) => setMemberId(e.target.value)}>
            <option value="all">ทุกคน</option>
            <option value="shared">ส่วนกลาง</option>
            {members.map((m) => (
              <option key={m.user_id} value={m.user_id}>{m.display_name}</option>
            ))}
          </select>
        </div>
        <div className="totals-strip">
          <span>{totals.count} รายการ</span>
          <span className="pos">+{fmtMoney(totals.income)}</span>
          <span className="neg">−{fmtMoney(totals.expense)}</span>
          <strong className={totals.net >= 0 ? 'pos' : 'neg'}>
            {totals.net >= 0 ? '+' : '−'}{fmtMoney(Math.abs(totals.net))}
          </strong>
        </div>
      </section>

      <section className="card">
        <TransactionList items={filtered} emptyText="ไม่พบรายการตามเงื่อนไขที่เลือก" />
      </section>
    </div>
  )
}
