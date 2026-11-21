-- Wine Journal V2 integration checks. Designed to run after schema migrations
-- inside a transaction that MUST end in ROLLBACK. Do not execute standalone.
select set_config('wj.test_owner',(select m.user_id::text from public.wine_members m limit 1),true);
select set_config('wj.test_bob',gen_random_uuid()::text,true);
select set_config('wj.test_eve',gen_random_uuid()::text,true);
insert into auth.users(id) values(current_setting('wj.test_bob')::uuid),(current_setting('wj.test_eve')::uuid);
select set_config('request.jwt.claim.sub',current_setting('wj.test_owner'),true);
set local role authenticated;
select set_config('wj.test_journal_a',public.wj_create_journal('V2 SQL Smoke A')::text,true);
insert into public.wines(name,grape,created_by,journal_id)
values('V2 test bottle','Shiraz',current_setting('wj.test_owner')::uuid,current_setting('wj.test_journal_a')::uuid);
select set_config('wj.test_wine',(select id::text from public.wines where name='V2 test bottle' limit 1),true);
insert into public.wine_reviews(wine_id,reviewer_id,score,notes)
values(current_setting('wj.test_wine')::uuid,current_setting('wj.test_owner')::uuid,88,'test');
select set_config('wj.test_code',(select invitation_code from public.wj_create_invitation(current_setting('wj.test_journal_a')::uuid)),true);
do $checks$
begin
 if (select count(*) from public.wines where journal_id=current_setting('wj.test_journal_a')::uuid)<>1 then
   raise exception 'Owner cannot see own private bottle'; end if;
 if (select count(*) from public.journal_members where journal_id=current_setting('wj.test_journal_a')::uuid)<>1 then
   raise exception 'Owner membership missing'; end if;
end $checks$;

reset role;
select set_config('request.jwt.claim.sub','',true);
set local role anon;
do $checks$
begin
 if exists(select 1 from public.wines where journal_id=current_setting('wj.test_journal_a')::uuid) then
   raise exception 'Anonymous account can read private wine'; end if;
 if not exists(select 1 from public.wines where journal_id<>current_setting('wj.test_journal_a')::uuid) then
   raise exception 'Legacy public wine is no longer readable'; end if;
 if (select count(*) from public.wj_preview_invitation(current_setting('wj.test_code')))<>1 then
   raise exception 'Valid invitation preview fails anonymously'; end if;
end $checks$;

reset role;
select set_config('request.jwt.claim.sub',current_setting('wj.test_bob'),true);
set local role authenticated;
select set_config('wj.test_journal_b',public.wj_create_journal('V2 SQL Smoke B')::text,true);
do $checks$
begin
 if exists(select 1 from public.wines where journal_id=current_setting('wj.test_journal_a')::uuid) then
   raise exception 'Nonmember can see private journal A'; end if;
 if exists(select 1 from public.journal_members where journal_id=current_setting('wj.test_journal_a')::uuid) then
   raise exception 'Nonmember can list private memberships'; end if;
end $checks$;
select public.wj_redeem_invitation(current_setting('wj.test_code'));
do $checks$
begin
 if (select count(*) from public.wines where journal_id=current_setting('wj.test_journal_a')::uuid)<>1 then
   raise exception 'Joined user cannot read private journal A'; end if;
 if (select count(*) from public.journals where id in (current_setting('wj.test_journal_a')::uuid,current_setting('wj.test_journal_b')::uuid))<>2 then
   raise exception 'Joining removed a previous journal'; end if;
end $checks$;
insert into public.wine_reviews(wine_id,reviewer_id,score,notes)
values(current_setting('wj.test_wine')::uuid,current_setting('wj.test_bob')::uuid,99,'second opinion');
do $checks$
begin
 if (select count(*) from public.wine_reviews where wine_id=current_setting('wj.test_wine')::uuid)<>2 then
   raise exception 'Independent reviews failed'; end if;
end $checks$;
update public.wine_reviews set score=1 where wine_id=current_setting('wj.test_wine')::uuid
and reviewer_id=current_setting('wj.test_owner')::uuid;
do $checks$
begin
 if (select score from public.wine_reviews where wine_id=current_setting('wj.test_wine')::uuid and reviewer_id=current_setting('wj.test_owner')::uuid)<>88 then
  raise exception 'Review can be edited without opt-in'; end if;
end $checks$;

reset role;
select set_config('request.jwt.claim.sub',current_setting('wj.test_owner'),true);
set local role authenticated;
update public.journal_members set allow_member_edits=true
where journal_id=current_setting('wj.test_journal_a')::uuid and user_id=current_setting('wj.test_owner')::uuid;
reset role;
select set_config('request.jwt.claim.sub',current_setting('wj.test_bob'),true);
set local role authenticated;
update public.wine_reviews set score=87 where wine_id=current_setting('wj.test_wine')::uuid
and reviewer_id=current_setting('wj.test_owner')::uuid;
do $checks$
begin
 if (select score from public.wine_reviews where wine_id=current_setting('wj.test_wine')::uuid and reviewer_id=current_setting('wj.test_owner')::uuid)<>87 then
  raise exception 'Opt-in delegated review editing failed'; end if;
end $checks$;

reset role;
select set_config('request.jwt.claim.sub',current_setting('wj.test_eve'),true);
set local role authenticated;
do $checks$
begin
 begin
  perform public.wj_redeem_invitation(current_setting('wj.test_code'));
  raise exception 'Reused invitation unexpectedly worked';
 exception when others then
  if SQLERRM='Reused invitation unexpectedly worked' then raise; end if;
 end;
 if exists(select 1 from public.wines where journal_id=current_setting('wj.test_journal_a')::uuid) then
  raise exception 'Uninvited account can read private journal A'; end if;
end $checks$;

reset role;
select set_config('request.jwt.claim.sub',current_setting('wj.test_owner'),true);
set local role authenticated;
select set_config('wj.test_revoked_invite',(select row_to_json(i)::text from public.wj_create_invitation(current_setting('wj.test_journal_a')::uuid) i),true);
select public.wj_revoke_invitation((current_setting('wj.test_revoked_invite')::json->>'invitation_id')::uuid);
reset role;
select set_config('request.jwt.claim.sub',current_setting('wj.test_eve'),true);
set local role authenticated;
do $checks$
begin
 begin
  perform public.wj_redeem_invitation(current_setting('wj.test_revoked_invite')::json->>'invitation_code');
  raise exception 'Revoked invitation unexpectedly worked';
 exception when others then
  if SQLERRM='Revoked invitation unexpectedly worked' then raise; end if;
 end;
end $checks$;

reset role;
select 'PASS: isolated journals, anon and member RLS, two reviews, edit opt-in, one-use and revocation' as result;
rollback;