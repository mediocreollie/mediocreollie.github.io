-- Wine Journal profiles and delegated review editing.
-- Existing reviews and wine entries are preserved.
alter table public.wine_members
  add column if not exists display_name text,
  add column if not exists allow_member_edits boolean not null default false;
-- Remove hardcoded default reviewer names; existing Ollie name is retained.
-- Each invited member sets their own display_name after login.
grant select (user_id,display_name,allow_member_edits) on public.wine_members to anon, authenticated;
grant update (display_name,allow_member_edits) on public.wine_members to authenticated;
drop policy if exists "Members update own settings" on public.wine_members;
create policy "Members update own settings" on public.wine_members
  for update to authenticated
  using (user_id=(select auth.uid()))
  with check (user_id=(select auth.uid()));
-- Supabase requires SELECT visibility for UPDATE. Existing public reviewer
-- display-name SELECT policy already provides that.
drop policy if exists "Own review update" on public.wine_reviews;
create policy "Own or permitted member review update" on public.wine_reviews
  for update to authenticated
  using (
    exists(select 1 from public.wine_members actor where actor.user_id=(select auth.uid()))
    and (
      reviewer_id=(select auth.uid())
      or exists(select 1 from public.wine_members owner
        where owner.user_id=reviewer_id and owner.allow_member_edits=true)
    )
  )
  with check (
    exists(select 1 from public.wine_members actor where actor.user_id=(select auth.uid()))
    and (
      reviewer_id=(select auth.uid())
      or exists(select 1 from public.wine_members owner
        where owner.user_id=reviewer_id and owner.allow_member_edits=true)
    )
  );
-- Delegate INSERT is intentionally not granted: only the reviewer may create
-- their first review. Delegate UPDATE applies to existing reviews only.
-- Delegated deletion is not granted.
