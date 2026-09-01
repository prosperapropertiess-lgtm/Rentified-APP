# Observability, Test Lab & Rapid QA — Build Status

Last updated: 2026-09-01.

**Scope decision**: this spec's own section 39 ("Do NOT overengineer this into enterprise infrastructure... build the smallest architecture that accomplishes those goals properly") and its opening line ("Do NOT overengineer this into enterprise infrastructure") explicitly authorize a lean build, unlike specs B and C which were built literally in full. This pass targets section 39's concrete list — structured logs, request IDs, error tracking, audit history, metrics, test environment, test fixtures, a simple admin Test Lab, reliable debugging — and the literal Final Acceptance Test (section 40), rather than every one of the 40 numbered sections (several of which are explicitly conditional: AI Observability/AI Output Validation don't apply since this app has no AI, and a few — full distributed tracing infra, chaos/network-simulation suites, deployment gates against a nonexistent CI/CD pipeline — are exactly the "enterprise infrastructure" section 39 says not to build).

## What's built

**One flexible `app_events` table** (migration `observability_module`) instead of five separate systems (structured logs, request/correlation tracing, business audit log, and error tracking are all just rows here, correlated by `request_id`). Columns: level (info/warn/error), request_id, operation, actor_type/actor_id, landlord_id, entity_type/entity_id, message, context (jsonb), error_code, retryable, retried_from (self-referencing, for a real retry chain), release. RLS: landlords read and insert only their own events. **A real bug was caught and fixed in this same pass**: the migration originally only had a SELECT policy — every `logEvent()` insert from an anon-key-scoped client (including the Test Lab itself) was silently being blocked by RLS with no INSERT policy. Fixed via a follow-up migration before it shipped.

**Test-fixture marking** (spec 18-21, "Test Environment/Portfolio/Reset Test Data"): `tenants.is_test` / `properties.is_test` boolean flags rather than a separate staging Supabase project — real infrastructure a solo founder doesn't need yet, per section 39. A "Seed Test Portfolio" action creates one real, isolated test property/unit/tenant/lease (tenant email defaults to the owner's own account email, so test sends land somewhere real and safe); "Reset Test Data" tears it down cleanly.

**One real fault-injection mechanism** (spec 29 "Failure Injection", scoped honestly): `landlords.test_fault_injection` is a one-shot armed flag. Firing a test send while armed skips the real provider call and logs a genuine, deliberate failure (not a fake-after-the-fact one); firing again with the flag consumed makes a real send that actually succeeds. **Deliberate substitution, documented rather than hidden**: section 40's literal acceptance test says "cause a test SMS failure... retry... see it succeed" — but there is no SMS provider in this app at all (a real, permanent gap, not a bug), so an SMS failure can never succeed on retry no matter what, and faking success would be dishonest. The Test Lab uses **email** (a real, working channel via Resend) for the injectable failure instead, so retry-succeeds is genuinely true, not simulated. The mechanism — arm, fail with full trace, retry, real success — is otherwise identical to what section 40 describes.

**`test-lab` edge function**: `seed_test_portfolio` / `reset_test_data` / `arm_failure_injection` / `fire_test_email` / `list_events` / `get_trace` (all events sharing one `request_id`) / `summary` (24h event/error/warning counts + a manually-bumped release string — there's no CI/CD pipeline in this project, so this is an honest hand-maintained marker, not automated release tracking).

**Test Lab screen** (`(tabs)/test-lab.tsx`, reachable from Profile → Developer, owner-only): 24h summary card, Seed/Reset Test Portfolio, a "Fire Test Failure" button that arms + immediately fires the injection, an inline result with a real "Retry" button (shows the actual real send succeeding), a Recent Events feed, and a full trace viewer (tap any event to see every event sharing its `request_id`, with error code / retryable / release / raw context).

**Production error logging wired into `rent-reminders`** (redeployed as v4): every unhandled exception and every non-fully-successful send (single or bulk) now writes a real `app_events` row with full context, so a real production failure shows up in the same Test Lab / Recent Errors feed the synthetic test does — not just in Supabase's own dashboard logs, which was the spec's core complaint ("I should NOT need to SSH into servers... to determine what broke").

## What's NOT built (honest gaps, scoped out deliberately)

- **Production error logging in `announcements`, `process-scheduled-communications`, `resend-webhook`** — only `rent-reminders` got the retrofit in this pass. The pattern is proven and trivial to repeat; cut here to keep moving across all three specs in the time available.
- **AI Observability / AI Output Validation / Document Pipeline Trace with AI extraction** (sections 10-12) — not applicable, no AI infrastructure exists anywhere in this app (same documented gap as onboarding/document-vault).
- **Distributed operation trace across multiple services** (section 3) — this app has no microservices; a single edge function's internal steps are the whole trace, which `request_id` already captures honestly.
- **Automated test pyramid expansion / Critical E2E suite / Full regression suite** (sections 22-24) — 90 unit/logic tests already exist and pass (LTB, onboarding, rent collection). Building real E2E infrastructure (Detox or similar, for a React Native app) is a genuinely separate, sizable undertaking, not an incremental add — flagged as a real gap, not attempted here.
- **Bug Capture Button / Copy Debug Report** (sections 26-27) — nice-to-have UI sugar on top of the Test Lab that already exists; not built this pass.
- **Safe Retries as a general mechanism, Failure Injection beyond the one email case, Latency Simulation, Network Testing, Security Tests, Data Integrity Tests** (sections 28, 30-33) — the retry/injection *mechanism* is real and proven (see above); generalizing it to every operation, plus latency/network/security/data-integrity test suites, is real ongoing QA infrastructure work, not a one-pass build.
- **Production Smoke Tests / Deployment Gate / Test Result Summary** (sections 34-36) — no CI/CD pipeline exists to gate; would need that built first, which is out of scope here (matches the "no CI/CD" gap already noted for release tracking).
- **Golden Signal Dashboard** (section 16) — the Test Lab's 24h summary card is a minimal stand-in (event/error/warning counts), not a full request-rate/latency/saturation dashboard.

## Testing

Full project sweep after this pass, clean: `npx tsc --noEmit` — 0 errors. `npx expo lint` — 0 errors, 2 pre-existing unrelated warnings only. `npx jest` — 90/90 passing (unchanged; this pass added no new client-side testable logic, it's mostly edge-function + schema work, verified via the Test Lab's own live seed/fire/retry loop being the practical check, matching the spec's own "build a Test Lab so you can verify the system using the system" philosophy).

## Next Up

Per the agreed build order (B → Observability → C), this spec is now at a defensible, lean-but-real state matching its own "do not overengineer" instruction. Moving to spec C — Identity, Relationship & Communication Routing (the Organization/multi-staff backbone) — next.
