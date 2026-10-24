-- One-time conversion of existing wine scores from /10 to /100.
-- Preserves the relative value of existing ratings (6/10 becomes 60/100).
-- Run this in Supabase SQL Editor once, not repeatedly.
begin;
do $$
declare c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid='public.wine_reviews'::regclass
      and contype='c'
      and pg_get_constraintdef(oid) ~* '(score)'
  loop
    execute format('alter table public.wine_reviews drop constraint %I',c.conname);
  end loop;
end $$;
update public.wine_reviews set score=score*10 where score is not null;
alter table public.wine_reviews
  add constraint wine_reviews_score_1_100 check (score is null or (score between 1 and 100 and score=trunc(score)));
commit;
