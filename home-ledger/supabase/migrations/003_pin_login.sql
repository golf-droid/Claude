-- แก้บั๊ก "function gen_random_bytes(integer) does not exist" และเพิ่มการเข้าบ้านด้วยรหัสประจำตัว
-- วางทั้งไฟล์ใน Supabase → SQL Editor แล้วกด Run (รันซ้ำได้)

-- สร้างรหัสเชิญ 6 ตัวอักษร
-- ใช้ random() ของ PostgreSQL แกนหลัก ไม่พึ่ง pgcrypto เพราะ Supabase ติดตั้ง
-- extension ไว้ใน schema extensions ซึ่งอยู่นอก search_path ของฟังก์ชันนี้
-- ตัวอักษรตัดตัวที่อ่านสับสน (I, L, O, 0, 1) ออก เวลาบอกกันปากเปล่าจะได้ไม่ผิด
create or replace function public.create_invite(p_household_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';  -- 31 ตัว
  v_code text;
begin
  if not public.is_household_member(p_household_id) then
    raise exception 'ไม่มีสิทธิ์ในบ้านนี้';
  end if;

  loop
    select string_agg(substr(v_alphabet, floor(random() * length(v_alphabet))::int + 1, 1), '')
      into v_code
      from generate_series(1, 6);
    exit when not exists (select 1 from public.household_invites where code = v_code);
  end loop;

  insert into public.household_invites (code, household_id, created_by)
  values (v_code, p_household_id, auth.uid());

  return v_code;
end;
$$;

-- เข้าบ้านของครอบครัวโดยไม่ต้องใช้รหัสเชิญ
-- ฐานข้อมูลนี้ให้บริการบ้านเดียว ใครล็อกอินเข้ามาจึงเข้าบ้านหลังนั้นได้เลย
-- (ด่านจริงอยู่ที่หน้าล็อกอิน: ต้องรู้รหัสประจำตัวถึงจะสร้าง session ได้)
create or replace function public.enter_family(p_display_name text)
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

  -- เป็นสมาชิกอยู่แล้ว: คืนบ้านเดิม พร้อมอัปเดตชื่อที่แสดง
  select household_id into v_id
  from public.household_members
  where user_id = v_uid
  order by joined_at
  limit 1;

  if v_id is not null then
    update public.household_members
       set display_name = coalesce(nullif(trim(p_display_name), ''), display_name)
     where household_id = v_id and user_id = v_uid;
    return v_id;
  end if;

  -- ยังไม่มีบ้านในระบบ: คนแรกที่เข้ามาเป็นผู้สร้าง
  select id into v_id from public.households order by created_at limit 1;
  if v_id is null then
    return public.create_household('บ้านของเรา', p_display_name);
  end if;

  insert into public.household_members (household_id, user_id, display_name, role)
  values (v_id, v_uid, coalesce(nullif(trim(p_display_name), ''), 'สมาชิก'), 'member')
  on conflict (household_id, user_id)
  do update set display_name = excluded.display_name;

  return v_id;
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
