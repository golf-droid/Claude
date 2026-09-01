import { useMemo, useState } from 'react'
import Modal from './Modal.jsx'
import { useData } from '../lib/store.jsx'
import { parseAmount, todayKey } from '../lib/format.js'

const TYPES = [
  { key: 'expense', label: 'รายจ่าย' },
  { key: 'income', label: 'รายรับ' },
  { key: 'transfer', label: 'โอนเงิน' }
]

export default function TransactionSheet({ onClose, editing }) {
  const {
    accounts, categories, members, userId,
    addTransaction, updateTransaction, deleteTransaction
  } = useData()

  const activeAccounts = accounts.filter((a) => a.is_active !== false)
  const [type, setType] = useState(editing?.type ?? 'expense')
  const [amount, setAmount] = useState(editing ? String(editing.amount) : '')
  const [date, setDate] = useState(editing?.txn_date ?? todayKey())
  const [categoryId, setCategoryId] = useState(editing?.category_id ?? null)
  const [accountId, setAccountId] = useState(editing?.account_id ?? activeAccounts[0]?.id ?? '')
  const [toAccountId, setToAccountId] = useState(
    editing?.to_account_id ?? activeAccounts[1]?.id ?? ''
  )
  const [note, setNote] = useState(editing?.note ?? '')
  const [paidBy, setPaidBy] = useState(editing?.paid_by ?? userId)
  const [err, setErr] = useState('')

  const visibleCategories = useMemo(
    () => categories.filter((c) => c.kind === type && c.is_active !== false),
    [categories, type]
  )

  const pickType = (next) => {
    setType(next)
    if (next !== 'transfer') setCategoryId(null)
    setErr('')
  }

  const submit = () => {
    const value = parseAmount(amount)
    if (!isFinite(value) || value <= 0) return setErr('ใส่จำนวนเงินให้ถูกต้อง')
    if (!accountId) return setErr('เลือกกระเป๋าเงินก่อน')
    if (type === 'transfer') {
      if (!toAccountId) return setErr('เลือกกระเป๋าปลายทาง')
      if (toAccountId === accountId) return setErr('กระเป๋าต้นทางกับปลายทางต้องต่างกัน')
    } else if (!categoryId) {
      return setErr('เลือกหมวดหมู่ก่อน')
    }

    const payload = {
      type,
      txn_date: date,
      amount: value,
      account_id: accountId,
      to_account_id: type === 'transfer' ? toAccountId : null,
      category_id: type === 'transfer' ? null : categoryId,
      note: note.trim(),
      paid_by: paidBy
    }
    if (editing) updateTransaction(editing.id, payload)
    else addTransaction(payload)
    onClose()
  }

  const remove = () => {
    if (!editing) return
    if (!confirm('ลบรายการนี้?')) return
    deleteTransaction(editing.id)
    onClose()
  }

  return (
    <Modal
      title={editing ? 'แก้ไขรายการ' : 'บันทึกรายการ'}
      onClose={onClose}
      footer={
        <div className="row gap">
          {editing && (
            <button className="btn danger-ghost" onClick={remove}>ลบ</button>
          )}
          <button className="btn primary grow" onClick={submit}>
            {editing ? 'บันทึกการแก้ไข' : 'บันทึก'}
          </button>
        </div>
      }
    >
      <div className="seg">
        {TYPES.map((t) => (
          <button
            key={t.key}
            className={`seg-item ${type === t.key ? 'active ' + t.key : ''}`}
            onClick={() => pickType(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <label className="field amount-field">
        <span className="field-label">จำนวนเงิน (บาท)</span>
        <input
          className="amount-input"
          inputMode="decimal"
          placeholder="0.00"
          value={amount}
          autoFocus
          onChange={(e) => setAmount(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
        />
        <span className="hint">พิมพ์บวกลบได้ เช่น 120+35</span>
      </label>

      {type !== 'transfer' && (
        <div className="field">
          <span className="field-label">หมวดหมู่</span>
          <div className="chips">
            {visibleCategories.map((c) => (
              <button
                key={c.id}
                className={`chip ${categoryId === c.id ? 'selected' : ''}`}
                style={categoryId === c.id ? { borderColor: c.color, background: c.color + '22' } : undefined}
                onClick={() => setCategoryId(c.id)}
              >
                <span>{c.icon}</span> {c.name}
              </button>
            ))}
            {visibleCategories.length === 0 && (
              <span className="muted">ยังไม่มีหมวดหมู่ ไปเพิ่มได้ที่หน้าตั้งค่า</span>
            )}
          </div>
        </div>
      )}

      <div className="grid-2">
        <label className="field">
          <span className="field-label">{type === 'transfer' ? 'จากกระเป๋า' : 'กระเป๋าเงิน'}</span>
          <select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
            {activeAccounts.map((a) => (
              <option key={a.id} value={a.id}>{a.icon} {a.name}</option>
            ))}
          </select>
        </label>

        {type === 'transfer' ? (
          <label className="field">
            <span className="field-label">ไปกระเป๋า</span>
            <select value={toAccountId} onChange={(e) => setToAccountId(e.target.value)}>
              {activeAccounts.map((a) => (
                <option key={a.id} value={a.id}>{a.icon} {a.name}</option>
              ))}
            </select>
          </label>
        ) : (
          <label className="field">
            <span className="field-label">ของใคร</span>
            <select value={paidBy ?? ''} onChange={(e) => setPaidBy(e.target.value || null)}>
              <option value="">ส่วนกลาง</option>
              {members.map((m) => (
                <option key={m.user_id} value={m.user_id}>{m.display_name}</option>
              ))}
            </select>
          </label>
        )}
      </div>

      <div className="grid-2">
        <label className="field">
          <span className="field-label">วันที่</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label className="field">
          <span className="field-label">บันทึกช่วยจำ</span>
          <input
            type="text"
            placeholder="เช่น ข้าวเย็นร้านป้าแดง"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </label>
      </div>

      {err && <p className="error">{err}</p>}
    </Modal>
  )
}
