-- หารเท่า: แตกรายจ่ายหนึ่งรายการออกเป็นส่วนที่คนอื่นต้องจ่ายคืนคนที่ออกเงินไปก่อน
-- วางทั้งไฟล์ใน Supabase → SQL Editor แล้วกด Run (รันซ้ำได้)
--
-- แนวคิด: รายการจ่ายยังเป็นของคนที่ "ออกเงินไปก่อน" (transactions.paid_by) เหมือนเดิม
-- ส่วนที่คนอื่นติดหนี้เก็บแยกในตารางนี้ทีละคน พร้อมสถานะว่าจ่ายคืนแล้วหรือยัง

create table if not exists public.expense_shares (
  id             uuid primary key default gen_random_uuid(),
  household_id   uuid not null references public.households on delete cascade,
  transaction_id uuid not null references public.transactions on delete cascade,
  debtor         uuid not null references auth.users on delete cascade,  -- คนที่ต้องจ่ายคืน
  amount         numeric(14, 2) not null check (amount >= 0),
  settled        boolean not null default false,                         -- จ่ายคืนแล้วหรือยัง
  settled_at     timestamptz,
  created_at     timestamptz not null default now(),
  unique (transaction_id, debtor)
);

create index if not exists expense_shares_household_idx
  on public.expense_shares (household_id, settled);
create index if not exists expense_shares_debtor_idx
  on public.expense_shares (household_id, debtor, settled);

alter table public.expense_shares enable row level security;

-- ใครเป็นคนออกเงินให้รายการนี้
create or replace function public.transaction_payer(p_txn uuid)
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select paid_by from public.transactions where id = p_txn;
$$;

-- ---------------------------------------------------------------------------
-- สิทธิ์
--   อ่าน   : สมาชิกในบ้าน/กลุ่มเห็นได้หมด จะได้รู้ว่าใครติดใครเท่าไหร่
--   สร้าง  : เฉพาะคนที่ออกเงินให้รายการนั้น (เป็นคนกดหาร)
--   ลบ     : เฉพาะคนที่ออกเงิน
--   แก้ไข  : คนออกเงินแก้ได้ทุกช่อง / คนที่ติดหนี้แก้ได้เฉพาะช่อง "จ่ายคืนแล้ว"
--            (บังคับด้วย trigger ข้างล่าง เพราะ RLS คุมเป็นรายคอลัมน์ไม่ได้)
-- ---------------------------------------------------------------------------

drop policy if exists shares_select on public.expense_shares;
drop policy if exists shares_insert on public.expense_shares;
drop policy if exists shares_update on public.expense_shares;
drop policy if exists shares_delete on public.expense_shares;

create policy shares_select on public.expense_shares
  for select to authenticated
  using (public.is_household_member(household_id));

create policy shares_insert on public.expense_shares
  for insert to authenticated
  with check (
    public.is_household_member(household_id)
    and public.transaction_payer(transaction_id) = auth.uid()
    and debtor <> auth.uid()
  );

create policy shares_update on public.expense_shares
  for update to authenticated
  using (
    public.is_household_member(household_id)
    and (debtor = auth.uid() or public.transaction_payer(transaction_id) = auth.uid())
  )
  with check (
    public.is_household_member(household_id)
    and (debtor = auth.uid() or public.transaction_payer(transaction_id) = auth.uid())
  );

create policy shares_delete on public.expense_shares
  for delete to authenticated
  using (
    public.is_household_member(household_id)
    and public.transaction_payer(transaction_id) = auth.uid()
  );

-- คนที่ติดหนี้กดติ๊กว่าจ่ายคืนแล้วได้ แต่แก้ยอดหรือย้ายให้คนอื่นไม่ได้
create or replace function public.guard_share_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.settled_at := case
    when new.settled then coalesce(old.settled_at, now())
    else null
  end;

  if public.transaction_payer(new.transaction_id) = auth.uid() then
    return new;
  end if;

  if new.transaction_id is distinct from old.transaction_id
     or new.household_id is distinct from old.household_id
     or new.debtor    is distinct from old.debtor
     or new.amount    is distinct from old.amount then
    raise exception 'แก้ได้เฉพาะสถานะจ่ายคืนแล้วเท่านั้น';
  end if;

  return new;
end;
$$;

drop trigger if exists expense_shares_guard on public.expense_shares;
create trigger expense_shares_guard
  before update on public.expense_shares
  for each row execute function public.guard_share_update();

-- ให้ทุกเครื่องเห็นการเปลี่ยนแปลงทันที
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.expense_shares;
    exception when duplicate_object then null;
    end;
  end if;
end
$$;
