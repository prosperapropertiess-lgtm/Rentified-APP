# AI-Guided Owner Onboarding — Build Status

Last updated: 2026-08-31.

**Scope decision, made with Ebin explicitly**: the source spec (`~/Downloads/BUILD - COMPLETE_ AI-GUIDED OWNER ONBOARDING.md`) describes a full AI document-parsing pipeline (LLM extraction, cross-document matching, confidence scoring, conflict resolution). That's genuinely a multi-week system, and this app has **no AI/LLM provider wired in at all** — no API key, no existing edge function calling an LLM. Rather than fake a "complete" AI pipeline or silently build a fraction of it and call it done, I asked Ebin directly. He chose: **skip AI extraction for now, build the real structured-import path** (spreadsheet/CSV column-mapping, review, commit) so it's genuinely useful today, with AI-powered lease-PDF parsing as a clearly-scoped future addition once there's a provider key.

## Phase 1 audit — what already existed (before this session)

- **Role-select + PIN login**: already fully built and working (`(auth)/role-select.tsx`, `pin-entry.tsx`, a live `pin-login` edge function). Not something I needed to build.
- **"Property Partner" wording**: already the live owner-facing label throughout the app — not a placeholder.
- **Landlord account onboarding**: `(onboarding)/landlord.tsx` — a 4-slide carousel ending in a real form (name/phone/PIN) that creates the `landlords` row. Already worked, reused as-is.
- **Document upload pattern**: `(tabs)/documents.tsx` — proven pick → base64 read → Storage upload → signed-URL pattern, reused for this feature's file picking (not its upload-to-Storage part, since import files are parsed client-side and never need to live in Storage).
- **AI/LLM integration**: none anywhere in the codebase.
- **Spreadsheet/CSV parsing**: none — no `xlsx`/`papaparse` installed.
- **A real, unrelated bug found during the audit**: `add-tenant.tsx` was inserting into three columns that don't exist on the live schema (`tenants.unit_id`, `tenants.full_name`, `tenants.status`, `leases.deposit_amount` — the live schema uses `first_name`/`last_name` and `leases.security_deposit`, and tenants relate to units only through `leases`, not a direct column). This meant **adding a new resident through the app was broken** — every insert would fail with a "column does not exist" error. Fixed as part of this work since the new import code needed to match the exact same real schema anyway, and it's core to the actual most-important pillar (vacancy → tenant).

## What was built this session

**Entry flow** (the concrete thing Ebin asked for first): `role-select.tsx` → "I'm a Property Partner" now goes to a new `(auth)/owner-entry.tsx` fork screen — "I'm a new Property Partner" (→ account creation → portfolio import) vs. "I already have a PIN" (→ existing PIN login, unchanged). Had to adjust one line in `_layout.tsx`'s global auth-redirect guard so a freshly-created landlord isn't auto-bounced to the dashboard before reaching the import screen — the same exemption pattern already used for `set-password`.

**Structured import pipeline** (`src/lib/onboarding/`):
- `columnMapping.ts` — deterministic header-normalization + synonym dictionary (address, unit, tenant name, email, phone, rent, lease start/end, deposit, status, city, province, postal code). Exact matches vs. partial "guess" matches vs. genuinely unmapped, per the spec's example ("Monthly Amount" → Rent, confirm?). Also address/unit normalization for duplicate detection (treats "1577 Purser St" / "Street" / "STREET" as the same). **7 passing tests.**
- `spreadsheetParser.ts` — reads a base64-encoded CSV/XLSX via `xlsx` (SheetJS, newly installed — the only new dependency added). Handles multi-sheet workbooks, blank sheets, and title rows above the real header (scans for the first row that looks like a header instead of assuming row 1). Does **not** handle merged cells specially or duplicate header rows mid-sheet — known, documented limitation, not silently pretended to work.
- `importDraft.ts` — turns mapped rows into an in-memory draft: groups rows into properties (by normalized address) and units (by unit label within a property), parses money/dates loosely, and determines per-unit missing-field issues (a unit that looks occupied but has no tenant name or rent gets flagged; a unit with no tenant and no rent is treated as vacant, not an error). Also compares draft properties against the landlord's real existing properties to catch likely duplicates before creating anything. **7 passing tests**, including the exact "messy spreadsheet" shape from the spec.

