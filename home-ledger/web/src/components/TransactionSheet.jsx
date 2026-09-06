import { useMemo, useState } from 'react'
import Modal from './Modal.jsx'
import { useData } from '../lib/store.jsx'
import { parseAmount, todayKey } from '../lib/format.js'
import { accountColor, accountLabel } from '../lib/banks.js'

const NEW_CATEGORY_COLORS = ['#f97316', '#ef4444', '#eab308', '#16a34a',
  '#0891b2', '#3b82f6', '#8b5cf6', '#ec4899', '#64748b']

const TYPES = [
  { key: 'expense', label: 'รายจ่าย' },
  { key: 'income', label: 'รายรับ' },
  { key: 'transfer', label: 'โอนเงิน' }
]

export default function TransactionSheet({ onClose, editing }) {
  const {
    accounts, categories, members, userId,
    addTransaction, updateTransaction, deleteTransaction, saveCategory
  } = useData()

  const activeAccounts = accounts.filter((a) => a.is_active !== false)

  // แต่ละคนแก้ได้เฉพาะรายการของตัวเองกับส่วนกลาง เจ้าบ้านแก้ได้ทุกอัน
  // (กติกาจริงบังคับที่ฐานข้อมูล ตรงนี้แค่ทำให้หน้าจอไม่ชวนกดสิ่งที่จะโดนปฏิเสธ)
  const isOwner = members.find((m) => m.user_id === userId)?.role === 'owner'
  const owner = editing?.paid_by ? members.find((m) => m.user_id === editing.paid_by) : null
  const readOnly = Boolean(editing) && !isOwner &&
    editing.paid_by != null && editing.paid_by !== userId
  const assignable = isOwner ? members : members.filter((m) => m.user_id === userId)
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

  // ฟอร์มเพิ่มหมวดหมู่แบบไม่ต้องออกจากหน้านี้
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [newIcon, setNewIcon] = useState('🏷️')
  const [newColor, setNewColor] = useState(NEW_CATEGORY_COLORS[0])

  const addCategory = () => {
    const name = newName.trim()
    if (!name) return
    const id = saveCategory({ kind: type, name, icon: newIcon || '🏷️', color: newColor })
    if (id) setCategoryId(id)
    setAdding(false)
    setNewName('')
    setNewIcon('🏷️')
    setErr('')
  }

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
      title={readOnly ? 'รายการของคนอื่น' : editing ? 'แก้ไขรายการ' : 'บันทึกรายการ'}
      onClose={onClose}
      footer={
        readOnly ? (
          <button className="btn block" onClick={onClose}>ปิด</button>
        ) : (
          <div className="row gap">
            {editing && (
              <button className="btn danger-ghost" onClick={remove}>ลบ</button>
            )}
            <button className="btn primary grow" onClick={submit}>
              {editing ? 'บันทึกการแก้ไข' : 'บันทึก'}
            </button>
          </div>
        )
      }
    >
      {readOnly && (
        <p className="locked-note">
          รายการนี้เป็นของ <b>{owner?.display_name ?? 'สมาชิกคนอื่น'}</b> ดูได้อย่างเดียว
          แก้ไขหรือลบได้เฉพาะเจ้าของรายการ
        </p>
      )}

      <fieldset className="bare" disabled={readOnly}>
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
            <button className="chip add" onClick={() => setAdding((v) => !v)}>
              {adding ? '✕ ยกเลิก' : '+ เพิ่มหมวด'}
            </button>
          </div>

          {adding && (
            <div className="inline-form">
              <div className="row gap">
                <input
                  className="emoji-input narrow"
                  value={newIcon}
                  maxLength={2}
                  onChange={(e) => setNewIcon(e.target.value)}
                  aria-label="ไอคอน"
                />
                <input
                  className="grow"
                  autoFocus
                  placeholder={type === 'income' ? 'ชื่อหมวดรายรับใหม่' : 'ชื่อหมวดรายจ่ายใหม่'}
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addCategory())}
                />
              </div>
              <div className="swatches">
                {NEW_CATEGORY_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={`swatch ${newColor === c ? 'on' : ''}`}
                    style={{ background: c }}
                    onClick={() => setNewColor(c)}
                    aria-label={`สี ${c}`}
                  />
                ))}
              </div>
              <button className="btn primary block" onClick={addCategory} disabled={!newName.trim()}>
                เพิ่มหมวด “{newName.trim() || '…'}” แล้วเลือกเลย
              </button>
            </div>
          )}
        </div>
      )}

      <div className="grid-2">
        <label className="field">
          <span className="field-label">{type === 'transfer' ? 'จากกระเป๋า' : 'กระเป๋าเงิน'}</span>
          <select
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            style={{ borderLeft: `4px solid ${accountColor(accounts.find((a) => a.id === accountId)) ?? 'transparent'}` }}
          >
            {activeAccounts.map((a) => (
              <option key={a.id} value={a.id}>{accountLabel(a)}</option>
            ))}
          </select>
        </label>

        {type === 'transfer' ? (
          <label className="field">
            <span className="field-label">ไปกระเป๋า</span>
            <select
              value={toAccountId}
              onChange={(e) => setToAccountId(e.target.value)}
              style={{ borderLeft: `4px solid ${accountColor(accounts.find((a) => a.id === toAccountId)) ?? 'transparent'}` }}
            >
              {activeAccounts.map((a) => (
                <option key={a.id} value={a.id}>{accountLabel(a)}</option>
              ))}
            </select>
          </label>
        ) : (
          <label className="field">
            <span className="field-label">ของใคร</span>
            <select value={paidBy ?? ''} onChange={(e) => setPaidBy(e.target.value || null)}>
              <option value="">ส่วนกลาง (ของบ้าน)</option>
              {assignable.map((m) => (
                <option key={m.user_id} value={m.user_id}>
                  {m.display_name}{m.user_id === userId ? ' (คุณ)' : ''}
                </option>
              ))}
              {readOnly && owner && (
                <option value={owner.user_id}>{owner.display_name}</option>
              )}
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
      </fieldset>
    </Modal>
  )
}
