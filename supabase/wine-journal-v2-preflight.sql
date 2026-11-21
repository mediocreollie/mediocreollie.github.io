-- WINE JOURNAL V2: READ-ONLY PRODUCTION PREFLIGHT
-- Run in the current Supabase project's SQL editor BEFORE any v2 migration.
-- Only SELECT queries. Save the output privately. No user data is changed.
-- Do not share Auth UUIDs or any private production output publicly.

-- 1. Existing rows to preserve, and identify the intended legacy owner.
select 'wines' as entity, count(*)::bigint as rows from public.wines
union all select 'reviews', count(*) from public.wine_reviews
union all select 'approved_members', count(*) from public.wine_members;
select m.user_id, to_jsonb(m)->>'display_name' as display_name,
       to_jsonb(m)->>'allow_member_edits' as allow_member_edits,
       (select count(*) from public.wines w where w.created_by=m.user_id) as wines_created,
       (select count(*) from public.wine_reviews r where r.reviewer_id=m.user_id) as reviews_written
from public.wine_members m
order by m.user_id;

-- 2. Current table columns, pgcrypto location and score constraints.
select e.extname,n.nspname as extension_schema
from pg_extension e join pg_namespace n on n.oid=e.extnamespace
where e.extname='pgcrypto';
select table_name,column_name,data_type,is_nullable,column_default
from information_schema.columns
where table_schema='public' and table_name in
 ('wines','wine_reviews','wine_members','journals','journal_members','profiles','journal_invitations')
order by table_name,ordinal_position;
select conrelid::regclass::text as table_name, conname, pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid in ('public.wines'::regclass,'public.wine_reviews'::regclass,'public.wine_members'::regclass)
order by table_name,conname;
select count(*) filter (where score is not null and
    (score < 1 or score > 100 or score <> trunc(score))) as invalid_score_rows,
       min(score) as lowest_score, max(score) as highest_score
from public.wine_reviews;

-- 3. Active RLS policies and permission grants (may differ from repository SQL).
select schemaname,tablename,policyname,roles,cmd,qual,with_check
from pg_policies
where (schemaname='public' and tablename in
 ('wines','wine_reviews','wine_members','journals','journal_members','profiles','journal_invitations'))
 or (schemaname='storage' and tablename='objects')
order by schemaname,tablename,policyname;
select grantee,table_name,privilege_type
from information_schema.role_table_grants
where table_schema='public' and table_name in ('wines','wine_reviews','wine_members')
 and grantee in ('anon','authenticated')
order by table_name,grantee,privilege_type;

-- 4. Storage bucket visibility and existing object counts.
select b.id,b.public,b.file_size_limit,b.allowed_mime_types,
       (select count(*) from storage.objects o where o.bucket_id=b.id) as object_count
from storage.buckets b where b.id in ('wine-photos','wine-private-photos');

-- 5. Orphan checks before any migration.
select count(*) as reviews_without_wines
from public.wine_reviews r left join public.wines w on w.id=r.wine_id
where w.id is null;
select count(*) as wines_whose_creator_is_not_approved
from public.wines w left join public.wine_members m on m.user_id=w.created_by
where m.user_id is null;
select count(*) as reviews_by_non_approved_users
from public.wine_reviews r left join public.wine_members m on m.user_id=r.reviewer_id
where m.user_id is null;

-- Stop here. Before a migration, take a verified database and storage backup,
-- select the intended owner UUID, and review all unexpected results.
