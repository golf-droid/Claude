export const THAI_MONTHS = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
]
const THAI_MONTHS_SHORT = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']

const money = new Intl.NumberFormat('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const moneyShort = new Intl.NumberFormat('th-TH', { maximumFractionDigits: 0 })

export const fmtMoney = (n) => money.format(Number(n) || 0)
export const fmtMoneyShort = (n) => moneyShort.format(Number(n) || 0)

/** yyyy-mm-dd ตามเวลาท้องถิ่น (ไม่ใช้ toISOString เพราะจะเพี้ยนข้ามวันตามโซนเวลา) */
export function toDateKey(d) {
  const dt = d instanceof Date ? d : new Date(d)
  const p = (v) => String(v).padStart(2, '0')
  return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}`
}

export const todayKey = () => toDateKey(new Date())

/** '2026-09' จากวันที่หรือคีย์วันที่ */
export const monthKeyOf = (dateKey) => String(dateKey).slice(0, 7)

export function currentMonthKey() {
  return monthKeyOf(todayKey())
}

export function shiftMonth(monthKey, delta) {
  const [y, m] = monthKey.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function monthLabel(monthKey, short = false) {
  const [y, m] = monthKey.split('-').map(Number)
  const names = short ? THAI_MONTHS_SHORT : THAI_MONTHS
  return `${names[m - 1]} ${y + 543}`
}

export function shortMonthLabel(monthKey) {
  const [, m] = monthKey.split('-').map(Number)
  return THAI_MONTHS_SHORT[m - 1]
}

export function dayLabel(dateKey) {
  const [y, m, d] = dateKey.split('-').map(Number)
  const today = todayKey()
  if (dateKey === today) return 'วันนี้'
  const yst = new Date()
  yst.setDate(yst.getDate() - 1)
  if (dateKey === toDateKey(yst)) return 'เมื่อวาน'
  return `${d} ${THAI_MONTHS_SHORT[m - 1]} ${String(y + 543).slice(-2)}`
}

/** จำนวนเงินที่พิมพ์มา อาจมีคอมมา หรือเป็นนิพจน์เช่น 120+35 */
export function parseAmount(input) {
  const raw = String(input ?? '').replace(/[, ]/g, '')
  if (!raw) return NaN
  if (/^[0-9+\-*/.()]+$/.test(raw) && /[+\-*/]/.test(raw)) {
    try {
      // eslint-disable-next-line no-new-func
      const v = Function(`"use strict";return (${raw})`)()
      return typeof v === 'number' && isFinite(v) ? Math.round(v * 100) / 100 : NaN
    } catch {
      return NaN
    }
  }
  const v = Number(raw)
  return isFinite(v) ? Math.round(v * 100) / 100 : NaN
}
