# Fit Reference implementation plan

Based on the Project Plan, Design Brief and Functional Brief dated 16 September 2026. Work proceeds one reviewable task at a time. Each task records its changes and verification in `fit-changelog.md` before the next starts.

## Task 1: Navigation and visual foundation

Status: merged through PR #9 on 17 September 2026. GitHub Pages deployment tracked in run 35175343159.

- Make Check item the opening view, with My fit and Saved as the other primary destinations.
- Bring existing screenshot input above manual entry.
- Apply paper, ink and yellow styling with square controls and mobile bottom navigation.
- Keep account controls accessible in an expandable area; leave cloud status visible.
- Bring all existing comparison summaries into Saved alongside owned favourites.
- Preserve the v1 storage format and existing authentication integration.

Acceptance: primary navigation works, draft fields survive view changes, guest records still load, account controls keep their IDs and behaviour, layout fits mobile and desktop, file chooser is keyboard accessible.

## Task 2: Measurement contract and honest results

Status: merged through PR #10 on 17 September 2026 at the owner’s request. Pages run 35175738396 succeeded. Nine focused Node checks pass; browser review remains outstanding.

Depends on task 1. Separate body charts from garment dimensions; define units, flat width/circumference, sleeve and inseam. Replace the legacy percentage score and score-driven illustration with signed measurement differences and explicit unknowns. Version the data with a backwards-compatible migration before changing stored records. Verify manual fixtures before OCR uses the new contract.

## Task 3: Screenshot extraction and review

Status: merged through PR #11 on 17 September 2026. Twenty focused checks pass; browser and real-image OCR review remain outstanding.

Depends on task 2. Read multi-size tables into editable candidates, retain source text and all sizes, confirm units and meaning, handle uncertainty and cancellation, and provide manual recovery. Decide OCR processing and image retention explicitly. No product scraping or label lookup in this task.

## Task 4: Owned garments and reproducible history

Depends on task 2. Editable garments, observed fit, compatible references, explicit save action and immutable input snapshots. Open old checks as legacy summaries without inventing their missing reference values. Verify profile ownership and sign-out handling with the evolved model.

## Task 5: Measurement diagrams and release polish

Depends on tasks 3 and 4. Upper/lower body measurement guides and simple labelled garment diagrams, responsive and accessibility checks, privacy and migration verification, then preview and release. No photorealistic try-on.

## Audit findings

The current app is `public/fit/index.html` with inline UI logic and `account.js` for Supabase. Profiles, garments and comparison summaries share a v1 payload. The account layer uses revision checks and explicit guest import. This is a code observation, not a live security verification. The original OCR parser guesses units and takes the first labelled number; original comparison scoring conflates chart types. Tasks 2 and 3 address these known limitations. Task 1 deliberately does not change their data or calculation contract.

## Release discipline

Use a dedicated branch and pull request for each task. Verify locally and record remaining gaps. Review before merging into the GitHub Pages deployment branch. Do not bundle unrelated mini-app changes or database migrations into a UI task.

## Task 4 delivery slices

- **4a, edit and reuse clothing:** merged through PR #12 on 17 September 2026; Pages run 35225273521 succeeded. Edit existing garment records, record observed fit/notes and select a reference. Twenty-seven focused checks pass; browser verification outstanding.
- **4b, save and reopen comparisons:** merged through PR #13 on 18 September 2026 and confirmed on the live page. Explicit save button, immutable original snapshot view and a separate compare-again action using current measurements. Thirty-three focused checks passed at release.
- **4c, record purchase outcome:** implemented in a separate draft branch. Mark an item as bought, record actual fit and add it to owned clothes without presenting retailer body-chart values as measured garment dimensions. Forty focused checks pass across the Fit feature.

Keep these slices separate for review. Tasks 3, 4a and 4b are now on main; Task 4c remains isolated until reviewed.
