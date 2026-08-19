import { AppLanguage } from '../types/models';

/**
 * The privacy policy and terms, as data.
 *
 * Two rules govern this file:
 *
 * 1. Every factual claim here is checked against the code. The app has exactly
 *    one outbound request (src/lib/aiCoachClient.ts, and only when
 *    EXPO_PUBLIC_AI_COACH_API_URL is set), two AsyncStorage keys, no analytics,
 *    no accounts and no ad SDKs. If that ever changes, this file changes in the
 *    same commit — tests/lib/legalDocuments.test.cjs fails otherwise.
 *
 * 2. The prose lives here rather than in i18n.ts on purpose. These are ~120
 *    paragraph-length strings that are read as whole documents, never
 *    interpolated, and must be diffable as documents when the policy is
 *    revised. Splitting them into flat keys would make a legal change
 *    unreviewable.
 *
 * scripts/export-legal.cjs renders the same data to Markdown for hosting, so
 * the published policy and the in-app policy cannot drift.
 */

/**
 * The one place the publisher's identity is defined. Change it here and the
 * app, the exported Markdown and the Play Console listing all agree.
 *
 * The controller has to be whoever actually controls the data on the day a
 * user reads this, so it names the individual until Taito Tech Oy is entered
 * in the trade register (name pending PRH approval; a company that does not
 * exist yet cannot be the controller). The moment the registration lands,
 * switch `name` to the company, fill in `businessId`, re-run
 * `node scripts/export-legal.cjs`, and bump LEGAL_LAST_UPDATED — the change of
 * controller is exactly the kind users are entitled to see.
 */
export const LEGAL_ENTITY = {
  name: 'Santeri Ylönen',
  /** Y-tunnus. Empty until the company is registered; rendered when set. */
  businessId: '',
  email: 'santeriylonen@gmail.com',
  country: 'Finland',
  countryFi: 'Suomi',
} as const;

/** "Taito Tech Oy (FI12345678)" once registered, just the name before that. */
function publisher(): string {
  return LEGAL_ENTITY.businessId ? `${LEGAL_ENTITY.name} (${LEGAL_ENTITY.businessId})` : LEGAL_ENTITY.name;
}

/** Bumped whenever the wording changes in a way a user should re-read. */
export const LEGAL_LAST_UPDATED = '2026-08-18';

export type LegalDocumentId = 'privacy' | 'terms';

export interface LegalSection {
  heading: string;
  /** Paragraphs, rendered in order. */
  body?: string[];
  /** Bulleted lines, rendered after the paragraphs. */
  bullets?: string[];
}

export interface LegalDocument {
  id: LegalDocumentId;
  title: string;
  /** One sentence under the title: what this document is for. */
  summary: string;
  updatedLabel: string;
  sections: LegalSection[];
}

