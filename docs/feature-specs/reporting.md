# Issue Reporting — Feature Spec

**Status: draft.**

**What this document is.** The requirements for reporting machine issues: the reporting modes, the information each mode collects, report templates, draft continuity, and duplicate-report awareness. It describes the intended final state only; what the code does or used to do lives solely in the Known divergences table. Each requirement is numbered for citation. When code and spec disagree, either the code is wrong or this document gets amended — never silently neither.

**Related records.** Bead `PP-ek0e`; `docs/superpowers/specs/2026-07-12-quick-report-design.md`; `docs/superpowers/specs/2026-07-16-tabbed-report-page-design.md`.

---

## 1. Concepts

- **Report draft** — an unsaved description of an operational problem associated with a machine. It becomes an issue only when submitted.
- **Report template** — a reusable, player-facing description of an observable machine problem. It seeds a report draft and may provide guidance before submission.
- **Report mode** — one of three ways to prepare issue reports: **Quick report**, **Detailed report**, or **Multiple issues**.
- **Quick report** — the default, minimum-input path for reporting one observable problem.
- **Detailed report** — the complete single-issue form for reporters who need to add context or control additional issue fields.
- **Multiple issues** — the batch-authoring mode for preparing and submitting reports about more than one problem.
- **Deflection guidance** — advice that may resolve an immediate problem without creating an issue while preserving a path to report a recurring or unresolved problem.

## 2. Reporting surface and modes

- **2.1** Opening `/report` starts in Quick report.
- **2.2** Quick report is the primary path rather than one of several equally weighted top-level tabs.
- **2.3** The Quick report surface places its report templates before the actions for entering Detailed report or Multiple issues.
- **2.4** A reporter can expand a Quick report draft into Detailed report.
- **2.5** A reporter can move a draft from Quick report or Detailed report into Multiple issues.
- **2.6** Multiple issues offers Detailed report, but not Quick report, as its single-issue destination.
- **2.7** Moving between modes preserves every report field shared by the source and destination.
- **2.8** A draft moved into Multiple issues becomes its first issue row.
- **2.9** Quick report and Detailed report are available to anyone permitted to report an issue.
- **2.10** Multiple issues is shown only to people with the batch-reporting capability.

## 3. Quick report

- **3.1** Quick report exposes only the machine, observed problem, and issue frequency, plus any reporter-identity fields required for that person.
- **3.2** Quick report does not expose a rich-text description, images, priority, status, assignee, or watch controls.
- **3.3** Quick report first asks the reporter to confirm or select the machine.
- **3.4** After a machine is selected, Quick report prominently shows that machine's three newest open issues before asking for another report.
- **3.5** Report templates are organized as compact problem groups followed by specific observable problems.
- **3.6** Selecting a problem group reveals its specific choices progressively within the same report surface.
- **3.7** Selecting a group never replaces the full page or navigates to a page-like intermediate screen.
- **3.8** A reporter can change the selected machine, group, or specific problem without restarting the report.
- **3.9** Choosing a specific problem produces a confirmation state showing the machine, problem, and frequency.
- **3.10** The confirmation state offers Not specified, Intermittent, Frequent, and Constant as large touch-friendly frequency choices.
- **3.11** The confirmation state offers a primary action to report the issue and a secondary action to continue in Detailed report.
- **3.12** “Something else” provides a short free-text problem field without requiring a report template.
- **3.13** The free-text problem field enforces the same short issue-title limit as the other reporting modes.

## 4. Quick report values

- **4.1** Quick report exposes and supplies issue values as follows:

| Issue field | Reporter interaction                      | Submitted value                       |
| :---------- | :---------------------------------------- | :------------------------------------ |
| Machine     | Select or confirm                         | Selected machine                      |
| Title       | Select a template or enter Something else | Template label or entered text        |
| Frequency   | Select during confirmation                | Template default until changed        |
| Severity    | Hidden                                    | Template default                      |
| Priority    | Hidden                                    | Medium                                |
| Status      | Hidden                                    | New                                   |
| Assignee    | Hidden                                    | Unassigned                            |
| Description | Not present                               | None                                  |
| Images      | Not present                               | None                                  |
| Watch       | Not present                               | On when the reporter can watch issues |

- **4.2** Not specified is a valid issue-frequency value.
- **4.3** A template whose frequency is not self-evident defaults to Not specified.
- **4.4** The reporter can replace every template-supplied value after continuing into Detailed report.
- **4.5** Quick report uses the same permission checks, reporter attribution, validation, duplicate-submission protection, issue creation, and notification behavior as the other reporting modes.
- **4.6** A successful Quick report creates exactly one issue.

## 5. Report template catalog

- **5.1** Quick report provides this template catalog:

