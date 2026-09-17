# Fit Reference change log

## 17 September 2026: Task 1

### Changed

- Check item opens first; navigation is Check item, My fit and Saved.
- Screenshot upload is first in the check form, with a keyboard-accessible button and manual-entry shortcut.
- Account controls collapse into a details panel; connection/save messages remain visible.
- Applied the design brief's paper, black and yellow palette, square controls and mobile bottom navigation.
- Saved includes owned favourites and all stored comparison summaries, newest first. Existing records are not rewritten.
- Selected references survive ordinary re-renders when still available. View switching retains form fields and moves keyboard focus to the view heading.

### Boundaries

No database, authentication, storage-schema, OCR algorithm or comparison-scoring changes. Existing estimates remain legacy behaviour until task 2; this task does not validate them. Previous checks are summaries, not reconstructable snapshots. No live cloud account was used in local verification.

### Verification

Passed JavaScript syntax checks for the page and unchanged account script, unique HTML IDs, navigation destinations and default view, upload ordering, account/inline DOM ID references, stylesheet presence and git whitespace checks.

Browser interaction and visual checks remain outstanding: the local Chromium runtime was unavailable and its download timed out. Cloud sign-in, OCR and deployed rendering were not tested. PR #9 was subsequently merged on 17 September 2026 at the owner’s explicit request to push live. Browser interaction checks remain unverified.

### Next

Task 2: measurement meaning, units and directional results before improving OCR.


## 17 September 2026: Task 2

### Changed

- Added a pure measurement engine with explicit chart type, units and width/circumference confirmation.
- Body size charts support ranges; body charts cannot compare against an owned garment.
- Garment comparisons report signed differences; comparisons to a body show wearing ease only for compatible girths. No thresholds, fit scores or best-size promises.
- Removed score-driven scaling and coloured verdicts from the schematic. Trouser checks do not display a T-shirt schematic.
- New checks focus on T-shirts and trousers. Sleeve and inseam inputs are separate. Legacy trouser sleeve values are not inferred to be inseams.
- New garments record their unit and measurement version. Existing garments retain the historical profile-unit interpretation.
- New comparison records include measurementVersion 2, source values/units, chart meaning, reference snapshot and rule result. Existing v1 records are untouched and still display as historical summaries. The account payload and storage key remain compatible; no SQL migration is needed.
- Editing inputs or changing reference data invalidates confirmation/results. Pending image extraction cannot fill fields after profile/account re-render or a newer upload. OCR no longer guesses units from numeric magnitude.

### Verification

Run `node --test tests/fit-measurements.test.mjs`: nine passing tests covering conversions, ranges, unknowns, incompatible references, invalid inputs, ease, separate inseam, and the real UI submit handler with an in-memory DOM adapter. The submit check verifies the legacy record survives and the new reference snapshot stays unchanged after later edits. This adapter is not a browser test.

Inline JavaScript syntax, static DOM ID references, duplicate IDs and git whitespace checks pass. Browser rendering, live authentication and real-image OCR were not tested. Task 2 remains a separate reviewable change, not a live release.

### Compatibility and rollback

The existing account validator accepts the additive fields. No old records are rewritten on load. Reverting UI code leaves records readable through their summary fields; retain new record fields when editing data. Version 2 ranges are strings in source measurements and numeric bounds in result rows, so future code must read measurementVersion before treating them as simple numbers.

### Remaining work

Task 3 provides proper table extraction/review, image cancellation and source retention decisions. The legacy OCR still reads the first recognised number and requires manual correction; it cannot select a size column reliably. Task 4 adds explicit save controls, reopening snapshots and editable garments. Task 5 adds complete upper/lower body diagrams and visual accessibility verification.
