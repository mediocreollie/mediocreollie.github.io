-- WINE JOURNAL V2 FOUNDATION (DRAFT, NOT RUN AGAINST PRODUCTION)
-- Prerequisites: verified backup of Postgres AND wine-photos storage; review
-- wine-journal-v2-preflight.sql output; choose correct existing owner UUID.
-- Set v_owner below before running. Run ONCE in one Supabase SQL transaction.
-- Do NOT enable public signup until the invitations migration, UI and RLS tests
-- have also passed. The existing public read-only journal remains public.
begin;
create extension if not exists pgcrypto;

-- Compatibility with older installs whose profile-settings SQL was not run.
alter table public.wine_members add column if not exists display_name text;
alter table public.wine_members add column if not exists allow_member_edits boolean not null default false;

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check(length(btrim(display_name)) between 1 and 60),
  updated_at timestamptz not null default now()
);
create table public.journals (
  id uuid primary key default gen_random_uuid(),
  slug text unique,
  name text not null check(length(btrim(name)) between 1 and 100),
  owner_id uuid not null references auth.users(id),
  visibility text not null default 'private' check(visibility in ('private','public')),
  created_at timestamptz not null default now()
);
create table public.journal_members (
  journal_id uuid not null references public.journals(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check(role in ('owner','admin','member')),
  allow_member_edits boolean not null default false,
  joined_at timestamptz not null default now(),
  primary key(journal_id,user_id)
);
create index journal_members_by_user on public.journal_members(user_id,journal_id);
create table public.journal_invitations (
  id uuid primary key default gen_random_uuid(),
  journal_id uuid not null references public.journals(id) on delete cascade,
  code_hash text not null unique,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default(now()+interval '7 days'),
  redeemed_by uuid references auth.users(id),
  redeemed_at timestamptz,
  revoked_at timestamptz,
  check(expires_at > created_at)
);
create index journal_invitations_by_journal on public.journal_invitations(journal_id,created_at desc);

-- Use an explicit owner chosen from the preflight results. No guessing
-- based on which account created the first wine.
do $migration$
declare
  v_owner uuid := null; -- REPLACE null with 'EXISTING_OWNER_UUID'::uuid
  v_legacy uuid;
begin
  if v_owner is null or not exists (
    select 1 from public.wine_members where user_id=v_owner
  ) then
    raise exception 'Set v_owner to an existing, approved wine_members user UUID. Nothing was migrated.';
  end if;
  if exists(select 1 from public.wines w
       where not exists(select 1 from public.wine_members m where m.user_id=w.created_by))
     or exists(select 1 from public.wine_reviews r
       where not exists(select 1 from public.wine_members m where m.user_id=r.reviewer_id)) then
    raise exception 'Orphan wine creator/reviewer: reconcile the preflight output first.';
  end if;

  insert into public.journals(slug,name,owner_id,visibility)
  values('legacy-wine-journal','Our Wine Journal',v_owner,'public')
  returning id into v_legacy;

  insert into public.profiles(user_id,display_name)
  select m.user_id,coalesce(nullif(btrim(m.display_name),''),'Wine member')
  from public.wine_members m;

  insert into public.journal_members(journal_id,user_id,role,allow_member_edits)
  select v_legacy,m.user_id,case when m.user_id=v_owner then 'owner' else 'member' end,
         m.allow_member_edits
  from public.wine_members m;

  alter table public.wines add column journal_id uuid references public.journals(id);
  update public.wines set journal_id=v_legacy;
  alter table public.wines alter column journal_id set not null;

  -- The original frontend does not supply journal_id. Its writes must still
  -- go to the old collection until the multi-journal UI is deployed.
  execute format('alter table public.wines alter column journal_id set default %L::uuid',v_legacy);
end
$migration$;

-- Prevent existing generic UPDATE grants from moving wines across journals
-- or changing ownership, while preserving compatibility with old UI payloads.
create function public.wj_immutable_wine_identity()
returns trigger language plpgsql set search_path='' as $$
begin
  if new.id is distinct from old.id or new.journal_id is distinct from old.journal_id
     or new.created_by is distinct from old.created_by then
    raise exception 'Changing wine ownership or journal is not allowed';
  end if;
  return new;
end $$;
create trigger wj_immutable_wine_identity before update on public.wines
for each row execute function public.wj_immutable_wine_identity();

-- Helpers are security-definer to avoid recursive journal membership RLS.
-- They return booleans only and never reveal membership tables as raw data.
create function public.wj_is_member(p_journal uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select (select auth.uid()) is not null and exists(
    select 1 from public.journal_members m
    where m.journal_id=p_journal and m.user_id=(select auth.uid()));
$$;
create function public.wj_is_manager(p_journal uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select (select auth.uid()) is not null and exists(
    select 1 from public.journal_members m
    where m.journal_id=p_journal and m.user_id=(select auth.uid())
      and m.role in ('owner','admin'));
$$;
create function public.wj_can_read(p_journal uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select exists(
    select 1 from public.journals j where j.id=p_journal
      and (j.visibility='public' or exists(
        select 1 from public.journal_members m where m.journal_id=j.id
          and m.user_id=(select auth.uid()))));
$$;
create function public.wj_can_edit_review(p_wine uuid,p_reviewer uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select exists(
    select 1 from public.wines w
    join public.journal_members actor on actor.journal_id=w.journal_id
      and actor.user_id=(select auth.uid())
    where w.id=p_wine
      and (p_reviewer=(select auth.uid()) or exists(
        select 1 from public.journal_members author
        where author.journal_id=w.journal_id and author.user_id=p_reviewer
          and author.allow_member_edits=true)));
$$;
revoke all on function public.wj_is_member(uuid) from public;
revoke all on function public.wj_is_manager(uuid) from public;
revoke all on function public.wj_can_read(uuid) from public;
revoke all on function public.wj_can_edit_review(uuid,uuid) from public;
grant execute on function public.wj_is_member(uuid),public.wj_is_manager(uuid),
 public.wj_can_edit_review(uuid,uuid) to authenticated;
grant execute on function public.wj_can_read(uuid) to anon,authenticated;

alter table public.profiles enable row level security;
alter table public.journals enable row level security;
alter table public.journal_members enable row level security;
alter table public.journal_invitations enable row level security;

-- Anyone may see member names in a PUBLIC journal, otherwise co-members only.
create policy "Visible profiles" on public.profiles for select to anon,authenticated
using (user_id=(select auth.uid()) or exists(
  select 1 from public.journal_members m where m.user_id=profiles.user_id
    and public.wj_can_read(m.journal_id)));
create policy "Visible journals" on public.journals for select to anon,authenticated
using (public.wj_can_read(id));
create policy "Members see their journal membership" on public.journal_members for select to authenticated
using (public.wj_is_member(journal_id));
create policy "Members update their editing preference" on public.journal_members for update to authenticated
using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));
-- No INSERT/DELETE on journal_members or journal_invitations to browser clients.
-- Only trusted database functions can add membership or issue invites.
create policy "Managers edit journal details" on public.journals for update to authenticated
using (public.wj_is_manager(id)) with check (public.wj_is_manager(id));

grant select on public.profiles,public.journals to anon,authenticated;
grant select on public.journal_members to authenticated;
grant update(allow_member_edits) on public.journal_members to authenticated;
grant update(name,visibility) on public.journals to authenticated;

-- Replace single-global-collection RLS: no old permissive policy may remain.
drop policy if exists "Members read wines" on public.wines;
drop policy if exists "Public read wines" on public.wines;
drop policy if exists "Members insert wines" on public.wines;
drop policy if exists "Members edit wines" on public.wines;
drop policy if exists "Members delete wines" on public.wines;
create policy "Journal wine read" on public.wines for select to anon,authenticated
using (public.wj_can_read(journal_id));
create policy "Journal wine add" on public.wines for insert to authenticated
with check (created_by=(select auth.uid()) and public.wj_is_member(journal_id));
create policy "Journal wine edit" on public.wines for update to authenticated
using (public.wj_is_member(journal_id)) with check (public.wj_is_member(journal_id));
-- Preserve current shared editing/deletion behaviour for existing collection.
-- Revisit permanent deletion and owner controls in the permissions milestone.
create policy "Journal wine delete" on public.wines for delete to authenticated
using (public.wj_is_member(journal_id));

drop policy if exists "Members read reviews" on public.wine_reviews;
drop policy if exists "Public read reviews" on public.wine_reviews;
drop policy if exists "Own review insert" on public.wine_reviews;
drop policy if exists "Own review update" on public.wine_reviews;
drop policy if exists "Own or permitted member review update" on public.wine_reviews;
drop policy if exists "Own review delete" on public.wine_reviews;
create policy "Journal review read" on public.wine_reviews for select to anon,authenticated
using (exists(select 1 from public.wines w where w.id=wine_id
  and public.wj_can_read(w.journal_id)));
create policy "Journal own review insert" on public.wine_reviews for insert to authenticated
with check (reviewer_id=(select auth.uid()) and exists(
 select 1 from public.wines w where w.id=wine_id and public.wj_is_member(w.journal_id)));
create policy "Journal review edit" on public.wine_reviews for update to authenticated
using (public.wj_can_edit_review(wine_id,reviewer_id))
with check (public.wj_can_edit_review(wine_id,reviewer_id));
create policy "Journal own review delete" on public.wine_reviews for delete to authenticated
using (reviewer_id=(select auth.uid()) and exists(
 select 1 from public.wines w where w.id=wine_id and public.wj_is_member(w.journal_id)));

-- Restrict review edits to content columns so identity cannot be rewritten.
revoke update on public.wine_reviews from authenticated;
grant update(score,notes,tags) on public.wine_reviews to authenticated;

-- Legacy settings UI still writes wine_members; propagate its edits so
-- delegated review permissions and names remain in sync during the transition.
create function public.wj_sync_legacy_settings()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  insert into public.profiles(user_id,display_name)
    values(new.user_id,coalesce(nullif(btrim(new.display_name),''),'Wine member'))
    on conflict(user_id) do update set display_name=excluded.display_name,updated_at=now();
  update public.journal_members jm
   set allow_member_edits=new.allow_member_edits
   from public.journals j
   where jm.journal_id=j.id and j.slug='legacy-wine-journal'
     and jm.user_id=new.user_id;
  return new;
end $$;
create trigger wj_sync_legacy_settings after update of display_name,allow_member_edits
on public.wine_members for each row execute function public.wj_sync_legacy_settings();

-- A separate PRIVATE bucket is mandatory for any new private journal.
-- Never put private-journal photos in the legacy publicly readable wine-photos bucket.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('wine-private-photos','wine-private-photos',false,5242880,
  array['image/jpeg','image/png','image/webp'])
on conflict(id) do nothing;

-- File paths must be journal_uuid/wine_uuid/filename.
create function public.wj_photo_journal_id(p_path text)
returns uuid language plpgsql immutable set search_path='' as $$
declare v_id text:=split_part(p_path,'/',1);
begin
  if v_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and split_part(p_path,'/',2) <> '' and split_part(p_path,'/',3) <> '' then
    return v_id::uuid;
  end if;
  return null;
end $$;
revoke all on function public.wj_photo_journal_id(text) from public;
grant execute on function public.wj_photo_journal_id(text) to anon,authenticated;
create policy "Journal photo read" on storage.objects for select to anon,authenticated
using(bucket_id='wine-private-photos'
  and public.wj_can_read(public.wj_photo_journal_id(name)));
create policy "Journal photo upload" on storage.objects for insert to authenticated
with check(bucket_id='wine-private-photos'
  and public.wj_is_member(public.wj_photo_journal_id(name)));
create policy "Journal photo delete" on storage.objects for delete to authenticated
using(bucket_id='wine-private-photos' and owner_id=(select auth.uid())::text
  and public.wj_is_member(public.wj_photo_journal_id(name)));

-- Commit only after all RLS/policy changes succeed. No signup is enabled here.
commit;
