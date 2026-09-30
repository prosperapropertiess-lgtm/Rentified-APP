# Rentified — Splash / Loading Animation: Motion Design Brief

## 1. What this is for

A loading/splash animation for **Rentified**, a property-management mobile app (iOS/Android, React Native + Expo) built by Prospera Properties. It's the first thing a landlord or tenant sees every time they open the app — a few seconds, full-screen, before the dashboard loads. The goal is a "wow, that's wild" reaction: something fluid, premium, and a little unexpected, not a static logo fade-in.

**This is a splash/loading moment, not a brand video.** It needs to read as intentional in 1.5–3 seconds, work on a phone screen (portrait, 9:19.5-ish), and loop or hold gracefully if the actual data load takes longer than the animation.

## 2. Brand reality (use this, don't invent a new look)

Two identities coexist right now and the designer should know both:

- **The legacy mark** (currently the literal app icon/splash image): a navy crest — crown, laurel wreath, a simple house line-icon, serif "PROSPERA PROPERTIES" wordmark, burgundy rule lines. Ornate, traditional, real-estate-agency energy.
- **The live in-app identity** (what you actually see using the app today — login screen, dashboards, every screen): **"Rentified"**, set in DM Sans Bold, on a warm off-white background, navy as the dominant ink color. Clean, modern, geometric. This is the one the animation should primarily serve.

**Direction for the designer: resolve the tension by having the animation *become* the modern "Rentified" identity** — it can gesture at the house/crest motif abstractly (a roofline, an arch, a doorway) without literally reproducing the ornate crest. Think "the crest's *idea*, rebuilt as clean geometry and fluid motion," not the crest itself.

## 3. Exact palette (hex, use these — do not eyeball from screenshots)

| Role | Hex | Notes |
|---|---|---|
| Background (warm bg) | `#F7F5F2` | Off-white, warm, not pure white |
| Primary ink (navy) | `#1F2F3A` | Deep desaturated navy, near-black |
| Navy muted | `#333333` | Secondary text weight |
| Navy border/neutral | `#D8D2C8` | Warm greige, hairlines |
| Accent (burgundy) | `#8B2030` | Used sparingly — rules, emphasis, never a whole field |
| Card white | `#FFFFFF` | |

Keep it a **two-tone animation** — navy ink moving through warm-white space — with burgundy appearing only as a single accent beat near the end (a spark, a line, a dot), not a wash of color. This is a restrained, editorial palette, not a saturated tech-startup gradient. No blues-and-purples gradient clichés, no neon, no glassmorphism.

## 4. Typography

- **Wordmark**: DM Sans, Bold (700) — geometric sans, confident, slightly tight tracking. This is the typeface actually shipping in the app.
- Secondary/serif accent (optional, for a single refined beat only): Cormorant, Light (300) — already in the app's type system for editorial moments. Use sparingly if at all; this is a supporting flavor, not the headline face.

## 5. What the app actually does (the animation must represent THIS, not brand mood)

Rentified is a real, functioning property-management system. A landlord's day-to-day, before this app, is scattered across a dozen disconnected things: a spreadsheet of rent, a text thread with a tenant about a leaky faucet, a folder of lease PDFs, a bank app to check if rent cleared, a legal-notice template they're not sure is current. **Rentified's actual value proposition is consolidation**: rent collection, maintenance requests, tenant messaging, document storage, and legal/compliance workflows — five genuinely separate systems in most landlords' lives — become one dashboard, one login, one source of truth.

The animation's job is to **make a viewer feel that consolidation happen**, not just look pretty. That's the correlation to the product that was missing before.

### The concept — "Five things, one roof"

Five small, distinct navy glyphs — each a real, immediately-legible pictogram of one core function — enter the frame scattered and adrift, each with its own slightly different fluid drift (they should not move in unison; they read as separate, disconnected things, which is the point):

1. A **coin/dollar disc** (rent & payments)
2. A **wrench** (maintenance)
3. A **chat bubble** (tenant messaging)
4. A **document/page** (leases & document vault)
5. A **shield or gavel mark** (legal/LTB compliance)

These are not abstract blobs — they should read instantly as what they are, simplified to clean geometric icon-line-art (1.5–2px equivalent stroke weight, matching the navy `#1F2F3A`), small enough that no single one dominates the frame.

### Beat-by-beat (target: 2.2–2.8 seconds total, 60fps)

**Beat 1 — Scatter (0.0s–0.6s)**
The five glyphs fade/bloom into the warm-white frame at once, each in a different quadrant, each drifting independently in a small organic float (like separate droplets, each with its own fluid-sim wobble) — visually establishing "five separate, disconnected things." No connection between them yet.