const PRIVACY_EN: LegalSection[] = [
  {
    heading: 'The short version',
    body: [
      'Vinha keeps your training data on your phone. There is no behavioural analytics and no tracking. We do not see your workouts, and we cannot — nothing is uploaded unless you turn on the AI coach in its online mode, and even then only training numbers are sent, never your identity.',
      'If you uninstall the app, that data is gone from the phone. The only copy that can exist elsewhere is the one your own Google account keeps in Android backup, if you have that turned on — we hold none.',
    ],
  },
  {
    heading: 'Who is responsible',
    body: [
      `${publisher()} (${LEGAL_ENTITY.country}) publishes Vinha and is the data controller for the limited processing described below.`,
      `Questions about this policy or your data: ${LEGAL_ENTITY.email}.`,
    ],
  },
  {
    heading: 'What the app stores',
    body: [
      'Everything below is entered by you, or produced by the app from what you entered. It is stored in the app’s own storage on your device.',
    ],
    bullets: [
      'Profile: age, height, weight, training goal, experience level, available days and equipment.',
      'Training log: exercises, sets, reps, weights, times and dates of your sessions.',
      'Body data you choose to add: bodyweight entries and body measurements.',
      'Preferences: language, units, notification and sound settings, exercises you asked to avoid.',
      'Purchase state: whether Pro is active, and a redeemed promo code if you used one.',
    ],
  },
  {
    heading: 'Where it is stored',
    body: [
      'In the app’s local storage on your device, under three keys — one for your training log, one for the workout you have in progress, and one small one for your settings. It is not synced to a server we run, and we have no way to read it remotely.',
      'If the app ever finds that storage unreadable, it moves the damaged copy aside under a third key instead of deleting it, and starts a fresh one — so a broken file is not the same thing as a lost training log. That copy stays on your device like everything else, and erasing the app’s data removes it too.',
      'Android backup is switched on for this app. That means your device can copy Vinha’s local data — your training log, bodyweight and measurement entries, programmes and settings — into the backup of your own Google account, so a new phone can restore it. Vinha has no backend and no sync, so this backup is the only way your history survives changing devices.',
      'That copy is between you and Google. We never see it, we cannot read it, and nothing is sent to any server we run. Google encrypts it, and on current Android versions the key is tied to your device PIN. You can switch it off at any time in Android settings under Google → Backup, and Vinha keeps working exactly the same.',
      'Deleting the data is immediate and total: Settings → My data → reset, or uninstalling the app.',
    ],
  },
  {
    heading: 'The AI coach',
    body: [
      'The AI coach has two modes, and today only the first one is active.',
      'On-device mode (the default): answers are generated on your phone from your own training log. Nothing leaves the device — not the question, not the answer.',
      'Online mode: if a future version enables it, your question and a numeric summary of your recent training (exercise names, sets, reps, kilograms, session dates) are sent over an encrypted connection to our endpoint and from there to Anthropic’s API, which produces the answer. Your name, email, device identifiers and body measurements are not part of that summary. The data is used to answer that one question. It is not used to train models, and we do not keep a copy.',
      'You will be told in the app before online mode is ever switched on.',
    ],
  },
  {
    heading: 'What the app does not do',
    bullets: [
      'No analytics, telemetry or crash reporting. The app measures nothing about you.',
      'No advertising and no ad networks.',
      'No third-party trackers or social SDKs.',
      'No advertising profile, and no identity attached to your training. Signing in and entering a competition are the only features that need an account, and they collect only what they need to work.',
      'No access to location, contacts, camera, photos, microphone or your files.',
      'Your data is never sold, rented or shared. There is no one to share it with.',
    ],
  },
  {
    heading: 'Notifications',
    body: [
      'Rest timers and reminders are scheduled locally by your phone. They are not push notifications, so no server is involved and no device token exists. Turn them off in Settings or in Android.',
    ],
  },
  {
    heading: 'Payments',
    body: [
      'If you buy Pro, the payment is handled entirely by Google Play. We never see your card number, billing address or any payment detail — the app only learns whether your subscription is active.',
    ],
  },
  {
    heading: 'Your rights',
    body: [
      'Under the GDPR you have the right to access your data, correct it, delete it, and take it with you. Because your data lives on your device, you exercise these rights directly and without asking us:',
    ],
    bullets: [
      'See it: Settings → My data shows what is stored.',
      'Correct it: edit your profile, or edit any logged session.',
      'Delete it: Settings → My data → reset all data, or uninstall the app.',
      `Ask a question or complain: ${LEGAL_ENTITY.email}. You also have the right to lodge a complaint with your national data protection authority (in Finland, the Office of the Data Protection Ombudsman).`,
    ],
  },
  {
    heading: 'Children',
    body: [
      'Vinha is not intended for children under 16. We do not knowingly process the data of children — and since we receive no data at all, there is nothing for us to identify or delete.',
    ],
  },
  {
    heading: 'Changes to this policy',
    body: [
      'If this policy changes in a way that affects you, the app will show the change before it takes effect. The date at the top of this page always tells you which version you are reading.',
    ],
  },
];