**UI** (`(onboarding)/import.tsx`) — one screen, five stages:
1. **Entry**: "Upload Files" (multi-file CSV/XLSX picker) or "I'll enter things manually" (routes to the existing `add-property.tsx` — reused, not rebuilt).
2. **Mapping confirmation** — only shown if any column wasn't an exact synonym match; lets the owner correct a wrong guess or mark a column "Ignore."
3. **Review** — real counts (properties/units/occupied/vacant/scheduled rent), duplicate-property choices (Same property / They're different / Skip), and inline fields to fill in exactly what's missing — nothing else. Matches the spec's "everything looks good except N things" framing.
4. **Committing** — creates properties → units → tenants (with a real login PIN, same generation/collision-retry pattern as `add-tenant.tsx`) → leases, property by property. If one property fails partway, it's rolled back (tenant row deleted if the lease insert fails) and the rest of the import continues — a bad property doesn't kill the whole import.
5. **Done** — real created counts, a plain-language list of anything that failed, and an explicit note that **bulk-imported residents get a login PIN but are not automatically emailed an invite** (a deliberate choice — mass-emailing a landlord's entire tenant list the moment they finish a first-time upload is the kind of one-way side effect that shouldn't happen without being asked for).

## Second-pass fixes (same day, after the audit above)

- **Save & resume** — the draft now autosaves to `AsyncStorage` (already used elsewhere in this app for the Supabase session, so no new dependency) every time the review draft changes — an edit, a duplicate-property decision. On return to the entry screen, a real saved draft (properties/units/edits/choices, not just "you had a file open") shows with Resume / Start Over. Cleared automatically once a commit succeeds. **Scope note, still real**: this is single-device resume (same phone), not a server-staged draft that would also survive switching devices — see `draftPersistence.ts`'s header comment. Not the full `OnboardingSession`/`ImportDraftProperty` DB architecture the spec describes, but the actual behavior asked for ("close browser, lose internet, refresh, come back later... resume where you stopped") now works.
- **Double-tap protection on Finish Setup** — fixed with a `useRef` guard checked synchronously at the top of `commitPortfolio()`, not just the `stage` state that gates the button's visibility. React state updates aren't synchronous, so a fast double-tap could previously call the commit function twice before the button actually disappeared from the screen; the ref blocks re-entrancy immediately regardless of render timing.

## What was deliberately NOT built (by choice, not oversight)

- **Any AI/LLM extraction** — lease PDF parsing, entity extraction, confidence scoring, hallucination guardrails. Needs a provider key first (see the scope decision above).
- **Cross-document matching** (spec's core "leases.pdf AND properties.xlsx AND rent-roll.csv become one tenancy") — only makes sense once lease-PDF extraction exists; right now there's one structured source (spreadsheets) so there's nothing to cross-match yet.
- **Conflict detection between two sources disagreeing** (e.g. spreadsheet says $1,850, lease says $1,900) — same reason, needs two sources.
- **One-question-per-screen missing-info flow** — the spec wants each missing field asked on its own screen; this build shows all missing fields inline in the review list instead. Faster to build, still meets "only ask what's missing," just not the exact one-at-a-time UX.
- **Analytics events, animations/count-up moments, accessibility pass, large-portfolio virtualization (100+ properties)** — none of this was touched.
- **Google Sheets / scanned-image / Word-doc input** — only CSV/XLSX.

## Testing

`npx jest src/lib/onboarding` → 14/14 passing. `npx jest` (whole app) → 72/72 passing. `npx tsc --noEmit` and `npx expo lint` both clean (2 pre-existing unrelated warnings only).

**Not tested**: no live device test of actually picking a real file and running it through the full flow — same limitation as the LTB PDF work, this sandbox has no GUI automation. First thing worth doing by hand: upload a real small spreadsheet (3-5 rows, a couple of vacant units, one duplicate-looking address) and walk it through to Finish Setup.

## Honest answer to the spec's own required questions

- **Median expected user input steps**: for a clean spreadsheet with no missing fields and no duplicates — one file pick, one tap (Finish Setup). Realistically, most real-world sheets will surface at least one missing-field edit or one duplicate-property decision.
- **What's still preventing a true <5-minute onboarding for messy real data**: no AI parsing means lease PDFs still need manual entry (or CSV export first); no cross-document reconciliation means multiple files with the same info won't merge cleanly; no resume-from-crash means a lost connection mid-review costs the owner the whole re-upload.
