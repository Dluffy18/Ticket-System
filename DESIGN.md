---
name: Citation System
description: The ledger that accounts for every pre-numbered paper Citation by its Control Number.
colors:
  ink: "#1C2B4A"
  ink-hover: "#2A3D66"
  ink-2: "#44506B"
  ink-3: "#5A6480"
  field-stroke: "#7A849B"
  rule-2: "#C9CEDA"
  rule-3: "#E5E8EF"
  ground: "#FFFFFF"
  ground-2: "#F3F4F7"
  sheet: "#FFFFFF"
  sheet-2: "#FAF6F7"
  pink-copy: "#E7B4BF"
  serial: "#B3162B"
  void-bg: "#FBE9EB"
  canary: "#F8EBA9"
  canary-line: "#D9C25A"
  canary-ink: "#4F3F00"
  done: "#1E6A43"
  done-bg: "#E2F0E7"
  cancel: "#555D6E"
  cancel-bg: "#ECEDF1"
  paid: "#5A3DA8"
  paid-bg: "#EFEAFA"
  pending: "#7A5200"
  pending-bg: "#FBF0D6"
  band-sub: "#C3CADD"
  night-ground: "#0E1320"
  night-sheet: "#161D2E"
  night-sheet-2: "#1B2336"
  night-ink: "#E9ECF4"
  night-ink-2: "#BAC2D6"
  night-rule: "#9AA4BC"
  night-rule-2: "#2F3A53"
  night-serial: "#FF8590"
  night-pink-copy: "#4A2A33"
  night-canary: "#3A3316"
  night-canary-ink: "#F5DF80"
  night-done: "#74D7A1"
  night-paid: "#BBA6FF"
  night-pending: "#F2C463"
typography:
  serial-display:
    fontFamily: "Courier Prime, Courier New, ui-monospace, monospace"
    fontSize: "3.25rem"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "0"
    fontFeature: "tnum"
  serial:
    fontFamily: "Courier Prime, Courier New, ui-monospace, monospace"
    fontSize: "1.0625rem"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "0.02em"
    fontFeature: "tnum"
  headline:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "1.75rem"
    fontWeight: 750
    lineHeight: 1.15
    letterSpacing: "-0.01em"
    fontVariation: "'wdth' 88"
  title:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 700
    lineHeight: 1.3
  figure:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "1.75rem"
    fontWeight: 750
    lineHeight: 1.1
    fontVariation: "'wdth' 88"
    fontFeature: "tnum"
  body:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 650
    lineHeight: 1.5
  box-label:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 700
    letterSpacing: "0.1em"
  stamp:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 700
    lineHeight: 1.55
    letterSpacing: "0.09em"
    fontVariation: "'wdth' 92"
rounded:
  sheet: "0"
  mark: "3px"
  control: "4px"
spacing:
  hair: "4px"
  tight: "8px"
  stack: "14px"
  gutter: "16px"
  section: "20px"
  touch: "44px"
  nav: "64px"
  rail: "232px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.sheet}"
    rounded: "{rounded.control}"
    padding: "0 18px"
    height: "44px"
  button-primary-hover:
    backgroundColor: "{colors.ink-hover}"
  button-primary-xl:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.sheet}"
    rounded: "{rounded.control}"
    padding: "0 24px"
    height: "60px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "0 18px"
    height: "44px"
  button-ghost-hover:
    backgroundColor: "{colors.sheet-2}"
  button-danger:
    backgroundColor: "{colors.serial}"
    textColor: "{colors.sheet}"
    rounded: "{rounded.control}"
    padding: "0 18px"
    height: "44px"
  input:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sheet}"
    padding: "10px 12px"
    height: "48px"
  input-serial:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.serial}"
    typography: "{typography.serial}"
    rounded: "{rounded.sheet}"
    height: "48px"
  sheet:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sheet}"
    padding: "16px"
  chip:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.sheet}"
    padding: "0 12px"
    height: "40px"
  chip-on:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.sheet}"
  type-tab:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.control}"
    padding: "9px 14px"
    height: "44px"
  type-tab-on:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.sheet}"
  stamp:
    backgroundColor: "transparent"
    textColor: "{colors.done}"
    typography: "{typography.stamp}"
    rounded: "{rounded.mark}"
    padding: "0 7px"
  account-mark:
    backgroundColor: "transparent"
    textColor: "{colors.done}"
    padding: "1px 8px"
  tag-sync:
    backgroundColor: "{colors.canary}"
    textColor: "{colors.canary-ink}"
    rounded: "{rounded.mark}"
    padding: "2px 8px"
  header-band:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.sheet}"
    padding: "6px 16px"
    height: "56px"
  dialog:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sheet}"
    padding: "20px"
    width: "460px"
