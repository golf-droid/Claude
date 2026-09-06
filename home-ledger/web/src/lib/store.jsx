import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from './supabase.js'
import { monthKeyOf, shiftMonth, currentMonthKey } from './format.js'

/**
 * ชั้นข้อมูลของแอป
 *
 * หลักการ:
 *  1. โหลดข้อมูลบ้านทั้งก้อน (เล็กมากสำหรับ 4 คน) เก็บไว้ในหน่วยความจำ + localStorage
 *  2. ทุกการแก้ไขเขียนลงหน้าจอทันที (optimistic) แล้วค่อยส่งขึ้นคลาวด์
 *  3. ถ้าเน็ตหลุด งานที่ค้างจะถูกพักไว้ใน "outbox" แล้วส่งต่อเมื่อกลับมาออนไลน์
 *  4. Realtime ของ Supabase คอยแจ้งเมื่อคนอื่นในบ้านบันทึกรายการใหม่
 */

const MONTHS_LOADED = 24 // โหลดย้อนหลัง 2 ปี พอสำหรับดูแนวโน้ม
const CACHE_PREFIX = 'hl:cache:'
const OUTBOX_KEY = 'hl:outbox'
const HOUSEHOLD_KEY = 'hl:household'

const EMPTY = {
  household: null,
  members: [],
  accounts: [],
  categories: [],
  transactions: [],
  budgets: []
}

const DataContext = createContext(null)
export const useData = () => useContext(DataContext)

const readJSON = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}
const writeJSON = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* โควตาเต็มหรือโหมดส่วนตัว — ไม่ใช่เรื่องคอขาดบาดตาย */
  }
}

const newId = () =>
  (globalThis.crypto?.randomUUID?.() ??
    'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0
      return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
    }))

/** ใหม่สุดอยู่บนสุด: เรียงตามวันที่ แล้วตามเวลาที่บันทึก */
const sortTxns = (list) =>
  [...list].sort((a, b) =>
    a.txn_date === b.txn_date
      ? String(b.created_at).localeCompare(String(a.created_at))
      : String(b.txn_date).localeCompare(String(a.txn_date))
  )

