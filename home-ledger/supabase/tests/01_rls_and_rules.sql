\set ON_ERROR_STOP on
\pset pager off

insert into auth.users (id, email) values
  ('11111111-1111-4111-8111-111111111111', 'pa@home.local'),
  ('22222222-2222-4222-8222-222222222222', 'ma@home.local'),
  ('99999999-9999-4999-8999-999999999999', 'stranger@elsewhere.local');

\echo '=== 1) พ่อสร้างบ้าน (ต้องได้กระเป๋า 3 หมวด 13) ==='
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';
select public.create_household('บ้านสุขใจ', 'พ่อ') as household_id \gset
select set_config('test.hh', :'household_id', false);
select count(*) as accounts_created from public.accounts;
select count(*) as categories_created from public.categories;
select set_config('test.acc', (select id::text from public.accounts where name = 'บัญชีธนาคาร'), false);
select set_config('test.cash', (select id::text from public.accounts where name = 'เงินสด'), false);
select set_config('test.cat', (select id::text from public.categories where name = 'ค่าน้ำค่าไฟ'), false);
select set_config('test.salary', (select id::text from public.categories where name = 'เงินเดือน'), false);

\echo '=== 2) สร้างรหัสเชิญ แล้วแม่ใช้รหัสเข้าบ้าน ==='
select public.create_invite(:'household_id') as code \gset
select set_config('test.code', :'code', false), length(:'code') as invite_code_length;
set request.jwt.claim.sub = '22222222-2222-4222-8222-222222222222';
select public.join_household(:'code', 'แม่') = :'household_id' as joined_same_household;

\echo '=== 3) ใช้รหัสเดิมซ้ำต้องไม่ได้ ==='
do $$
begin
  perform public.join_household(current_setting('test.code'), 'ใครก็ไม่รู้');
  raise exception 'ล้มเหลว: ใช้รหัสซ้ำได้';
exception when others then raise notice 'ผ่าน — %', sqlerrm;
end $$;

\echo '=== 4) แม่บันทึกรายการได้ และเห็นข้อมูลชุดเดียวกับพ่อ ==='
insert into public.transactions (household_id, type, txn_date, amount, account_id, category_id, note, paid_by, created_by)
values (current_setting('test.hh')::uuid, 'income', current_date, 45000,
        current_setting('test.acc')::uuid, current_setting('test.salary')::uuid, 'เงินเดือนแม่', auth.uid(), auth.uid());
insert into public.transactions (household_id, type, txn_date, amount, account_id, category_id, note, paid_by, created_by)
values (current_setting('test.hh')::uuid, 'expense', current_date, 1850,
        current_setting('test.acc')::uuid, current_setting('test.cat')::uuid, 'ค่าไฟ', null, auth.uid());
insert into public.transactions (household_id, type, txn_date, amount, account_id, to_account_id, note, paid_by, created_by)
values (current_setting('test.hh')::uuid, 'transfer', current_date, 2000,
        current_setting('test.acc')::uuid, current_setting('test.cash')::uuid, 'กดเงินสด', auth.uid(), auth.uid());
select count(*) as rows_visible_to_ma from public.transactions;

\echo '=== 5) ยอดคงเหลือ (คาดหวัง ธนาคาร=41150, เงินสด=2000, วอลเล็ท=0) ==='
select name, balance from public.v_account_balances order by sort_order;

\echo '=== 6) สรุปรายเดือน (คาดหวัง income=45000 expense=1850 net=43150) ==='
select month, income, expense, net from public.v_monthly_summary;

\echo '=== 7) คนนอกบ้านต้องไม่เห็นอะไรเลย (ทุกช่องต้องเป็น 0) ==='
set request.jwt.claim.sub = '99999999-9999-4999-8999-999999999999';
select
  (select count(*) from public.transactions)      as txns,
  (select count(*) from public.accounts)          as accounts,
  (select count(*) from public.categories)        as categories,
  (select count(*) from public.households)        as households,
  (select count(*) from public.household_members) as members;

\echo '=== 8) คนนอกบ้านเขียนข้อมูลเข้าบ้านคนอื่นไม่ได้ ==='
do $$
begin
  insert into public.transactions (household_id, type, txn_date, amount, account_id, category_id)
  values (current_setting('test.hh')::uuid, 'expense', current_date, 1,
          current_setting('test.acc')::uuid, current_setting('test.cat')::uuid);
  raise exception 'ล้มเหลว: คนนอกเขียนข้อมูลได้';
exception when others then raise notice 'ผ่าน — %', sqlerrm;
end $$;

\echo '=== 9) กติการูปแบบรายการในฐานข้อมูล ==='
set request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';
do $$
declare hh uuid := current_setting('test.hh')::uuid;
begin
  begin
    insert into public.transactions (household_id, type, txn_date, amount, account_id)
    values (hh, 'expense', current_date, 100, current_setting('test.acc')::uuid);
    raise exception 'ล้มเหลว: รายจ่ายไม่มีหมวดหมู่ก็บันทึกได้';
  exception when check_violation then raise notice 'ผ่าน — รายจ่ายต้องมีหมวดหมู่';
  end;
  begin
    insert into public.transactions (household_id, type, txn_date, amount, account_id, to_account_id)
    values (hh, 'transfer', current_date, 100,
            current_setting('test.acc')::uuid, current_setting('test.acc')::uuid);
    raise exception 'ล้มเหลว: โอนเข้ากระเป๋าเดียวกันได้';
  exception when check_violation then raise notice 'ผ่าน — โอนต้องต่างกระเป๋า';
  end;
  begin
    insert into public.transactions (household_id, type, txn_date, amount, account_id, category_id)
    values (hh, 'expense', current_date, -50,
            current_setting('test.acc')::uuid, current_setting('test.cat')::uuid);
    raise exception 'ล้มเหลว: จำนวนเงินติดลบผ่านได้';
  exception when check_violation then raise notice 'ผ่าน — จำนวนเงินต้องมากกว่า 0';
  end;
end $$;

\echo '=== 10) งบประมาณ + trigger updated_at ==='
insert into public.budgets (household_id, category_id, month, amount)
values (current_setting('test.hh')::uuid, current_setting('test.cat')::uuid,
        date_trunc('month', current_date)::date, 8000);
select amount as budget_amount from public.budgets;
update public.transactions set note = 'ค่าไฟ (แก้ไข)' where note = 'ค่าไฟ';
select (updated_at > created_at) as updated_at_bumped from public.transactions where note = 'ค่าไฟ (แก้ไข)';

reset role;
