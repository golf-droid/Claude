-- ============================================================================
-- Home Ledger — โครงสร้างฐานข้อมูลสำหรับ Supabase (PostgreSQL)
--
-- วิธีใช้: เปิด Supabase Dashboard → SQL Editor → วางไฟล์นี้ทั้งไฟล์ → Run
-- ไฟล์นี้รันซ้ำได้ (idempotent) ปลอดภัยต่อการรันใหม่เมื่อมีการอัปเดต
-- ============================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- ตาราง
-- ---------------------------------------------------------------------------

-- บ้าน 1 หลัง = 1 household ทุกคนในบ้านเห็นข้อมูลชุดเดียวกัน
create table if not exists public.households (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  currency    text not null default 'THB',
  created_by  uuid references auth.users on delete set null,
  created_at  timestamptz not null default now()
);

-- สมาชิกในบ้าน (ออกแบบไว้สำหรับ 4 คน แต่ไม่จำกัดจำนวน)
create table if not exists public.household_members (
  household_id uuid not null references public.households on delete cascade,
  user_id      uuid not null references auth.users on delete cascade,
  display_name text not null,
  role         text not null default 'member' check (role in ('owner', 'member')),
  color        text not null default '#64748b',
  joined_at    timestamptz not null default now(),
  primary key (household_id, user_id)
);

-- รหัสเชิญเข้าบ้าน (ใช้ครั้งเดียว หมดอายุใน 7 วัน)
create table if not exists public.household_invites (
  code         text primary key,
  household_id uuid not null references public.households on delete cascade,
  created_by   uuid references auth.users on delete set null,
  created_at   timestamptz not null default now(),
  expires_at   timestamptz not null default (now() + interval '7 days'),
  used_by      uuid references auth.users on delete set null,
  used_at      timestamptz
);

-- กระเป๋าเงิน / บัญชีธนาคาร
create table if not exists public.accounts (
  id              uuid primary key default gen_random_uuid(),
  household_id    uuid not null references public.households on delete cascade,
  name            text not null,
  kind            text not null default 'cash'
                    check (kind in ('cash', 'bank', 'ewallet', 'credit', 'savings', 'invest')),
  opening_balance numeric(14, 2) not null default 0,
  icon            text not null default '👛',
  sort_order      int  not null default 0,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now()
);

-- ผูกกระเป๋าเงินกับธนาคาร/วอลเล็ท (เพิ่มภายหลัง จึงใช้ alter เพื่อให้อัปเกรดของเดิมได้)
alter table public.accounts add column if not exists bank text;

-- หมวดหมู่รายรับ / รายจ่าย
create table if not exists public.categories (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households on delete cascade,
  name         text not null,
  kind         text not null check (kind in ('income', 'expense')),
  icon         text not null default '📌',
  color        text not null default '#64748b',
  sort_order   int  not null default 0,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  unique (household_id, kind, name)
);

-- รายการรับ-จ่าย (หัวใจของระบบ)
create table if not exists public.transactions (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references public.households on delete cascade,
  type          text not null check (type in ('income', 'expense', 'transfer')),
  txn_date      date not null default current_date,
  amount        numeric(14, 2) not null check (amount > 0),
  account_id    uuid not null references public.accounts on delete restrict,
  to_account_id uuid references public.accounts on delete restrict,
  category_id   uuid references public.categories on delete restrict,
  note          text not null default '',
  paid_by       uuid references auth.users on delete set null,  -- รายการนี้เป็นของใคร
  created_by    uuid references auth.users on delete set null,  -- ใครเป็นคนบันทึก
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  -- โอนเงินต้องมีปลายทางและห้ามมีหมวดหมู่ / รับ-จ่ายต้องมีหมวดหมู่และห้ามมีปลายทาง
  constraint transactions_shape_check check (
    (type = 'transfer'
      and to_account_id is not null
      and category_id is null
      and to_account_id <> account_id)
    or
    (type in ('income', 'expense')
      and to_account_id is null
      and category_id is not null)
  )
);

create index if not exists transactions_household_date_idx
  on public.transactions (household_id, txn_date desc, created_at desc);
create index if not exists transactions_category_idx
  on public.transactions (household_id, category_id);

-- งบประมาณรายเดือนต่อหมวดหมู่ (month = วันที่ 1 ของเดือนนั้น)
create table if not exists public.budgets (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households on delete cascade,
  category_id  uuid not null references public.categories on delete cascade,
  month        date not null,
  amount       numeric(14, 2) not null check (amount >= 0),
  unique (household_id, category_id, month)
);

-- อัปเดต updated_at อัตโนมัติ
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists transactions_touch_updated_at on public.transactions;
create trigger transactions_touch_updated_at
  before update on public.transactions
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- ฟังก์ชันช่วยตรวจสิทธิ์
-- ใช้ security definer เพื่อตัดปัญหา RLS เรียกซ้อนตัวเอง (infinite recursion)
-- ---------------------------------------------------------------------------

