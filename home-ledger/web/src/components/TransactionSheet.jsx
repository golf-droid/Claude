import { useEffect, useMemo, useRef, useState } from 'react'
import Modal from './Modal.jsx'
import { useData } from '../lib/store.jsx'
import { CCY, fmtMoney, parseAmount, todayKey } from '../lib/format.js'
import { accountColor, accountLabel } from '../lib/banks.js'
import { CONFIG } from '../lib/config.js'
import { deleteReceipt, receiptUrl, uploadReceipt } from '../lib/receipts.js'

const NEW_CATEGORY_COLORS = ['#f97316', '#ef4444', '#eab308', '#16a34a',
  '#0891b2', '#3b82f6', '#8b5cf6', '#ec4899', '#64748b']

const TYPES = [
  { key: 'expense', label: 'รายจ่าย' },
  { key: 'income', label: 'รายรับ' },
  { key: 'transfer', label: 'โอนเงิน' }
]

export default function TransactionSheet({ onClose, editing }) {
  const {
    accounts, categories, members, userId, household, split,
    addTransaction, updateTransaction, deleteTransaction, saveCategory, saveShares
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

  // หารเท่า
  const existingShares = editing ? (split?.byTransaction?.[editing.id] ?? []) : []
  const [splitOn, setSplitOn] = useState(existingShares.length > 0)
  const [splitWith, setSplitWith] = useState(existingShares.map((x) => x.debtor))

  // รูปใบเสร็จ
  const fileRef = useRef(null)
  const [receiptPath, setReceiptPath] = useState(editing?.receipt_path ?? null)
  const [receiptSrc, setReceiptSrc] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [viewing, setViewing] = useState(false)

  useEffect(() => {
    let alive = true
    if (!receiptPath) { setReceiptSrc(null); return }
    receiptUrl(receiptPath).then((url) => { if (alive) setReceiptSrc(url) })
    return () => { alive = false }
  }, [receiptPath])

  const pickPhoto = async (ev) => {
    const file = ev.target.files?.[0]
    ev.target.value = ''            // เลือกไฟล์เดิมซ้ำได้
    if (!file) return
    setUploading(true)
    setErr('')
    try {
      const previous = receiptPath
      const path = await uploadReceipt(file, household?.id, userId)
      setReceiptPath(path)
      if (previous) deleteReceipt(previous)    // เปลี่ยนรูป: เก็บกวาดใบเก่า
    } catch (e) {
      setErr(e.message || String(e))
    } finally {
      setUploading(false)
    }
  }

  const dropPhoto = () => {
    if (!confirm('ลบรูปใบเสร็จนี้?')) return
    const path = receiptPath
    setReceiptPath(null)
    setReceiptSrc(null)
    if (path) deleteReceipt(path)
  }

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
    if (next !== 'expense') { setSplitOn(false); setSplitWith([]) }
    setErr('')
  }

  const toggleSplit = (on) => {
    setSplitOn(on)
    setErr('')
    // ต้องรู้ว่าใครออกเงินไปก่อน ถ้ายังเป็น "ส่วนกลาง" ให้ถือว่าเป็นของคนที่กำลังบันทึก
    if (on && !paidBy) setPaidBy(userId)
    if (!on) setSplitWith([])
  }

  const toggleDebtor = (id) =>
    setSplitWith((list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]))

  // ยอดที่แต่ละคนต้องจ่าย — เศษสตางค์ตกที่คนออกเงิน เพราะเป็นคนเลือกหารเอง
  const splitMath = (() => {
    const total = parseAmount(amount)
    const debtors = splitWith.filter((id) => id !== paidBy)
    if (!isFinite(total) || total <= 0 || debtors.length === 0) return null
    const each = Math.round((total / (debtors.length + 1)) * 100) / 100
    return { people: debtors.length + 1, each, mine: Math.round((total - each * debtors.length) * 100) / 100 }
  })()

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
      receipt_path: receiptPath,
      paid_by: paidBy
    }
    const saved = editing
      ? (updateTransaction(editing.id, payload), { id: editing.id })
      : addTransaction(payload)

    if (CONFIG.split && saved?.id) {
      const debtors = type === 'expense' && splitOn ? splitWith.filter((id) => id !== payload.paid_by) : []
      if (debtors.length || existingShares.length) {
        saveShares({ id: saved.id, amount: value, paid_by: payload.paid_by }, debtors)
      }
    }
    onClose()
  }

  const remove = () => {
    if (!editing) return
    if (!confirm('ลบรายการนี้?')) return
    if (editing.receipt_path) deleteReceipt(editing.receipt_path)
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
        <span className="field-label">จำนวนเงิน ({CCY})</span>
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

      {CONFIG.split && type === 'expense' && (
        <div className="field">
          <label className="split-toggle">
            <input type="checkbox" checked={splitOn} onChange={(e) => toggleSplit(e.target.checked)} />
            <span>
              <b>หารเท่า</b>
              <small>แบ่งรายการนี้ให้เพื่อนช่วยจ่าย แล้วตามเก็บทีหลัง</small>
            </span>
          </label>

          {splitOn && (
            <div className="split-panel">
              <span className="field-label">หารกับใครบ้าง</span>
              <div className="chips">
                {members.filter((m) => m.user_id !== paidBy).map((m) => (
                  <button
                    key={m.user_id}
                    type="button"
                    className={`chip ${splitWith.includes(m.user_id) ? 'selected' : ''}`}
                    style={splitWith.includes(m.user_id)
                      ? { borderColor: m.color, background: m.color + '22' } : undefined}
                    onClick={() => toggleDebtor(m.user_id)}
                  >
                    {m.display_name}
                  </button>
                ))}
                {members.filter((m) => m.user_id !== paidBy).length === 0 && (
                  <span className="muted">ยังไม่มีสมาชิกคนอื่นในกลุ่ม</span>
                )}
              </div>

              {splitMath ? (
                <p className="split-preview">
                  หาร <b>{splitMath.people} คน</b> · คนละ <b>{CCY}{fmtMoney(splitMath.each)}</b>
                  {' · '}ส่วนของคุณ {CCY}{fmtMoney(splitMath.mine)}
                </p>
              ) : (
                <p className="split-preview muted">ใส่จำนวนเงินและเลือกคนที่จะหารด้วย</p>
              )}
            </div>
          )}
        </div>
      )}

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

      {CONFIG.receipts && (
        <div className="field">
          <span className="field-label">ใบเสร็จ</span>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            hidden
            onChange={pickPhoto}
          />
          {receiptPath ? (
            <div className="receipt-box">
              {receiptSrc
                ? <img className="receipt-thumb" src={receiptSrc} alt="รูปใบเสร็จ" onClick={() => setViewing(true)} />
                : <div className="receipt-thumb placeholder">กำลังโหลด…</div>}
              <div className="stack grow">
                <button type="button" className="btn" onClick={() => setViewing(true)} disabled={!receiptSrc}>
                  ดูเต็มจอ
                </button>
                {!readOnly && (
                  <>
                    <button type="button" className="btn" onClick={() => fileRef.current?.click()} disabled={uploading}>
                      {uploading ? 'กำลังอัปโหลด…' : 'เปลี่ยนรูป'}
                    </button>
                    <button type="button" className="btn danger-ghost" onClick={dropPhoto} disabled={uploading}>
                      ลบรูป
                    </button>
                  </>
                )}
              </div>
            </div>
          ) : (
            <button
              type="button"
              className="btn receipt-add"
              onClick={() => fileRef.current?.click()}
              disabled={uploading || readOnly}
            >
              {uploading ? 'กำลังอัปโหลด…' : '📷 ถ่ายรูป หรือเลือกจากคลัง'}
            </button>
          )}
        </div>
      )}

      {err && <p className="error">{err}</p>}
      </fieldset>

      {viewing && receiptSrc && (
        <div className="lightbox" onClick={() => setViewing(false)} role="dialog" aria-label="รูปใบเสร็จ">
          <img src={receiptSrc} alt="รูปใบเสร็จ" />
          <span className="lightbox-hint">แตะที่ใดก็ได้เพื่อปิด</span>
        </div>
      )}
    </Modal>
  )
}
