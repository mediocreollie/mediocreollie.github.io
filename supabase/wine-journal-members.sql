-- Apply after wine-journal.sql, or add these statements before use.
alter table public.wine_members add column if not exists display_name text;
-- Assign names for the two invited user UUIDs:
-- update public.wine_members set display_name='Ollie' where user_id='FIRST_USER_UUID';
-- update public.wine_members set display_name='Beth' where user_id='SECOND_USER_UUID';
