# GAINER (Gymlog) — Security & Privacy Audit

**App:** GAINER — React Native 0.83 / Expo SDK 55, Android package `com.lantu66.gymlog`
**Audit date:** 4 June 2026
**Auditor role:** Senior mobile security engineer (React Native / Expo / mobile auth / store compliance)
**Codebase version:** `package.json` 1.1.0 (`app.json` version 1.1.0)
**Assumption:** App is on a path to 100,000+ users. Findings are rated for that scale, not for a private beta.

---

## Scope & methodology

I reviewed the full working tree: app shell (`App.tsx`), state/storage layers (`src/state`, `src/storage`, `src/features/workout`), the AI Coach client and serverless backend (`src/lib/aiCoach*`, `api/ai-coach.ts`), the data model (`src/types/models.ts`), build/config (`app.json`, `.gitignore`, `.env*.local`, generated `android/`), and the launch/architecture docs (`docs/`). I checked git history for committed secrets, traced every `fetch`, every `AsyncStorage` key, every PII field, and the premium/auth flows.

**Architecture in one paragraph:** GAINER is an offline-first tracker. All user data lives on-device in two AsyncStorage keys. There is **no backend account system, no database, no Firebase/Supabase, and no real authentication** — "sign in" and "premium" are local preference flags. The only network surface is an optional serverless AI Coach endpoint (`api/ai-coach.ts`) that proxies to OpenAI; it is disabled by default (preview mode) and enabled only when `EXPO_PUBLIC_AI_COACH_API_URL` is set. That single design fact shapes most of the findings: the attack surface today is small, but the data-at-rest, monetization, and AI-backend designs do not scale safely to 100k users without changes.

Findings are grouped by domain. Each carries Severity, File path, Explanation, Real-world impact, Recommended fix, and an example where useful. The four summary sections (Executive Summary, Critical Issues, Quick Wins, Roadmap) are at the **end**, as requested.

Severity scale: **Critical** (exploitable now, high damage) · **High** (serious, likely at scale) · **Medium** (real risk, conditional or moderate) · **Low** (hardening / hygiene).

---

# 1. Secrets, API keys & tokens

## F1 — Live OpenAI API key stored in the project working tree
**Severity: Critical**
**File:** `.env.openai.local`

A real, valid-format OpenAI **project key** (`sk-proj-z47…`, ~164 chars, redacted here) is sitting in plaintext in the repository working directory.

What I confirmed:
- The file is **git-ignored** (`.gitignore` → `.env*.local`) and I verified it was **never committed** — `git log --all -S 'sk-proj'` returns nothing, and no `.env*.local` appears in history. So this is **not** a git-history leak.
- The key is **not referenced anywhere in the code** (`grep` for `OPENAI`, `sk-proj`, `api.openai.com`, `dall-e`, `gpt-image` across `src/`, `scripts/`, `tools/` finds only the server file `api/ai-coach.ts`, which reads `process.env.OPENAI_API_KEY` — a *server* env var, not this file). The file comment says "image generation secret," but no image-generation code exists in the tree. **It is an orphaned, unused, live credential.**

**Real-world impact:** A live key in the working tree leaks the moment that tree is shared, zipped, synced to cloud storage, copied to a backup, pasted into a support ticket, or accidentally committed after a future `.gitignore` change. An orphaned key nobody monitors is the worst kind: usage spikes go unnoticed. Anyone holding it can run arbitrary OpenAI calls billed to your account (denial-of-wallet, data exfiltration via your org). The fact that an external tool (this audit) could read it is itself a demonstration of exposure.

**Recommended fix:**
1. **Rotate the key now** in the OpenAI dashboard — assume it is compromised.
2. Delete `.env.openai.local` from the working tree if unused. If image generation is planned, the key belongs only in the server/deployment platform's secret store (Vercel/Cloud env), never in the repo.
3. Add automated secret scanning so this can't recur.

**Example — pre-commit secret scan (gitleaks):**
```yaml
# .pre-commit-config.yaml
repos:
  - repo: https://github.com/gitleaks/gitleaks
    rev: v8.18.4
    hooks:
      - id: gitleaks
```
```bash
# one-off scan of the whole history before launch
gitleaks detect --source . --redact -v
```

