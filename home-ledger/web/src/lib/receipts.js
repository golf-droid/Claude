import { supabase } from './supabase.js'

/**
 * รูปใบเสร็จ
 *
 * เก็บใน Supabase Storage ถัง 'receipts' แบบไม่เปิดสาธารณะ
 * ชื่อไฟล์เป็น <household_id>/<user_id>/<สุ่ม>.jpg เพื่อให้กติกาฝั่งฐานข้อมูล
 * ตรวจได้ว่าใครดูได้และใครแก้ได้ (ดูไฟล์ supabase/migrations/005_receipts.sql)
 *
 * ย่อรูปก่อนอัปโหลดเสมอ รูปจากกล้องมือถือใบละ 3–5 MB ถ้าอัปดิบ ๆ
 * โควตาฟรี 1 GB จะหมดใน 200 กว่าใบ แต่ย่อแล้วเหลือใบละ ~150 KB เก็บได้เป็นหมื่นใบ
 */

const MAX_DIMENSION = 1600
const JPEG_QUALITY = 0.82
export const RECEIPT_BUCKET = 'receipts'

const randomName = () =>
  (globalThis.crypto?.randomUUID?.() ?? String(Date.now()) + Math.random().toString(36).slice(2))
    .replace(/-/g, '')

async function loadBitmap(file) {
  // createImageBitmap หมุนรูปตาม EXIF ให้เอง รูปถ่ายแนวตั้งจะได้ไม่ตะแคง
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' })
    } catch (e) {
      /* เบราว์เซอร์เก่าไม่รองรับ option นี้ ตกไปใช้ทางด้านล่าง */
    }
  }
  return await new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => { URL.revokeObjectURL(url); resolve(img) }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('อ่านไฟล์รูปไม่ได้')) }
    img.src = url
  })
}

/** ย่อรูปให้ด้านยาวสุดไม่เกิน 1600px แล้วแปลงเป็น JPEG */
async function shrink(file) {
  const src = await loadBitmap(file)
  const w0 = src.width, h0 = src.height
  const scale = Math.min(1, MAX_DIMENSION / Math.max(w0, h0))
  const w = Math.max(1, Math.round(w0 * scale))
  const h = Math.max(1, Math.round(h0 * scale))

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#ffffff'          // กัน JPEG ที่มาจาก PNG โปร่งใสกลายเป็นพื้นดำ
  ctx.fillRect(0, 0, w, h)
  ctx.drawImage(src, 0, 0, w, h)
  if (src.close) src.close()

  return await new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('ย่อรูปไม่สำเร็จ'))),
      'image/jpeg',
      JPEG_QUALITY
    )
  })
}

/** อัปโหลดรูป แล้วคืนชื่อไฟล์ที่ต้องเก็บไว้ในรายการ */
export async function uploadReceipt(file, householdId, userId) {
  if (!supabase) throw new Error('ยังไม่ได้เชื่อมต่อคลาวด์')
  if (!householdId || !userId) throw new Error('ยังไม่พร้อม ลองใหม่อีกครั้ง')
  if (!navigator.onLine) throw new Error('ต้องออนไลน์ถึงจะแนบรูปได้ บันทึกรายการก่อนแล้วค่อยมาแนบทีหลังได้')

  const blob = await shrink(file)
  const path = `${householdId}/${userId}/${randomName()}.jpg`
  const { error } = await supabase.storage
    .from(RECEIPT_BUCKET)
    .upload(path, blob, { contentType: 'image/jpeg', upsert: false })

  if (error) {
    if (/Bucket not found/i.test(error.message)) {
      throw new Error('ยังไม่ได้สร้างที่เก็บรูป — รันไฟล์ supabase/migrations/005_receipts.sql ใน Supabase ก่อน')
    }
    throw error
  }
  return path
}

/** ลิงก์ชั่วคราวสำหรับเปิดดูรูป (อายุ 1 ชั่วโมง) */
export async function receiptUrl(path) {
  if (!supabase || !path) return null
  const { data, error } = await supabase.storage
    .from(RECEIPT_BUCKET)
    .createSignedUrl(path, 3600)
  if (error) return null
  return data?.signedUrl ?? null
}

/** ลบรูปทิ้ง — ลบได้เฉพาะรูปที่ตัวเองอัปโหลด ตามกติกาฝั่งฐานข้อมูล */
export async function deleteReceipt(path) {
  if (!supabase || !path) return
  await supabase.storage.from(RECEIPT_BUCKET).remove([path])
}
