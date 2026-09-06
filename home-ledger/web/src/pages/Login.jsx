import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import {
  PEOPLE, credentialsFor, peopleCodeLength, personByCode, rememberPerson
} from '../lib/people.js'

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫']

/** เข้าใช้งานด้วยรหัสประจำตัว — เบื้องหลังยังเป็นบัญชี Supabase จริงเหมือนเดิม */
function CodeLogin({ onUseEmail }) {
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const inputRef = useRef(null)
  const person = personByCode(code)

  const signIn = async (p) => {
    setBusy(true)
    setErr('')
    const { email, password } = credentialsFor(p)
    try {
      let { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error && /Invalid login credentials/i.test(error.message)) {
        // ครั้งแรกของคนนี้: สร้างบัญชีให้แล้วเข้าเลย
        const { data, error: signUpError } = await supabase.auth.signUp({ email, password })
        if (signUpError) throw signUpError
        if (!data.session) {
          throw new Error(
            'สร้างบัญชีแล้วแต่ระบบยังรอการยืนยันอีเมล ให้ปิด Confirm email ' +
            'ที่ Supabase → Authentication → Sign In / Providers → Email แล้วลองใหม่'
          )
        }
        error = null
      }
      if (error) throw error
      rememberPerson(p)
    } catch (e) {
      const m = e.message || String(e)
      setErr(
        /Failed to fetch|NetworkError|Load failed/i.test(m)
          ? 'เชื่อมต่อไม่ได้ ตรวจสัญญาณอินเทอร์เน็ตแล้วลองใหม่'
        : /Signups not allowed/i.test(m)
          ? 'ระบบปิดการสมัครอยู่ ให้เปิด Allow new users to sign up ที่ Supabase ชั่วคราวเพื่อให้คนนี้เข้าครั้งแรก'
        : /rate limit|too many/i.test(m)
          ? 'ลองเข้าถี่เกินไป รอสักครู่แล้วลองใหม่'
        : m
      )
      setCode('')
      setBusy(false)
    }
  }

  // ครบตัวและตรงกับคนในบ้าน → เข้าให้เลย ไม่ต้องกดปุ่มยืนยันอีกที
  useEffect(() => {
    if (busy) return
    if (code.length < peopleCodeLength) return
    if (person) signIn(person)
    else if (code.length >= peopleCodeLength) {
      setErr('ไม่พบรหัสนี้ ลองใหม่อีกครั้ง')
      setCode('')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code])

  const press = (k) => {
    if (busy) return
    setErr('')
    if (k === '⌫') setCode((c) => c.slice(0, -1))
    else if (k) setCode((c) => (c.length >= peopleCodeLength ? c : c + k))
  }

  return (
    <div className="card narrow pin-card">
      <div className="logo">
        <span className="logo-mark">฿</span>
        <div>
          <h1>บัญชีบ้านเรา</h1>
          <p className="muted small">ใส่รหัสประจำตัวของคุณ</p>
        </div>
      </div>

      <div className="pin-display" onClick={() => inputRef.current?.focus()}>
        <input
          ref={inputRef}
          className="pin-hidden"
          inputMode="numeric"
          autoComplete="off"
          value={code}
          maxLength={peopleCodeLength}
          onChange={(e) => { setErr(''); setCode(e.target.value.replace(/\D/g, '')) }}
          aria-label="รหัสประจำตัว"
        />
        <div className="pin-dots">
          {Array.from({ length: peopleCodeLength }).map((_, i) => (
            <span key={i} className={`pin-dot ${i < code.length ? 'filled' : ''}`}>
              {i < code.length ? code[i] : ''}
            </span>
          ))}
        </div>
        <p className="pin-who">
          {busy ? 'กำลังเข้าสู่ระบบ…' : person ? `สวัสดี ${person.name}` : ' '}
        </p>
      </div>

      {err && <p className="error">{err}</p>}

      <div className="keypad">
        {KEYS.map((k, i) => (
          <button
            key={i}
            type="button"
            className={`key ${k ? '' : 'blank'}`}
            disabled={!k || busy}
            onClick={() => press(k)}
          >
            {k}
          </button>
        ))}
      </div>

      <p className="muted small pin-hint">
        รหัสของแต่ละคน: {PEOPLE.map((p) => `${p.name} ${p.code}`).join(' · ')}
      </p>
      <button type="button" className="btn link block" onClick={onUseEmail}>
        เข้าด้วยอีเมลแทน
      </button>
    </div>
  )
}

/** ทางเข้าเดิมด้วยอีเมล เก็บไว้สำหรับบัญชีเจ้าบ้านที่สมัครไว้ก่อนหน้า */
function EmailLogin({ onUseCode }) {
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
        if (!data.session) setMsg('สมัครเรียบร้อย เปิดอีเมลเพื่อยืนยันตัวตนแล้วกลับมาเข้าสู่ระบบ')
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
    <form className="card narrow" onSubmit={submit}>
      <div className="logo">
        <span className="logo-mark">฿</span>
        <div>
          <h1>เข้าด้วยอีเมล</h1>
          <p className="muted small">สำหรับบัญชีที่สมัครไว้ก่อนหน้า</p>
        </div>
      </div>

      <label className="field">
        <span className="field-label">อีเมล</span>
        <input type="email" required autoComplete="email" value={email}
          onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
      </label>

      <label className="field">
        <span className="field-label">รหัสผ่าน</span>
        <input type="password" required minLength={6}
          autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
          value={password} onChange={(e) => setPassword(e.target.value)} />
      </label>

      {err && <p className="error">{err}</p>}
      {msg && <p className="success">{msg}</p>}

      <button className="btn primary block" disabled={busy}>
        {busy ? 'กำลังดำเนินการ…' : mode === 'signin' ? 'เข้าสู่ระบบ' : 'สมัครใช้งาน'}
      </button>
      <button type="button" className="btn link block"
        onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setErr(''); setMsg('') }}>
        {mode === 'signin' ? 'ยังไม่มีบัญชี? สมัครใหม่' : 'มีบัญชีอยู่แล้ว? เข้าสู่ระบบ'}
      </button>
      <button type="button" className="btn link block" onClick={onUseCode}>
        ← กลับไปใส่รหัสประจำตัว
      </button>
    </form>
  )
}

export default function Login() {
  const [useEmail, setUseEmail] = useState(false)
  return (
    <div className="centered-page">
      {useEmail
        ? <EmailLogin onUseCode={() => setUseEmail(false)} />
        : <CodeLogin onUseEmail={() => setUseEmail(true)} />}
    </div>
  )
}