## F2 — `OPENAI_API_KEY` is correctly server-side (positive finding)
**Severity: Informational (good)**
**File:** `api/ai-coach.ts`, `src/lib/aiCoachClient.ts`, `docs/mvp-launch-scope.md` §9.7

The app **never** imports `openai` or calls `api.openai.com` from the client. The mobile app calls its own endpoint (`EXPO_PUBLIC_AI_COACH_API_URL`); the endpoint holds the key in `process.env.OPENAI_API_KEY`. This indirection is the correct pattern and prevents key extraction from the app binary. Keep this invariant enforced (see Quick Wins for a lint rule). Note that `EXPO_PUBLIC_*` values **are bundled into the client binary** — only the *URL* is public, which is fine, but never put a secret behind an `EXPO_PUBLIC_` name.

---

# 2. Insecure storage of user data

## F3 — Personal and health data persisted unencrypted in AsyncStorage
**Severity: High**
**Files:** `src/storage/database.ts` (key `@gymlog/database/v1`), `src/features/workout/workoutPersistence.ts` (key `@gymlog/workout/v1`), data shapes in `src/types/models.ts:199-260`

Both stores are written with `AsyncStorage.setItem(key, JSON.stringify(...))` — **plaintext, no encryption**. On Android, AsyncStorage is an unencrypted SQLite file in the app sandbox. What's stored includes clearly personal and health-adjacent data:

- Identity/profile: `profileName`, `setupGender`, `setupAge` / `setupAgeRange`
- Body metrics: `setupCurrentWeightKg`, `bodyweightGoalKg`, `bodyweightEntries[]`, and `measurementEntries[]` with `kind` ∈ {`bodyfat`, `waist`, `hips`, `chest`, `thighs`, `shoulders`} — i.e. **body-composition data**
- Free-text health notes: `aiPlannerLimitations`, `aiPlannerAvoid`, `aiPlannerMustInclude` (users routinely type injuries/medical limits here)
- Full immutable training history: every session, set, weight, rep, note, timestamp

**Real-world impact:** On a rooted device, a lost/stolen device with USB debugging, a malicious app exploiting a sandbox-escape, or via device backup (see F8), this data is readable as plain JSON. Body-fat, weight, age, gender and injury notes are sensitive; under GDPR, health data is a *special category* (Art. 9). At 100k users this is a meaningful breach surface and a regulatory liability even though the data never leaves the device by default.

**Recommended fix:**
- Encrypt sensitive data at rest. Minimum: store an app encryption key in the OS keystore via `expo-secure-store` (Android Keystore / iOS Keychain) and use it to encrypt the AsyncStorage payload, **or** migrate persistence to an encrypted store (e.g. SQLCipher via `op-sqlite`/`react-native-quick-sqlite`, or `react-native-mmkv` with an encryption key).
- At minimum, segregate the highest-sensitivity fields (measurements, limitations, profile) and keep them in `expo-secure-store` directly.

**Example — keystore-backed encryption key + encrypted blob:**
```ts
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { randomKey, encrypt, decrypt } from './crypto'; // AES-GCM wrapper

async function getDbKey(): Promise<string> {
  let k = await SecureStore.getItemAsync('db_key');
  if (!k) { k = randomKey(); await SecureStore.setItemAsync('db_key', k); }
  return k;
}

export async function saveDatabase(db: AppDatabase) {
  const key = await getDbKey();
  const plaintext = JSON.stringify({ ...db, exerciseLibrary: [] });
  await AsyncStorage.setItem('@gymlog/database/v1', encrypt(plaintext, key));
}
```

## F4 — Android device backup of local data not disabled
**Severity: Medium**
**Files:** generated `android/app/src/main/AndroidManifest.xml` (`<application … android:allowBackup="true">`), `app.json` (no backup config)

`AndroidManifest.xml` **explicitly sets `android:allowBackup="true"`** and ships no Auto Backup exclusion rules. Combined with F3 (plaintext storage), the AsyncStorage DB can be pulled via `adb backup` on debuggable/older devices, or synced into Google's cloud backup, where it sits as plaintext.

