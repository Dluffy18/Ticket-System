# Citation Ledger

A numbering ledger proving every Control Number on every paper Citation form has exactly one recorded outcome.

## Language

**Done**:
The outcome of a Citation that was issued to a Violator. Shown as "Issued" on Office Admin and Verifier pages.
_Avoid_: Completed, closed

**Status**:
The recorded outcome of one Control Number: Done, Cancelled or Voided. Enforcer pages call it "Status"; Office Admin and Verifier pages head the same thing "Outcome".
_Avoid_: Result, state

**Paid**:
The payment state of a Done Citation once the Treasury Office records its Official Receipt number. Not a Status; Cancelled and Voided forms are never Paid. Only the Treasury Office sees whether a Citation is Paid; Enforcers don't.
_Avoid_: Settled, closed

**Unpaid**:
A Done Citation with no Official Receipt recorded yet. Cancelled and Voided forms are never Unpaid.
_Avoid_: Outstanding, owed

**Not synced**:
A Citation recorded while offline that hasn't reached the server yet. Its mark in Citation lists reads "Unsynced"; filters, alerts and the Citation itself say "Not synced".
_Avoid_: Pending, offline, queued

**Citations (count)**:
On an Enforcer's Stats, the number of Done Citations only. Cancelled and Voided forms are counted separately, so forms used = Citations + Cancelled forms + Voided forms.
_Avoid_: Forms used, tickets

**Discard**:
Clearing everything entered for the current Control Number (violations, photos, Violator details) without recording a Status. The number stays open, and the next Citation starts blank on it. Only the Enforcer's own Discard clears a draft; interruptions keep it.
_Avoid_: Cancel, restart, reset

**Violator's photo**:
A photo of the Violator themselves, taken when the Citation is issued, separate from the photo of their ID. Required on every Citation, including when the Violator has no ID; a refusal doesn't excuse it.
_Avoid_: Face photo, selfie, mugshot

**Booklet**:
A consecutive range of Control Numbers for one Citation Type, handed to one Enforcer by the Treasury Office.
_Avoid_: Pad, stack

**Registered (Booklet)**:
When the Enforcer entered the Booklet's first and last Control Number in the app, before using it. Not when the Treasury Office handed it over; that moment isn't recorded.
_Avoid_: Received, issued (for a Booklet)

**Repeat Violator**:
A Violator Record with two or more Done Citations. Cancelled and Voided forms don't count, because no Citation was issued on them.
_Avoid_: Repeat offender, habitual violator

**Super Admin**:
The one account above every office, held by the CICT Office of the City Government of Mati. Sees every account, gives Office Admin or Verifier access, and can approve, reject, deactivate or reactivate any account. Nobody signs up as a Super Admin.
_Avoid_: System Admin, root, owner

**Temporary password**:
A password made by the app when the Super Admin, or an Enforcer's Office Admin, resets someone's password. It's shown once, and works for one sign-in only: the person must set their own password before doing anything else.
_Avoid_: Default password, reset code

**Activity log**:
The Super Admin's list of everything done to accounts: sign-ups, and every decision, role change, detail correction and password reset made by an Office Admin or the Super Admin. People changing their own password aren't in it.
_Avoid_: Audit trail, history (that's one account's own list)