const PRIVACY_FI: LegalSection[] = [
  {
    heading: 'Lyhyesti',
    body: [
      'Vinha pitää treenitietosi puhelimessasi. Ei käyttäytymisanalytiikkaa eikä seurantaa. Emme näe treenejäsi emmekä voi nähdä — mitään ei lähetetä mihinkään, ellet ota AI-valmentajaa käyttöön verkkotilassa, ja silloinkin lähtee vain treeninumeroita, ei henkilöllisyyttäsi.',
      'Jos poistat sovelluksen, tiedot katoavat puhelimesta. Ainoa kopio, joka voi olla muualla, on oman Google-tilisi Android-varmuuskopio, jos se on käytössä — meillä ei ole mitään.',
    ],
  },
  {
    heading: 'Kuka vastaa',
    body: [
      `${publisher()} (${LEGAL_ENTITY.countryFi}) julkaisee Vinhan ja toimii rekisterinpitäjänä siinä rajatussa käsittelyssä, joka kuvataan alla.`,
      `Kysymykset tästä selosteesta tai tiedoistasi: ${LEGAL_ENTITY.email}.`,
    ],
  },
  {
    heading: 'Mitä sovellus tallentaa',
    body: [
      'Kaikki alla oleva on joko sinun syöttämääsi tai sovelluksen laskemaa sinun syöttämästäsi. Se tallentuu sovelluksen omaan tallennustilaan laitteellasi.',
    ],
    bullets: [
      'Profiili: ikä, pituus, paino, treenitavoite, kokemustaso, käytettävissä olevat päivät ja välineet.',
      'Treeniloki: liikkeet, sarjat, toistot, painot, ajat ja treenipäivämäärät.',
      'Kehon tiedot jotka itse lisäät: painomerkinnät ja kehon mitat.',
      'Asetukset: kieli, yksiköt, ilmoitus- ja ääniasetukset, liikkeet jotka pyysit välttämään.',
      'Ostotila: onko Pro voimassa, ja käytetty kampanjakoodi jos sellaisen syötit.',
    ],
  },
  {
    heading: 'Missä tiedot ovat',
    body: [
      'Sovelluksen paikallisessa tallennustilassa laitteellasi, kolmen avaimen alla — yksi treenilokille, yksi kesken olevalle treenille ja yksi pieni asetuksille. Niitä ei synkronoida meidän palvelimellemme, eikä meillä ole mitään keinoa lukea niitä etänä.',
      'Jos sovellus joskus toteaa tallennuksen lukukelvottomaksi, se siirtää vaurioituneen kopion sivuun kolmannen avaimen alle sen sijaan että poistaisi sen, ja aloittaa uuden — rikkoutunut tiedosto ei ole sama asia kuin menetetty treeniloki. Kopio pysyy laitteellasi kuten kaikki muukin, ja sovelluksen tietojen poistaminen poistaa myös sen.',
      'Androidin varmuuskopiointi on tälle sovellukselle päällä. Se tarkoittaa, että laitteesi voi kopioida Vinhan paikallisen datan — treenilokin, paino- ja mittamerkinnät, ohjelmat ja asetukset — oman Google-tilisi varmuuskopioon, jotta uusi puhelin voi palauttaa ne. Vinhalla ei ole palvelinta eikä synkronointia, joten tämä varmuuskopio on ainoa tapa jolla historiasi selviää laitteen vaihdosta.',
      'Se kopio on sinun ja Googlen välinen. Me emme näe sitä emmekä voi lukea sitä, eikä mitään lähetetä millekään meidän palvelimellemme. Google salaa sen, ja nykyisissä Android-versioissa avain on sidottu laitteesi PIN-koodiin. Voit kytkeä sen pois milloin tahansa Androidin asetuksista kohdasta Google → Varmuuskopiointi, ja Vinha toimii täsmälleen samalla tavalla.',
      'Tietojen poisto on välitön ja täydellinen: Asetukset → Omat tiedot → nollaus, tai sovelluksen poistaminen.',
    ],
  },
  {
    heading: 'AI-valmentaja',
    body: [
      'AI-valmentajalla on kaksi tilaa, ja tällä hetkellä vain ensimmäinen on käytössä.',
      'Laitetila (oletus): vastaukset muodostetaan puhelimessasi omasta treenilokistasi. Mitään ei lähde laitteelta — ei kysymys eikä vastaus.',
      'Verkkotila: jos tuleva versio ottaa sen käyttöön, kysymyksesi ja numeerinen yhteenveto viime aikojen treeneistäsi (liikkeiden nimet, sarjat, toistot, kilot, treenipäivämäärät) lähetetään salattua yhteyttä pitkin päätepisteeseemme ja sieltä Anthropicin rajapintaan, joka muodostaa vastauksen. Nimesi, sähköpostisi, laitetunnisteesi ja kehon mittasi eivät kuulu yhteenvetoon. Tietoja käytetään vain sen yhden kysymyksen vastaamiseen. Niillä ei kouluteta malleja, emmekä säilytä niistä kopiota.',
      'Saat tiedon sovelluksessa ennen kuin verkkotila kytketään päälle.',
    ],
  },
  {
    heading: 'Mitä sovellus ei tee',
    bullets: [
      'Ei analytiikkaa, telemetriaa eikä kaatumisraportointia. Sovellus ei mittaa sinusta mitään.',
      'Ei mainoksia eikä mainosverkostoja.',
      'Ei kolmannen osapuolen seurantaa eikä sosiaalisen median SDK:ita.',
      'Ei mainosprofiilia eikä henkilöllisyyttä kiinnitettynä treeneihisi. Kirjautuminen ja kilpailuun osallistuminen ovat ainoat toiminnot jotka tarvitsevat tilin, ja ne keräävät vain sen mitä toimiakseen tarvitsevat.',
      'Ei pääsyä sijaintiin, yhteystietoihin, kameraan, kuviin, mikrofoniin tai tiedostoihisi.',
      'Tietojasi ei myydä, vuokrata eikä jaeta. Ei ole ketään kenelle jakaa.',
    ],
  },
  {
    heading: 'Ilmoitukset',
    body: [
      'Palautusajastimet ja muistutukset ajastaa puhelimesi paikallisesti. Ne eivät ole push-ilmoituksia, joten palvelinta ei ole mukana eikä laitetunnistetta ole olemassa. Voit sammuttaa ne Asetuksista tai Androidista.',
    ],
  },
  {
    heading: 'Maksut',
    body: [
      'Jos ostat Pron, maksun hoitaa kokonaan Google Play. Emme näe korttinumeroasi, laskutusosoitettasi emmekä mitään maksutietoa — sovellus saa tietää vain onko tilauksesi voimassa.',
    ],
  },
  {
    heading: 'Oikeutesi',
    body: [
      'GDPR antaa sinulle oikeuden nähdä tietosi, korjata ne, poistaa ne ja ottaa ne mukaasi. Koska tietosi ovat laitteellasi, käytät näitä oikeuksia suoraan ilman että kysyt meiltä:',
    ],
    bullets: [
      'Näe ne: Asetukset → Omat tiedot näyttää mitä on tallennettu.',
      'Korjaa ne: muokkaa profiiliasi tai mitä tahansa kirjattua treeniä.',
      'Poista ne: Asetukset → Omat tiedot → nollaa kaikki tiedot, tai poista sovellus.',
      `Kysy tai tee valitus: ${LEGAL_ENTITY.email}. Sinulla on myös oikeus tehdä valitus tietosuojaviranomaiselle (Suomessa tietosuojavaltuutetun toimistolle).`,
    ],
  },
  {
    heading: 'Lapset',
    body: [
      'Vinhaa ei ole tarkoitettu alle 16-vuotiaille. Emme tietoisesti käsittele lasten tietoja — eikä meillä ole mitään tunnistettavaa tai poistettavaa, koska emme vastaanota tietoja lainkaan.',
    ],
  },
  {
    heading: 'Muutokset tähän selosteeseen',
    body: [
      'Jos tämä seloste muuttuu tavalla joka vaikuttaa sinuun, sovellus näyttää muutoksen ennen kuin se astuu voimaan. Sivun yläreunan päiväys kertoo aina minkä version luet.',
    ],
  },
];