**Real-world impact:** Local-only data stops being local-only. Health/training data ends up in device backups and Google Drive backups, expanding the breach and GDPR surface beyond the device.

**Recommended fix:** Disable backup or exclude the storage keys. Because `android/` is generated by prebuild, set this through config so it survives regeneration.

**Example — `app.json` / config plugin:**
```jsonc
// app.json -> expo.android
"allowBackup": false
```
If you keep backup enabled, ship `data_extraction_rules.xml` / `full_backup_content.xml` that exclude the React Native AsyncStorage database file, and never back up the SecureStore key.

---

# 3. Authentication & authorization

## F5 — There is no real authentication; "Sign in" is a cosmetic local flag
**Severity: Medium** (compliance + future-sync risk)
**Files:** `App.tsx:1490-1497` (`handleContinueEntry` sets `selectedSignInMethod: 'local'`), `src/types/models.ts:225` (`SignInMethod` ∈ apple/email), `src/screens/ProfileScreen.tsx:51` (`signedIn = selectedSignInMethod !== null`)

`selectedSignInMethod` can be `'apple' | 'email' | 'local' | null`, but nothing implements Apple/email auth — no identity token, no OAuth, no backend session. "Signed in" is purely a stored preference, and the entry flow hard-codes `'local'`.

**Real-world impact:**
- **Store risk:** If any UI presents "Sign in with Apple" or email sign-in (the type exists, implying a screen), Apple **requires** a working Sign in with Apple implementation when other social logins are offered (Guideline 4.8 / 2.3.1), and shipping a non-functional auth button is a rejection/misrepresentation risk on both stores.
- **Future risk:** The docs name Supabase sync as a future feature (`mvp-launch-scope.md` §9.1). There is currently **no authentication foundation**, so any future sync/multi-device/account-deletion feature starts from zero with no identity to bind data to.

**Recommended fix:** Either (a) remove all sign-in affordances for v1 and present the app honestly as local/offline (matches §2.10 "no settings that imply features that don't exist"), or (b) implement real auth (Sign in with Apple + a real IdP) before exposing those entry points. Do not ship a sign-in button that only writes a string.

## F6 — Premium entitlement is a client-side boolean with a free toggle
**Severity: High** (revenue/abuse at scale; Medium today because v1 is intentionally free)
**Files:** `App.tsx:2695-2699` (`onTogglePreview` → `adaptiveCoachPremiumUnlocked: !adaptiveCoachPremiumUnlocked`), `src/storage/database.ts:283`, `src/screens/AccessChoiceScreen.tsx` (Premium card with "Live" badge, "Start Premium")

Premium status lives in `preferences.adaptiveCoachPremiumUnlocked` (plaintext AsyncStorage) and `selectedAccessTier: 'free' | 'premium'`. The Premium screen flips it with a **plain client-side toggle and no payment, no receipt, no server check**. The Access screen markets "Start Premium / Live."

**Real-world impact:** The instant any feature is actually gated behind this flag and sold, the gate is bypassable by editing AsyncStorage (rooted device, backup edit, or a modified build) or just toggling it. At 100k users this is direct revenue leakage and an obvious "free premium" how-to. There is no StoreKit/Play Billing integration and no server-side entitlement to validate against.

Today the app is intentionally free (`mvp-launch-scope.md` §4.6 excludes the paywall), so this is latent — but the architecture bakes in the vulnerability, and the "Start Premium"/"Live" UI already contradicts the team's own §4.6/§8.5 ("no upsells before value"). Presenting a "Premium" purchase affordance with no real IAP also risks App Store Guideline 3.1.1 (purchasable functionality must use IAP) / misleading-UI rejection.

**Recommended fix:**
- Before monetizing: implement real IAP (`expo-in-app-purchases` / RevenueCat) and **validate receipts server-side**; derive entitlement from a server (or signed, device-bound, expiring token), never from a writable local boolean.
- For v1: align UI with the stated "no paywall" scope — relabel "Premium/Live" as "Preview" or remove it, so the app doesn't advertise a purchase that doesn't exist.