---

# Design System: Citation System

## Overview

**Creative North Star: "The Carbonless Booklet"**

The screen is the top copy of a pre-numbered paper form. White sheets sit on a white page, outlined by a light rule, with the pink and canary copies peeking out only beneath the Home sheet; text, rules and the header band are printer's navy ink; the Control Number is the red figure of a numbering machine. The app is the ledger that accounts for every serial, so the most legible thing on any Enforcer screen is the current number, and outcomes arrive as rubber-stamp marks rather than coloured pills.

Density follows the role. The Enforcer's phone view is one column, 640px wide at most, with 44 to 60px targets for one hand and gloves, readable in sunlight. Office Admin and Verifier work at a desk in a 1240px ledger of ruled tables and filter boxes beside a left rail. Both share the same paper, ink and rules. A Night theme swaps the paper for dark asphalt while the serials stay bright.

The world turns down the default government app: no bright app-blue bar, no rounded white cards, no pill badges. Forms are boxed with 1px ink rules and square corners, like a printed form.

**Key Characteristics:**
- Navy ink on white sheets over a white ground; canary copy for Not synced and warnings.
- Red is scarce. It marks Control Numbers, the current tally cell and Void/danger, and nothing else.
- Courier Prime Bold for serials only; Archivo, slightly condensed, for everything else.
- Square sheets and inputs drawn with 1px ink rules; a 4px ink rule across the top of every sheet.
- Outcomes are 3px double-ruled uppercase stamps. Account statuses are single-rule marks.
- Light and Night themes share one token set.

## Colors

A three-copy carbonless palette (white, pink, canary) printed in navy ink, with one red for the numbering machine and a few stamp-pad inks for outcomes.

### Primary
- **Printer's Navy** (ink): body text, all rules on forms, the header band, primary buttons, selected tabs/chips/steps, nav badges, the done cells of the tally. It does every job red is not allowed to do. On hover it lightens to Lifted Navy (ink-hover).

### Secondary
- **Numbering-Machine Red** (serial): Control Numbers wherever they appear (in Courier Prime), the outline of the current tally cell, the text caret, Void stamps, danger buttons, error text and error borders. Night lifts it to Night Serial (night-serial) so it stays bright on asphalt. Void Wash (void-bg) is the tint behind incident and error panels.

### Tertiary
- **Canary Copy** (canary) with **Canary Rule** (canary-line) and **Canary Ink** (canary-ink): Not synced tags, the offline banner, warnings, unread ID fields, and text selection. Canary always carries canary-ink text.
- **Stamp-pad inks**, each paired with a pale wash for panels: **Ledger Green** (done / done-bg) for Done and Issued, **Slate Grey** (cancel / cancel-bg) for Cancelled, **Treasury Violet** (paid / paid-bg) for Paid and the payment panel, **Amber Pending** (pending / pending-bg) for pending accounts.

### Neutral
- **White Ground** (ground): the page behind every sheet. In light mode it is white, so sheets carry a 1px rule-2 edge (card-edge) to stay distinct; Night keeps its dark ground and drops the edge. Pressed Ground (ground-2) is the deeper ground.
- **Top-Copy White** (sheet): sheets, inputs, chips, tables, the nav bar and rail. Faint Sheet (sheet-2) is for hover rows, table footers, checked rows, and the selected rail item and Demo person.
- **Pink Copy Edge** (pink-copy): only for the copy that peeks under the Home sheet, with the canary copy below it. Night version is night-pink-copy.
- **Ink greys**: ink-2 for secondary text and labels, ink-3 for muted text and placeholders, field-stroke for unselected checkbox, radio and ghost-button outlines.
- **Rules**: ink is the form rule (input borders, box rows, segmented controls, table head underline). rule-2 is the light rule for list dividers, the nav border, perforations and dashed empty states. rule-3 is the faint rule inside key/value lists and table bodies.
- **Band Sub** (band-sub): secondary text on the navy header band.

### Named Rules
**The Numbering-Machine Rule.** Red belongs to Control Numbers, the current tally cell and Void/danger. Navigation, steps, badges, selected states and primary actions are ink. If red shows up anywhere else, it is a defect. (The Voided boxes on the Stats summaries count as Void.)