const TERMS_EN: LegalSection[] = [
  {
    heading: 'The short version',
    body: [
      'Vinha is a training app. It suggests programs and tracks what you lift. It is not a doctor, a physiotherapist or a personal trainer standing next to you, and it cannot see your form or how you feel. You decide what is safe to lift.',
      'By using the app you accept these terms.',
    ],
  },
  {
    heading: 'Who provides the service',
    body: [
      `Vinha is provided by ${publisher()} (${LEGAL_ENTITY.country}). Contact: ${LEGAL_ENTITY.email}.`,
    ],
  },
  {
    heading: 'Your licence to use the app',
    body: [
      'You get a personal, non-exclusive, non-transferable right to use Vinha for your own training. That right lasts as long as you follow these terms.',
    ],
  },
  {
    heading: 'Health and safety — read this one',
    body: [
      'Vinha gives general fitness information. It is not medical advice, and nothing in it diagnoses, treats or prevents any condition.',
      'Talk to a doctor before starting a training program, especially if you are pregnant, recovering from an injury or illness, have a heart, joint or blood-pressure condition, or have not trained in a long time.',
      'Stop immediately if you feel pain, dizziness, chest tightness or shortness of breath, and get medical help.',
      'Weights are dangerous. You are responsible for your own technique, your warm-up, the equipment you use and the weight you choose. A suggested weight in the app is a suggestion based on numbers you logged — it knows nothing about how you slept, what hurts today, or whether the bar is loaded correctly.',
      'The AI coach reads your logged numbers and writes about them. It is not a clinician and does not know your medical history. Treat it as a knowledgeable training partner, not as a professional opinion.',
      'You train at your own risk.',
    ],
  },
  {
    heading: 'Your responsibilities',
    bullets: [
      'Enter your data honestly — the recommendations are only as good as what you log.',
      'Use the app for your own personal, non-commercial training.',
      'Do not rely on the app as your only source of health information.',
      'Keep your device secure. Anyone who can open your phone can see your training data.',
    ],
  },
  {
    heading: 'Your data is on your device',
    body: [
      'There is no account and no server-side copy of your training history. This means we cannot recover it for you if you lose your phone, uninstall the app, or reset your data. That is the trade-off for a private app, and it is worth saying plainly.',
    ],
  },
  {
    heading: 'Pro subscription',
    bullets: [
      'Pro unlocks the features listed on the Pro page in the app at the time you subscribe. The free version keeps every program, the full exercise library and unlimited logging.',
      'Payment is charged through Google Play at confirmation of purchase.',
      'Subscriptions renew automatically unless you cancel at least 24 hours before the period ends.',
      'Manage or cancel your subscription in Google Play, not in the app. Cancelling stops the next renewal; the current period runs to its end.',
      'Refunds follow Google Play’s policy and your statutory consumer rights.',
      'Promo codes may be limited in time or number, and can expire.',
      'If a price changes, you will be told in advance and the change never applies to a period you have already paid for.',
    ],
  },
  {
    heading: 'What we promise, and what we do not',
    body: [
      'The app is provided as it is. We work to keep it accurate and available, but we do not promise it will be uninterrupted, error-free, or that it will produce any particular result. Strength, weight loss and muscle growth depend on far more than an app: sleep, food, consistency, genetics, stress and time.',
      'To the extent the law allows, our liability for any claim connected to the app is limited to what you paid for it in the twelve months before the claim. Nothing here limits liability that cannot be limited by law — including liability for death or personal injury caused by negligence, or for fraud.',
    ],
  },
  {
    heading: 'What belongs to whom',
    body: [
      'The app, its design, its training programs and its exercise library belong to us and are protected by copyright. You may not copy, resell, redistribute or reverse-engineer them.',
      'Your training data is yours. We claim no ownership of anything you log.',
    ],
  },
  {
    heading: 'Things you may not do',
    bullets: [
      'Reverse-engineer, decompile or modify the app.',
      'Resell, republish or redistribute the training programs or exercise content.',
      'Use automated tools to extract content from the app.',
      'Use the app in any way that breaks the law.',
    ],
  },
  {
    heading: 'Changes and ending',
    body: [
      'We may update these terms as the app changes. Material changes are shown in the app before they take effect, and continuing to use Vinha after that means you accept them.',
      'You can stop at any time by uninstalling the app. We may end your access if you seriously breach these terms.',
    ],
  },
  {
    heading: 'Governing law',
    body: [
      'These terms are governed by Finnish law. This does not remove the mandatory consumer protection rights of the country where you live. If a dispute cannot be settled, a consumer in Finland may take it to the Consumer Disputes Board (kuluttajariita.fi) after contacting the Consumer Advisory Service.',
    ],
  },
];

