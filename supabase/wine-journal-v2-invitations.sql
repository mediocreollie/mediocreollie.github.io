-- WINE JOURNAL V2: SERVER-VALIDATED ACCOUNTS AND INVITATIONS
-- Apply only AFTER wine-journal-v2-foundation.sql and backup/RLS verification.
-- This file does NOT enable a public signup screen or change the live website.
-- Invitations are 128-bit random tokens, hashed at rest, one-use, revocable,
-- scoped to ONE journal and expired after seven days. Only managers can issue.

begin;

-- Supabase Auth remains the authentication provider. This RPC only creates
-- the signed-in user's own public-facing profile, not a new auth account.
create function public.wj_save_profile(p_display_name text)
returns void language plpgsql security definer set search_path='' as $$
declare v_user uuid := (select auth.uid()); v_name text:=btrim(p_display_name);
begin
  if v_user is null then raise exception 'Sign in first'; end if;
  if v_name is null or length(v_name) not between 1 and 60 then
    raise exception 'Display name must be 1 to 60 characters';
  end if;
  insert into public.profiles(user_id,display_name)
  values(v_user,v_name)
  on conflict(user_id) do update
    set display_name=excluded.display_name,updated_at=now();
  -- Keep the original website's reviewer names aligned during migration.
  update public.wine_members set display_name=v_name where user_id=v_user;
end $$;

create function public.wj_create_journal(p_name text)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_user uuid:=(select auth.uid()); v_id uuid; v_name text:=btrim(p_name);
begin
  if v_user is null then raise exception 'Sign in first'; end if;
  if v_name is null or length(v_name) not between 1 and 100 then
    raise exception 'Journal name must be 1 to 100 characters';
  end if;
  -- Keep new journals PRIVATE, with no automatic public browsing.
  insert into public.journals(name,owner_id,visibility)
  values(v_name,v_user,'private') returning id into v_id;
  insert into public.journal_members(journal_id,user_id,role)
  values(v_id,v_user,'owner');
  insert into public.profiles(user_id,display_name)
  values(v_user,'Wine lover') on conflict(user_id) do nothing;
  return v_id;
end $$;

-- Owner/admin sees pending, used, expired and revoked codes by METADATA only.
-- The actual code is never stored or recoverable. Generate a new one to share.
create function public.wj_list_invitations(p_journal uuid)
returns table(invitation_id uuid,created_at timestamptz,expires_at timestamptz,
  redeemed_at timestamptz,revoked_at timestamptz)
language plpgsql stable security definer set search_path='' as $$
begin
  if not public.wj_is_manager(p_journal) then raise exception 'Not permitted'; end if;
  return query
    select i.id,i.created_at,i.expires_at,i.redeemed_at,i.revoked_at
    from public.journal_invitations i where i.journal_id=p_journal
    order by i.created_at desc;
end $$;

create function public.wj_create_invitation(p_journal uuid)
returns table(invitation_id uuid,invitation_code text,expires_at timestamptz)
language plpgsql security definer set search_path='' as $$
declare
  v_code text; v_invitation_id uuid; v_expiry timestamptz;
begin
  if (select auth.uid()) is null or not public.wj_is_manager(p_journal) then
    raise exception 'Only journal owners or admins can invite';
  end if;
  v_code:=encode(extensions.gen_random_bytes(16),'hex');
  insert into public.journal_invitations(journal_id,code_hash,created_by)
  values(p_journal,encode(extensions.digest(v_code,'sha256'),'hex'),(select auth.uid()))
  returning id,public.journal_invitations.expires_at
  into v_invitation_id,v_expiry;
  return query select v_invitation_id,v_code,v_expiry;
end $$;

-- A code can reveal only the name of the invited journal and its owner.
-- There is deliberately no public invitation table SELECT grant.
create function public.wj_preview_invitation(p_code text)
returns table(journal_id uuid,journal_name text,owner_name text,expires_at timestamptz)
language plpgsql stable security definer set search_path='' as $$
declare v_code text:=lower(btrim(p_code));
begin
  if v_code is null or v_code !~ '^[0-9a-f]{32}$' then return; end if;
  return query
    select j.id,j.name,coalesce(p.display_name,'Journal owner'),i.expires_at
    from public.journal_invitations i
    join public.journals j on j.id=i.journal_id
    left join public.profiles p on p.user_id=j.owner_id
    where i.code_hash=encode(extensions.digest(v_code,'sha256'),'hex')
      and i.revoked_at is null and i.redeemed_at is null
      and i.expires_at>now();
end $$;

-- Redemption locks the invitation row, so two concurrent requests cannot
-- redeem the same code. Membership and consumption commit atomically.
create function public.wj_redeem_invitation(p_code text)
returns uuid language plpgsql security definer set search_path='' as $$
declare
  v_user uuid:=(select auth.uid());
  v_code text:=lower(btrim(p_code));
  v_inv public.journal_invitations%rowtype;
begin
  if v_user is null then raise exception 'Sign in to join a journal'; end if;
  if v_code is null or v_code !~ '^[0-9a-f]{32}$' then
    raise exception 'Invalid invitation code';
  end if;
  select * into v_inv from public.journal_invitations
  where code_hash=encode(extensions.digest(v_code,'sha256'),'hex')
  for update;
  if not found then raise exception 'Invalid invitation code'; end if;
  if v_inv.revoked_at is not null then raise exception 'Invitation revoked'; end if;
  if v_inv.expires_at<=now() then raise exception 'Invitation expired'; end if;
  if v_inv.redeemed_at is not null then raise exception 'Invitation already used'; end if;

  -- Existing members need not consume another invitation.
  if exists(select 1 from public.journal_members
    where journal_id=v_inv.journal_id and user_id=v_user) then
    return v_inv.journal_id;
  end if;

  insert into public.journal_members(journal_id,user_id,role)
  values(v_inv.journal_id,v_user,'member');
  insert into public.profiles(user_id,display_name)
  values(v_user,'Wine lover') on conflict(user_id) do nothing;
  update public.journal_invitations
    set redeemed_by=v_user,redeemed_at=now() where id=v_inv.id;
  return v_inv.journal_id;
end $$;

create function public.wj_revoke_invitation(p_invitation uuid)
returns boolean language plpgsql security definer set search_path='' as $$
declare v_journal uuid;
begin
  select i.journal_id into v_journal from public.journal_invitations i
  where i.id=p_invitation;
  if v_journal is null or not public.wj_is_manager(v_journal) then
    raise exception 'Not permitted';
  end if;
  update public.journal_invitations set revoked_at=now()
    where id=p_invitation and redeemed_at is null and revoked_at is null;
  return found;
end $$;

-- Revoke default public function execution, then grant only intended APIs.
revoke all on function public.wj_save_profile(text) from public;
revoke all on function public.wj_create_journal(text) from public;
revoke all on function public.wj_list_invitations(uuid) from public;
revoke all on function public.wj_create_invitation(uuid) from public;
revoke all on function public.wj_preview_invitation(text) from public;
revoke all on function public.wj_redeem_invitation(text) from public;
revoke all on function public.wj_revoke_invitation(uuid) from public;
grant execute on function public.wj_save_profile(text),
 public.wj_create_journal(text),public.wj_list_invitations(uuid),
 public.wj_create_invitation(uuid),public.wj_redeem_invitation(text),
 public.wj_revoke_invitation(uuid) to authenticated;
grant execute on function public.wj_preview_invitation(text) to anon,authenticated;

commit;
