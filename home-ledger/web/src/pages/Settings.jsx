import { useMemo, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { useData } from '../lib/store.jsx'
import { currentMonthKey, fmtMoney, monthLabel, parseAmount } from '../lib/format.js'
import Modal from '../components/Modal.jsx'
import { accountColor, banksFor, bankOf } from '../lib/banks.js'

const ACCOUNT_KINDS = [
  { key: 'cash', label: 'เงินสด' },
  { key: 'bank', label: 'บัญชีธนาคาร' },
  { key: 'ewallet', label: 'วอลเล็ท/พร้อมเพย์' },
  { key: 'credit', label: 'บัตรเครดิต' }
]
const PALETTE = ['#ef4444', '#f97316', '#eab308', '#16a34a', '#0891b2',
  '#2563eb', '#8b5cf6', '#ec4899', '#64748b']

const KIND_ICON = { cash: '💵', bank: '🏦', ewallet: '📱', credit: '💳' }

function AccountDialog({ account, onClose }) {
  const { saveAccount } = useData()
  const [name, setName] = useState(account?.name ?? '')
  const [kind, setKind] = useState(account?.kind ?? 'cash')
  const [icon, setIcon] = useState(account?.icon ?? '👛')
  const [bank, setBank] = useState(account?.bank ?? '')
  const [opening, setOpening] = useState(String(account?.opening_balance ?? '0'))
  const [active, setActive] = useState(account?.is_active !== false)

  const bankChoices = banksFor(kind)

  const pickKind = (next) => {
    setKind(next)
    if (banksFor(next).every((b) => b.code !== bank)) setBank('')
    if (!account && (!icon || Object.values(KIND_ICON).includes(icon))) setIcon(KIND_ICON[next])
  }

  /** เลือกธนาคารแล้วเติมชื่อให้เลย ถ้าผู้ใช้ยังไม่ได้ตั้งชื่อเองไว้ */
  const pickBank = (code) => {
    const before = bankOf(bank)
    const after = bankOf(code)
    setBank(code)
    if (after && (!name.trim() || (before && name.trim() === before.name))) setName(after.name)
  }

  const save = () => {
    if (!name.trim()) return
    saveAccount({
      id: account?.id,
      name: name.trim(),
      kind,
      icon: icon || '👛',
      bank: bank || null,
      opening_balance: parseAmount(opening) || 0,
      is_active: active
    })
    onClose()
  }

  return (
    <Modal
      title={account ? 'แก้ไขกระเป๋าเงิน' : 'เพิ่มกระเป๋าเงิน'}
      onClose={onClose}
      footer={<button className="btn primary block" onClick={save}>บันทึก</button>}
    >
      <div className="grid-2">
        <label className="field">
          <span className="field-label">ไอคอน</span>
          <input value={icon} onChange={(e) => setIcon(e.target.value)} maxLength={2} className="emoji-input" />
        </label>
        <label className="field">
          <span className="field-label">ชื่อ</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="เช่น กสิกร ออมทรัพย์" />
        </label>
      </div>
      <label className="field">
        <span className="field-label">ประเภท</span>
        <select value={kind} onChange={(e) => pickKind(e.target.value)}>
          {ACCOUNT_KINDS.map((k) => <option key={k.key} value={k.key}>{k.label}</option>)}
        </select>
      </label>

      {bankChoices.length > 0 && (
        <label className="field">
          <span className="field-label">
            {kind === 'ewallet' ? 'วอลเล็ท / พร้อมเพย์' : 'ธนาคาร'}
          </span>
          <select
            value={bank}
            onChange={(e) => pickBank(e.target.value)}
            style={{ borderLeft: `4px solid ${bankOf(bank)?.color ?? 'transparent'}` }}
          >
            <option value="">— ไม่ระบุ —</option>
            {bankChoices.map((b) => (
              <option key={b.code} value={b.code}>{b.name}</option>
            ))}
          </select>
          <span className="hint">เลือกแล้วชื่อกระเป๋าจะเติมให้เอง แก้เป็นชื่ออื่นได้ เช่น “กสิกร ออมทรัพย์”</span>
        </label>
      )}
      <label className="field">
        <span className="field-label">ยอดยกมา (ยอดตั้งต้นก่อนเริ่มบันทึก)</span>
        <input inputMode="decimal" value={opening} onChange={(e) => setOpening(e.target.value)} />
      </label>
      {account && (
        <label className="check">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
          <span>ใช้งานอยู่ (ปิดไว้เพื่อซ่อนจากรายการเลือก)</span>
        </label>
      )}
    </Modal>
  )
}

function CategoryDialog({ category, kind, onClose }) {
  const { saveCategory } = useData()
  const [name, setName] = useState(category?.name ?? '')
  const [icon, setIcon] = useState(category?.icon ?? '📌')
  const [color, setColor] = useState(category?.color ?? '#64748b')
  const [active, setActive] = useState(category?.is_active !== false)

  const save = () => {
    if (!name.trim()) return
    saveCategory({
      id: category?.id,
      kind: category?.kind ?? kind,
      name: name.trim(),
      icon: icon || '📌',
      color,
      is_active: active
    })
    onClose()
  }

  return (
    <Modal
      title={category ? 'แก้ไขหมวดหมู่' : `เพิ่มหมวด${kind === 'income' ? 'รายรับ' : 'รายจ่าย'}`}
      onClose={onClose}
      footer={<button className="btn primary block" onClick={save}>บันทึก</button>}
    >
      <div className="grid-2">
        <label className="field">
          <span className="field-label">ไอคอน</span>
          <input value={icon} onChange={(e) => setIcon(e.target.value)} maxLength={2} className="emoji-input" />
        </label>
        <label className="field">
          <span className="field-label">ชื่อหมวด</span>
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </label>
      </div>
      <div className="field">
        <span className="field-label">สี</span>
        <div className="swatches">
          {PALETTE.map((c) => (
            <button
              key={c}
              className={`swatch ${color === c ? 'on' : ''}`}
              style={{ background: c }}
              onClick={() => setColor(c)}
              aria-label={c}
            />
          ))}
        </div>
      </div>
      {category && (
        <label className="check">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
          <span>ใช้งานอยู่</span>
        </label>
      )}
    </Modal>
  )
}

function BudgetDialog({ onClose }) {
  const { categories, budgets, setBudget } = useData()
  const month = currentMonthKey()
  const expenseCats = categories.filter((c) => c.kind === 'expense' && c.is_active !== false)
  const current = Object.fromEntries(
    budgets.filter((b) => b.month === `${month}-01`).map((b) => [b.category_id, String(b.amount)])
  )
  const [draft, setDraft] = useState(current)

  const save = () => {
    for (const c of expenseCats) {
      const v = parseAmount(draft[c.id] ?? '') || 0
      const before = parseAmount(current[c.id] ?? '') || 0
      if (v !== before) setBudget(c.id, month, v)
    }
    onClose()
  }

  return (
    <Modal
      title={`งบประมาณ ${monthLabel(month)}`}
      onClose={onClose}
      footer={<button className="btn primary block" onClick={save}>บันทึกงบ</button>}
    >
      <p className="muted small">ใส่ 0 หรือเว้นว่างถ้าไม่ต้องการตั้งงบหมวดนั้น</p>
      {expenseCats.map((c) => (
        <label className="budget-row" key={c.id}>
          <span>{c.icon} {c.name}</span>
          <input
            inputMode="decimal"
            placeholder="0"
            value={draft[c.id] ?? ''}
            onChange={(e) => setDraft({ ...draft, [c.id]: e.target.value })}
          />
        </label>
      ))}
    </Modal>
  )
}

export default function Settings() {
  const {
    household, members, accounts, categories, transactions, balances,
    userId, createInvite, updateMyProfile, refresh, pending
  } = useData()

  const me = members.find((m) => m.user_id === userId)
  const [nickname, setNickname] = useState(me?.display_name ?? '')
  const [invite, setInvite] = useState('')
  const [inviteErr, setInviteErr] = useState('')
  const [accountDialog, setAccountDialog] = useState(null)
  const [categoryDialog, setCategoryDialog] = useState(null)
  const [budgetDialog, setBudgetDialog] = useState(false)

  const incomeCats = useMemo(() => categories.filter((c) => c.kind === 'income'), [categories])
  const expenseCats = useMemo(() => categories.filter((c) => c.kind === 'expense'), [categories])

  const makeInvite = async () => {
    setInviteErr('')
    try {
      setInvite(await createInvite())
    } catch (e) {
      setInviteErr(e.message || String(e))
    }
  }

  const exportCsv = () => {
    const accById = Object.fromEntries(accounts.map((a) => [a.id, a.name]))
    const catById = Object.fromEntries(categories.map((c) => [c.id, c.name]))
    const memById = Object.fromEntries(members.map((m) => [m.user_id, m.display_name]))
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
    const header = ['วันที่', 'ประเภท', 'จำนวนเงิน', 'หมวดหมู่', 'กระเป๋า', 'ปลายทาง', 'ของใคร', 'บันทึก']
    const rows = [...transactions]
      .sort((a, b) => a.txn_date.localeCompare(b.txn_date))
      .map((t) => [
        t.txn_date,
        t.type === 'income' ? 'รายรับ' : t.type === 'expense' ? 'รายจ่าย' : 'โอนเงิน',
        Number(t.amount).toFixed(2),
        t.category_id ? catById[t.category_id] ?? '' : '',
        accById[t.account_id] ?? '',
        t.to_account_id ? accById[t.to_account_id] ?? '' : '',
        t.paid_by ? memById[t.paid_by] ?? '' : 'ส่วนกลาง',
        t.note ?? ''
      ])
    const csv = '﻿' + [header, ...rows].map((r) => r.map(esc).join(',')).join('\r\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `บัญชีบ้าน-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="page">
      <section className="card">
        <h2 className="card-title">โปรไฟล์ของฉัน</h2>
        <label className="field">
          <span className="field-label">ชื่อที่แสดงในบ้าน</span>
          <div className="row gap">
            <input className="grow" value={nickname} onChange={(e) => setNickname(e.target.value)} />
            <button
              className="btn"
              disabled={!nickname.trim() || nickname === me?.display_name}
              onClick={() => updateMyProfile(nickname.trim())}
            >
              บันทึก
            </button>
          </div>
        </label>
        <p className="muted small">บ้าน: {household?.name} · บทบาท: {me?.role === 'owner' ? 'เจ้าบ้าน' : 'สมาชิก'}</p>
      </section>

      <section className="card">
        <div className="card-head">
          <h2 className="card-title">สมาชิกในบ้าน ({members.length})</h2>
          <button className="btn" onClick={makeInvite}>สร้างรหัสเชิญ</button>
        </div>
        <ul className="member-list">
          {members.map((m) => (
            <li key={m.user_id}>
              <span className="avatar" style={{ background: m.color }}>{m.display_name.slice(0, 1)}</span>
              <span className="grow">{m.display_name}{m.user_id === userId && ' (คุณ)'}</span>
              <span className="muted small">{m.role === 'owner' ? 'เจ้าบ้าน' : 'สมาชิก'}</span>
            </li>
          ))}
        </ul>
        {invite && (
          <div className="invite-box">
            <span className="muted small">ให้คนในบ้านสมัครบัญชีแล้วกรอกรหัสนี้ (ใช้ได้ครั้งเดียว หมดอายุใน 7 วัน)</span>
            <strong className="invite-code">{invite}</strong>
            <button className="btn" onClick={() => navigator.clipboard?.writeText(invite)}>คัดลอก</button>
          </div>
        )}
        {inviteErr && <p className="error">{inviteErr}</p>}
      </section>

      <section className="card">
        <div className="card-head">
          <h2 className="card-title">กระเป๋าเงิน</h2>
          <button className="btn" onClick={() => setAccountDialog({})}>+ เพิ่ม</button>
        </div>
        <ul className="setting-list">
          {balances.map((a) => (
            <li key={a.id}>
              <button className="setting-row" onClick={() => setAccountDialog(a)}>
                <span
                  className="acc-icon"
                  style={accountColor(a) ? { background: accountColor(a) + '22', boxShadow: `inset 0 0 0 1.5px ${accountColor(a)}55` } : undefined}
                >{a.icon}</span>
                <span className="grow">
                  {a.name}
                  {bankOf(a.bank) && !a.name.includes(bankOf(a.bank).name) && (
                    <span className="tag">{bankOf(a.bank).name}</span>
                  )}
                  {a.is_active === false && <span className="tag">ปิดใช้งาน</span>}
                </span>
                <span className="muted">{fmtMoney(a.balance)}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="card">
        <div className="card-head">
          <h2 className="card-title">หมวดรายจ่าย</h2>
          <button className="btn" onClick={() => setCategoryDialog({ kind: 'expense' })}>+ เพิ่ม</button>
        </div>
        <div className="chips">
          {expenseCats.map((c) => (
            <button
              key={c.id}
              className={`chip ${c.is_active === false ? 'off' : ''}`}
              style={{ borderColor: c.color }}
              onClick={() => setCategoryDialog({ category: c })}
            >
              {c.icon} {c.name}
            </button>
          ))}
        </div>

        <div className="card-head mt">
          <h2 className="card-title">หมวดรายรับ</h2>
          <button className="btn" onClick={() => setCategoryDialog({ kind: 'income' })}>+ เพิ่ม</button>
        </div>
        <div className="chips">
          {incomeCats.map((c) => (
            <button
              key={c.id}
              className={`chip ${c.is_active === false ? 'off' : ''}`}
              style={{ borderColor: c.color }}
              onClick={() => setCategoryDialog({ category: c })}
            >
              {c.icon} {c.name}
            </button>
          ))}
        </div>
      </section>

      <section className="card">
        <h2 className="card-title">เครื่องมือ</h2>
        <div className="stack">
          <button className="btn block" onClick={() => setBudgetDialog(true)}>ตั้งงบประมาณเดือนนี้</button>
          <button className="btn block" onClick={exportCsv}>ส่งออกข้อมูลเป็น CSV</button>
          <button className="btn block" onClick={refresh}>
            ซิงก์ข้อมูลเดี๋ยวนี้{pending ? ` (ค้างอยู่ ${pending})` : ''}
          </button>
          <button className="btn danger-ghost block" onClick={() => supabase.auth.signOut()}>
            ออกจากระบบ
          </button>
        </div>
      </section>

      {accountDialog && (
        <AccountDialog account={accountDialog.id ? accountDialog : null} onClose={() => setAccountDialog(null)} />
      )}
      {categoryDialog && (
        <CategoryDialog
          category={categoryDialog.category}
          kind={categoryDialog.kind}
          onClose={() => setCategoryDialog(null)}
        />
      )}
      {budgetDialog && <BudgetDialog onClose={() => setBudgetDialog(false)} />}
    </div>
  )
}
