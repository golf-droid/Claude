-- อัปเกรดฐานข้อมูลที่สร้างไว้ก่อนหน้า: ผูกกระเป๋าเงินกับธนาคาร/วอลเล็ทได้
-- วางทั้งไฟล์ใน Supabase → SQL Editor แล้วกด Run (รันซ้ำได้ ไม่กระทบข้อมูลเดิม)
alter table public.accounts add column if not exists bank text;