create or replace function public.is_household_member(hid uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.household_members m
    where m.household_id = hid and m.user_id = auth.uid()
  );
$$;

create or replace function public.is_household_owner(hid uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.household_members m
    where m.household_id = hid and m.user_id = auth.uid() and m.role = 'owner'
  );
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security — ทุกตารางเห็นเฉพาะข้อมูลบ้านตัวเอง
-- ---------------------------------------------------------------------------

alter table public.households        enable row level security;
alter table public.household_members enable row level security;
alter table public.household_invites enable row level security;
alter table public.accounts          enable row level security;
alter table public.categories        enable row level security;
alter table public.transactions      enable row level security;
alter table public.budgets           enable row level security;

do $$
declare
  t text;
  p record;
begin
  -- ลบ policy เดิมทั้งหมดก่อน เพื่อให้รันไฟล์ซ้ำได้
  for p in
    select schemaname, tablename, policyname from pg_policies
    where schemaname = 'public'
      and tablename in ('households', 'household_members', 'household_invites',
                        'accounts', 'categories', 'transactions', 'budgets')
  loop
    execute format('drop policy %I on %I.%I', p.policyname, p.schemaname, p.tablename);
  end loop;

  -- ตารางลูกทั้งหมดใช้กติกาเดียวกัน: เป็นสมาชิกบ้านนั้น = อ่าน/เขียนได้
  foreach t in array array['accounts', 'categories', 'transactions', 'budgets']
  loop
    execute format($f$
      create policy %1$s_member_all on public.%1$I
        for all to authenticated
        using (public.is_household_member(household_id))
        with check (public.is_household_member(household_id))
    $f$, t);
  end loop;
end
$$;

create policy households_member_select on public.households
  for select to authenticated using (public.is_household_member(id));

create policy households_owner_update on public.households
  for update to authenticated
  using (public.is_household_owner(id))
  with check (public.is_household_owner(id));

create policy members_select on public.household_members
  for select to authenticated using (public.is_household_member(household_id));

-- แก้ชื่อเล่น/สีของตัวเองได้ เจ้าบ้านแก้ของทุกคนได้
create policy members_update on public.household_members
  for update to authenticated
  using (user_id = auth.uid() or public.is_household_owner(household_id))
  with check (user_id = auth.uid() or public.is_household_owner(household_id));

-- ออกจากบ้านเองได้ เจ้าบ้านลบสมาชิกคนอื่นได้ (แต่ห้ามลบเจ้าบ้าน)
create policy members_delete on public.household_members
  for delete to authenticated
  using (
    (user_id = auth.uid() and role <> 'owner')
    or (public.is_household_owner(household_id) and role <> 'owner')
  );

create policy invites_select on public.household_invites
  for select to authenticated using (public.is_household_member(household_id));

create policy invites_insert on public.household_invites
  for insert to authenticated with check (public.is_household_member(household_id));

create policy invites_delete on public.household_invites
  for delete to authenticated using (public.is_household_member(household_id));

-- ---------------------------------------------------------------------------
-- RPC: สร้างบ้าน + ข้อมูลตั้งต้น
-- ---------------------------------------------------------------------------

