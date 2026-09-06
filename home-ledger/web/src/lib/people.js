/**
 * รายชื่อคนในบ้านและรหัสประจำตัวสำหรับเข้าใช้งาน
 *
 * เพิ่ม/แก้คนได้ที่ไฟล์นี้ไฟล์เดียว แล้ว push ขึ้น GitHub — Vercel จะ deploy ให้เอง
 * ถ้าเปลี่ยนรหัสของใคร คนนั้นจะกลายเป็น "คนใหม่" ในระบบ (บัญชีผูกกับรหัส)
 * ให้เข้ามาแล้วลบชื่อเดิมทิ้งที่หน้าตั้งค่า
 *
 * ⚠️ รหัสสั้นแค่ไหน ความปลอดภัยก็เท่านั้น รหัส 2 หลักหมายความว่าคนที่รู้ลิงก์
 * เดาครบทุกความเป็นไปได้ได้ใน 100 ครั้ง ถ้าอยากแน่นขึ้นให้เปลี่ยนเป็น 4–6 หลัก
 * (เช่น '1032') ใช้งานเหมือนเดิมทุกอย่าง แค่พิมพ์ยาวขึ้นครั้งเดียวต่อเครื่อง
 */
export const PEOPLE = [
  { code: '01', name: 'พ่อ',    color: '#2563eb' },
  { code: '02', name: 'แม่',    color: '#16a34a' },
  { code: '03', name: 'กอล์ฟ',  color: '#f97316' },
  { code: '04', name: 'เกรซ',   color: '#8b5cf6' }
]

/** ใช้แยกชุดบัญชีของบ้านนี้ออกจากบ้านอื่น เผื่อมีคนเอาโค้ดไปใช้ต่อ */
const SLUG = import.meta.env.VITE_HOUSEHOLD_SLUG || 'home'

export const peopleCodeLength = Math.max(...PEOPLE.map((p) => p.code.length))

export const personByCode = (code) =>
  PEOPLE.find((p) => p.code === String(code ?? '').trim()) ?? null

/**
 * แปลงรหัสประจำตัวเป็นบัญชี Supabase จริง ๆ เบื้องหลัง
 * โดเมน example.com สงวนไว้ตาม RFC 2606 จึงไม่มีทางชนกับอีเมลจริงของใคร
 */
export const credentialsFor = (person) => ({
  email: `${person.code}@${SLUG}.example.com`,
  password: `hl-${SLUG}-${person.code}-v1`
})

const KEY = 'hl:person'
export const rememberPerson = (person) => {
  try { localStorage.setItem(KEY, person.code) } catch (e) { /* โหมดส่วนตัว */ }
}
export const rememberedPerson = () => {
  try { return personByCode(localStorage.getItem(KEY)) } catch (e) { return null }
}
export const forgetPerson = () => {
  try { localStorage.removeItem(KEY) } catch (e) { /* ไม่เป็นไร */ }
}
