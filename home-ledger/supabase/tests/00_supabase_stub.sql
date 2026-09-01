-- จำลองสภาพแวดล้อมของ Supabase เท่าที่ schema.sql ต้องใช้
create schema if not exists auth;
create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text
);
create extension if not exists pgcrypto;
create or replace function auth.uid() returns uuid
language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated;
  end if;
end $$;
grant usage on schema public, auth to authenticated;
alter default privileges in schema public grant all on tables to authenticated;
create publication supabase_realtime;
