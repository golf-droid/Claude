import { useState } from 'react'
import { supabase } from '../lib/supabase.js'

export default function Login() {
  const [mode, setMode] = useState('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true); setErr(''); setMsg('')
    try {
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      } else {
        const { data, error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        if (!data.session) {
          setMsg('สมัครเรียบร้อย กรุณาเปิดอีเมลเพื่อยืนยันตัวตน แล้วกลับมาเข้าสู่ระบบ')
        }
      }
    } catch (e2) {
      const m = e2.message || String(e2)
      setErr(
        /Invalid login credentials/i.test(m) ? 'อีเมลหรือรหัสผ่านไม่ถูกต้อง'
        : /User already registered/i.test(m) ? 'อีเมลนี้สมัครไว้แล้ว ลองเข้าสู่ระบบแทน'
        : /Password should be/i.test(m) ? 'รหัสผ่านต้องยาวอย่างน้อย 6 ตัวอักษร'
        : m
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="centered-page">
      <form className="card narrow" onSubmit={submit}>
        <div className="logo">
          <span className="logo-mark">฿</span>
          <div>
            <h1>บัญชีบ้านเรา</h1>
            <p className="muted small">รายรับ-รายจ่ายของทั้งบ้าน ซิงก์ทุกเครื่อง</p>
          </div>
        </div>

        <label className="field">
          <span className="field-label">อีเมล</span>
          <input
            type="email" required autoComplete="email"
            value={email} onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
        </label>

        <label className="field">
          <span className="field-label">รหัสผ่าน</span>
          <input
            type="password" required minLength={6}
            autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            value={password} onChange={(e) => setPassword(e.target.value)}
            placeholder="อย่างน้อย 6 ตัวอักษร"
          />
        </label>

        {err && <p className="error">{err}</p>}
        {msg && <p className="success">{msg}</p>}

        <button className="btn primary block" disabled={busy}>
          {busy ? 'กำลังดำเนินการ…' : mode === 'signin' ? 'เข้าสู่ระบบ' : 'สมัครใช้งาน'}
        </button>

        <button
          type="button" className="btn link block"
          onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setErr(''); setMsg('') }}
        >
          {mode === 'signin' ? 'ยังไม่มีบัญชี? สมัครใหม่' : 'มีบัญชีอยู่แล้ว? เข้าสู่ระบบ'}
        </button>
      </form>
    </div>
  )
}