**The Three Copies Rule.** White is both the working surface and the page; pink appears only as the copy edge under the Home sheet; canary means the record isn't synced or needs attention. Don't use canary for decoration.

**The Night Ink Rule.** Night is a full token swap (`prefers-color-scheme: dark` or `data-theme="dark"`), not a filter. Stamps and serials take their lifted Night inks; ink becomes the light text colour and on-ink becomes dark.

## Typography

**Display Font:** Courier Prime Bold 700 (with Courier New, ui-monospace), for serials only
**Body Font:** Archivo variable 400–800, width 62–125% (with system-ui, Segoe UI, Roboto)

**Character:** Archivo, condensed to about 88% for headings and figures, reads as a printed government form: firm and plain. Courier Prime is the numbering machine's typewriter face, and it appears only where a Control Number or a file code appears.

### Hierarchy
- **Serial Display** (700, 3.25rem, line-height 1): the current Control Number at the top right of the Home sheet. Steps down to 2.25rem (record header), 1.375rem (record bar) and 1.0625rem (list rows and tables). Always red, always tabular.
- **Headline** (750, 1.75rem, 1.15, width 88%, -0.01em, balanced): page titles. Sheet and dialog titles use the same face at 1.25rem.
- **Title** (700, 1.125rem, 1.3): section headings inside sheets, with an optional leading icon.
- **Figure** (750, 1.75rem, 1.1, width 88%, tabular): counts in box rows and stat grids. On the Stats summaries the figure takes the box's on-ink text colour.
- **Body** (400, 1.0625rem, 1.5): all running text. Leads are ink-2 with a 65ch maximum.
- **Label** (650, 0.875rem): field labels above inputs, in ink-2. "Optional" goes inline in the same label at weight 400 and ink-3.
- **Box Label** (700, 0.6875rem, 0.1em tracking, uppercase, ink-2): printed captions inside ruled boxes, sitting directly over the value they caption (CONTROL NO., USED, FORMS LEFT).
- **Stamp** (700, 0.75rem, 0.09em tracking, uppercase, width 92%): outcome stamps. 1rem in the large size.

### Named Rules
**The Typewriter-Only-For-Numbers Rule.** Courier Prime is used for serials, serial inputs and file/violation codes, and nowhere else. Headings and UI stay in Archivo.

**The Tabular Figures Rule.** Every number that can sit in a column (serials, counts, times, pager numbers, table numbers) uses `tabular-nums`.

## Layout

Phones get one column: a 640px maximum page with a 16px gutter (gutter) and 20px top padding, a sticky 56px navy header band, and a fixed 64px bottom tab bar (nav) with safe-area insets. Inside sheets, spacing runs 14–16px; form fields stack 14px apart (stack). Sections are 20–24px apart (section).

At 900px and up the shell becomes a grid: a 232px left rail (rail) sticky under the band, and the content beside it. Office Admin and Verifier pages widen to 1240px with 28px/32px page padding. The Enforcer Profile page widens to 1240px too, so all three Profile pages match. Recording and auth use a focus mode with no rail or tab bar.

Below 760px, ledger tables reflow into stacked two-column records, each cell labelled by its column name. Desktop filters sit in a white box with a light rule and use a 165px auto-fill grid (four selects plus a search and date row from 1100px). Below 760px they fold behind a Filters toggle, and the panel closes again as soon as a filter is picked or cleared.

The recording flow keeps a sticky footer bar on a 92% ground wash with a 6px backdrop blur, so Back/Next stay within reach of the thumb.

## Elevation & Depth

The paper lies flat. Sheets get a soft two-layer paper shadow plus a 1px rule-2 edge so they read as a top copy resting on the white page, and depth only becomes pronounced for things that float above the page: toasts, dialogs and the demo panel. Structure comes from ink rules, not shadows. Nested containers (a table inside a sheet section) drop the shadow and use a light rule.

### Shadow Vocabulary
- **Paper** (`box-shadow: 0 1px 2px rgba(28,43,74,.10), 0 6px 18px rgba(28,43,74,.07)`): sheets, citation cards, checklists, ledger tables, and the peeking copies.
- **Lifted** (`box-shadow: 0 10px 30px rgba(14,19,32,.22)`): toasts, dialogs. Dialogs sit over a navy scrim (`rgba(14,19,32,.55)`).
- Night variants: `0 1px 2px rgba(0,0,0,.4), 0 6px 18px rgba(0,0,0,.25)` and `0 10px 30px rgba(0,0,0,.5)`.

