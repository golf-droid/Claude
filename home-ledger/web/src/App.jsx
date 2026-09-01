import { useEffect, useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { isConfigured, supabase } from './lib/supabase.js'
import { DataProvider, useData } from './lib/store.jsx'
import Layout from './components/Layout.jsx'
import Login from './pages/Login.jsx'
import Onboarding from './pages/Onboarding.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Transactions from './pages/Transactions.jsx'
import Reports from './pages/Reports.jsx'
import Settings from './pages/Settings.jsx'

function NotConfigured() {
  return (
    <div className="centered-page">
      <div className="card narrow">
        <h1>ยังตั้งค่าคลาวด์ไม่เสร็จ</h1>
        <p className="muted">
          แอปยังไม่รู้ว่าต้องคุยกับ Supabase โปรเจกต์ไหน ให้สร้างไฟล์ <code>web/.env</code> แล้วใส่ค่า
          สองบรรทัดนี้จากหน้า Project Settings → API ของ Supabase
        </p>
        <pre className="code">
{`VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...`}
        </pre>
        <p className="muted">แล้วรัน <code>npm run dev</code> ใหม่อีกครั้ง (รายละเอียดเต็มอยู่ใน docs/SETUP.md)</p>
      </div>
    </div>
  )
}

function Gate() {
  const { status, error } = useData()

  if (status === 'loading') {
    return (
      <div className="centered-page">
        <div className="spinner" />
      </div>
    )
  }
  if (status === 'no-household') return <Onboarding />
  if (status === 'error') {
    return (
      <div className="centered-page">
        <div className="card narrow">
          <h1>เชื่อมต่อฐานข้อมูลไม่ได้</h1>
          <p className="muted">{error}</p>
          <p className="muted">
            ถ้าเพิ่งตั้งโปรเจกต์ใหม่ ให้ตรวจว่ารันไฟล์ <code>supabase/schema.sql</code> ครบแล้ว
          </p>
          <button className="btn primary" onClick={() => location.reload()}>ลองใหม่</button>
        </div>
      </div>
    )
  }

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/transactions" element={<Transactions />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

export default function App() {
  const [session, setSession] = useState(undefined) // undefined = ยังไม่รู้

  useEffect(() => {
    if (!isConfigured) return
    supabase.auth.getSession().then(({ data }) => setSession(data.session ?? null))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s ?? null))
    return () => sub.subscription.unsubscribe()
  }, [])

  if (!isConfigured) return <NotConfigured />
  if (session === undefined) {
    return (
      <div className="centered-page">
        <div className="spinner" />
      </div>
    )
  }
  if (!session) return <Login />

  return (
    <DataProvider session={session}>
      <Gate />
    </DataProvider>
  )
}
