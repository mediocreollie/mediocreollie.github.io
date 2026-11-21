# Wine Journal V2: Staging and Release Gates

**Status (21 November 2026):** Implementation branch only. None of the SQL in this branch has been executed against production. The existing page at `/wine-journal/` has not been replaced. The V2 beta lives separately at `/wine-journal/beta.html` and MUST NOT be advertised or enabled for general signup before the gates below pass.

## Implementation in this branch

| Component | File | Status |
| --- | --- | --- |
| Read-only inventory | `supabase/wine-journal-v2-preflight.sql` | Written, not run in production |
| Journals, profiles, membership, scoped RLS, private photo bucket | `supabase/wine-journal-v2-foundation.sql` | Written, not deployed or DB-tested |
| Create journal, register profile, issue/preview/redeem/revoke invitations | `supabase/wine-journal-v2-invitations.sql` | Written, not deployed or DB-tested |
| Separate V2 beta interface | `public/wine-journal/beta.html` | Written, not live-tested |
| Current production UI | `public/wine-journal/index.html` | Untouched |

## Production read-only findings (21 November 2026)

The matching live Supabase project was accessed after Supabase was connected. **No SQL mutations were made.**

- Latest read-only counts: 1 confirmed Auth account, 1 approved legacy member, 2 wines, 2 reviews and 2 photo objects. Counts changed during investigation, so re-check immediately before migration.
- All existing wines and reviews belong to the single approved user. Orphan or missing Auth creator/reviewer count: zero.
- The existing review scores are 83 and 89, and the live database uses a 1–100 score check. No evidence of fractional scores in current records.
- The `wine_members` table has `display_name` but **not** `allow_member_edits`; profile-settings migration is not applied.
- There are no `journals`, `journal_members`, `profiles`, or `journal_invitations` tables yet.
- `pgcrypto` is installed in the `extensions` schema, consistent with the new invitation RPCs.
- Existing wines, reviews and photos are publicly readable. Private data isolation must be installed before public self-service registration.
- Supabase's migration history tool returned no entries even though earlier SQL scripts have clearly run. Treat historical migration status as manually applied and reconcile instead of assuming a clean database.
- Security advisor flagged leaked-password protection disabled. Review [Supabase password security](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) before public signups.
- A public signup UI has **not** been deployed. Existing approved accounts can use the old page.

**Owner migration:** The foundation SQL now chooses the sole approved legacy member automatically only if exactly one remains. With multiple approved users, an explicit `v_owner` selection is required. Counts must be rechecked at execution.

## Required before touching the database

1. Run `wine-journal-v2-preflight.sql` read-only and save the output privately.
2. Verify the exact production columns, policies, grants, score constraint and `pgcrypto` extension schema. The V2 invitation functions currently use `extensions.gen_random_bytes` and `extensions.digest`. Adjust if production has pgcrypto in a different schema.
3. Reconfirm the existing sole approved member is the intended owner. If there are now two or more approved users, explicitly set `v_owner` and verify ownership. The foundation refuses an ambiguous owner.
4. Create and verify recoverable backups of **Postgres and both wine photo storage metadata/files**. Record the restoration process.
5. Confirm old profile-settings and 1–100 scoring migrations are applied or reconciled. Check actual legacy photo bucket access.
6. Run all new migrations first on a **staging clone** with realistic anonymized test accounts, wines, reviews and photos.
7. Validate migration transaction and counts. Confirm old wine/review IDs, images, names, scores and notes remain unchanged.
8. Do not merge or release until the full test matrix passes.

## Staging tests (real independent Supabase sessions, not just browser UI)

- [ ] **Legacy compatibility**: existing approved users still sign in, view, add wines, upload images, add/edit reviews, save names and permissions. Existing anonymous read-only view still works.
- [ ] **Backfill**: existing wines all assigned to the original public journal. Correct owner. Member list, reviewer names, scores and tags preserved. Original journal photo URLs still resolve.
- [ ] **Private isolation**: A user in Private Journal A cannot read, update, delete, list or fetch photos from Private Journal B, including requests directly to the REST/Storage APIs. Anonymous clients cannot read either private journal.
- [ ] **Public view**: Anonymous clients can read only explicitly public journals and permitted reviews and photos. Read access gives no editing or invitation rights.
- [ ] **Self signup**: Sign up with a chosen name, verify email and sign in. Joining an invitation must not automatically create an unrelated personal journal.
- [ ] **Create journal**: New journal is private and creator is its owner. The selected journal is explicit and switching does not mix data.
- [ ] **Invitations**: Owner can create unique codes; member cannot. Valid code joins exactly one journal once. Separate codes can invite Beth and an additional friend.
- [ ] **Invitation abuse**: Invalid, expired, revoked and redeemed codes fail; two simultaneous redemptions cannot both succeed. Codes are never stored in plaintext or enumerated through browser table access.
- [ ] **Reviews**: Separate 1–100 scores, notes and keywords for 2, 3 and 5 members. One member's score never overwrites another's. Old scores 1 and 100 persist.
- [ ] **Permissions**: Member editing of another's existing review works only when that author opted in for that journal. After revocation, editing fails even through direct API calls. Changing reviewer ID or wine ID fails.
- [ ] **Photos**: New uploads use the private bucket with journal-prefixed path. Private photo URLs are not publicly accessible or retrievable via guessed object paths.
- [ ] **Data integrity**: The old page stays functional. New wines save to one selected journal only. No cross-posting or global approved-user leakage.
- [ ] **Mobile**: Test signup, invite link, loading, wine entry, review editing, image upload and session refresh on iOS Safari and Android Chrome.
- [ ] **Failure / recovery**: Test mid-upload failure, email verification links, refresh after login, expired sessions and browser reloads. Show accurate errors, no false save confirmations.

## Known beta limitations

- The V2 beta is a first integration surface, **not a replacement** for the existing journal. Public signup must remain closed until backend migration, app testing and release signoff.
- The beta can create or join journals, switch the active journal, add bottles, score wines, see independent reviews, create one-use invitations, and save names/editing permissions when its RPCs exist.
- Invitation history and revocation UI are included; delegated review-editing UI, advanced keyword suggestions, full export and owner removal flows remain to build. Source-level smoke tests exist, but full database integration and RLS tests are still required.
- Creating a wine and creating its review/photo currently involve separate calls. The UI reports partial errors, but staging must confirm recovery and cleanup.
- The current legacy front end still assumes a single journal. The migration assigns it a legacy default `journal_id` so old additions remain in the existing collection.
- Production schema has **not** been inspected by this branch. SQL assumptions must be validated against preflight results before any execution.

## Open product decisions before wider rollout

- Should deleting a shared bottle remain available to any journal member, or be limited to owner/admin?
- What should happen to reviews if a member leaves, and can the journal owner remove a member?
- Can an owner leave only after transferring ownership?
- Should an empty review with no score be allowed (currently yes)?
- Should public journal authors have the option to hide their names and notes from anonymous readers?

## Rollout

Use a staging clone to test schema and beta. Once accepted, do a production backup and an approved deployment window. Apply the foundation migration, invitations migration, then release the V2 interface behind a controlled beta link. Maintain the existing page unchanged until old/new compatibility is confirmed. Keep rollback instructions and backups available; do not attempt to remove the new columns/tables while users are writing V2 data.
