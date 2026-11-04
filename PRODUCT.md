# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Static HTML/CSS/JS, no build step, no framework. One `index.html`, ES modules, reference data in `/data/*.json` fetched at start-up (so it must be served, not opened as a file). Confirmed by the user.

## Users

- **Enforcer**: a field officer in one Agency (Traffic Enforcement, Police, Public Safety Office, Civil Security Unit). Uses a mid-sized Android phone held in one hand, outdoors on the street, often in strong sunlight, sometimes at night, often with a weak or no signal. They are standing in front of a Violator, writing on a pre-numbered paper form, and use the app to record that form by its Control Number.
- **Office Admin**: one per Agency, at a desk on a PC. Approves or rejects sign-ups, deactivates and reactivates Enforcers, sees counts per Enforcer, an Overview with Needs-attention flags, Booklets in hand, and a This-month Heatmap of their Agency (area totals only, areas under 3 hidden). Never sees Citation contents.
- **Verifier**: one, city-wide, at the Treasury Office, at a desk on a PC. Sees every Citation and marks Issued Citations Paid with an Official Receipt number. Also has the Booklets ledger, Unpaid by days since issued, Repeat Violators, a city-wide Heatmap, and CSV/Print for reports.

## Product Purpose

Make sure every Control Number on every paper Citation form is accounted for: issued (Done), Cancelled or Voided, never skipped and never used twice. The paper form stays the official Citation; the app is the ledger that proves no form went missing. Success: at any time, every number in every Booklet has exactly one recorded outcome, and the Treasury Office can see which Issued Citations are Paid.

## Positioning

A numbering ledger for paper forms, not a digital ticket. The app only ever offers the current number in the Booklet, in strict order, and the Enforcer matches it to the paper in hand. It records no fine amounts anywhere.

## Operating Context

- Enforcers receive Booklets (consecutive Control Number ranges per Citation Type) from the Treasury Office and register them in the app.
- Recording a Citation: pick Violations, take camera-only photos (ticket form, ID unless "No ID", plate for Traffic), Violator Details read from the ID or typed, then Review → Mark Done, Cancel, or Incident Report → Void.
- Works offline; Citations recorded offline are marked Not synced until back online.
- Prototype: no backend; Booklets, Citations and new Violator Records live in memory; Registrations and account status changes in browser storage; a Demo panel switches users and online/offline.
- Full functional spec: `BUILD-PROMPT-FUNCTIONAL.md` (supplied by the user; the authority for rules, flows and exact messages).

## Capabilities and Constraints

- Domain words from the spec are used verbatim in screens and code: Agency, Enforcer, Citation, Citation Type, Control Number, Booklet, Violation, Violator, Violator Details, Violator Record, Done/Issued, Cancelled, Voided, Incident Report, Registration, Official Receipt number.
- Done is labelled "Issued" on Office Admin and Verifier pages.
- No fine amounts, prices or totals anywhere. No passwords in any JSON file. Passwords for Registrations stored only as salted SHA-256 hashes.
- English UI now; every user-facing string kept in one strings module so a Filipino translation can be added later.
- Must work on a phone and on a PC.
- Real ID reading must run on-device with no paid cloud services; the prototype simulates it.
- Data Privacy Act (RA 10173): never ship real Violators' personal data in served files. Sample data is made up.

## Evidence on Hand

Sample reference data (agencies, Citation Types, Violation Types, Enforcers, Admins, Violator Records, Booklets, Citations) is fully specified in the spec and is synthetic. No logos, seals or official branding have been supplied; none may be invented or imitated.

## Product Principles

1. The number is the point. The current Control Number is always the most legible thing on the Enforcer's screen.
2. Final means final. Done, Cancelled and Voided can't be edited; the interface never suggests otherwise.
3. Never lose work in the field. Offline, interrupted, mid-ID-reading: photos and drafts are kept. Only the Enforcer's own Discard clears a draft, and it asks first.
4. Say exactly what's missing. Blocks name the item and jump to it.
5. Each role sees only what it must. Office Admins never see Citation contents; Enforcers never see payment details.

## Accessibility & Inclusion

Readable in direct sunlight and at night on a phone; large touch targets for one-handed use, possibly with gloves. WCAG 2.1 AA contrast as the floor.
