# Wine Journal: Living Product and Delivery Plan

**Version:** 1.0  
**Date:** 30 October 2026  
**Status:** Requirements agreed in principle; NO application code or database migrations made during this planning update.  
**Website:** https://olliewritesthings.com/wine-journal/  
**Owner's working Word companion:** Wine_Journal_Product_Requirements_and_Roadmap.docx (delivered in ChatGPT).

## Product aim

A mobile-first shared wine journal, initially ideal for two people but supporting larger groups and families. Each participant has a separate profile and writes their own review on the same bottle. People can create a journal or join one using a code. Private collections must be isolated from other users.

## Agreed decisions

| Area | Decision | Stage |
| --- | --- | --- |
| Group size | Friendly default for two; allow more than two with no hard two-person cap | V2 |
| Registration | Email/password and chosen display name, never hardcoded reviewer names | V2 |
| Onboarding | After signing up choose Create journal or Join journal | V2 |
| Invites | Journal-specific code or link; securely generated; one use; revocable; expires in 7 days | V2 |
| Reviews | Independent score 1-100, notes and tags for every user in a journal | V2 |
| Delegated editing | Author can allow other members of THAT journal to edit existing reviews; off by default | V2 |
| Privacy | New journals private by default; existing public read-only journal preserved during migration | V2 |
| Multiple journals | One account can be a member of multiple journals | Data foundation |
| Active journal | Add to ONE selected active journal by default | V2 |
| Add to several | Later optional "Also add to..." multi-select; OFF by default; separate entries in each destination | Future |
| Discover/follow | Public journal search and read-only following; separate from joining or editing | Future |
| Cloud import | Excluded; retain an export/backup facility | V2 |

**Multi-journal example:** A person is in both "Our Wine Journal" and "Friday Wine Club". They switch between journals, each with separate wines and reviews. Adding a wine saves only in the currently selected journal. A later multi-select can duplicate bottle metadata into chosen journals, but must not automatically reveal anyone's tasting notes or sync private data.

**Why invitation belongs to a journal, not a user:** A person may eventually create/join several journals. Every invite grants access to ONE journal only. If they sign up using a friend's invite, they should not be forced to create an unused personal journal.

## As-is (inspected GitHub, 30 Oct 2026)

- Frontend is a standalone HTML/CSS/JavaScript page: `public/wine-journal/index.html`, part of the broader Astro website.
- Uses a pre-existing Supabase Auth project, Postgres tables and image Storage.
- `public.wines` holds bottle metadata (name, producer, grape, vintage, region, image path, creator).
- `public.wine_reviews` holds one score/notes/tags per (wine_id, reviewer_id).
- `public.wine_members` is ONE global list of approved users, not per-journal membership.
- Current UI includes login, settings, add/edit/delete wine, photo compression, 1-100 scoring, tag suggestions, notes search, filters and export.
- Earlier SQL made the existing journal readable by anonymous visitors; approved members can write. Group-level privacy is NOT implemented.
- Settings include display name and `allow_member_edits`, but rely on a separate migration that may not have run. The UI has a compatibility fallback for a missing column; this does not guarantee Settings save successfully.
- Initial schema specified score `numeric(3,1)` restricted to 0-10. A separate later SQL file addresses the 1-100 change. Deployed DB state has not been independently checked.
- All approved users currently share the same global wine list; any approved member may delete a wine and all its reviews under the original policies.
- No dedicated Wine Journal automated integration/end-to-end test suite was evident in reviewed repository files.

**Evidence boundary:** These are observations from source code and SQL, NOT confirmation of live Supabase migrations or a successful multi-account production test. Inspect live schema read-only before implementation.

## To-be: key user flows

### Create a journal
1. Register; set chosen name; verify email.
2. Choose "Create a journal", enter journal name, default Private.
3. Become journal owner/admin; add a wine and independent review.
4. Generate a time-limited invitation code/link.

