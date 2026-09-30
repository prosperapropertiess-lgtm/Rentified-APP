# Email Notifications — What's Wired, What's Not

Full audit of every place in Rentified an email currently fires from, plus every real gap worth wiring next. All real transactional email goes through Resend (`RESEND_API_KEY` / `RESEND_FROM_ADDRESS` edge function secrets), one edge function per purpose (or one multi-type dispatcher for closely related small sends — see `notify` below).

## Wired today

| Trigger | Function | Recipient(s) | Notes |
|---|---|---|---|
| Landlord adds a resident | `send-tenant-invite` | New tenant | PIN + how-to-download instructions. Existing, already working. |
| Landlord adds a resident | `notify` (`resident_added_confirm`) | Landlord | **New this pass.** Confirms the resident was added and invited. |
| Landlord finishes owner onboarding | `notify` (`welcome_landlord`) | Landlord | **New this pass.** Fired right after the `landlords` row is created. |
| Landlord ends a lease / removes a resident | `notify` (`lease_ended`) | Both landlord and tenant | **New this pass.** Wired into the new "End Lease" action on the Residents tab. |
| Rent due soon / overdue | `rent-reminders` | Tenant | Existing. Also writes `app_events` on every failure (Observability pass). |
| Property announcement | `announcements` / `process-scheduled-communications` | All active leaseholders on a property, or one tenant directly | Existing. Scheduled sends resolve the real audience at fire time, not at schedule time. |
| Any of the above delivered/bounced | `resend-webhook` | — (updates delivery status in `communication_deliveries`) | Existing, but **only receives events once you register the webhook in the Resend dashboard and set `RESEND_WEBHOOK_SECRET`** — see the separate note already given for this. |

## Real gaps — gathered here, not yet built

Roughly in order of how much a landlord would actually miss them:

1. **Maintenance request created → landlord email.** Right now a new maintenance request only shows up if the landlord happens to open the app. No email nudge exists. High value, small build (mirrors the `notify` pattern).
2. **Maintenance status changed → tenant email.** A tenant who reported a leaky faucet has no way to know it moved to "in progress" or "resolved" except reopening the app.
3. **Payment received → tenant receipt.** `rent-reminders` covers "you owe," but there's no "we got it, thanks" confirmation when a payment is recorded or marked paid.
4. **Lease expiring soon → landlord reminder.** `leases.end_date` already exists and is queryable; nothing currently emails a landlord "this lease ends in 30 days, plan ahead."
5. **Document expiring soon → landlord email.** The Document Vault's "Needs Attention" section already computes this in-app (documents expiring within 30 days) — it just doesn't also email. Cheapest gap to close, the query already exists.
6. **LTB notice status change → landlord email.** Notices move through a real state machine (DRAFT → READY_TO_SERVE → WAITING_PERIOD → ELIGIBLE_FOR_APPLICATION, etc.) with no email at any transition — landlords only see this by opening the LTB tab.
7. **Tenant's own first-login welcome.** The invite email doubles as onboarding today; there's no separate "welcome, here's what you can do" once a tenant actually sets up their account, unlike the landlord side (which now has one, from this pass).
8. **New message → email fallback.** Direct messages between landlord and tenant are in-app/polling only; no email fallback if the recipient doesn't have the app open (announcements already support `IN_APP`/`EMAIL`/`SMS` channel selection — direct messages don't yet).

None of these are wired yet. Happy to take them in order, or pick specific ones — 1 and 2 (maintenance) are probably the highest-value next pair since they're the most "did I miss something important" gap for a landlord.
