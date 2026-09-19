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

JavaScript syntax, DOM IDs/references and git whitespace checks pass. These are not browser or OCR accuracy tests. Desktop/mobile rendering, actual Tesseract image recognition and live account saving remain unverified. Task 3 was merged through PR #11 on 17 September 2026.

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

Browser interaction and live-account saving remain unverified. Task 4a was rebuilt cleanly on the merged Task 3 baseline and merged through PR #12 on 17 September 2026. GitHub Pages run 35225273521 completed successfully.

### Next

Task 4b: explicit Save comparison and reopening original snapshots. Task 4c: mark a checked item as bought, record observed fit and add it to My clothes. No database migration is required for Task 4a; fields are additive and account payload validation is unchanged.

## 17 September 2026: Task 4b

### Changed

- Running a comparison now creates an unsaved result. It reaches Previous checks only after the user chooses Save comparison.
- Saved version 2 checks open in a dialog showing the original result rows, chart values and reference values. Normalised snapshot values display in centimetres and do not change when the current profile or garment is edited.
- Compare again starts a separate draft from the saved chart inputs, then uses the current profile and current selected reference when run. The saved check is never recalculated or overwritten.
- If a saved garment reference has been removed, Compare again selects body measurements and asks the user to choose a new reference before running the check.
- Legacy checks remain readable as summaries. Because their original chart and reference values were not stored, they cannot be rebuilt automatically.
- New history helpers deep-copy records at save and replay boundaries. No database migration is required; the existing comparisons array and version 2 schema remain compatible.

### Verification

`node --test tests/fit-*.test.mjs`: 33 checks pass. Six new history checks cover explicit save, deep-copy immutability, record lookup, replay with an available reference, deleted-reference fallback and legacy rejection. The real submit-handler fixture confirms that running a comparison does not mutate saved history or trigger cloud persistence.

JavaScript syntax, static DOM references, unique IDs and whitespace checks pass. Task 4b was merged through PR #13 on 18 September 2026. The live Fit page was opened after deployment and confirmed to contain the explicit-save history copy. Full interaction and live-account saving remain unverified.

### Next

Task 4c: mark a checked item as bought, record its observed fit and add it to My clothes without treating retailer body-chart values as measured garment dimensions. Task 5 then adds upper/lower measurement diagrams and release polish.

## 18 September 2026: Task 4c

### Changed

- Saved version 2 checks now offer Record purchase. The outcome form records the item, label size, actual fit and notes, then links the check to an item in My clothes.
- Updating a purchase edits the linked clothing record instead of creating duplicates. If that linked record was deleted, saving the outcome creates a new linked item safely.
- Purchase status and observed fit are additive metadata on the saved check. Its original chart inputs, reference snapshot and calculated result remain unchanged.
- Retailer chart values are never copied into owned-clothing measurements. New purchased items start with blank garment measurements and explain that the physical item can be measured later.
- Clothing without a real garment measurement cannot be selected as a reference. After measurements are added through Edit, the normal Use as reference action becomes available.
- T-shirt and trouser checks map to the corresponding owned-clothing category. Legacy summary checks do not offer purchase recording because their source snapshot is incomplete.

### Verification

`node --test tests/fit-*.test.mjs`: 40 checks pass. Seven new checks cover measurement eligibility plus purchase creation, snapshot preservation, duplicate prevention, retained physical measurements, deleted-link recovery, trouser mapping and atomic rejection of invalid outcomes.

JavaScript syntax, unique IDs, static DOM references and whitespace checks pass. Task 4c was merged through PR #14 on 18 September 2026. The live page was opened after deployment and confirmed to contain the purchase script, dialog and action. Signed-in purchase saving remains unverified.

### Next

Task 5: replace the limited schematic with clear upper-body and trouser measurement diagrams, then complete responsive, accessibility, privacy and migration checks before the broader release review.

## 18 September 2026: Task 5

### Changed

- Replaced the old T-shirt-only overlay with paired body and flat-garment diagrams for both T-shirts and trousers.
- T-shirt guides label chest, shoulder, length and sleeve. Trouser guides label waist, hip and inseam. Flat chest, waist and hip lines explicitly show that the width is doubled.
- Each SVG has an accessible title and description. The supporting text explains that diagrams show measurement direction only and do not predict stretch, drape or appearance.
- Changing category switches the guide and its written instructions. Comparison results retain the relevant diagram while replacing the notes with the measured differences.
- Added a keyboard skip link, accessible dialog names, a labelled add-profile control, polite result announcements and responsive single-column diagrams on small screens.
- Added an expandable privacy explanation covering guest storage, private account storage, locally processed images and the limited reviewed text saved with an explicit comparison.
- Moved account-payload validation into a tested helper. Legacy payloads without snapshots or purchase fields remain valid; the new fields are additive.
- Verified the Supabase setup keeps row-level security enabled and limits the table policy to the authenticated row owner. No SQL or payload migration is required.

### Verification

`node --test tests/fit-*.test.mjs`: 51 checks pass. New coverage includes T-shirt and trouser guide copy, copied guide state, labelled SVGs, privacy disclosure, unique IDs, script references, labels, dialog names, keyboard/live-region hooks, legacy/evolved payload compatibility and the owner-only database policy.

JavaScript syntax and whitespace checks pass. Task 4c was confirmed on the live site before Task 5 began. The Task 5 diagrams still require visual review at desktop and mobile widths, and signed-in cloud behaviour still requires an account-based browser check.

### Release boundary

Task 5 remains a separate draft pull request until visual and interaction review. It does not add women-specific categories, retailer scraping, product-code lookup or photorealistic try-on.
