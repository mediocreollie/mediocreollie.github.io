-- Run in the Supabase SQL editor for a private two-person wine journal.
-- Add both users to the auth.users table by inviting them through Supabase Auth.
create extension if not exists pgcrypto;
create table if not exists public.wines (
 id uuid primary key default gen_random_uuid(),
 name text not null,
 producer text,
 grape text not null,
 vintage integer,
 region text,
 photo_path text,
 created_by uuid not null references auth.users(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table if not exists public.wine_reviews (
 wine_id uuid not null references public.wines(id) on delete cascade,
 reviewer_id uuid not null references auth.users(id),
 score numeric(3,1) check (score between 0 and 10),
 notes text not null default '',
 tags text[] not null default '{}',
 primary key (wine_id, reviewer_id)
);
-- Only allow accounts explicitly added to this list.
create table if not exists public.wine_members (
 user_id uuid primary key references auth.users(id) on delete cascade
);
alter table public.wine_members enable row level security;
alter table public.wines enable row level security;
alter table public.wine_reviews enable row level security;
create policy "Members can see their own membership" on public.wine_members
 for select to authenticated using (user_id = (select auth.uid()));
create policy "Members read wines" on public.wines for select to authenticated
 using (exists(select 1 from public.wine_members m where m.user_id=(select auth.uid())));
create policy "Members insert wines" on public.wines for insert to authenticated
 with check (created_by=(select auth.uid()) and exists(select 1 from public.wine_members m where m.user_id=(select auth.uid())));
create policy "Members edit wines" on public.wines for update to authenticated
 using (exists(select 1 from public.wine_members m where m.user_id=(select auth.uid())))
 with check (exists(select 1 from public.wine_members m where m.user_id=(select auth.uid())));
create policy "Members delete wines" on public.wines for delete to authenticated
 using (exists(select 1 from public.wine_members m where m.user_id=(select auth.uid())));
create policy "Members read reviews" on public.wine_reviews for select to authenticated
 using (exists(select 1 from public.wine_members m where m.user_id=(select auth.uid())));
create policy "Own review insert" on public.wine_reviews for insert to authenticated
 with check (reviewer_id=(select auth.uid()) and exists(select 1 from public.wine_members m where m.user_id=(select auth.uid())));
create policy "Own review update" on public.wine_reviews for update to authenticated
 using (reviewer_id=(select auth.uid())) with check (reviewer_id=(select auth.uid()));
create policy "Own review delete" on public.wine_reviews for delete to authenticated
 using (reviewer_id=(select auth.uid()));
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
 values ('wine-photos','wine-photos',false,5242880,array['image/jpeg','image/png','image/webp'])
 on conflict (id) do nothing;
create policy "Members view photos" on storage.objects for select to authenticated
 using (bucket_id='wine-photos' and exists(select 1 from public.wine_members m where m.user_id=(select auth.uid())));
create policy "Members upload photos" on storage.objects for insert to authenticated
 with check (bucket_id='wine-photos' and exists(select 1 from public.wine_members m where m.user_id=(select auth.uid())));
create policy "Members update photos" on storage.objects for update to authenticated
 using (bucket_id='wine-photos' and exists(select 1 from public.wine_members m where m.user_id=(select auth.uid())));
create policy "Members delete photos" on storage.objects for delete to authenticated
 using (bucket_id='wine-photos' and exists(select 1 from public.wine_members m where m.user_id=(select auth.uid())));
-- Once both accounts exist, run (replace UUID placeholders):
-- insert into public.wine_members(user_id) values ('FIRST_USER_UUID'),('SECOND_USER_UUID');