| Group           | Problem                              | Severity   | Default frequency | Additional behavior                                   |
| :-------------- | :----------------------------------- | :--------- | :---------------- | :---------------------------------------------------- |
| Ball            | Ball stuck                           | Major      | Not specified     | Deflection guidance (§6)                              |
| Ball            | Ball loading problem                 | Major      | Not specified     | Covers no ball served and multiple balls served       |
| Ball            | Plunger or launch button not working | Major      | Not specified     | —                                                     |
| Playfield       | Flipper not working                  | Major      | Not specified     | —                                                     |
| Playfield       | Flipper weak or sticking             | Minor      | Not specified     | —                                                     |
| Playfield       | Bumper, sling, or kicker not firing  | Minor      | Not specified     | —                                                     |
| Playfield       | Shot or target not registering       | Minor      | Not specified     | —                                                     |
| Playfield       | Broken rubber                        | Minor      | Constant          | —                                                     |
| Playfield       | Loose or broken part                 | Minor      | Constant          | —                                                     |
| Display & sound | Lights out                           | Minor      | Constant          | —                                                     |
| Display & sound | Display / score reel problem         | Minor      | Not specified     | Covers electronic displays and mechanical score reels |
| Display & sound | Sound problem                        | Minor      | Not specified     | —                                                     |
| Machine         | Game won’t start                     | Unplayable | Constant          | —                                                     |
| Machine         | Game resets or freezes               | Major      | Intermittent      | —                                                     |
| Something else  | Reporter-entered problem             | Major      | Not specified     | Short free text (§3.12)                               |

- **5.2** Template groups organize the picker but do not classify the resulting issue.
- **5.3** The complete template catalog is available for every machine; PinPoint does not hide templates based on machine era.
- **5.4** Ball loading problem combines failures where no ball is served and failures where more than one ball is served.
- **5.5** Display / score reel problem combines electronic-display and mechanical-score-reel failures.
- **5.6** Drain-not-recognized failures use Something else rather than a dedicated template.

## 6. Deflection guidance

- **6.1** Choosing Ball stuck first advises the reporter to find someone who can free the ball.
- **6.2** The guidance tells the reporter to continue with a report when nobody can help or when the problem keeps happening.
- **6.3** The guidance is a two-step branch presented before issue confirmation.
- **6.4** The reporter can finish the flow without creating an issue after the ball is freed.
- **6.5** The reporter can continue from the guidance into the ordinary Quick report confirmation.
- **6.6** PinPoint does not show generic “find someone” guidance on templates where that advice does not resolve the immediate problem.

## 7. Detailed report

- **7.1** The complete single-issue mode is named Detailed report.
- **7.2** Detailed report provides machine, title, rich-text description, severity, frequency, priority, status, assignee, image, reporter identity, and watch controls when the reporter has access to each field.
- **7.3** Detailed report applies the established permission-dependent defaults when a reporter cannot set workflow fields.
- **7.4** A Quick report draft expanded into Detailed report retains its machine, title, severity, and frequency.
- **7.5** Every value carried from Quick report can be changed in Detailed report.
- **7.6** Detailed report creates one issue using the common reporting submission behavior (§4.5).

## 8. Multiple issues

- **8.1** Multiple issues lets a permitted reporter prepare more than one issue row and submit rows individually or as a batch.
- **8.2** Each row provides machine, problem, severity, priority, status, frequency, assignee, watch, and an optional rich-text description.
- **8.3** Rows may collapse for fast entry or expand to expose their complete field set.
- **8.4** A batch submission creates every valid row and leaves each invalid or failed row editable with its error.
- **8.5** A successful row cannot be created twice by overlapping submission attempts.
- **8.6** Unsubmitted batch content survives ordinary navigation between reporting modes and a page reload.
- **8.7** PinPoint warns before navigation that would discard non-empty, unsubmitted batch content.
- **8.8** Multiple issues does not provide image uploads.
- **8.9** A draft received from Quick report or Detailed report occupies the first row without losing shared field values.
- **8.10** Leaving Multiple issues for a single-issue form leads to Detailed report and preserves the first row as its draft.

## 9. Recent open issues

- **9.1** Once a machine is selected, the reporting surface shows its three newest open issues.
- **9.2** Changing the selected machine refreshes the displayed issues for the new machine.
- **9.3** Each displayed issue links to its issue page and shows its current status.
- **9.4** The panel links to the selected machine's complete issue list when open issues are present.
- **9.5** The panel has explicit loading, failure, no-machine, and no-open- issues states.
- **9.6** The panel remains collapsible but is open and visually prominent by default.

## Known divergences

| Requirement                                                                                       | Code today                                                                                                                                                                | Resolution  |
| :------------------------------------------------------------------------------------------------ | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :---------- |
| §2.1–§2.2, §2.4–§2.10, §3.1–§3.4, §3.8, §3.12–§3.13, §4.1, §4.3–§4.6, §7.1, §7.4–§7.5, §8.9–§8.10 | `/report` opens the complete single form; Quick, Something else, and draft-preserving mode handoffs do not exist; the existing modes are named Single issue and Multiple. | `PP-ek0e.2` |
| §2.3, §3.5–§3.11, §5–§6                                                                           | Quick report templates, progressive problem selection, template confirmation, and deflection guidance do not exist.                                                       | `PP-ek0e.3` |
| §4.2                                                                                              | Issue frequency requires Intermittent, Frequent, or Constant; Not specified is unavailable.                                                                               | `PP-ek0e.2` |
| §9.1, §9.6                                                                                        | Recent issues show three rows on mobile and five on desktop with different visual prominence.                                                                             | `PP-ek0e.2` |

## Changelog

| Date       | Change                                                                                                                                |
| :--------- | :------------------------------------------------------------------------------------------------------------------------------------ |
| 2026-09-05 | Initial draft: three report modes, draft continuity, Quick report templates and defaults, deflection, and recent-open-issue behavior. |
