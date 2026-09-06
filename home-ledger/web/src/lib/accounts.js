/**
 * ประเภทของกระเป๋าเงิน
 *
 * แบ่งเป็นสองกลุ่มโดยเจตนา:
 *   spend   — เงินที่หยิบใช้ได้ตอนนี้
 *   reserve — เงินที่กันไว้แล้ว (เงินเก็บสำรอง, พอร์ตลงทุน)
 *
 * การย้ายเงินเข้ากลุ่ม reserve ทำผ่านเมนู "โอนเงิน" ไม่ใช่บันทึกเป็นรายจ่าย
 * เพราะเงินยังเป็นของเราอยู่ ถ้านับเป็นรายจ่ายรายงานจะบอกว่าเดือนนั้นใช้เงินหนัก
 * ทั้งที่แค่ย้ายกระเป๋า และยอดคงเหลือของเดือนจะติดลบทั้งที่เก็บเงินได้
 */
export const ACCOUNT_KINDS = [
  { key: 'cash',    label: 'เงินสด',              icon: '💵', group: 'spend' },
  { key: 'bank',    label: 'บัญชีธนาคาร',         icon: '🏦', group: 'spend' },
  { key: 'ewallet', label: 'วอลเล็ท/พร้อมเพย์',   icon: '📱', group: 'spend' },
  { key: 'credit',  label: 'บัตรเครดิต',          icon: '💳', group: 'spend' },
  { key: 'savings', label: 'เงินเก็บสำรอง',       icon: '🏛️', group: 'reserve' },
  { key: 'invest',  label: 'ลงทุนหุ้น/กองทุน',    icon: '📈', group: 'reserve' }
]

const BY_KEY = Object.fromEntries(ACCOUNT_KINDS.map((k) => [k.key, k]))

export const kindOf = (key) => BY_KEY[key] ?? BY_KEY.cash
export const isReserve = (key) => kindOf(key).group === 'reserve'

/** แยกกระเป๋าออกเป็นสองกลุ่มพร้อมยอดรวมของแต่ละกลุ่ม */
export function splitByGroup(list) {
  const spend = list.filter((a) => !isReserve(a.kind))
  const reserve = list.filter((a) => isReserve(a.kind))
  const sum = (xs) => xs.reduce((s, a) => s + (Number(a.balance) || 0), 0)
  return { spend, reserve, spendTotal: sum(spend), reserveTotal: sum(reserve) }
}
