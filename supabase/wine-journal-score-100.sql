-- Run once for the new 1-100 scoring scale.
-- Preserves existing test ratings as they are; no multiplication.
-- Important: the original numeric(3,1) type cannot hold 100.
begin;
alter table public.wine_reviews alter column score type numeric(5,1);
do $$
declare c record;
begin
 for c in select conname from pg_constraint
  where conrelid='public.wine_reviews'::regclass and contype='c'
    and pg_get_constraintdef(oid) ~* 'score'
 loop
  execute format('alter table public.wine_reviews drop constraint %I',c.conname);
 end loop;
end $$;
alter table public.wine_reviews
 add constraint wine_reviews_score_1_100
 check (score is null or (score between 1 and 100 and score=trunc(score)));
commit;