### Named Rules
**The Stacked Copies Rule.** The Home sheet carries the pink copy edge and the canary copy edge peeking 7px and 14px below it, each inset 6px further. This is the world's signature, and it belongs only on the sheet showing the current Booklet.

## Shapes

Square paper, slightly softened controls. Sheets, inputs, selects, segmented controls, chips, box rows, stat grids, tables and dialogs have no corner radius (sheet). Every sheet, ledger table and dialog is capped with a solid ink rule across the top: 4px on sheets, tables and checklists, 3px on citation cards, 5px on dialogs. Inputs and boxed forms use 1px ink rules. Tables use a 1.5px ink rule under the header and above the footer.

Buttons, type tabs, choice rows, alerts and panels take a 4px radius (control). Stamps, tags, and the brand mark take 3px (mark). Perforations are 2px dashed lines (6px dash, 5px gap in rule-2) that divide the head of a sheet from its body. Dashed outlines mean "not yet": a type with no Booklet, an empty photo slot, an empty state.

The few round shapes are functional only: radio dots, step numbers, the switch track and its knob.

## Components

### Buttons
Heavy and plain, like the ink on the form.
- **Shape:** gently softened (4px), 1.5px border, weight 650, 1rem. Heights are 40px (sm), 44px (default), 52px (lg) and 60px (xl, the Start citation action, full width).
- **Primary:** navy fill, white text. Hover lightens to ink-hover. Disabled is rule-2 with ink-3 text.
- **Ghost:** transparent, field-stroke border, ink text. Hover fills sheet-2 and turns the border ink.
- **Danger / Danger ghost:** red fill with white text, or a red outline that fills void-bg on hover. Only for Void and destructive confirmations.
- **Press:** moves down 1px. **Focus (global):** a 3px ink outline offset 2px, with a 6px canary halo.

### Chips and Type Tabs
- **Filter chips:** square, 40px, 1px ink rule, white with ink-2 text and an optional tabular count. Selected chips fill navy.
- **Type tabs:** 44px, 4px radius, 1.5px rule-2 border on white. The selected tab fills navy. A tab for a type with no Booklet gets a dashed border and muted text. On phones the row scrolls sideways; on desktop it wraps.

### Sheets / Containers
- **Corner Style:** square.
- **Background:** white (sheet) with a 1px rule-2 edge on the white ground.
- **Shadow Strategy:** Paper (see Elevation).
- **Border:** a 4px ink rule across the top only.
- **Internal Padding:** a 14/16px head, a dashed perforation, then a 16px body on a 14px grid gap.
- **Citation card (list row):** a sheet with a 3px top rule, 12/14px padding, and the red serial with the stamp aligned right on the top line.

### Inputs / Fields
- **Style:** white, 1px ink rule, square, 48px minimum height, 10/12px padding. Selects use a navy chevron. Textareas start at 96px.
- **Hover:** the rule thickens to 2px with an inset ink shadow. **Focus:** the global ink outline with the canary halo.
- **Serial input:** red Courier Prime Bold at 1.25rem with 0.04em tracking. The placeholder falls back to Archivo.
- **Error:** the border turns red and red error text sits under the field. **Read/unread (ID reading):** read fields get a green-tinted border with a green check mark; unread fields get a canary-washed fill, a canary-line border and a canary mark.
- **Segmented control:** square, 1px ink rule and ink dividers. The selected segment fills navy.

### Navigation
- **Header band:** navy, 56px, sticky. It holds the brand mark (a square with a 1.5px rule and a file icon) and the name, plus the user's name and agency in band-sub on the right.
- **Phone tab bar:** white with a top rule-2 border and five items (24px icon plus a 0.75rem label) in ink-3. The active item turns ink and gets a 3px ink bar along its top edge. Count badges are navy squares with 2px corners. The Enforcer's bar puts Home in the center (Type, Citations, Home, Stats, Profile). Home is a 56px navy circle with an on-ink icon, raised 20px above the bar with a 4px sheet ring. It is always filled; when active it gets a bold label instead of the top bar. This is the one deliberately round element in the system, phone only; the rail keeps Home first and square.
- **Desktop rail:** white with a right rule-2 border. Items are 10/12px with a 20px icon. The active item fills with Faint Sheet (sheet-2), outlined by a 1px inset ink rule, in weight 700. Sign out sits at the bottom.

