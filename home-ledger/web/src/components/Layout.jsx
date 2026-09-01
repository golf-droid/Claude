import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { useData } from '../lib/store.jsx'
import TransactionSheet from './TransactionSheet.jsx'

const TABS = [
  { to: '/', icon: '🏠', label: 'ภาพรวม' },
  { to: '/transactions', icon: '🧾', label: 'รายการ' },
  { to: '/reports', icon: '📊', label: 'รายงาน' },
  { to: '/settings', icon: '⚙️', label: 'ตั้งค่า' }
]

export default function Layout() {
  const { online, pending, syncing, household } = useData()
  const [adding, setAdding] = useState(false)

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar-inner">
          <span className="brand">
            <span className="brand-dot" />
            {household?.name ?? 'บัญชีบ้านเรา'}
          </span>
          <span className={`sync-pill ${online ? (pending ? 'warn' : 'ok') : 'off'}`}>
            {!online
              ? `ออฟไลน์${pending ? ` · ค้าง ${pending}` : ''}`
              : syncing
                ? 'กำลังซิงก์…'
                : pending
                  ? `รอส่ง ${pending}`
                  : 'ซิงก์แล้ว'}
          </span>
        </div>
      </header>

      <main className="content">
        <Outlet />
      </main>

      <button className="fab" onClick={() => setAdding(true)} aria-label="เพิ่มรายการ">
        +
      </button>

      <nav className="tabbar">
        {TABS.map((t) => (
          <NavLink key={t.to} to={t.to} end={t.to === '/'} className="tab">
            <span className="tab-icon">{t.icon}</span>
            <span className="tab-label">{t.label}</span>
          </NavLink>
        ))}
      </nav>

      {adding && <TransactionSheet onClose={() => setAdding(false)} />}
    </div>
  )
}