const TERMS_FI: LegalSection[] = [
  {
    heading: 'Lyhyesti',
    body: [
      'Vinha on treenisovellus. Se ehdottaa ohjelmia ja seuraa mitä nostat. Se ei ole lääkäri, fysioterapeutti eikä vieressä seisova personal trainer, eikä se näe tekniikkaasi tai sitä miltä sinusta tuntuu. Sinä päätät mikä on turvallista nostaa.',
      'Käyttämällä sovellusta hyväksyt nämä ehdot.',
    ],
  },
  {
    heading: 'Kuka palvelun tarjoaa',
    body: [
      `Vinhan tarjoaa ${publisher()} (${LEGAL_ENTITY.countryFi}). Yhteystieto: ${LEGAL_ENTITY.email}.`,
    ],
  },
  {
    heading: 'Käyttöoikeutesi',
    body: [
      'Saat henkilökohtaisen, ei-yksinomaisen ja siirtokelvottoman oikeuden käyttää Vinhaa omaan treenaamiseesi. Oikeus on voimassa niin kauan kuin noudatat näitä ehtoja.',
    ],
  },
  {
    heading: 'Terveys ja turvallisuus — lue tämä',
    body: [
      'Vinha antaa yleistä kuntoilutietoa. Se ei ole lääketieteellistä neuvontaa, eikä mikään siinä diagnosoi, hoida tai ehkäise mitään sairautta.',
      'Keskustele lääkärin kanssa ennen treeniohjelman aloittamista, erityisesti jos olet raskaana, toivut vammasta tai sairaudesta, sinulla on sydän-, nivel- tai verenpaineongelma, tai et ole treenannut pitkään aikaan.',
      'Lopeta heti jos tunnet kipua, huimausta, puristusta rinnassa tai hengenahdistusta, ja hakeudu lääkäriin.',
      'Painot ovat vaarallisia. Vastaat itse tekniikastasi, lämmittelystäsi, käyttämistäsi välineistä ja valitsemastasi painosta. Sovelluksen ehdottama paino on ehdotus, joka perustuu kirjaamiisi numeroihin — se ei tiedä mitään siitä miten nukuit, mihin sattuu tänään, tai onko tanko ladattu oikein.',
      'AI-valmentaja lukee kirjaamiasi numeroita ja kirjoittaa niistä. Se ei ole terveydenhuollon ammattilainen eikä tunne sairaushistoriaasi. Suhtaudu siihen asiantuntevana treenikaverina, älä ammattilaisen lausuntona.',
      'Treenaat omalla vastuullasi.',
    ],
  },
  {
    heading: 'Sinun vastuusi',
    bullets: [
      'Syötä tietosi rehellisesti — suositukset ovat vain niin hyviä kuin se mitä kirjaat.',
      'Käytä sovellusta omaan henkilökohtaiseen, ei-kaupalliseen treenaamiseen.',
      'Älä käytä sovellusta ainoana terveystiedon lähteenäsi.',
      'Pidä laitteesi turvassa. Kuka tahansa joka saa puhelimesi auki näkee treenitietosi.',
    ],
  },
  {
    heading: 'Tietosi ovat laitteellasi',
    body: [
      'Tiliä ei ole eikä treenihistoriastasi ole kopiota palvelimella. Tämä tarkoittaa ettemme voi palauttaa sitä sinulle jos hukkaat puhelimesi, poistat sovelluksen tai nollaat tietosi. Se on yksityisen sovelluksen hinta, ja se on reilua sanoa suoraan.',
    ],
  },
  {
    heading: 'Pro-tilaus',
    bullets: [
      'Pro avaa ne ominaisuudet jotka on lueteltu sovelluksen Pro-sivulla tilaushetkellä. Ilmaisversioon jäävät kaikki ohjelmat, koko liikekirjasto ja rajaton kirjaus.',
      'Maksu veloitetaan Google Playn kautta oston vahvistuksessa.',
      'Tilaus uusiutuu automaattisesti, ellet peruuta sitä vähintään 24 tuntia ennen kauden päättymistä.',
      'Hallitse tai peruuta tilaus Google Playssä, ei sovelluksessa. Peruutus lopettaa seuraavan uusiutumisen; kuluva kausi jatkuu loppuun.',
      'Palautukset noudattavat Google Playn käytäntöä ja lakisääteisiä kuluttajaoikeuksiasi.',
      'Kampanjakoodit voivat olla määrä- tai aikarajattuja ja ne voivat vanheta.',
      'Jos hinta muuttuu, saat siitä tiedon etukäteen, eikä muutos koskaan koske jo maksamaasi kautta.',
    ],
  },
  {
    heading: 'Mitä lupaamme ja mitä emme',
    body: [
      'Sovellus tarjotaan sellaisena kuin se on. Teemme työtä pitääksemme sen paikkansapitävänä ja saatavilla, mutta emme lupaa että se toimii keskeytyksettä tai virheettömästi, emmekä lupaa mitään tiettyä tulosta. Voima, painonpudotus ja lihaskasvu riippuvat paljon muustakin kuin sovelluksesta: unesta, ruoasta, säännöllisyydestä, perimästä, stressistä ja ajasta.',
      'Siinä määrin kuin laki sallii, vastuumme sovellukseen liittyvistä vaatimuksista rajoittuu siihen mitä olet siitä maksanut vaatimusta edeltäneiden 12 kuukauden aikana. Mikään tässä ei rajoita vastuuta jota ei lain mukaan voi rajoittaa — mukaan lukien vastuu huolimattomuudesta aiheutuneesta kuolemasta tai henkilövahingosta, tai petoksesta.',
    ],
  },
  {
    heading: 'Kenelle mikäkin kuuluu',
    body: [
      'Sovellus, sen ulkoasu, treeniohjelmat ja liikekirjasto kuuluvat meille ja ovat tekijänoikeuden suojaamia. Niitä ei saa kopioida, jälleenmyydä, levittää eikä purkaa takaisinmallinnuksella.',
      'Treenitietosi ovat sinun. Emme väitä omistavamme mitään mitä kirjaat.',
    ],
  },
  {
    heading: 'Mitä et saa tehdä',
    bullets: [
      'Takaisinmallintaa, purkaa tai muokata sovellusta.',
      'Jälleenmyydä, julkaista uudelleen tai levittää treeniohjelmia tai liikesisältöä.',
      'Käyttää automaattisia työkaluja sisällön poimimiseen sovelluksesta.',
      'Käyttää sovellusta lainvastaisella tavalla.',
    ],
  },
  {
    heading: 'Muutokset ja päättyminen',
    body: [
      'Voimme päivittää näitä ehtoja sovelluksen muuttuessa. Olennaiset muutokset näytetään sovelluksessa ennen voimaantuloa, ja käytön jatkaminen sen jälkeen tarkoittaa että hyväksyt ne.',
      'Voit lopettaa milloin tahansa poistamalla sovelluksen. Voimme päättää käyttöoikeutesi jos rikot näitä ehtoja vakavasti.',
    ],
  },
  {
    heading: 'Sovellettava laki',
    body: [
      'Näihin ehtoihin sovelletaan Suomen lakia. Tämä ei poista asuinmaasi pakottavia kuluttajansuojaoikeuksia. Jos riitaa ei saada sovittua, Suomessa asuva kuluttaja voi viedä sen kuluttajariitalautakuntaan (kuluttajariita.fi) oltuaan ensin yhteydessä kuluttajaneuvontaan.',
    ],
  },
];