export function DataProvider({ session, children }) {
  const userId = session?.user?.id ?? null
  const [state, setState] = useState(EMPTY)
  const [status, setStatus] = useState('loading') // loading | ready | no-household | error
  const [error, setError] = useState(null)
  const [online, setOnline] = useState(navigator.onLine)
  const [pending, setPending] = useState(() => readJSON(OUTBOX_KEY, []).length)
  const [syncing, setSyncing] = useState(false)
  const [syncError, setSyncError] = useState(null)
  const flushing = useRef(false)

  // ---------------------------------------------------------------- outbox --
  const enqueue = useCallback((op) => {
    const box = readJSON(OUTBOX_KEY, [])
    box.push({ ...op, queued_at: Date.now() })
    writeJSON(OUTBOX_KEY, box)
    setPending(box.length)
  }, [])

  const flush = useCallback(async () => {
    if (flushing.current || !navigator.onLine || !supabase) return
    let box = readJSON(OUTBOX_KEY, [])
    if (box.length === 0) return
    flushing.current = true
    setSyncing(true)
    try {
      while (box.length > 0) {
        const op = box[0]
        try {
          const q = supabase.from(op.table)
          let res
          if (op.kind === 'insert') res = await q.upsert(op.row)
          else if (op.kind === 'update') res = await q.update(op.row).eq('id', op.id)
          else res = await q.delete().eq('id', op.id)

          if (res.error) {
            // ข้อมูลผิดกติกา/ถูกลบไปแล้ว: ทิ้งงานนี้ ไม่งั้นคิวจะตันถาวร
            const permanent = !/network|fetch|timeout|Failed to fetch/i.test(res.error.message || '')
            if (!permanent) throw res.error
            // ทิ้งเงียบ ๆ แล้วผู้ใช้เข้าใจว่าบันทึกสำเร็จคือกับดัก จึงต้องบอกให้เห็น
            console.warn('ข้ามงานที่ส่งไม่สำเร็จ:', op, res.error.message)
            setSyncError(res.error.message || 'ส่งข้อมูลขึ้นคลาวด์ไม่สำเร็จ')
          }
        } catch (e) {
          // น่าจะเน็ตมีปัญหา — หยุดไว้ก่อน ค่อยลองใหม่รอบหน้า
          break
        }
        box.shift()
        writeJSON(OUTBOX_KEY, box)
        setPending(box.length)
      }
    } finally {
      flushing.current = false
      setSyncing(false)
    }
  }, [])

  // ------------------------------------------------------------------ load --
  const load = useCallback(
    async (householdId) => {
      if (!supabase || !userId) return
      const since = (() => {
        const m = shiftMonth(currentMonthKey(), -(MONTHS_LOADED - 1))
        return `${m}-01`
      })()

      const [hh, mem, acc, cat, txn, bud] = await Promise.all([
        supabase.from('households').select('*').eq('id', householdId).single(),
        supabase.from('household_members').select('*').eq('household_id', householdId),
        supabase.from('accounts').select('*').eq('household_id', householdId).order('sort_order'),
        supabase.from('categories').select('*').eq('household_id', householdId).order('sort_order'),
        supabase
          .from('transactions')
          .select('*')
          .eq('household_id', householdId)
          .gte('txn_date', since)
          .order('txn_date', { ascending: false })
          .order('created_at', { ascending: false }),
        supabase.from('budgets').select('*').eq('household_id', householdId)
      ])

      const firstError = [hh, mem, acc, cat, txn, bud].find((r) => r.error)?.error
      if (firstError) throw firstError

      const next = {
        household: hh.data,
        members: mem.data ?? [],
        accounts: acc.data ?? [],
        categories: cat.data ?? [],
        // เรียงซ้ำฝั่งเครื่องด้วย เพื่อให้ลำดับเหมือนกันเสมอไม่ว่าข้อมูลจะมาจากไหน
        transactions: sortTxns(txn.data ?? []),
        budgets: bud.data ?? []
      }
      setState(next)
      writeJSON(CACHE_PREFIX + householdId, next)
      return next
    },
    [userId]
  )

  const bootstrap = useCallback(async () => {
    if (!supabase || !userId) return
    setStatus('loading')
    setError(null)
    try {
      const { data: memberships, error: mErr } = await supabase
        .from('household_members')
        .select('household_id, role, joined_at')
        .eq('user_id', userId)
        .order('joined_at')
      if (mErr) throw mErr

      if (!memberships || memberships.length === 0) {
        localStorage.removeItem(HOUSEHOLD_KEY)
        setState(EMPTY)
        setStatus('no-household')
        return
      }

      const saved = localStorage.getItem(HOUSEHOLD_KEY)
      const hid = memberships.some((m) => m.household_id === saved)
        ? saved
        : memberships[0].household_id
      localStorage.setItem(HOUSEHOLD_KEY, hid)

      const cached = readJSON(CACHE_PREFIX + hid, null)
      if (cached) {
        setState(cached)
        setStatus('ready') // แสดงของเก่าก่อน แล้วค่อยอัปเดตเบื้องหลัง
      }
      await load(hid)
      setStatus('ready')
      flush()
    } catch (e) {
      const cachedId = localStorage.getItem(HOUSEHOLD_KEY)
      const cached = cachedId ? readJSON(CACHE_PREFIX + cachedId, null) : null
      if (cached) {
        setState(cached)
        setStatus('ready')
      } else {
        setError(e.message || String(e))
        setStatus('error')
      }
    }
  }, [userId, load, flush])

  useEffect(() => {
    if (userId) bootstrap()
    else {
      setState(EMPTY)
      setStatus('loading')
    }
  }, [userId, bootstrap])

  // ----------------------------------------------------- online / realtime --
  useEffect(() => {
    const goOnline = () => {
      setOnline(true)
      flush().then(() => {
        const hid = localStorage.getItem(HOUSEHOLD_KEY)
        if (hid) load(hid).catch(() => {})
      })
    }
    const goOffline = () => setOnline(false)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [flush, load])

  const householdId = state.household?.id ?? null

  useEffect(() => {
    if (!supabase || !householdId) return
    const channel = supabase
      .channel(`household:${householdId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'transactions', filter: `household_id=eq.${householdId}` },
        () => load(householdId).catch(() => {})
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'accounts', filter: `household_id=eq.${householdId}` },
        () => load(householdId).catch(() => {})
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'categories', filter: `household_id=eq.${householdId}` },
        () => load(householdId).catch(() => {})
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [householdId, load])

  // อัปเดตเมื่อกลับมาเปิดแอปอีกครั้ง (เผื่อ realtime หลุดตอนหน้าจอดับ)
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible' && householdId && navigator.onLine) {
        flush().then(() => load(householdId).catch(() => {}))
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [householdId, load, flush])

  // ------------------------------------------------------------ mutations --
  const patchLocal = useCallback((key, fn) => {
    setState((prev) => {
      const next = { ...prev, [key]: fn(prev[key]) }
      const hid = prev.household?.id
      if (hid) writeJSON(CACHE_PREFIX + hid, next)
      return next
    })
  }, [])

  const addTransaction = useCallback(
    (input) => {
      const now = new Date().toISOString()
      const row = {
        id: newId(),
        household_id: householdId,
        type: input.type,
        txn_date: input.txn_date,
        amount: input.amount,
        account_id: input.account_id,
        to_account_id: input.type === 'transfer' ? input.to_account_id : null,
        category_id: input.type === 'transfer' ? null : input.category_id,
        note: input.note ?? '',
        paid_by: input.paid_by ?? userId,
        created_by: userId,
        created_at: now,
        updated_at: now
      }
      patchLocal('transactions', (list) => sortTxns([row, ...list]))
      enqueue({ kind: 'insert', table: 'transactions', row })
      flush()
      return row
    },
    [householdId, userId, patchLocal, enqueue, flush]
  )

  const updateTransaction = useCallback(
    (id, input) => {
      const patch = {
        type: input.type,
        txn_date: input.txn_date,
        amount: input.amount,
        account_id: input.account_id,
        to_account_id: input.type === 'transfer' ? input.to_account_id : null,
        category_id: input.type === 'transfer' ? null : input.category_id,
        note: input.note ?? '',
        paid_by: input.paid_by ?? userId,
        updated_at: new Date().toISOString()
      }
      patchLocal('transactions', (list) =>
        sortTxns(list.map((t) => (t.id === id ? { ...t, ...patch } : t)))
      )
      enqueue({ kind: 'update', table: 'transactions', id, row: patch })
      flush()
    },
    [userId, patchLocal, enqueue, flush]
  )

  const deleteTransaction = useCallback(
    (id) => {
      patchLocal('transactions', (list) => list.filter((t) => t.id !== id))
      enqueue({ kind: 'delete', table: 'transactions', id })
      flush()
    },
    [patchLocal, enqueue, flush]
  )

  const saveAccount = useCallback(
    (input) => {
      if (input.id) {
        const patch = {
          name: input.name,
          kind: input.kind,
          icon: input.icon,
          bank: input.bank ?? null,
          opening_balance: input.opening_balance,
          is_active: input.is_active !== false
        }
        patchLocal('accounts', (l) => l.map((a) => (a.id === input.id ? { ...a, ...patch } : a)))
        enqueue({ kind: 'update', table: 'accounts', id: input.id, row: patch })
      } else {
        const row = {
          id: newId(),
          household_id: householdId,
          name: input.name,
          kind: input.kind ?? 'cash',
          icon: input.icon ?? '👛',
          bank: input.bank ?? null,
          opening_balance: input.opening_balance ?? 0,
          sort_order: 100,
          is_active: true,
          created_at: new Date().toISOString()
        }
        patchLocal('accounts', (l) => [...l, row])
        enqueue({ kind: 'insert', table: 'accounts', row })
      }
      flush()
    },
    [householdId, patchLocal, enqueue, flush]
  )

  const saveCategory = useCallback(
    (input) => {
      if (input.id) {
        const patch = {
          name: input.name,
          icon: input.icon,
          color: input.color,
          is_active: input.is_active !== false
        }
        patchLocal('categories', (l) => l.map((c) => (c.id === input.id ? { ...c, ...patch } : c)))
        enqueue({ kind: 'update', table: 'categories', id: input.id, row: patch })
        flush()
        return input.id
      } else {
        const row = {
          id: newId(),
          household_id: householdId,
          name: input.name,
          kind: input.kind,
          icon: input.icon ?? '📌',
          color: input.color ?? '#64748b',
          sort_order: 100,
          is_active: true,
          created_at: new Date().toISOString()
        }
        patchLocal('categories', (l) => [...l, row])
        enqueue({ kind: 'insert', table: 'categories', row })
        flush()
        return row.id
      }
    },
    [householdId, patchLocal, enqueue, flush]
  )

  const setBudget = useCallback(
    (categoryId, monthKey, amount) => {
      const month = `${monthKey}-01`
      const existing = state.budgets.find(
        (b) => b.category_id === categoryId && b.month === month
      )
      if (!amount || amount <= 0) {
        if (existing) {
          patchLocal('budgets', (l) => l.filter((b) => b.id !== existing.id))
          enqueue({ kind: 'delete', table: 'budgets', id: existing.id })
        }
      } else if (existing) {
        patchLocal('budgets', (l) =>
          l.map((b) => (b.id === existing.id ? { ...b, amount } : b))
        )
        enqueue({ kind: 'update', table: 'budgets', id: existing.id, row: { amount } })
      } else {
        const row = {
          id: newId(),
          household_id: householdId,
          category_id: categoryId,
          month,
          amount
        }
        patchLocal('budgets', (l) => [...l, row])
        enqueue({ kind: 'insert', table: 'budgets', row })
      }
      flush()
    },
    [state.budgets, householdId, patchLocal, enqueue, flush]
  )

  const updateMyProfile = useCallback(
    async (displayName) => {
      if (!supabase || !householdId) return
      patchLocal('members', (l) =>
        l.map((m) => (m.user_id === userId ? { ...m, display_name: displayName } : m))
      )
      await supabase
        .from('household_members')
        .update({ display_name: displayName })
        .eq('household_id', householdId)
        .eq('user_id', userId)
    },
    [householdId, userId, patchLocal]
  )

  const createInvite = useCallback(async () => {
    if (!supabase || !householdId) throw new Error('ยังไม่มีบ้าน')
    const { data, error: e } = await supabase.rpc('create_invite', { p_household_id: householdId })
    if (e) throw e
    return data
  }, [householdId])

  const createHousehold = useCallback(
    async (name, displayName) => {
      const { data, error: e } = await supabase.rpc('create_household', {
        p_name: name,
        p_display_name: displayName
      })
      if (e) throw e
      localStorage.setItem(HOUSEHOLD_KEY, data)
      await bootstrap()
      return data
    },
    [bootstrap]
  )

  const joinHousehold = useCallback(
    async (code, displayName) => {
      const { data, error: e } = await supabase.rpc('join_household', {
        p_code: code,
        p_display_name: displayName
      })
      if (e) throw e
      localStorage.setItem(HOUSEHOLD_KEY, data)
      await bootstrap()
      return data
    },
    [bootstrap]
  )

  const refresh = useCallback(async () => {
    if (!householdId) return bootstrap()
    await flush()
    return load(householdId)
  }, [householdId, load, flush, bootstrap])

  // ------------------------------------------------------------- ตัวช่วย --
  const helpers = useMemo(() => {
    const accountById = Object.fromEntries(state.accounts.map((a) => [a.id, a]))
    const categoryById = Object.fromEntries(state.categories.map((c) => [c.id, c]))
    const memberById = Object.fromEntries(state.members.map((m) => [m.user_id, m]))

    const balances = state.accounts.map((a) => {
      let bal = Number(a.opening_balance) || 0
      for (const t of state.transactions) {
        const amt = Number(t.amount) || 0
        if (t.account_id === a.id) bal += t.type === 'income' ? amt : -amt
        else if (t.to_account_id === a.id && t.type === 'transfer') bal += amt
      }
      return { ...a, balance: bal }
    })

    const totalBalance = balances
      .filter((a) => a.is_active !== false)
      .reduce((s, a) => s + a.balance, 0)

    const byMonth = new Map()
    for (const t of state.transactions) {
      const key = monthKeyOf(t.txn_date)
      if (!byMonth.has(key)) byMonth.set(key, { income: 0, expense: 0, list: [] })
      const bucket = byMonth.get(key)
      const amt = Number(t.amount) || 0
      if (t.type === 'income') bucket.income += amt
      else if (t.type === 'expense') bucket.expense += amt
      bucket.list.push(t)
    }

    const monthSummary = (monthKey) => {
      const b = byMonth.get(monthKey) ?? { income: 0, expense: 0, list: [] }
      return { ...b, net: b.income - b.expense }
    }

    return { accountById, categoryById, memberById, balances, totalBalance, byMonth, monthSummary }
  }, [state])

  const value = {
    ...state,
    ...helpers,
    userId,
    status,
    error,
    online,
    pending,
    syncing,
    syncError,
    clearSyncError: () => setSyncError(null),
    addTransaction,
    updateTransaction,
    deleteTransaction,
    saveAccount,
    saveCategory,
    setBudget,
    updateMyProfile,
    createInvite,
    createHousehold,
    joinHousehold,
    refresh
  }

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}
