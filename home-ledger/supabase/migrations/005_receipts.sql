-- แนบรูปใบเสร็จกับรายการรับ-จ่าย
-- วางทั้งไฟล์ใน Supabase → SQL Editor แล้วกด Run (รันซ้ำได้)

-- 1) ที่เก็บชื่อไฟล์ในตารางรายการ
alter table public.transactions add column if not exists receipt_path text;

-- 2) ถังเก็บไฟล์ แบบไม่เปิดสาธารณะ — เปิดดูได้ผ่านลิงก์ชั่วคราวที่แอปขอให้เท่านั้น
insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', false)
on conflict (id) do nothing;

update storage.buckets
   set file_size_limit = 5242880,                                    -- 5 MB ต่อไฟล์
       allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
 where id = 'receipts';

-- 3) ชื่อไฟล์ใช้รูปแบบ  <household_id>/<user_id>/<ชื่อสุ่ม>.jpg
--    โฟลเดอร์ชั้นแรกบอกว่าเป็นของบ้านไหน ชั้นที่สองบอกว่าใครเป็นคนอัปโหลด
create or replace function public.receipt_household(object_name text)
returns uuid
language plpgsql
immutable
set search_path = public, storage
as $$
declare
  v_first text := (storage.foldername(object_name))[1];
begin
  if v_first !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return null;
  end if;
  return v_first::uuid;
end;
$$;

create or replace function public.receipt_uploader(object_name text)
returns text
language sql
immutable
set search_path = public, storage
as $$
  select (storage.foldername(object_name))[2];
$$;

-- 4) กติกา: สมาชิกในบ้านดูใบเสร็จของบ้านได้ทุกใบ
--    แต่เพิ่ม/แก้/ลบได้เฉพาะไฟล์ในโฟลเดอร์ของตัวเอง — สอดคล้องกับกติกาของรายการ
drop policy if exists receipts_read on storage.objects;
drop policy if exists receipts_insert on storage.objects;
drop policy if exists receipts_update on storage.objects;
drop policy if exists receipts_delete on storage.objects;

create policy receipts_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'receipts'
    and public.is_household_member(public.receipt_household(name))
  );

create policy receipts_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'receipts'
    and public.is_household_member(public.receipt_household(name))
    and public.receipt_uploader(name) = auth.uid()::text
  );

create policy receipts_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'receipts'
    and public.is_household_member(public.receipt_household(name))
    and public.receipt_uploader(name) = auth.uid()::text
  );

create policy receipts_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'receipts'
    and public.is_household_member(public.receipt_household(name))
    and public.receipt_uploader(name) = auth.uid()::text
  );
