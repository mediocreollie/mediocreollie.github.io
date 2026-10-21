-- Read-only verification for the Wine Journal Supabase setup.
-- Run in Supabase SQL Editor. No tables, policies or records are changed.
select 'wines' as object, to_regclass('public.wines') is not null as exists
union all select 'wine_reviews', to_regclass('public.wine_reviews') is not null
union all select 'wine_members', to_regclass('public.wine_members') is not null;
select tablename, rowsecurity from pg_tables where schemaname='public' and tablename in ('wines','wine_reviews','wine_members') order by tablename;
select tablename, policyname, cmd from pg_policies where schemaname='public' and tablename in ('wines','wine_reviews','wine_members') order by tablename,policyname;
select id,name,public,file_size_limit from storage.buckets where id='wine-photos';
select policyname,cmd from pg_policies where schemaname='storage' and tablename='objects' and policyname like 'Members %photos%' order by policyname;
select u.email, m.display_name, m.user_id is not null as wine_member from auth.users u left join public.wine_members m on m.user_id=u.id order by u.created_at;
