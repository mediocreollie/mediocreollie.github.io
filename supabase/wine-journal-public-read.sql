-- Wine Journal: public browsing, member-only editing.
-- Run once in the existing Supabase project SQL Editor.
-- Public content includes bottle photos, ratings, tasting notes and display names.
alter table public.wine_members add column if not exists display_name text;
grant usage on schema public to anon, authenticated;
grant select on public.wines, public.wine_reviews to anon, authenticated;
grant select (user_id, display_name) on public.wine_members to anon, authenticated;
grant insert, update, delete on public.wines, public.wine_reviews to authenticated;
-- wine_members remains admin-managed: no insert/update/delete grant to visitors.
drop policy if exists "Members can see their own membership" on public.wine_members;
create policy "Public reviewer display names" on public.wine_members for select to anon, authenticated using (true);
drop policy if exists "Members read wines" on public.wines;
create policy "Public read wines" on public.wines for select to anon, authenticated using (true);
drop policy if exists "Members read reviews" on public.wine_reviews;
create policy "Public read reviews" on public.wine_reviews for select to anon, authenticated using (true);
-- Make bottle photographs publicly readable; only wine_members can upload/change/delete.
update storage.buckets set public=true where id='wine-photos';
drop policy if exists "Members view photos" on storage.objects;
create policy "Public view wine photos" on storage.objects for select to anon, authenticated using (bucket_id='wine-photos');
-- Existing member-only INSERT/UPDATE/DELETE storage policies stay unchanged.
-- Add Beth as a Supabase Auth user, then grant membership explicitly in SQL.
-- Example, replace with her exact account email:
-- insert into public.wine_members(user_id,display_name)
-- select id,'Beth' from auth.users where email='beth@example.com'
-- on conflict (user_id) do update set display_name=excluded.display_name;