**Beat 2 — Pull / Converge (0.6s–1.4s)**
All five begin moving toward the center simultaneously, each on its own curved path (not a straight line — genuine fluid, weighted easing, like they're being drawn in by a current rather than snapping to a grid). As they approach center, each glyph liquifies — loses its hard edges and becomes a soft navy fluid mass mid-transit, mid-flight, so the "five things" visually dissolve into "one substance" before they arrive. This is the fluid-sim show-off moment: five real, recognizable icons melting into liquid ink as they converge.

**Beat 3 — Resolve (1.4s–2.0s)**
The now-merged liquid mass snaps — fast, confident, the sharpest motion in the sequence, deliberate contrast to the slow converging drift before it — into a single clean roofline/arch stroke: one continuous line suggesting a house or a roof, built from the same "stuff" the five scattered glyphs just were. The read should be unmistakable: *five separate problems just became one structure.* This is the actual product story, not a generic morph.

**Beat 4 — Wordmark + accent (2.0s–2.6s)**
The arch stroke settles as a small mark above/beside "Rentified," set in DM Sans Bold with a confident snap-into-place (slight 2–4% overshoot, ease back). One thin burgundy (`#8B2030`) line draws itself under the wordmark — fast, precise, a single pen stroke. Only burgundy in the whole sequence; punctuation, not decoration.

**Beat 5 — Hold / Loop (2.6s+)**
If real load time exceeds the animation, hold on the resolved roofline + wordmark with a very subtle idle breathe (2–3% scale pulse on a slow sine) — never restart the full scatter-to-resolve sequence as a loop; that story only works told once per app open.

## 6. Motion principles (non-negotiable)

- **Everything eases.** No linear interpolation anywhere. Organic beats (1–2) use soft, viscous easing (long ease-in/ease-out, like `cubic-bezier(0.4, 0, 0.2, 1)` or slower). The resolve moment (beat 3) and wordmark snap (beat 4) use a sharper, more confident ease with a small overshoot — contrast between "liquid drift" and "decisive snap" is the whole point.
- **Volume conservation** on the fluid shape — it should always read as the same mass of liquid, just moving, never stretching thin-to-nothing or ballooning.
- **One continuous take.** No hard cuts between beats — every transition should feel like one unbroken physical gesture, not five separate animations stitched together.
- **Restraint on secondary motion.** No particles, no sparkles, no lens flares, no confetti. The "wow" comes from the physicality and precision of the fluid simulation and the confidence of the resolve moment — not from added effects on top.

## 7. Do / Don't

**Do:**
- Real fluid-sim quality motion (even if hand-animated to fake it) — weighted, physical, viscous
- A genuine "gestalt snap" moment where chaos becomes order
- Restraint — two-tone navy/cream with one burgundy accent beat
- Feel premium/editorial (think a high-end real-estate brand, a design studio reel — not a fintech app, not a game)

**Don't:**
- Generic "morphing blob" loading spinners (this needs a beginning, middle, and resolved end — not an infinite abstract loop)
- Gradient-heavy, neon, or glassmorphic treatments
- Over-detailed, illustrative icon style for the five glyphs (payment/wrench/chat/document/shield) — they must stay simple, single-weight line marks, instantly legible at small size, not clip-art
- Sound-dependent storytelling — assume most users have sound off; if scoring it, the animation must work silently
- Anything longer than ~3 seconds before the hold/loop — this is a splash screen, not a title sequence

## 8. Technical deliverable

- **Format**: Rive (`.riv`) preferred over Lottie for this — Rive's runtime state machines and native fluid/mesh deformation give a truer liquid feel and a smaller footprint in React Native (`rive-react-native` is already a viable drop-in for Expo). Lottie (`lottie-react-native`) is an acceptable fallback if the designer's pipeline is After Effects/Bodymovin-based, but liquid/metaball effects are harder to get right in Lottie's keyframe-vector model — flag this to the designer up front so they pick the right tool for the fluid beats.
- **Canvas**: Design at 1170×2532 (iPhone-safe portrait reference), but keep all key motion within a centered 800×800 safe area so it scales cleanly to smaller devices and doesn't rely on edge-to-edge framing.
- **Frame rate**: 60fps source.
- **Duration**: 2.2–2.8s for the main sequence + a seamless-loop idle hold.
- **Background**: must be exportable as transparent OR exactly `#F7F5F2` flat — the app's real `expo-splash-screen` config uses `#F7F5F2` as the native splash background, so the animation should either match it exactly or be composited on a transparent layer over it.
- **Color mode**: sRGB, hex values as specified in section 3 — no color drift from ink/gradient tools' default palettes.

## 9. Reference language (for mood boards / AI generation prompts)

"Five simple navy line-icons — a coin, a wrench, a chat bubble, a document, a shield — scattered and drifting independently on a warm cream background, each converging toward center on its own curved path, liquifying into navy ink mid-flight like droplets merging, macro slow-motion ink-in-water fluid simulation, the merged liquid snapping fast and precise into a single clean roofline/arch stroke, then confident geometric sans-serif typography snap, single deep burgundy accent line, premium editorial real-estate branding, restrained two-tone palette, Apple-keynote-level polish, Stripe/Linear-style confident product motion design, no particles, no gradients, physically accurate fluid dynamics, 60fps, portrait mobile splash screen, the story is 'five scattered tools become one system.'"