**Example — entitlement from validated receipt (RevenueCat sketch):**
```ts
const info = await Purchases.getCustomerInfo();
const isPremium = info.entitlements.active['coach_premium'] !== undefined; // server-validated
// gate features on isPremium, not on a local preference
```

---

# 4. Network & API communication

## F7 — AI Coach endpoint is unauthenticated → denial-of-wallet & abuse
**Severity: High** (becomes **Critical** the moment live mode ships at scale; currently latent because preview mode is the default)
**File:** `api/ai-coach.ts`

The serverless endpoint accepts unauthenticated `POST`s from anyone, sets `Access-Control-Allow-Origin: *`, and forwards prompt + context to OpenAI on your bill. There is **no API key, no app attestation, no per-user auth, and no request signing.** The only control is an IP-based rate limit (see F8), which is weak.

Additional gaps in the same file:
- **No input size cap.** `parseBody` accepts any `prompt` string; `max_output_tokens` is capped at 700 but the *input* is unbounded — a caller can send huge prompts/contexts to inflate token cost per request.
- **CORS `*`** means any web page can invoke it from a browser.

**Real-world impact:** A public, keyless LLM proxy is a classic **denial-of-wallet** target. Once `EXPO_PUBLIC_AI_COACH_API_URL` is live, scrapers and abusers will find it (it ships inside the app bundle, trivially extractable) and run it as a free GPT proxy. At 100k users the legitimate load already needs controls; abusive load can produce a surprise OpenAI bill and service outage. The team's own §12 Risk 4 flags this.

