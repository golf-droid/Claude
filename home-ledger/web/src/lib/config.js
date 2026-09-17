/**
 * ตั้งค่าประจำเว็บ — ทำให้โค้ดชุดเดียว deploy ได้หลายเว็บ
 *
 * แต่ละเว็บ (บ้านเรา / กลุ่มแฟน) ใช้โปรเจกต์ Supabase ของตัวเอง แล้วตั้งค่า
 * ที่ต่างกันผ่าน environment variables ของ Vercel โค้ดไม่ต้องแตกเป็นสองชุด
 * ถ้าไม่ตั้งค่าอะไรเลย จะได้พฤติกรรมเดิมของเว็บบ้านเราทุกอย่าง
 */

const env = import.meta.env

const PERSON_COLORS = ['#2563eb', '#16a34a', '#f97316', '#8b5cf6', '#0891b2', '#db2777']

/** "01:พ่อ,02:แม่" → [{code:'01', name:'พ่อ'}, ...] */
function parsePeople(raw) {
  if (!raw) return null
  const list = String(raw)
    .split(',')
    .map((entry, i) => {
      const [code, ...rest] = entry.split(':')
      const name = rest.join(':').trim()
      if (!code?.trim() || !name) return null
      return { code: code.trim(), name, color: PERSON_COLORS[i % PERSON_COLORS.length] }
    })
    .filter(Boolean)
  return list.length ? list : null
}

const DEFAULT_PEOPLE = [
  { code: '01', name: 'พ่อ', color: PERSON_COLORS[0] },
  { code: '02', name: 'แม่', color: PERSON_COLORS[1] },
  { code: '03', name: 'กอล์ฟ', color: PERSON_COLORS[2] },
  { code: '04', name: 'เกรซ', color: PERSON_COLORS[3] }
]

export const CONFIG = {
  /** ชื่อที่ขึ้นบนแท็บเบราว์เซอร์และหน้าล็อกอิน */
  appName: env.VITE_APP_NAME || 'บัญชีบ้านเรา',
  tagline: env.VITE_TAGLINE || 'รายรับ-รายจ่ายของทั้งบ้าน ซิงก์ทุกเครื่อง',

  /** 'default' = ฟ้า-ขาวแบบเดิม, 'pastel' = โทนพาสเทล */
  theme: env.VITE_THEME || 'default',

  /** สกุลเงินและรูปแบบตัวเลข */
  currency: env.VITE_CURRENCY || 'THB',
  locale: env.VITE_LOCALE || 'th-TH',

  /** 'be' = พ.ศ. (บวก 543), 'ce' = ค.ศ. */
  yearFormat: env.VITE_YEAR_FORMAT || 'be',

  /** แยกชุดบัญชีล็อกอินของแต่ละเว็บออกจากกัน */
  slug: env.VITE_HOUSEHOLD_SLUG || 'home',

  /** รายชื่อและรหัสประจำตัว */
  people: parsePeople(env.VITE_PEOPLE) || DEFAULT_PEOPLE,

  /** แนบรูปใบเสร็จได้ไหม (ต้องสร้าง bucket 'receipts' ใน Supabase ก่อน) */
  receipts: String(env.VITE_RECEIPTS ?? 'on').toLowerCase() !== 'off'
}

/** สัญลักษณ์สกุลเงิน เช่น ฿ หรือ $ ดึงจาก Intl จะได้ตรงกับ locale เสมอ */
export const CURRENCY_SYMBOL = (() => {
  try {
    return new Intl.NumberFormat(CONFIG.locale, {
      style: 'currency', currency: CONFIG.currency, maximumFractionDigits: 0
    })
      .formatToParts(0)
      .find((p) => p.type === 'currency')?.value ?? CONFIG.currency
  } catch (e) {
    return CONFIG.currency
  }
})()

/** ใช้เป็นโลโก้บนหน้าล็อกอิน — ตัวเดียวสั้น ๆ */
export const CURRENCY_MARK = CURRENCY_SYMBOL.length <= 2 ? CURRENCY_SYMBOL : CURRENCY_SYMBOL.slice(0, 2)
