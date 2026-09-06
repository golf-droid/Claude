-- แต่ละคนบันทึก/แก้/ลบได้เฉพาะรายการของตัวเองและรายการส่วนกลาง
-- วางทั้งไฟล์ใน Supabase → SQL Editor แล้วกด Run (รันซ้ำได้)
--
-- อ่าน:  สมาชิกทุกคนยังเห็นรายการของทั้งบ้านเหมือนเดิม ภาพรวมและรายงานจึงครบ
-- เขียน: เขียนได้เฉพาะแถวที่ paid_by เป็นตัวเอง หรือเป็นค่าว่าง (ส่วนกลาง)
--        เจ้าบ้าน (role = 'owner') แก้ได้ทุกแถว เอาไว้ตามแก้ของที่บันทึกผิด

drop policy if exists transactions_member_all on public.transactions;
drop policy if exists transactions_select on public.transactions;
drop policy if exists transactions_insert on public.transactions;
drop policy if exists transactions_update on public.transactions;
drop policy if exists transactions_delete on public.transactions;

create policy transactions_select on public.transactions
  for select to authenticated
  using (public.is_household_member(household_id));

create policy transactions_insert on public.transactions
  for insert to authenticated
  with check (
    public.is_household_member(household_id)
    and (paid_by is null or paid_by = auth.uid() or public.is_household_owner(household_id))
  );

create policy transactions_update on public.transactions
  for update to authenticated
  using (
    public.is_household_member(household_id)
    and (paid_by is null or paid_by = auth.uid() or public.is_household_owner(household_id))
  )
  with check (
    public.is_household_member(household_id)
    and (paid_by is null or paid_by = auth.uid() or public.is_household_owner(household_id))
  );

create policy transactions_delete on public.transactions
  for delete to authenticated
  using (
    public.is_household_member(household_id)
    and (paid_by is null or paid_by = auth.uid() or public.is_household_owner(household_id))
  );

-- รายการที่ผูกกับคนที่ไม่ได้อยู่ในบ้านแล้ว จะไม่มีใครแก้ได้เลย
-- ย้ายให้เป็นส่วนกลางเพื่อให้ยังจัดการต่อได้
update public.transactions t
   set paid_by = null
 where t.paid_by is not null
   and not exists (
     select 1 from public.household_members m
     where m.household_id = t.household_id and m.user_id = t.paid_by
   );