create or replace function public.create_household(p_name text, p_display_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_id  uuid;
begin
  if v_uid is null then
    raise exception 'ต้องเข้าสู่ระบบก่อน';
  end if;

  insert into public.households (name, created_by)
  values (coalesce(nullif(trim(p_name), ''), 'บ้านของเรา'), v_uid)
  returning id into v_id;

  insert into public.household_members (household_id, user_id, display_name, role, color)
  values (v_id, v_uid, coalesce(nullif(trim(p_display_name), ''), 'สมาชิก'), 'owner', '#2563eb');

  insert into public.accounts (household_id, name, kind, icon, sort_order) values
    (v_id, 'เงินสด',              'cash',    '💵', 1),
    (v_id, 'บัญชีธนาคาร',         'bank',    '🏦', 2),
    (v_id, 'พร้อมเพย์/วอลเล็ท',   'ewallet', '📱', 3),
    (v_id, 'เงินเก็บสำรอง',       'savings', '🏛️', 10),
    (v_id, 'ลงทุนหุ้น/กองทุน',    'invest',  '📈', 11);

  insert into public.categories (household_id, name, kind, icon, color, sort_order) values
    (v_id, 'เงินเดือน',      'income',  '💼', '#16a34a', 1),
    (v_id, 'รายได้เสริม',    'income',  '🧾', '#0d9488', 2),
    (v_id, 'เงินโอนเข้า',    'income',  '🎁', '#65a30d', 3),
    (v_id, 'ดอกเบี้ย/ลงทุน', 'income',  '📈', '#0891b2', 4),
    (v_id, 'อาหาร',          'expense', '🍚', '#f97316', 1),
    (v_id, 'ของใช้ในบ้าน',   'expense', '🧻', '#f59e0b', 2),
    (v_id, 'ค่าน้ำค่าไฟ',    'expense', '💡', '#eab308', 3),
    (v_id, 'เดินทาง/น้ำมัน', 'expense', '⛽', '#3b82f6', 4),
    (v_id, 'สุขภาพ',         'expense', '💊', '#ef4444', 5),
    (v_id, 'การศึกษา',       'expense', '📚', '#8b5cf6', 6),
    (v_id, 'ผ่อน/หนี้สิน',   'expense', '🏠', '#64748b', 7),
    (v_id, 'บันเทิง',        'expense', '🎬', '#ec4899', 8),
    (v_id, 'อื่น ๆ',          'expense', '📌', '#94a3b8', 99);

  return v_id;
end;
$$;

-- สร้างรหัสเชิญ 6 ตัวอักษร
create or replace function public.create_invite(p_household_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
begin
  if not public.is_household_member(p_household_id) then
    raise exception 'ไม่มีสิทธิ์ในบ้านนี้';
  end if;

  loop
    v_code := upper(substr(replace(encode(gen_random_bytes(8), 'base64'), '/', ''), 1, 6));
    exit when not exists (select 1 from public.household_invites where code = v_code);
  end loop;

  insert into public.household_invites (code, household_id, created_by)
  values (v_code, p_household_id, auth.uid());

  return v_code;
end;
$$;

-- ใช้รหัสเชิญเพื่อเข้าบ้าน
create or replace function public.join_household(p_code text, p_display_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_inv public.household_invites%rowtype;
begin
  if v_uid is null then
    raise exception 'ต้องเข้าสู่ระบบก่อน';
  end if;

  select * into v_inv
  from public.household_invites
  where code = upper(trim(p_code));

  if not found then
    raise exception 'ไม่พบรหัสเชิญนี้';
  end if;
  if v_inv.used_by is not null then
    raise exception 'รหัสเชิญนี้ถูกใช้ไปแล้ว';
  end if;
  if v_inv.expires_at < now() then
    raise exception 'รหัสเชิญหมดอายุแล้ว';
  end if;

  insert into public.household_members (household_id, user_id, display_name, role)
  values (v_inv.household_id, v_uid, coalesce(nullif(trim(p_display_name), ''), 'สมาชิก'), 'member')
  on conflict (household_id, user_id) do nothing;

  update public.household_invites
     set used_by = v_uid, used_at = now()
   where code = v_inv.code;

  return v_inv.household_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Views — ยอดคงเหลือและสรุปรายเดือน (คำนวณฝั่งฐานข้อมูล)
-- security_invoker = on ทำให้ view เคารพ RLS ของผู้เรียก
-- ---------------------------------------------------------------------------

create or replace view public.v_account_balances
with (security_invoker = on) as
select
  a.id as account_id,
  a.household_id,
  a.name,
  a.icon,
  a.kind,
  a.sort_order,
  a.is_active,
  a.opening_balance
    + coalesce((select sum(t.amount) from public.transactions t
                 where t.account_id = a.id and t.type = 'income'), 0)
    - coalesce((select sum(t.amount) from public.transactions t
                 where t.account_id = a.id and t.type in ('expense', 'transfer')), 0)
    + coalesce((select sum(t.amount) from public.transactions t
                 where t.to_account_id = a.id and t.type = 'transfer'), 0)
  as balance
from public.accounts a;

create or replace view public.v_monthly_summary
with (security_invoker = on) as
select
  t.household_id,
  date_trunc('month', t.txn_date)::date as month,
  sum(t.amount) filter (where t.type = 'income')  as income,
  sum(t.amount) filter (where t.type = 'expense') as expense,
  coalesce(sum(t.amount) filter (where t.type = 'income'), 0)
    - coalesce(sum(t.amount) filter (where t.type = 'expense'), 0) as net
from public.transactions t
group by 1, 2;

-- ---------------------------------------------------------------------------
-- Realtime — ให้ทุกเครื่องเห็นรายการใหม่ทันที
-- ---------------------------------------------------------------------------

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.transactions;
    exception when duplicate_object then null;
    end;
    begin
      alter publication supabase_realtime add table public.accounts;
    exception when duplicate_object then null;
    end;
    begin
      alter publication supabase_realtime add table public.categories;
    exception when duplicate_object then null;
    end;
    begin
      alter publication supabase_realtime add table public.budgets;
    exception when duplicate_object then null;
    end;
  end if;
end
$$;
