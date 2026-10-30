-- Second Chances: read-only preflight for the existing SQL - 2.txt setup.
-- Run in the SQL Editor for project dmlebylgswtcsfsokxzz.
-- This file does not create, update, or delete anything.

-- Expect images (ARRAY), status (text), and sold_at (timestamp with time zone).
select table_schema, table_name, column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name = 'items'
  and column_name in ('images', 'status', 'sold_at')
order by column_name;

-- Expect one item-photos bucket with public = true.
select id, name, public
from storage.buckets
where id = 'item-photos';

-- Inspect the existing inventory, settings, and photo access rules.
-- The supplied SQL uses authenticated users as administrators.
select schemaname, tablename, policyname, roles, cmd, qual, with_check
from pg_policies
where (schemaname = 'public' and tablename in ('items', 'settings'))
   or (schemaname = 'storage' and tablename = 'objects'
       and policyname in ('public read photos', 'admin upload photos', 'admin delete photos'))
order by schemaname, tablename, policyname;

-- Expect true for both tables.
select relname as table_name, relrowsecurity as row_level_security_enabled
from pg_class
where relnamespace = 'public'::regnamespace
  and relname in ('items', 'settings');

-- Authenticated administrators need SELECT, INSERT, UPDATE, and DELETE.
select table_name, grantee, string_agg(privilege_type, ', ' order by privilege_type) as privileges
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in ('items', 'settings')
  and grantee in ('anon', 'authenticated')
group by table_name, grantee
order by table_name, grantee;