### Join a friend's journal
1. Register or sign in.
2. Enter code or open invite link; preview target journal.
3. Accept; server validates one-use code, expiry, revocation and scope.
4. Become a member and independently review shared bottles.

### Use more than one journal
1. Switch active journal from a clear journal selector.
2. View only that journal's permitted wines.
3. "Add wine" saves to current journal only.
4. In a later enhancement, explicitly choose additional destination journals. Never auto-cross-post.

### Manage profile and privacy
1. Update display name and confirm persistence.
2. Owner/admin manages invitations, group members and journal visibility.
3. Each member controls whether co-members can edit their existing reviews.
4. Export journal data and have a predictable leaving/deletion process.

## Goals, implementation route, acceptance criteria

### G01: Baseline stability and settings
**Need:** Settings, login/session, 1-100 score, images, notes, search and saving work reliably.  
**How:** Read-only audit of production SQL/schema/policies; consolidate migrations; add regression tests; fix permissions and partial save problems.  
**Done when:** Two existing accounts save settings; score 1 and 100 work; expired session recovers; existing wines/photos/reviews survive.

### G02: Journal-specific data and privacy
**Need:** Separate journals with isolated members and wines. Support 2, 3, 5+ reviewers.  
**How:** Introduce `journals`, `journal_members`, `profiles` and `wines.journal_id`; migrate current journal and review references safely; secure RLS and photo paths by journal; backup and rollback.  
**Done when:** Unrelated accounts cannot read/change private journal records even through direct API requests; old data preserved.

### G03: Self-service signup
**Need:** Email registration, chosen display name, Create/Join onboarding and verification.  
**How:** Retain Supabase Auth; provide mobile signup screens; create profile on new account; offer journal choice after signup.  
**Done when:** No manual SQL or administrator action is required for normal onboarding.

### G04: Invite codes and links
**Need:** Seven-day, one-use, revocable, journal-scoped invitations, with preview.  
**How:** `journal_invitations` table; cryptographically random token; store digest; server-side atomic redemption and permission checks; never expose secret admin key.  
**Done when:** Valid code joins intended journal, and expired/reused/revoked codes cannot be redeemed.

### G05: Review ownership and permissions
**Need:** Individual ownership; optional delegated review editing; role-aware member management.  
**How:** Owner/admin vs member roles; journal-scoped edit toggle; database policy enforcement; clarify ownership transfer and deleting a shared wine.  
**Done when:** Another member cannot edit reviews without the author's permission; toggling off immediately revokes editing; followers never gain edit rights.

### G06: Mobile experience
**Need:** Quick add-wine, smaller header, prominent journal name, useful scores and reviews, clear Search/Settings.  
**How:** Separate the current one-file UI into testable components; preserve burgundy/cream identity; accessible buttons and forms; better loading/error states.  
**Done when:** iOS Safari and Android Chrome users can quickly sign in, find a journal, save a bottle and review.

### G07: Multiple journals with safe destination
**Need:** Account can belong to several, while each entry belongs to one journal by default.  
**How:** Active journal selector and per-journal queries; deny unauthorized destinations; design future explicit multi-select.  
**Done when:** Switching journals shows distinct lists; a wine does not appear in a second journal unless deliberately added.

### G08: Public/private content and future social foundation
**Need:** Private by default for new journals; current public journal preserved; public browsing separate from membership.  
**How:** Visibility-scoped RLS and image handling; stable journal IDs; do not build followers or public search yet.  
**Done when:** Anonymous users see only explicitly public records; private photos and notes cannot be fetched through guessed links.

### G09: Safe change management
**Need:** Repeatable releases without breaking established workflows.  
**How:** Versioned migrations, staging and seed fixtures, unit/integration/browser tests, pre-release backups, rollback steps and change log.  
**Done when:** Complete Create > Invite > Join > Review journey is tested with separate accounts and all security regression checks pass.

## Proposed database shape

