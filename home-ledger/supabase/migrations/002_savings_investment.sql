-- เพิ่มกระเป๋าเงิน 2 ประเภท: เงินเก็บสำรอง และ ลงทุนหุ้น/กองทุน
-- วางทั้งไฟล์ใน Supabase → SQL Editor แล้วกด Run (รันซ้ำได้ ไม่สร้างซ้ำ)

-- 1) อนุญาตประเภทใหม่
alter table public.accounts drop constraint if exists accounts_kind_check;
alter table public.accounts add constraint accounts_kind_check
  check (kind in ('cash', 'bank', 'ewallet', 'credit', 'savings', 'invest'));

-- 2) สร้างกระเป๋าทั้งสองให้ทุกบ้านที่ยังไม่มี
insert into public.accounts (household_id, name, kind, icon, sort_order)
select h.id, 'เงินเก็บสำรอง', 'savings', '🏛️', 10
from public.households h
where not exists (
  select 1 from public.accounts a where a.household_id = h.id and a.kind = 'savings'
);

insert into public.accounts (household_id, name, kind, icon, sort_order)
select h.id, 'ลงทุนหุ้น/กองทุน', 'invest', '📈', 11
from public.households h
where not exists (
  select 1 from public.accounts a where a.household_id = h.id and a.kind = 'invest'
);
