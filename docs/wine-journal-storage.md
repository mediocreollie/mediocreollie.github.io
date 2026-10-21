# Wine Journal: shared storage setup

## Current state (October 2026)
The site at `/wine-journal/` uses Supabase Auth, Postgres, and private Storage, rather than localStorage. The frontend contains sign-in, wine catalogue, individual per-user reviews, keyword tags, private photo uploads and signed photo URLs.

The Supabase project URL and public publishable key are configured in `public/wine-journal/index.html`. Never commit a service-role or secret key.

Ollie's Auth account and corresponding `wine_members` profile have been confirmed through the Supabase SQL Editor. Beth's membership, all row-level security policies, the private `wine-photos` bucket, and end-to-end two-device behaviour have **not yet been independently verified**.

## Next checks
1. Run `supabase/wine-journal-verify.sql` in the Supabase SQL Editor (read-only).
2. Confirm that the wine tables exist, RLS is enabled, policies exist, and the `wine-photos` bucket is private.
3. Confirm Beth has a Supabase Auth user and a `wine_members` row.
4. Sign in on the website, create a test wine, save a review, upload a photo, then check it appears after reloading.
5. Test Beth's separate account and review on a second device, and verify anonymous visitors cannot read private data.

The existing `supabase/wine-journal.sql` is the original setup migration, **not** a safe repeatable verification script. Do not rerun it merely to check status.

## Data model
- `wines`: bottle metadata and optional photo path
- `wine_reviews`: separate score, notes and tags for each reviewer
- `wine_members`: authorised accounts with display names
- `wine-photos`: private storage bucket

Never store private photos or reviews in the public GitHub repository.
