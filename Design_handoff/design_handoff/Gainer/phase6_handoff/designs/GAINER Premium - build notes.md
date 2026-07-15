# GAINER Premium — toteutusohjeet (lyhyt)

Tavoite: viedä prototyyppi (`GAINER Premium.html`) oikeaan appiin. Suurin osa on jo koodissa — alla vain se mitä lisätään.

---

## 1. Hinnoittelu (RevenueCat)

Expo + maksut → käytä **RevenueCat**ia. Älä koodaa hintoja kovakoodattuna — ne tulevat storesta.

```
npx expo install react-native-purchases
```

**App Store Connect / Google Play Console:** luo 2 tuotetta:
- `gainer_premium_monthly` — 9,99 €/kk
- `gainer_premium_yearly` — 71,99 €/vuosi (7 vrk free trial introductory offerina)

**RevenueCat dashboard:** luo yksi *Offering* ("default") jossa molemmat paketit + yksi *Entitlement* nimeltä `premium`.

Init (esim. `App.tsx`):
```ts
import Purchases from 'react-native-purchases';
Purchases.configure({ apiKey: PUBLIC_RC_KEY });
```

---

## 2. Hae paketit + osta

```ts
// hae näytön mountissa
const offerings = await Purchases.getOfferings();
const pkgs = offerings.current?.availablePackages ?? [];
// pkg.product.priceString → "9,99 €" valmiina lokalisoituna (älä kovakoodaa!)

// osto
const { customerInfo } = await Purchases.purchasePackage(selectedPkg);
const isPremium = !!customerInfo.entitlements.active['premium'];

// restore
const info = await Purchases.restorePurchases();
```

---

## 3. Näyttö (käytä olemassa olevaa `PremiumScreen.tsx`)

Prototyypin osat → mihin menevät:

| Prototyypin lohko | Toteutus |
|---|---|
| Hero + edistymisjana | `SurfaceCard` hero + pieni `Svg` (react-native-svg) jana, data `AICoachTrainingContext.trackedLifts`-squatista |
| "What Premium adds" lanet | `premiumLanes` on jo olemassa |
| Plan-valinta (yearly/monthly) | uusi: `useState(selectedPkg)` + 2 painettavaa korttia, hinnat `pkg.product.priceString` |
| Free vs Premium taulukko | `comparisonRows` on jo olemassa |
| CTA "Start 7-day free trial" | `Purchases.purchasePackage` |

Jana react-native-svg:llä:
```
npx expo install react-native-svg
```
`<Polyline>` historialle, `<Line strokeDasharray>` coachin askeleelle, `<Circle>` päätepisteelle — sama logiikka kuin prototyypissä (`HeroChart`).

---

## 4. Entitlement-gating (jo olemassa)

Teillä on jo `preferences.adaptiveCoachPremiumUnlocked` ja `AccessTier`. Korvaa testilippu RevenueCatin totuudella:

```ts
// AppProvider: päivitä oston/restore/launchin jälkeen
const isPremium = !!customerInfo.entitlements.active['premium'];
setPreferences(p => ({ ...p, adaptiveCoachPremiumUnlocked: isPremium }));
```

Loggerin lukko (`WorkoutLoggingScreen` → `hasAdaptiveCoachPremium`) toimii sitten automaattisesti.

---

## 5. Pakolliset storelinkit

Paywallissa **pakko** olla (muuten App Store hylkää):
- Hinta + jakso selvästi ("Then 71,99 €/vuosi")
- **Restore purchases** (on jo prototyypissä ylhäällä)
- **Terms** + **Privacy** linkit (on jo)
- Trial-ehdot: "7 days free, then …, cancel anytime"

---

## Tärkein periaate
Hinnat **aina** RevenueCatista (`priceString`), ei kovakoodattuna — lokalisointi, valuutta ja App Storen säännöt hoituvat itsestään. Prototyypin "9,99 €" / "71,99 €" ovat vain mockup-arvoja.
