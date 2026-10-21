# Wine Journal: shared storage setup

The first prototype at `/wine-journal/` saves to browser localStorage. This is NOT shared across devices.

## Planned backend

Supabase Auth, Postgres and private Supabase Storage. The SQL schema in `supabase/wine-journal.sql` creates a members-only wine catalogue, individual per-user reviews and a private photo bucket.

1. Create a Supabase project. Use the free tier if it meets your needs.
2. Run `supabase/wine-journal.sql` in its SQL Editor.
3. Configure email sign-in and the website URL in Auth URL configuration.
4. Invite the two reviewers, then add their Auth user UUIDs to `public.wine_members` as shown at the end of the SQL.
5. Add the **public project URL** and **publishable/anon key** to the website configuration when wiring the frontend. Never commit a service-role or secret key.
6. Implement frontend authentication, per-reviewer writes, photo upload and signed image retrieval, and migration from the prototype's local data.
7. Test on two devices and verify anonymous visitors cannot read photos or reviews before enabling shared mode.

**Status:** Backend schema prepared only. No Supabase project has been connected, and the current website still uses local browser storage. Do not treat the journal as a secure shared app until the above is completed.

## Data model

- `wines`: one bottle with metadata and optional photo path
- `wine_reviews`: separate score, notes and tags for each reviewer
- `wine_members`: explicit access list for the two authorised accounts
- `storage.objects` bucket `wine-photos`: private photographs

Important: Never use the public GitHub repository or GitHub Pages itself as a store for private wine photos or private reviews.
