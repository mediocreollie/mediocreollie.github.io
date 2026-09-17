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

Inline JavaScript syntax, static DOM ID references, duplicate IDs and git whitespace checks pass. Browser rendering, live authentication and real-image OCR were not tested. Task 2 was subsequently merged through PR #10 at the owner’s explicit request. Pages deployment 35175738396 succeeded. Browser and live-account checks remain outstanding.

### Compatibility and rollback

The existing account validator accepts the additive fields. No old records are rewritten on load. Reverting UI code leaves records readable through their summary fields; retain new record fields when editing data. Version 2 ranges are strings in source measurements and numeric bounds in result rows, so future code must read measurementVersion before treating them as simple numbers.

### Remaining work

Task 3 provides proper table extraction/review, image cancellation and source retention decisions. The legacy OCR still reads the first recognised number and requires manual correction; it cannot select a size column reliably. Task 4 adds explicit save controls, reopening snapshots and editable garments. Task 5 adds complete upper/lower body diagrams and visual accessibility verification.


## 17 September 2026: Task 3

### Changed

- Replaced direct OCR autofill with source-image preview, original extracted text and an editable multi-size table.
- Select and confirm a reviewed size before copying values into the comparison form. Blank values clear old fields and remain unknown. Chart meaning and unit confirmation are still required after import.
- Conservative English parsing supports horizontal letter-size headers and explicit numeric Size headers. Misaligned, duplicated and unrecognised rows remain blank with warnings. Vertical tables and ambiguous layouts use manual entry; no product or label lookup is implied.
- Add/remove size rows, correct extracted text, rebuild the table or enter a table manually. All candidates require human review; there is no invented confidence percentage.
- Added cancellation, worker termination, stale-result protection, file validation (PNG/JPEG/WebP, 10 MB and 20 million decoded pixels) and recovery to manual entry.
- Pending imports cannot be compared until applied or explicitly discarded via manual entry. Replacing a file preserves the manual comparison draft.
- Images are processed locally in the browser with Tesseract's English reader. The library and language resources download externally; image bytes are not uploaded to the account. Blob URLs and review data are cleared on profile/account re-render, discard and page exit.
- Reviewed table rows, selected size and extracted text are copied into an additive importSnapshot on saved comparisons. Editing copied values removes that provenance until re-reviewed. No storage schema or account policy migration.

### Verification

`node --test tests/fit-*.test.mjs`: 20 passing checks. Seven parser/validation fixtures cover size columns, ranges, missing/duplicate rows, numeric size headers, vertical-table fallback and OCR character artifacts. Four controller fixtures exercise the actual importer with in-memory DOM/worker adapters: required review and selection, immutable snapshot, cancellation with late completion, profile reset/image release and invalid-file recovery. Nine existing measurement/submit checks also pass.

JavaScript syntax, DOM IDs/references and git whitespace checks pass. These are not browser or OCR accuracy tests. Desktop/mobile rendering, actual Tesseract image recognition and live account saving remain unverified. Task 3 is a separate draft PR, not deployed.

### Scope and next task

English first; unfamiliar text can be mapped manually. No automatic translation, page scraping or product-code lookup. Crop using the device photo editor and re-upload; in-app cropping is deferred. Original images are not stored in Supabase. Task 4 is editable owned garments, explicit comparison saving and reopening historical snapshots.

Worker API reference: https://github.com/naptha/tesseract.js/blob/master/docs/api.md (reviewed 17 September 2026).

## 17 September 2026: Task 4a

### Changed

- My clothes now offers Edit and Use as reference for supported T-shirt/top and trouser categories.
- Editing updates the existing garment ID instead of adding another item. Brand, size, category, measurements and fit feedback are editable; original units and unrelated metadata remain intact.
- Added Too tight, Too loose and Not sure yet alongside existing fit descriptions, plus free-text fit notes. Notes are escaped when displayed.
- Reference selection opens Check item with the matching category and item selected. Items recorded as too tight or too loose trigger a warning rather than silently acting as an ideal fit.
- Existing comparison records and their reference snapshots remain untouched by garment edits.
- Legacy trouser sleeve/inseam values are retained separately and labelled as ambiguous, never copied automatically into an inseam field.
- Garment Cancel/Close bypass required-field validation. Saves validate all measurements before mutating data and reject edits if the active profile changed or the item was removed.

### Verification

`node --test tests/fit-*.test.mjs`: 27 checks pass, including seven new garment fixtures for edit identity/units/metadata, snapshot preservation, atomic validation, deleted-item handling, new-item units, legacy trouser ambiguity and supported reference categories. Inline script syntax, static element references, unique IDs and whitespace checks pass.

Browser interaction and live-account saving remain unverified. Task 4a is a separate draft change stacked on Task 3 PR #11, which remains unmerged. Neither task is deployed by this change.

### Next

Task 4b: explicit Save comparison and reopening original snapshots. Task 4c: mark a checked item as bought, record observed fit and add it to My clothes. No database migration is required for Task 4a; fields are additive and account payload validation is unchanged.
