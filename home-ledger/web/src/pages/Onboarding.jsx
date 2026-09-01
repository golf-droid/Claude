import { useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { useData } from '../lib/store.jsx'

export default function Onboarding() {
  const { createHousehold, joinHousehold } = useData()
  const [tab, setTab] = useState('create')
  const [name, setName] = useState('บ้านของเรา')
  const [displayName, setDisplayName] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    if (!displayName.trim()) return setErr('ใส่ชื่อเล่นของคุณก่อน')
    setBusy(true); setErr('')
    try {
      if (tab === 'create') await createHousehold(name, displayName)
      else await joinHousehold(code, displayName)
    } catch (e2) {
      setErr(e2.message || String(e2))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="centered-page">
      <form className="card narrow" onSubmit={submit}>
        <h1>เริ่มต้นใช้งาน</h1>
        <p className="muted small">
          สร้างบ้านใหม่ถ้าคุณเป็นคนแรก หรือใส่รหัสเชิญถ้ามีคนในบ้านสร้างไว้แล้ว
        </p>

        <div className="seg">
          <button type="button" className={`seg-item ${tab === 'create' ? 'active' : ''}`} onClick={() => setTab('create')}>
            สร้างบ้านใหม่
          </button>
          <button type="button" className={`seg-item ${tab === 'join' ? 'active' : ''}`} onClick={() => setTab('join')}>
            เข้าร่วมด้วยรหัส
          </button>
        </div>

        <label className="field">
          <span className="field-label">ชื่อเล่นของคุณ</span>
          <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="เช่น พ่อ, แม่, พี่หนึ่ง" />
        </label>

        {tab === 'create' ? (
          <label className="field">
            <span className="field-label">ชื่อบ้าน</span>
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </label>
        ) : (
          <label className="field">
            <span className="field-label">รหัสเชิญ 6 หลัก</span>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="ABC123" maxLength={6} className="code-input"
            />
          </label>
        )}

        {err && <p className="error">{err}</p>}

        <button className="btn primary block" disabled={busy}>
          {busy ? 'กำลังดำเนินการ…' : tab === 'create' ? 'สร้างบ้าน' : 'เข้าร่วมบ้าน'}
        </button>
        <button type="button" className="btn link block" onClick={() => supabase.auth.signOut()}>
          ออกจากระบบ
        </button>
      </form>
    </div>
  )
}