- `profiles(user_id, display_name,...)`
- `journals(id, name, owner_id, visibility,...)`
- `journal_members(journal_id, user_id, role, joined_at,...)`
- `journal_member_settings(journal_id, user_id, allow_member_edits,...)` (or equivalent journal-scoped membership field)
- `journal_invitations(journal_id, code_digest, expires_at, redeemed_by, revoked_at,...)`
- `wines(..., journal_id, created_by, photo_path)`
- `wine_reviews(wine_id, reviewer_id, score, notes, tags)`
- Storage metadata and access rules scoped to the journal.

**Non-negotiable:** Members may access only journals they belong to or journals explicitly marked public. Being permitted to view a public journal does not imply permission to edit, invite, or follow private content.

## Delivery stages and gates

| Stage | Outputs | Must pass before next stage |
| --- | --- | --- |
| 0. Stabilize | Production schema check, baseline tests, data backup, settings/login/score fixes | Existing experience works |
| 1. Data model | Journals, memberships, RLS, storage scope, migration | Old data preserved; isolation verified |
| 2. Accounts | Signup and Create/Join flow | New user needs no manual SQL |
| 3. Invitations | Code generation, share, redeem and revoke | One-use/expiry/access tests |
| 4. Permissions | Profile/settings, delegation, group roles | RLS tested; settings persist |
| 5. UX | Mobile navigation, active journal, fast Add/Review | Browser/mobile tests |
| 6. Release | End-to-end two-account plus 3+ member tests, backups and rollback | All P0 cases pass |

**Release gate:** Do not open public sign-up before journal isolation and secure invite redemption are deployed. Avoid any transition that inadvertently makes private wine data public.

## Test checklist

- [ ] Inspect production migrations and back up current wine and photo data.
- [ ] Migrate existing wine/reviews without losing IDs, photos or notes.
- [ ] Two unrelated private journals cannot see each other's data, including photos.
- [ ] New user can sign up, set name, create or join a journal.
- [ ] Expired, reused or revoked invitation fails; concurrent redemption is safe.
- [ ] Two and three-plus members can review the same wine independently.
- [ ] Score 1 and 100, averages and filters are correct.
- [ ] Settings persist; delegated edit permissions are enforced in database.
- [ ] Active-journal selection works; add does not cross-post.
- [ ] Guests view only explicitly public journals and cannot write.
- [ ] Export, upload, search, mobile forms, session refresh and error handling work.
- [ ] Backup and rollback validated before production release.

## Open decisions (recommended, not yet approved)

| Question | Proposed answer |
| --- | --- |
| Who can invite members? | Journal owner/admin initially |
| Who can permanently delete shared wine? | Owner/admin; consider soft-delete |
| Who can set journal public/private? | Owner/admin |
| Who may edit under the opt-in? | Other members of that journal, existing reviews only |
| What happens if owner leaves? | Transfer ownership before leaving |
| Is score mandatory when adding wine? | No; if provided, integer 1-100 |
| What happens to former members' reviews? | Define retention/export rules before launch |

## Later, not part of launch

1. Optional multi-journal posting with explicit selection and independent entries.
2. Follow public journals or reviewers (read-only, not membership).
3. Public journal search, discovery and matching tastes.
4. Solo/private personal collection (already supported by the model).
5. Advanced wine identification or scanning (only if worthwhile).

## Sources and update rules

Inspected: `public/wine-journal/index.html`, `supabase/wine-journal.sql`, `supabase/wine-journal-members.sql`, `supabase/wine-journal-public-read.sql`, `supabase/wine-journal-profile-settings.sql`, `supabase/wine-journal-score-100.sql`. Inspection 30 October 2026.

This is the living product specification. Update decisions, acceptance criteria and milestone status **before** implementing features. Treat “code committed”, “migration deployed” and “feature tested” as different statuses. Document changes and related PRs in this file.

### Change log
- **v1.0, 30 Oct 2026:** Baseline and target requirements; configurable member count; secure journal invite codes; one active journal by default; later explicit cross-journal additions; future following/discovery.