**Recommended fix:**
- Require app attestation: **Play Integrity API** (Android) and **App Attest / DeviceCheck** (iOS); verify the attestation token server-side before calling OpenAI.
- Add a per-install/per-user identifier and enforce quotas against it (not just IP).
- Restrict CORS to your own origins (the mobile app doesn't need `*`).
- Cap input length and reject oversized payloads.
- Set hard OpenAI **budget alerts / spend limits** and a global circuit breaker.

**Example — input cap + tightened CORS:**
```ts
const MAX_PROMPT = 2000, MAX_BODY = 16 * 1024;
function setCors(res: ApiResponse) {
  res.setHeader('Access-Control-Allow-Origin', 'https://app.gainer.example'); // not '*'
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-App-Attest');
}
// in parseBody:
if (candidate.prompt.length > MAX_PROMPT) return null;
```

## F8 — Server rate limiting is ineffective (spoofable IP + in-memory store)
**Severity: Medium**
**File:** `api/ai-coach.ts` (`getIpAddress`, `rateLimitStore = new Map(...)`, `checkRateLimit`)

The rate limiter keys on `x-forwarded-for`'s first value — a **client-controlled header** that's trivially spoofed (`X-Forwarded-For: <random>` per request resets the bucket). Worse, `rateLimitStore` is an **in-process `Map`**: on serverless platforms each cold start and each concurrent instance has its own map, so the limit is per-instance, not global, and resets constantly. Effective protection is near zero.

**Real-world impact:** The one control standing between the public endpoint and your OpenAI bill (F7) doesn't actually limit a determined caller.

**Recommended fix:** Rate-limit against a **durable, shared store** (Redis/Upstash, Vercel KV, Cloudflare rate limiting, or an API gateway) keyed on the attested app/user identity from F7, not on a spoofable header. Use the platform's trusted client-IP signal if IP is used at all.

## F9 — No TLS certificate pinning for the AI endpoint
**Severity: Low**
**File:** `src/lib/aiCoachClient.ts`

The client relies on platform TLS only (good: HTTPS is used, no cleartext). Since health-adjacent context transits this call, certificate/public-key pinning would add defense-in-depth against MITM on hostile networks or via a rogue CA.

**Recommended fix:** Add pinning (e.g. `react-native-ssl-pinning` or native network-security-config) for the AI Coach host once live mode ships. Low priority; do not block launch on it.

## F10 — Backend logs upstream error bodies
**Severity: Low**
**File:** `api/ai-coach.ts` (`console.error('AI Coach upstream request failed', response.status, body.slice(0, 400))`)

On OpenAI errors the first 400 chars of the upstream response are logged. `docs/ai-coach-backend.md` states prompts/context are not intentionally logged, but error payloads can echo request fragments into server logs. Minor, but worth scrubbing for a clean privacy posture.

**Recommended fix:** Log status + an error code/id only; avoid logging raw upstream bodies, or redact before logging.

---

# 5. Privacy & GDPR

## F11 — Health/PII sent to a third party (OpenAI) without disclosed consent/DPA
**Severity: High** (privacy/GDPR)
**Files:** `src/lib/aiTrainingContext.ts`, `src/lib/aiCoachSystemContext.ts`, `api/ai-coach.ts`, `docs/ai-coach-backend.md`

In live mode the app sends a structured training context to your endpoint and on to OpenAI: recent sessions, tracked lifts, plateaus, fatigue/ACWR/recovery scores, and the **free-text `limitations` / `avoid` / `mustInclude`** fields, plus athlete profile (goal, experience, equipment). The free-text fields commonly contain injuries/medical context — potential **special-category health data** under GDPR Art. 9.

**Real-world impact:** Processing health-adjacent data through a US third party triggers requirements: a clear lawful basis (likely explicit consent for special-category data), disclosure in the privacy policy, a Data Processing Agreement with OpenAI, data-minimization, and consideration of international transfer (SCCs). Shipping live mode without these is a GDPR exposure and a Play Data Safety mismatch. The docs (`ai-coach-backend.md` "Important", §12 Risk 5) acknowledge the gap.

**Recommended fix:**
- Keep live AI **off** until the privacy work is done (matches §4.5's "decision required before launch").
- Before enabling: update the privacy policy to name OpenAI as a processor and describe what's sent; obtain explicit, revocable consent before the first live call; sign OpenAI's DPA and enable zero-retention/no-training options; minimize the payload (strip or hash free-text fields, or let users review what's sent).
- Provide an in-app opt-out that falls back to preview mode.

## F12 — No data export or in-app erasure (GDPR access/portability/erasure)
**Severity: Medium**
**Files:** `src/storage/database.ts` (`resetDatabase` wipes locally but there's no export), `docs/mvp-launch-scope.md` §3.3 (export deferred)

There's a local reset path but no way for a user to **export** their data (Art. 20 portability / Art. 15 access) and no explicit, discoverable **delete-my-data** action beyond uninstalling. Today data is local, so uninstall ≈ erasure — but that's not a documented, discoverable right, and it breaks the moment Supabase sync (planned, §9.1) is added, after which server copies must also be erasable.

**Recommended fix:** Ship a JSON/CSV export and a clearly labeled "Delete all my data" control before launch (it's cheap while data is local-only). Design erasure to propagate to any future server store.

## F13 — Privacy policy / Data Safety not yet shipped
**Severity: High** (hard store blocker)
**File:** `docs/mvp-launch-scope.md` §2.11 (marked Required, not done)

Both stores require a published privacy policy at a stable URL, linked in-app, and an accurate Play Data Safety declaration / Apple privacy "nutrition label." The team's own scope lists this as a hard, non-optional launch requirement; I found no policy URL or in-app link in the code.

**Recommended fix:** Publish the policy, link it from Profile/Settings, and complete Data Safety/privacy labels accurately — including the OpenAI transfer if live AI is enabled. This is a launch gate, not a nice-to-have.

---

# 6. App Store / Google Play compliance

The store-relevant items are concentrated in findings above; summarized here for the compliance reviewer:

- **F13 (High):** Missing privacy policy + Data Safety — blocks both stores.
- **F6 (High/Medium):** "Premium / Start Premium / Live" UI with no IAP — Apple Guideline 3.1.1 (must use IAP for digital purchases) and misleading-UI risk; also contradicts the team's own "no paywall in v1."
- **F5 (Medium):** Non-functional "Sign in with Apple/email" affordances — Apple Guideline 4.8 / 2.3.1 (Sign in with Apple must work if offered; don't ship dead auth).
- **F11 (High):** Third-party data sharing (OpenAI) must match Data Safety / privacy label and have consent.
- **Permissions (Low — positive):** `AndroidManifest.xml` requests only `INTERNET` and explicitly removes `READ/WRITE_EXTERNAL_STORAGE` (`tools:node="remove"`). Minimal and clean. `MainActivity` is `exported="true"` which is normal for a launcher activity with no exported deep-link handlers.

## F14 — QA artifacts containing on-screen data live in the working tree
**Severity: Low**
**Files:** repo root `tmp_*.png`, `tmp-*.png`, `tmp-window*.xml`, `tmp-*.xml` (UI hierarchy dumps), `output/`, `tmp/`

Dozens of screenshots and Android `window_dump` XML files (full UI hierarchy, including any on-screen text/PII from the device used) sit in the working tree. They are git-ignored (not committed), so this is hygiene, not a leak — but UI dumps can contain a real person's profile name, weights, etc.

**Recommended fix:** Delete QA artifacts from the working tree (keep them ignored), and avoid capturing real-user screens; use seed/test data for QA captures.

---

# 7. Abuse vectors & cheating

- **F6 — Free premium:** the headline abuse vector (client-side entitlement). Covered above.
- **F7/F8 — Free GPT proxy / denial-of-wallet:** the headline cost-abuse vector. Covered above.
- **Local data tampering / fake PRs:** All history is local and trivially editable (plaintext AsyncStorage). The app has **no leaderboards or social features** (`mvp-launch-scope.md` §4.2 excludes them permanently), so falsified PRs harm only the user's own data — **low impact today**. *However*, if social/competitive features are ever added, the current append-only-but-unsigned local store provides no integrity guarantee; server-side validation of any competitive metric would be mandatory at that point.

## F15 — LLM prompt injection (low impact by design)
**Severity: Low**
**File:** `api/ai-coach.ts` (user `prompt` concatenated into the OpenAI request)

The user-controlled prompt is sent to the model. Injection could steer the coaching text or attempt to extract the system prompt. Impact is contained because the server exposes **no tools/actions**, the response is constrained by a strict JSON schema, and output is rendered as advice only — no code execution, no privileged actions. Worst case is misleading fitness advice.

**Recommended fix:** Keep the strict JSON schema (already present), keep the "do not reveal hidden reasoning" guardrail, and add a short output-sanity check. Don't over-invest here.

---

# Executive Summary

GAINER is a well-structured, offline-first fitness tracker with a deliberately small attack surface and several good instincts already in the code: OpenAI is server-side only, the Android permission set is minimal, storage is normalized defensively, and the launch docs show real privacy/cost awareness. The serious issues are concentrated in three areas, all of which matter much more at 100k users than in beta:

1. **Secret hygiene** — a live OpenAI key is sitting in the working tree (unused/orphaned, git-clean, but still a live credential to rotate now).
2. **Data-at-rest** — personal and health-adjacent data (body measurements, age/gender, weight goals, free-text injury notes, full history) is stored **unencrypted** and is backup-exposed on Android.
3. **Trust boundaries that don't scale** — "premium" and "sign in" are client-side flags with no server validation, and the AI Coach endpoint is an unauthenticated, weakly-rate-limited public LLM proxy (denial-of-wallet) the moment live mode ships.

Cross-cutting, the **privacy/compliance** layer (published policy, Data Safety/Apple labels, GDPR export/erasure, OpenAI consent + DPA) is not yet in place and is a hard store gate. None of these are architecturally hard to fix; most are 1–3 day changes. The biggest decisions are (a) rotate the key today, (b) encrypt sensitive storage before scale, and (c) do not enable live AI until auth, durable rate limiting, and the privacy work are done.

**Posture:** *Solid foundation, not yet launch-ready for 100k users.* No evidence of an active breach or a committed secret. The risks are forward-looking and addressable.

Finding counts: **1 Critical, 4 High, 4 Medium, 5 Low** (+2 positive/informational).

---

# Critical Issues List (fix before anything else)

| # | Severity | Issue | File |
|---|----------|-------|------|
| **F1** | **Critical** | Live OpenAI key in working tree (`sk-proj-…`), orphaned/unused — **rotate now** | `.env.openai.local` |
| F7 | High → **Critical if live AI ships** | Unauthenticated public AI proxy → denial-of-wallet | `api/ai-coach.ts` |
| F3 | High | Personal + health data stored unencrypted on device | `src/storage/database.ts`, `src/features/workout/workoutPersistence.ts` |
| F6 | High | Premium entitlement is a writable client-side boolean (free-premium) | `App.tsx:2697`, `src/storage/database.ts:283` |
| F11 | High | Health/PII sent to OpenAI without disclosed consent/DPA | `src/lib/aiTrainingContext.ts`, `api/ai-coach.ts` |
| F13 | High | No published privacy policy / Data Safety — store blocker | `docs/mvp-launch-scope.md` §2.11 |

---

# Quick Wins (< 1 day each)

1. **Rotate + remove the OpenAI key (F1).** Revoke in OpenAI, delete `.env.openai.local`, move any real key to server secrets only. (~30 min)
2. **Add secret scanning (F1).** Drop in the gitleaks pre-commit hook above and run a one-off history scan. (~1 hr)
3. **Disable Android backup of local data (F4).** Set `expo.android.allowBackup: false` (or backup-exclusion rules). (~1 hr)
4. **Tighten the AI endpoint cheaply (F7/F8):** cap prompt/body size, replace CORS `*` with your origin, stop logging raw upstream bodies (F10). (~2–3 hrs)
5. **Honest UI for v1 (F5/F6):** remove or relabel "Sign in with Apple/email" and "Start Premium / Live" so the app doesn't advertise features it doesn't implement (also satisfies §2.10/§8.5). (~2–4 hrs)
6. **Publish + link the privacy policy and complete Data Safety/Apple labels (F13).** Mostly content work, but unblocks the store. (~half day)
7. **Add a "Delete all my data" + JSON export control (F12).** Cheap while data is local-only. (~half day)
8. **Add the lint guard that `openai` is never imported under `src/`** to lock in the F2 invariant. (~30 min)

---

# Recommended Security Roadmap

### Phase 0 — Immediate (this week, pre-launch gate)
- Rotate the OpenAI key; remove from tree; add secret scanning (F1).
- Disable/limit Android backup (F4).
- Publish privacy policy + accurate Data Safety/Apple labels (F13).
- Make sign-in/premium UI honest for the free v1 (F5, F6).
- Decide AI mode: **ship preview-only** unless F7/F8/F11 are all done (matches §4.5).

### Phase 1 — Before scaling past beta (2–4 weeks)
- Encrypt sensitive data at rest: keystore-backed key + encrypted store, or move measurements/limitations/profile into `expo-secure-store` (F3).
- Ship GDPR data **export** and **erasure** controls (F12).
- If enabling live AI: app attestation (Play Integrity / App Attest), durable shared rate limiting, input caps, restricted CORS, OpenAI budget alerts/circuit breaker (F7, F8).
- Privacy work for live AI: consent flow, OpenAI DPA + zero-retention, payload minimization (F11).

### Phase 2 — Before monetization & multi-device (when premium/sync is built)
- Real IAP with **server-side receipt validation**; derive entitlement from server, not local flag (F6).
- Real authentication (Sign in with Apple + IdP) as the identity foundation for sync (F5).
- Certificate pinning for backend hosts (F9).
- Design any future Supabase sync with row-level security, encrypted transport, and erasure propagation from day one.

### Phase 3 — Hardening & ongoing
- Pen-test the AI backend and entitlement flow under load.
- Add abuse monitoring/anomaly alerts on AI spend.
- If social/competitive features are ever added: server-side validation and signing of any competitive metric (the current local store has no integrity guarantee).
- Periodic dependency audits (`npm audit`, Expo SDK security advisories) as part of CI.

---

*Methodology note: findings are based on static review of the source tree and git history as of 4 June 2026. I did not execute the app, exercise the live endpoint, or validate the OpenAI key against the API (doing so would itself use the credential). Severity assumes the stated 100k-user target; several High findings are latent today because live AI and the paywall are disabled by default — they become active risks the moment those features ship.*