const TITLES: Record<LegalDocumentId, Record<AppLanguage, { title: string; summary: string }>> = {
  privacy: {
    en: {
      title: 'Privacy policy',
      summary: 'What Vinha stores, where it stays, and what never leaves your phone.',
    },
    fi: {
      title: 'Tietosuojaseloste',
      summary: 'Mitä Vinha tallentaa, missä se pysyy ja mikä ei koskaan lähde puhelimestasi.',
    },
  },
  terms: {
    en: {
      title: 'Terms of use',
      summary: 'The rules of using Vinha, including the health warning and how Pro billing works.',
    },
    fi: {
      title: 'Käyttöehdot',
      summary: 'Vinhan käytön säännöt, terveysvaroitus ja miten Pro-laskutus toimii.',
    },
  },
};

/** dd.mm.yyyy in Finnish, ISO-ish long form in English. */
function formatUpdated(language: AppLanguage): string {
  const [year, month, day] = LEGAL_LAST_UPDATED.split('-');
  if (language === 'fi') return `Päivitetty ${Number(day)}.${Number(month)}.${year}`;
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  return `Updated ${Number(day)} ${months[Number(month) - 1]} ${year}`;
}

export function buildLegalDocument(id: LegalDocumentId, language: AppLanguage): LegalDocument {
  const sections =
    id === 'privacy'
      ? language === 'fi'
        ? PRIVACY_FI
        : PRIVACY_EN
      : language === 'fi'
        ? TERMS_FI
        : TERMS_EN;
  const meta = TITLES[id][language];
  return {
    id,
    title: meta.title,
    summary: meta.summary,
    updatedLabel: formatUpdated(language),
    sections,
  };
}

/** Markdown rendering, shared by the in-app screen's source of truth and the web export. */
export function renderLegalDocumentMarkdown(document: LegalDocument): string {
  const lines: string[] = [`# ${document.title}`, '', `*${document.updatedLabel}*`, '', document.summary, ''];
  for (const section of document.sections) {
    lines.push(`## ${section.heading}`, '');
    for (const paragraph of section.body ?? []) lines.push(paragraph, '');
    for (const bullet of section.bullets ?? []) lines.push(`- ${bullet}`);
    if (section.bullets?.length) lines.push('');
  }
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';
}
