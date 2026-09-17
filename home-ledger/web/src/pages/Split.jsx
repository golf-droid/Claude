import { useMemo, useState } from 'react'
import { useData } from '../lib/store.jsx'
import { CCY, dayLabel, fmtMoney } from '../lib/format.js'

/**
 * หน้า "หารกัน"
 *
 * แยกเป็นสองฝั่งให้ชัด: เงินที่เราต้องคืนเพื่อน กับเงินที่เพื่อนต้องคืนเรา
 * คนที่ติดหนี้เป็นคนกดติ๊กเองเมื่อจ่ายคืนแล้ว (คนออกเงินก็กดแทนได้ถ้าจำเป็น)
 */
export default function Split() {
  const { split, memberById, categoryById, userId, setShareSettled } = useData()
  const [showSettled, setShowSettled] = useState(false)

  const groups = useMemo(() => {
    const pick = (list) => (showSettled ? list : list.filter((s) => !s.settled))

    // ฉันติดใคร — จัดกลุ่มตามคนที่ออกเงินให้
    const byPayer = new Map()
    for (const s of pick(split.iOwe)) {
      const payer = s.txn?.paid_by ?? '_unknown'
      if (!byPayer.has(payer)) byPayer.set(payer, [])
      byPayer.get(payer).push(s)
    }

    // ใครติดฉัน — จัดกลุ่มตามลูกหนี้
    const byDebtor = new Map()
    for (const s of pick(split.owedToMe)) {
      if (!byDebtor.has(s.debtor)) byDebtor.set(s.debtor, [])
      byDebtor.get(s.debtor).push(s)
    }

    const shape = (map) =>
      [...map.entries()]
        .map(([id, items]) => ({
          id,
          name: memberById[id]?.display_name ?? 'ไม่ทราบชื่อ',
          color: memberById[id]?.color ?? '#94a3b8',
          items,
          open: items.filter((s) => !s.settled).reduce((n, s) => n + Number(s.amount), 0)
        }))
        .sort((a, b) => b.open - a.open)

    return { iOwe: shape(byPayer), owedToMe: shape(byDebtor) }
  }, [split, memberById, showSettled])

  const row = (s, canTick) => {
    const cat = s.txn?.category_id ? categoryById[s.txn.category_id] : null
    return (
      <li key={s.id}>
        <label className={`share-row ${s.settled ? 'done' : ''}`}>
          <input
            type="checkbox"
            checked={s.settled}
            disabled={!canTick}
            onChange={(e) => setShareSettled(s.id, e.target.checked)}
          />
          <span className="ic" style={{ background: (cat?.color ?? '#94a3b8') + '1f' }}>
            {cat?.icon ?? '🧾'}
          </span>
          <span className="mid">
            <b>{s.txn?.note?.trim() || cat?.name || 'รายการหารเท่า'}</b>
            <small>
              {s.txn ? dayLabel(s.txn.txn_date) : 'รายการเก่ากว่าที่โหลดไว้'}
              {s.txn ? ` · ทั้งบิล ${CCY}${fmtMoney(s.txn.amount)}` : ''}
            </small>
          </span>
          <span className="amt num">{CCY}{fmtMoney(s.amount)}</span>
        </label>
      </li>
    )
  }

  const section = (title, list, emptyText, canTick, tone) => (
    <section className="card">
      <h2 className="card-title">{title}</h2>
      {list.length === 0 ? (
        <p className="empty">{emptyText}</p>
      ) : (
        list.map((g) => (
          <div className="share-group" key={g.id}>
            <div className="share-head">
              <span className="avatar" style={{ background: g.color }}>
                {(g.name || '?').slice(0, 1)}
              </span>
              <span className="grow">{g.name}</span>
              <strong className={`num ${tone}`}>{CCY}{fmtMoney(g.open)}</strong>
            </div>
            <ul className="share-list">{g.items.map((s) => row(s, canTick))}</ul>
          </div>
        ))
      )}
    </section>
  )

  const settledCount = split.all.filter((s) => s.settled).length

  return (
    <div className="page">
      <section className="card hero">
        <span className="hero-label">ยอดหารเท่าที่ยังไม่เคลียร์</span>
        <strong className="hero-value">
          {split.net >= 0 ? '+' : '−'}{CCY}{fmtMoney(Math.abs(split.net))}
        </strong>
        <p className="hero-note">
          {split.net > 0
            ? 'รวมแล้วเพื่อนติดคุณอยู่'
            : split.net < 0
              ? 'รวมแล้วคุณติดเพื่อนอยู่'
              : 'เคลียร์กันหมดแล้ว'}
        </p>
        <div className="hero-split">
          <div>
            <span className="muted small">เพื่อนต้องคืนคุณ</span>
            <span className="money">{CCY}{fmtMoney(split.owedToMeTotal)}</span>
          </div>
          <div>
            <span className="muted small">คุณต้องคืนเพื่อน</span>
            <span className="money">{CCY}{fmtMoney(split.iOweTotal)}</span>
          </div>
        </div>
      </section>

      {section(
        'คุณต้องจ่ายคืน',
        groups.iOwe,
        'ไม่มีรายการที่ต้องจ่ายคืนใคร',
        true,
        'neg'
      )}

      {section(
        'รอเพื่อนจ่ายคืน',
        groups.owedToMe,
        'ยังไม่มีใครติดคุณ',
        true,
        'pos'
      )}

      {settledCount > 0 && (
        <button className="btn block" onClick={() => setShowSettled((v) => !v)}>
          {showSettled ? 'ซ่อนรายการที่เคลียร์แล้ว' : `แสดงรายการที่เคลียร์แล้ว (${settledCount})`}
        </button>
      )}

      <p className="muted small" style={{ textAlign: 'center' }}>
        ติ๊กช่องเมื่อจ่ายเงินคืนกันเรียบร้อยแล้ว ทุกคนในกลุ่มจะเห็นพร้อมกัน
      </p>
    </div>
  )
}
