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

Browser interaction and visual checks remain outstanding: the local Chromium runtime was unavailable and its download timed out. Cloud sign-in, OCR and deployed rendering were not tested. Keep this task as a draft pull request until desktop/mobile checks are complete.

### Next

Task 2: measurement meaning, units and directional results before improving OCR.