### Outcome Stamps (signature)
Rubber-stamp marks: a 3px double-ruled border in currentColor with 3px corners, uppercase Archivo 700 at 0.09em tracking. Done/Issued is green, Cancelled grey, Voided red and Paid violet. Unpaid is not a stamp; it is a quiet tag with a rule-2 outline. When a citation is marked Done, the stamp lands (scale 1.8 → 1, rotate −8° → 0, 0.5s) and the next serial rolls up into place (0.6s clip reveal). Both use the house ease `cubic-bezier(.16,1,.3,1)`.

### Account Marks
Account statuses (Active, Pending, Rejected, Inactive) are single-rule marks: a 1px currentColor border, square, 0.8125rem, weight 700. They stay visually lighter than outcome stamps so that a person's status never reads as a Citation outcome.

### Tally Strip (signature)
An 18px strip with one cell per form in the Booklet, 2px apart. Done cells are navy, Cancelled cells are grey diagonal hatching, Voided cells are red, and unused cells are rule-3. The current cell is white with a 2px red inset outline.

### Box Row and Stat Grid
Ruled boxes in 1px ink, like the boxes on a printed form. Each box holds a box label over a figure, both centered horizontally. A box row (Used / Forms left on Home) is one joined block with ink dividers. Stat grids are two columns of separate boxes, each with its own 1px ink rule and a 10px gap; the five-cell variant spans its first cell (Issued) across both columns, so Unpaid and Paid below line up with its edges. Enforcer Stats shows a Today card and a This month card, each with four boxes in two rows of two: side by side from 600px, stacked (Today first) on phones. Its boxes are filled solid, with on-ink text: Citations in Ledger Green (done), Violations recorded in navy ink, Cancelled forms in Amber (pending), Voided forms in red (void). The Verifier summary uses the same solid fills: Issued in Ledger Green, Unpaid in navy ink, Paid in Treasury Violet, Cancelled in Amber, Voided in red. Night uses each token's Night ink.

### Ledger Tables
White, with a 4px ink top rule when standalone, a 1.5px ink rule under the head, rule-3 row dividers and a sheet-2 footer. Numbers are right-aligned and tabular. Serials in tables are red underlined links. Below 760px rows stack into labelled records.

### Alerts, Toasts, Dialogs
- **Alerts:** 4px radius with a 1.5px border. Error is void-bg with a red border and red icon; warn/sync is canary; ok is done-bg.
- **Toasts:** navy (canary when offline, red for errors), Lifted shadow, centered just under the header band on every screen size, newest on top. They drop 8px on entry and may briefly cover the offline banner.
- **Dialogs:** square white sheets with a 5px ink top rule, a 20px form and right-aligned actions (ghost cancel, then primary or danger). Destructive dialogs can require the user to type the Control Number. They enter with a 12px rise over 0.22s.

### Steps
Three equal steps, each with a 3px bottom rule. Pending steps are ink-2 on rule-2. Completed steps are green with a check in the numbered circle. The current step is ink with a filled navy circle.

## Do's and Don'ts

### Do:
- **Do** make the current Control Number the largest, reddest thing on the Enforcer's screen (Courier Prime Bold, up to 3.25rem).
- **Do** use navy ink for every selected, active or primary state: tabs, chips, segments, steps, nav, badges, primary buttons.
- **Do** keep sheets, inputs, chips, tables and dialogs square, drawn with 1px ink rules and capped with an ink top rule.
- **Do** show Citation outcomes as 3px double-ruled uppercase stamps, and account statuses as 1px single-rule marks.
- **Do** use canary only for Not synced, offline and warnings, always with canary-ink text.
- **Do** keep touch targets at 44px or more (60px for the main field action) and keep WCAG AA contrast in both Light and Night.
- **Do** put box labels (uppercase 0.6875rem, 0.1em tracking) only inside ruled boxes, directly over the value they caption.

### Don't:
- **Don't** use red on navigation, steps, badges, headings or decoration. It is reserved for Control Numbers, the current tally cell and Void/danger.
- **Don't** use a bright app-blue header, rounded white cards or pill badges. The band is printer's navy ink and badges are square.
- **Don't** set any text other than serials and codes in Courier Prime.
- **Don't** give outcome stamps a fill, or turn account marks into double-ruled stamps.
- **Don't** put a fine amount, price or total in any component.
- **Don't** invent logos, seals or official insignia; the brand mark is a plain ruled square with a file icon.
- **Don't** use uppercase tracked labels as eyebrows above headings. They only caption values in ruled boxes.
