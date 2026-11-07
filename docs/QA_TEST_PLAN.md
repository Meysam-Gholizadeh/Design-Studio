# QA and Acceptance Test Plan
## BI Design Studio

**Version:** 1.0

---

## 1. Test approach

Test the product as a working application, not only as a visual design. Prioritize end-to-end journeys and data integrity. Use fictional sample data only.

## 2. Gallery tests

| ID | Scenario | Expected result |
|---|---|---|
| GAL-01 | Open Dashboard Gallery | Categories and template cards appear |
| GAL-02 | Select Finance category | Only finance templates appear |
| GAL-03 | Search for “budget” | Matching templates appear |
| GAL-04 | Clear filters | Full gallery returns |
| GAL-05 | Open template preview | Full rendered dashboard and metadata appear |
| GAL-06 | Navigate multi-page preview | Correct page is displayed |
| GAL-07 | Use this design | Independent editable copy opens in editor |

## 3. Editor tests

| ID | Scenario | Expected result |
|---|---|---|
| EDT-01 | Create from blank | Empty canvas and visual library appear |
| EDT-02 | Drag KPI onto canvas | KPI is created at drop location |
| EDT-03 | Click visual-library item | Visual is added without drag |
| EDT-04 | Move a visual | Visual position changes |
| EDT-05 | Resize a visual | Visual dimensions change within constraints |
| EDT-06 | Select a visual | Selection outline and inspector appear |
| EDT-07 | Change visual title | Canvas updates immediately |
| EDT-08 | Duplicate visual | Copy appears without overwriting original |
| EDT-09 | Delete visual | Selected visual is removed |
| EDT-10 | Add/rename page | Page appears and name updates |
| EDT-11 | Delete page | Confirmation appears; page is removed only after confirmation |
| EDT-12 | Drag outside valid canvas | No invalid component is created |

## 4. Theme and layout tests

| ID | Scenario | Expected result |
|---|---|---|
| THM-01 | Apply Corporate Blue | All compatible visuals use Corporate Blue tokens |
| THM-02 | Apply Modern Dark | Text and surfaces remain readable |
| THM-03 | Change theme | Data and geometry remain unchanged |
| LAY-01 | Apply layout to blank page | Layout is applied |
| LAY-02 | Apply layout to populated page | User is warned or offered a safe new-page option |
| LAY-03 | Switch preview breakpoint | Desktop geometry is not overwritten |

## 5. Persistence and export tests

| ID | Scenario | Expected result |
|---|---|---|
| SAV-01 | Save design | Save status confirms success |
| SAV-02 | Refresh and reopen | Saved design remains available |
| SAV-03 | Rename design | New name persists |
| SAV-04 | Duplicate design | Independent copy is created |
| SAV-05 | Delete design | Confirmation and removal work |
| EXP-01 | Export JSON | Valid JSON file downloads |
| EXP-02 | Import valid JSON | Design loads correctly |
| EXP-03 | Import malformed JSON | Helpful error; active design remains unchanged |
| EXP-04 | Import unsupported schema version | Import is rejected safely |
| EXP-05 | Export then re-import | Supported design properties are preserved |

## 6. Data integrity tests

- Template source definition is unchanged after editing a template copy.
- Component IDs remain unique after duplication.
- Page IDs remain unique after duplication.
- Deleting a visual does not delete unrelated visuals.
- Theme changes do not mutate visual sample data.
- Undo/redo restores expected document states.
- Imported data cannot execute HTML or JavaScript.
- Layout values remain within grid bounds.

## 7. Visual and usability review

Check:
- Text is readable at normal zoom.
- Cards align consistently.
- No accidental horizontal overflow in the gallery.
- Editor panels remain usable at common desktop widths.
- Selected component is visually obvious.
- Drag target is obvious.
- Empty states explain what the user can do next.
- Charts have labels, legends, or accessible context where appropriate.
- Themes maintain adequate contrast.
- Sample data is labeled as illustrative.

## 8. Release gate

Do not call the MVP complete if:
- A core button is non-functional.
- Drag/drop is only simulated.
- Gallery cards are merely static images with no editable definition.
- The editor and preview use unrelated rendering implementations.
- Template edits mutate the original template.
- Designs cannot be saved and reopened.
- Import can corrupt the current design.
- Production build or core end-to-end tests fail.
