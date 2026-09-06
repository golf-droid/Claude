/**
 * ธนาคารและวอลเล็ทในไทย ใช้เติมชื่อและสีให้กระเป๋าเงินอัตโนมัติ
 * จะได้ไม่ต้องพิมพ์ชื่อธนาคารลงในบันทึกช่วยจำทุกครั้ง
 *
 * สีเป็นสีประจำแบรนด์โดยประมาณ ใช้เพื่อให้แยกกระเป๋าด้วยสายตาได้เร็ว
 * ถ้าอยากได้สีอื่นก็แก้ที่ไฟล์นี้ไฟล์เดียว
 */
export const BANKS = [
  // ธนาคาร
  { code: 'kbank',  kind: 'bank', name: 'กสิกรไทย',            short: 'KBank', color: '#138F2D' },
  { code: 'scb',    kind: 'bank', name: 'ไทยพาณิชย์',           short: 'SCB',   color: '#4E2A84' },
  { code: 'ktb',    kind: 'bank', name: 'กรุงไทย',              short: 'KTB',   color: '#1BA5E1' },
  { code: 'bbl',    kind: 'bank', name: 'กรุงเทพ',              short: 'BBL',   color: '#1E4598' },
  { code: 'bay',    kind: 'bank', name: 'กรุงศรีอยุธยา',        short: 'BAY',   color: '#C4801A' },
  { code: 'ttb',    kind: 'bank', name: 'ทีทีบี',               short: 'ttb',   color: '#1279BE' },
  { code: 'gsb',    kind: 'bank', name: 'ออมสิน',               short: 'GSB',   color: '#EB198D' },
  { code: 'baac',   kind: 'bank', name: 'ธ.ก.ส.',               short: 'BAAC',  color: '#4B9B1D' },
  { code: 'ghb',    kind: 'bank', name: 'อาคารสงเคราะห์',       short: 'GHB',   color: '#F57F20' },
  { code: 'uob',    kind: 'bank', name: 'ยูโอบี',               short: 'UOB',   color: '#0B3979' },
  { code: 'cimb',   kind: 'bank', name: 'ซีไอเอ็มบี ไทย',       short: 'CIMB',  color: '#7E2F35' },
  { code: 'kkp',    kind: 'bank', name: 'เกียรตินาคินภัทร',     short: 'KKP',   color: '#635F98' },
  { code: 'tisco',  kind: 'bank', name: 'ทิสโก้',               short: 'TISCO', color: '#12549F' },
  { code: 'lhb',    kind: 'bank', name: 'แลนด์ แอนด์ เฮ้าส์',   short: 'LHB',   color: '#6D6E71' },
  { code: 'ibank',  kind: 'bank', name: 'อิสลามแห่งประเทศไทย',  short: 'IBank', color: '#184C3B' },
  { code: 'citi',   kind: 'bank', name: 'ซิตี้แบงก์',           short: 'Citi',  color: '#1D6FB8' },

  // วอลเล็ท / พร้อมเพย์
  { code: 'promptpay', kind: 'ewallet', name: 'พร้อมเพย์',      short: 'PromptPay', color: '#0B4F9E' },
  { code: 'truemoney', kind: 'ewallet', name: 'ทรูมันนี่ วอลเล็ท', short: 'TrueMoney', color: '#F0421C' },
  { code: 'rabbit',    kind: 'ewallet', name: 'Rabbit LINE Pay', short: 'LINE Pay',  color: '#06C755' },
  { code: 'shopeepay', kind: 'ewallet', name: 'ShopeePay',      short: 'ShopeePay', color: '#EE4D2D' },
  { code: 'paotang',   kind: 'ewallet', name: 'เป๋าตัง',         short: 'เป๋าตัง',    color: '#005DAA' },
  { code: 'other',     kind: 'ewallet', name: 'อื่น ๆ',          short: '',          color: '#64748b' }
]

const BY_CODE = Object.fromEntries(BANKS.map((b) => [b.code, b]))

/** คืนข้อมูลธนาคารจากรหัส (null ถ้าไม่พบหรือกระเป๋านั้นไม่ได้ผูกธนาคาร) */
export const bankOf = (code) => (code ? BY_CODE[code] ?? null : null)

/** ธนาคารที่เลือกได้สำหรับกระเป๋าประเภทนี้ — เงินสด/บัตรเครดิตเลือกได้ทุกเจ้า */
export function banksFor(kind) {
  if (kind === 'bank') return BANKS.filter((b) => b.kind === 'bank')
  if (kind === 'ewallet') return BANKS.filter((b) => b.kind === 'ewallet')
  if (kind === 'credit') return BANKS.filter((b) => b.kind === 'bank')
  return []
}

/** สีของกระเป๋า ใช้ทำแถบ/พื้นหลังไอคอน */
export const accountColor = (account) => bankOf(account?.bank)?.color ?? null

/** ป้ายชื่อกระเป๋าเงินที่ใช้ในเมนูเลือก — ต่อท้ายด้วยชื่อธนาคารถ้าชื่อกระเป๋ายังไม่ได้บอกไว้ */
export function accountLabel(a) {
  if (!a) return ''
  const b = bankOf(a.bank)
  const base = `${a.icon ?? ''} ${a.name}`.trim()
  if (!b || b.code === 'other' || a.name.includes(b.name)) return base
  return `${base} · ${b.name}`
}
