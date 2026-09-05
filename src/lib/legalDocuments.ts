import { AppLanguage } from '../types/models';

/**
 * The privacy policy and terms, as data.
 *
 * Two rules govern this file:
 *
 * 1. Every factual claim here is checked against the code. The app has exactly
 *    three outbound request sites — src/lib/aiCoachClient.ts (the coach, the
 *    programme composer and the photo import, only when
 *    EXPO_PUBLIC_AI_COACH_API_URL is set), src/features/account/backupApi.ts
 *    (the optional cloud backup, keyed by Google sign-in) and
 *    src/features/analytics/analyticsClient.ts (anonymous usage events) — and
 *    no analytics or ad SDKs. If any of that changes, this file changes in the
 *    same commit; tests/lib/legalDocuments.test.cjs fails otherwise. The
 *    online-coach notice in i18n.ts (coachChat.online.body) is held to the
 *    same standard by the same test: what App.tsx hands
 *    buildAiTrainingContext, the reader is told about.
 *
 * 2. The prose lives here rather than in i18n.ts on purpose. These are ~150
 *    paragraph-length strings that are read as whole documents, never
 *    interpolated, and must be diffable as documents when the policy is
 *    revised. Splitting them into flat keys would make a legal change
 *    unreviewable.
 *
 * The writing rule, from the 2026-09-04 rewrite: a reader who is not a
 * developer has to be able to follow every sentence. No storage keys, no
 * endpoints, no tokens, no SDKs — say what happens, where it goes, and how to
 * stop it. The two languages are kept structurally parallel (same sections,
 * same paragraph and bullet counts) so a clause cannot exist in one only.
 *
 * scripts/export-legal.cjs renders the same data to Markdown for hosting, so
 * the published policy and the in-app policy cannot drift.
 */

/**
 * The one place the publisher's identity is defined. Change it here and the
 * app, the exported Markdown and the Play Console listing all agree.
 *
 * The controller has to be whoever actually controls the data on the day a
 * user reads this, so it names the individual until a company is entered in
 * the trade register (the name is still being decided; a company that does
 * not exist yet cannot be the controller). The moment the registration lands,
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

/** "Company Oy (FI12345678)" once registered, just the name before that. */
function publisher(): string {
  return LEGAL_ENTITY.businessId ? `${LEGAL_ENTITY.name} (${LEGAL_ENTITY.businessId})` : LEGAL_ENTITY.name;
}

/** Bumped whenever the wording changes in a way a user should re-read. */
export const LEGAL_LAST_UPDATED = '2026-09-05';

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
      'Vinha keeps your training data on your phone. By default nothing about your training leaves it: not your workouts, not your weight, not your programmes.',
      'Two things leave your phone only if you choose them: the optional cloud backup (you sign in with Google) and the AI coach’s online mode (you read a notice and then send a question, ask for a programme, or import one from a photo). A third thing, anonymous usage statistics, is sent by the app itself unless you switch it off in Settings — it carries no content and no identity, and it is described in full below.',
      'No ads, no trackers, no selling of data. If something in this policy is unclear, write to us — the address is in the next section.',
    ],
  },
  {
    heading: 'Who is responsible',
    body: [
      `${publisher()} (${LEGAL_ENTITY.country}) publishes Vinha Fitness (“Vinha”) and is the data controller — the one responsible for how your data is handled — for everything described in this policy.`,
      `Questions about this policy or your data: ${LEGAL_ENTITY.email}.`,
    ],
  },
  {
    heading: 'What the app stores on your phone',
    body: [
      'Everything below is either entered by you or worked out by the app from what you entered. It is kept in the app’s own storage on your phone.',
    ],
    bullets: [
      'Your profile from setup: gender, age, height, weight, goals, experience level, days per week, equipment, the areas you want to focus on, and any injuries or limitations you ticked.',
      'Your training log: workouts and cardio sessions with their exercises, sets, reps, weights, notes, dates, durations and how the session felt.',
      'Body data you add yourself: weight entries and tape measurements.',
      'Your programmes: the ones you build, import from a CSV file or a photo, and the exercise names you teach the app.',
      'Goals you set with the coach, and the milestones and seasons the app counts from your log.',
      'What the coach has advised you in the last three weeks: the one-sentence summary of each answer and the date it was given, at most ten of them. It is kept so the coach does not repeat advice you have already had, it is deleted as it ages past three weeks, and it stays on this phone — the cloud backup below does not carry it.',
      'Preferences: language, units, theme, notification and sound settings, default rest time, training breaks.',
      'Pro status: whether Pro is on, when it was bought or cancelled, and the date until which a promo code keeps it on.',
      'Small bookkeeping: whether the rating prompt or the online-coach notice has been shown, the summary file the home-screen widget reads, the queue of usage events waiting to be sent, and a copy of a damaged data file if the app ever finds one — it is set aside rather than deleted, so a broken file is not a lost training log.',
    ],
  },
  {
    heading: 'Android backup',
    body: [
      'Android’s own backup is switched on for this app. That means your phone can copy Vinha’s data into the backup of your own Google account, so a new phone can restore it. Unless you use the cloud backup below, this is the only way your history survives changing phones.',
      'That copy is between you and Google. We never see it and cannot read it. Google encrypts it, and on current Android versions the key is tied to your device PIN. You can switch it off at any time in Android settings under Google → Backup, and Vinha keeps working exactly the same.',
    ],
  },
  {
    heading: 'Cloud backup (optional)',
    body: [
      'If you sign in with Google, a copy of everything listed under “What the app stores on your phone” — except a workout still in progress — is sent over an encrypted connection to our server and kept there, so a new phone can restore it after you sign in again. Signing in is never required; every feature works without it.',
      'From Google we receive your Google account’s identifier, your email address and your name. These stay on your phone, so the app can show which account is signed in. On the server the backup is filed under a scrambled version of the identifier; your email and name are not stored there.',
      'A backup is sent shortly after you log training, and whenever you press Back up now. The server checks your sign-in with Google on every request, stores the file, and hands it back only to the same Google account. It does not read, analyse or log the contents.',
      'The backup is stored by Vercel, our hosting provider, in the European Union. It is kept until you delete it.',
      'Settings → Delete cloud backup removes the server copy immediately. Signing out does not delete it, and neither does resetting the phone’s data — a reset signs you out first, precisely so that an empty backup never overwrites a full one. The copy waits until you sign in again. If you can no longer open the app, sign in on any Android phone with the same Google account and delete it there, or write to us.',
    ],
  },
  {
    heading: 'The AI coach',
    body: [
      'The coach has two modes. In on-device mode, the default, answers are put together on your phone from your own log, and nothing leaves the device — not the question, not the answer.',
      'In online mode, which a version of the app switches on, the app shows you a notice before your first question, and nothing is sent until you have read it. After that, each question you send carries three things: the question, the earlier messages of the same conversation, and a summary of your training.',
      'The summary contains your recent workouts (exercise names, sets, reps, kilograms, dates, durations), your current programme and its week, your goals, your setup answers (goal, level, days per week, equipment, limitations), the coach’s own answers from the last three weeks in one sentence each, so it does not repeat advice you have already had, and — if you have logged them — your latest weight, tape measurements, height, age and gender.',
      'It does not contain your name, your email, your Google account or any identifier of your phone. The question cannot be tied to you. Our server sees the phone’s internet address, which it holds briefly in memory to limit how many requests one connection can make; it is not stored.',
      'Our server forwards the question to Anthropic, the company behind the Claude model, which writes the answer in the United States. Under Anthropic’s commercial terms the data is not used to train its models and is deleted within 30 days. We keep no copy of questions or answers.',
      'The programme composer works the same way: when you ask the app to build a programme from a written brief, the brief and the same summary are sent along the same route.',
      'Importing a programme from a photo also uses this route. The photo you picked is scaled down and sent so the table in it can be read; it is used for that one import and is not kept.',
    ],
  },
  {
    heading: 'Usage statistics',
    body: [
      'To see whether the app works — for example whether some step of the setup is so hard that people give up there — the app sends anonymous usage events to our own server.',
      'An event is a name and a time, plus for setup steps the step number and which path you took. Never the content: no exercise name, no weight, no measurement, no question text. The full list of events is fixed in the app’s code, and the server refuses anything outside it.',
      'Each install gets a random identifier, generated on your phone. It is not connected to your name, email, Google account or any advertising identity, and it resets if you reinstall the app.',
      'The events go to our own server and nowhere else. They are kept for up to 24 months and then deleted automatically, and they are not shared, not sold and not used for advertising. You can switch them off at any time in Settings → Usage statistics; the app then sends nothing and throws away whatever was waiting to be sent. These are the events:',
    ],
    bullets: [
      'The app was opened.',
      'A setup step was reached, and which one.',
      'Setup was finished, and whether you built a programme or picked a ready one.',
      'A programme was taken into use.',
      'A workout was started.',
      'A workout was saved.',
      'The Pro page was viewed.',
      'A question was sent to the coach — the fact that one was sent, never the text.',
    ],
  },
  {
    heading: 'Who helps us run this',
    body: [
      'We run no servers of our own. Three companies process data for us, under contracts that bind them to handle it only on our instructions and only for the purposes described here.',
    ],
    bullets: [
      'Vercel (United States): runs our server and stores the cloud backups and the usage events. The storage is in the European Union.',
      'Anthropic (United States): answers coach questions, composes programmes and reads programme photos, as described above.',
      'Google (United States): verifies your Google sign-in, keeps the Android backup of your own account, and handles Google Play payments. Your relationship with Google is covered by Google’s own privacy policy.',
    ],
  },
  {
    heading: 'Data outside the European Union',
    body: [
      'Where data goes outside the European Union — the coach traffic to Anthropic, and possibly Vercel’s processing — the transfer rests on the European Commission’s standard contractual clauses, which are part of each provider’s data processing agreement with us.',
    ],
  },
  {
    heading: 'Why we may process your data',
    body: [
      'The GDPR requires a lawful basis for each kind of processing. These are ours.',
    ],
    bullets: [
      'Providing the app you asked for (contract): keeping your data on your phone, running Pro, and showing you your own history.',
      'Your consent: the cloud backup (you sign in), the coach’s online mode (you read the notice and send a question), the programme composer and the photo import (you ask for them). Training and body data count as health data, so for anything that leaves your phone we rely on your explicit consent. You can withdraw it at any time: delete the backup and sign out, and simply stop sending questions.',
      'Our legitimate interest: the anonymous usage statistics, so we can see where the app fails people, and the brief rate limiting that protects the server from abuse. You can object by switching the statistics off in Settings, or by writing to us.',
      'Legal obligations: none of ours involve your personal data today. Google Play is the seller of record for Pro and keeps the purchase records; the sales reports we receive from Google contain no personal data.',
    ],
  },
  {
    heading: 'What the app does not do',
    bullets: [
      'No third-party analytics and no crash-reporting tools from other companies. The only usage data is the anonymous statistics described above, sent to our own server and no one else.',
      'No ads, no ad networks, no advertising identifier.',
      'No trackers and no social media components. There is no feed, no followers and no public profile.',
      'No access to your location, contacts, microphone, camera or files. A photo is read only when you pick one yourself, through the phone’s own picker, and only that photo.',
      'No advertising profile. The app does tailor programmes and suggestions from your answers and your log, but that happens on your phone, and nothing is decided about you automatically in a way that has legal or similar effects.',
      'No selling, renting or sharing of your data with anyone, beyond the three providers named above who work for us.',
      'No account needed. Sign-in exists only to key the optional cloud backup.',
    ],
  },
  {
    heading: 'Permissions the app asks for',
    body: [
      'The app asks your phone for very little. What it does use:',
    ],
    bullets: [
      'Notifications: asked the first time a rest timer needs to alert you, or when you switch notifications on in Settings. Refuse, and everything else keeps working.',
      'Photos: the phone’s own picker hands the app the one photo you chose. No permission to your photo library is asked.',
      'Internet: only for the three things above — backup, coach, statistics. Logging a workout never needs a connection.',
      'Keeping the screen on during a workout, if you switch that on in Settings.',
      'Vibration, for the haptic ticks — which you can switch off.',
    ],
  },
  {
    heading: 'Notifications',
    body: [
      'Notifications come in three groups: while you train (the rest timer and the live session), wins and recaps after a workout, and reminders such as a weigh-in day or a training day. Every one of them is scheduled on your phone by the app itself. They are not push notifications: no server is involved and no device token exists.',
      'Turn any group, or all of them, off in Settings → Notifications, or in Android’s own notification settings.',
    ],
  },
  {
    heading: 'Payments and promo codes',
    body: [
      'If you buy Pro, the payment is handled entirely by Google Play. We never see your card number, billing address or any payment detail. The app learns only whether Pro is active, which plan, and until when.',
      'A promo code is checked on your phone, and the app stores only the date until which it keeps Pro on. Nothing about it is sent anywhere.',
    ],
  },
  {
    heading: 'Feedback, rating and sharing',
    body: [
      'Send feedback opens your own mail app with our address and the app version filled in. You decide what to write. We then see your email address and your message, and keep them only as long as it takes to handle the feedback.',
      'Rate Vinha opens the app’s page on Google Play. The app itself sends nothing.',
      'Exporting a programme or your training log as CSV, and inviting a friend, go through your phone’s share menu to the app you pick. We never see where they go.',
    ],
  },
  {
    heading: 'Security',
    body: [
      'Everything that leaves your phone travels over an encrypted connection. On the server, every backup request is checked against Google before anything is read or written, backups are filed under a scrambled identifier in private storage, training data is never written to logs, and request rates are limited.',
      'On your phone, the app’s data is protected by the phone’s own lock and the separation Android keeps between apps; the app adds no encryption of its own. Anyone who can unlock your phone can open Vinha and see your training data, so keep the phone locked.',
    ],
  },
  {
    heading: 'How long we keep it',
    bullets: [
      'On your phone: until you reset the app’s data or uninstall it.',
      'Android backup: as long as your Google account keeps it — that is Google’s setting, not ours.',
      'Cloud backup: until you delete it in Settings, or ask us to.',
      'Coach questions, briefs and photos: not kept by us at all. Anthropic deletes them within 30 days.',
      'Usage statistics: up to 24 months, then deleted automatically.',
      'Feedback emails: as long as it takes to handle them.',
    ],
  },
  {
    heading: 'Your rights',
    body: [
      'Under the GDPR you have the right to see the data we hold about you, to correct it, to delete it, to take it with you, to withdraw a consent you gave, and to object to processing based on our legitimate interest.',
      'Most of these you exercise yourself, inside the app, without asking anyone. For the rest, write to us — we answer within a month.',
    ],
    bullets: [
      'See it: Settings → My data shows your profile, and Progress shows your log. The cloud backup is the same data, so there is nothing more on our side to show.',
      'Correct it: edit your profile, or any logged session or entry.',
      'Delete it: Settings → Reset all data clears the phone, and Settings → Delete cloud backup clears the server. Uninstalling the app removes the phone copy too. Usage statistics cannot be traced back to you, so there is nothing of yours to find in them.',
      'Take it with you: Settings → Export plan (CSV) sends your programme, or every logged set, as CSV text to any app you choose.',
      'Withdraw consent or object: delete the cloud backup and sign out; stop sending questions to the coach; switch usage statistics off in Settings.',
      `Complain: write to ${LEGAL_ENTITY.email} first, so we can put it right. You also have the right to complain to the data protection authority — in Finland, the Office of the Data Protection Ombudsman (tietosuoja.fi).`,
    ],
  },
  {
    heading: 'Children',
    body: [
      'Vinha is not intended for children under 16, and we do not knowingly process their data. Because nothing reaches us with a name attached, we cannot tell a child’s data from anyone else’s — if you believe a child has signed in for the cloud backup, write to us and we will delete it.',
    ],
  },
  {
    heading: 'Changes to this policy',
    body: [
      'If this policy changes in a way that affects you, the app shows the change before it takes effect. The date at the top always tells you which version you are reading, and earlier versions are available on request.',
    ],
  },
];

const PRIVACY_FI: LegalSection[] = [
  {
    heading: 'Lyhyesti',
    body: [
      'Vinha pitää treenitietosi puhelimessasi. Oletuksena treeneistäsi ei lähde puhelimesta mitään: ei treenejä, ei painoa, ei ohjelmia.',
      'Kaksi asiaa lähtee puhelimestasi vain, jos itse valitset ne: vapaaehtoinen pilvivarmuuskopio (kirjaudut Googlella) ja AI-valmentajan verkkotila (luet ilmoituksen ja lähetät sen jälkeen kysymyksen, pyydät ohjelman tai tuot sellaisen valokuvasta). Kolmannen asian, nimettömät käyttötilastot, sovellus lähettää itse, ellet kytke sitä pois asetuksista — niissä ei ole sisältöä eikä henkilöllisyyttä, ja ne kuvataan kokonaan alla.',
      'Ei mainoksia, ei seurantaa, ei tietojen myyntiä. Jos jokin tässä selosteessa on epäselvää, kirjoita meille — osoite on seuraavassa kohdassa.',
    ],
  },
  {
    heading: 'Kuka vastaa',
    body: [
      `${publisher()} (${LEGAL_ENTITY.countryFi}) julkaisee Vinha Fitness -sovelluksen (”Vinha”) ja on rekisterinpitäjä eli se, joka vastaa tietojesi käsittelystä kaikessa, mitä tässä selosteessa kuvataan.`,
      `Kysymykset tästä selosteesta tai tiedoistasi: ${LEGAL_ENTITY.email}.`,
    ],
  },
  {
    heading: 'Mitä sovellus tallentaa puhelimeesi',
    body: [
      'Kaikki alla oleva on joko sinun syöttämääsi tai sovelluksen laskemaa siitä, mitä syötit. Se säilyy sovelluksen omassa tallennustilassa puhelimessasi.',
    ],
    bullets: [
      'Profiilisi käyttöönotosta: sukupuoli, ikä, pituus, paino, tavoitteet, kokemustaso, treenipäivät viikossa, välineet, painotettavat alueet sekä vammat tai rajoitteet, jotka merkitsit.',
      'Treenilokisi: treenit ja cardio-suoritukset liikkeineen, sarjoineen, toistoineen, painoineen, muistiinpanoineen, päivämäärineen ja kestoineen sekä se, miltä treeni tuntui.',
      'Kehon tiedot, jotka itse lisäät: painomerkinnät ja mittanauhalla otetut mitat.',
      'Ohjelmasi: ne, jotka rakennat, tuot CSV-tiedostosta tai valokuvasta, sekä liikenimet, jotka opetat sovellukselle.',
      'Valmentajan kanssa asettamasi tavoitteet sekä virstanpylväät ja kaudet, jotka sovellus laskee lokistasi.',
      'Mitä valmentaja on neuvonut sinulle viimeisten kolmen viikon aikana: kunkin vastauksen yhden lauseen tiivistelmä ja päivä, jona se annettiin, enintään kymmenen kappaletta. Se säilytetään, jottei valmentaja toista jo antamaansa neuvoa, se poistuu kolmea viikkoa vanhetessaan, ja se pysyy tässä puhelimessa — alla kuvattu pilvivarmuuskopio ei kanna sitä mukanaan.',
      'Asetukset: kieli, yksiköt, teema, ilmoitus- ja ääniasetukset, oletuslepoaika, treenitauot.',
      'Pro-tila: onko Pro päällä, milloin se ostettiin tai peruttiin, ja päivä, johon asti kampanjakoodi pitää sen päällä.',
      'Pientä kirjanpitoa: onko arviointipyyntö tai verkkovalmentajan ilmoitus jo näytetty, tiivistelmätiedosto, jota kotinäytön widget lukee, jono lähetystä odottavia käyttötapahtumia, sekä kopio vaurioituneesta datatiedostosta, jos sovellus sellaisen joskus löytää — se siirretään sivuun eikä poisteta, jotta rikkoutunut tiedosto ei ole menetetty treeniloki.',
    ],
  },
  {
    heading: 'Androidin oma varmuuskopio',
    body: [
      'Androidin oma varmuuskopiointi on tälle sovellukselle päällä. Puhelimesi voi siis kopioida Vinhan tiedot oman Google-tilisi varmuuskopioon, jotta uusi puhelin voi palauttaa ne. Ellet käytä alla kuvattua pilvivarmuuskopiota, tämä on ainoa tapa, jolla historiasi selviää puhelimen vaihdosta.',
      'Se kopio on sinun ja Googlen välinen. Me emme näe sitä emmekä voi lukea sitä. Google salaa sen, ja nykyisissä Android-versioissa avain on sidottu laitteesi PIN-koodiin. Voit kytkeä sen pois milloin tahansa Androidin asetuksista kohdasta Google → Varmuuskopiointi, ja Vinha toimii täsmälleen samalla tavalla.',
    ],
  },
  {
    heading: 'Pilvivarmuuskopio (vapaaehtoinen)',
    body: [
      'Jos kirjaudut Googlella, kopio kaikesta kohdassa ”Mitä sovellus tallentaa puhelimeesi” luetellusta — paitsi kesken olevasta treenistä — lähetetään salattua yhteyttä pitkin palvelimellemme ja säilytetään siellä, jotta uusi puhelin voi palauttaa sen, kun kirjaudut uudelleen. Kirjautumista ei koskaan vaadita; jokainen toiminto toimii ilman sitä.',
      'Googlelta saamme Google-tilisi tunnisteen, sähköpostiosoitteesi ja nimesi. Ne säilyvät puhelimessasi, jotta sovellus voi näyttää, mikä tili on kirjautuneena. Palvelimella varmuuskopio tallennetaan tunnisteen sekoitetun muodon alle; sähköpostiasi ja nimeäsi ei tallenneta sinne.',
      'Varmuuskopio lähetetään hetki sen jälkeen, kun kirjaat treenin, ja aina kun painat Varmuuskopioi nyt. Palvelin tarkistaa kirjautumisesi Googlelta joka pyynnöllä, tallentaa tiedoston ja luovuttaa sen vain samalle Google-tilille. Se ei lue, analysoi eikä lokita sisältöä.',
      'Varmuuskopion säilyttää Vercel, palvelintarjoajamme, Euroopan unionin alueella. Se säilyy, kunnes poistat sen.',
      'Asetukset → Poista pilvivarmuuskopio poistaa palvelinkopion heti. Uloskirjautuminen ei poista sitä, eikä puhelimen tietojen nollaus — nollaus kirjaa sinut ensin ulos juuri siksi, ettei tyhjä varmuuskopio koskaan korvaisi täyttä. Kopio odottaa, kunnes kirjaudut uudelleen. Jos et enää pääse sovellukseen, kirjaudu samalla Google-tilillä millä tahansa Android-puhelimella ja poista se sieltä, tai kirjoita meille.',
    ],
  },
  {
    heading: 'AI-valmentaja',
    body: [
      'Valmentajalla on kaksi tilaa. Laitetilassa, joka on oletus, vastaukset kootaan puhelimessasi omasta lokistasi, eikä mitään lähde laitteelta — ei kysymys eikä vastaus.',
      'Verkkotilassa, jonka sovelluksen versio kytkee päälle, sovellus näyttää sinulle ilmoituksen ennen ensimmäistä kysymystä, eikä mitään lähetetä ennen kuin olet lukenut sen. Sen jälkeen jokainen lähettämäsi kysymys kantaa mukanaan kolme asiaa: kysymyksen, saman keskustelun aiemmat viestit ja yhteenvedon treenistäsi.',
      'Yhteenvedossa ovat viimeaikaiset treenisi (liikkeiden nimet, sarjat, toistot, kilot, päivämäärät, kestot), nykyinen ohjelmasi ja sen viikko, tavoitteesi, käyttöönoton vastauksesi (tavoite, taso, treenipäivät viikossa, välineet, rajoitteet), valmentajan omat vastaukset viimeisiltä kolmelta viikolta yhtenä lauseena kukin, jottei se toista jo antamaansa neuvoa, sekä — jos olet kirjannut ne — viimeisin painosi, mittasi, pituutesi, ikäsi ja sukupuolesi.',
      'Siinä ei ole nimeäsi, sähköpostiasi, Google-tiliäsi eikä mitään puhelimesi tunnistetta. Kysymystä ei voi yhdistää sinuun. Palvelimemme näkee puhelimen internet-osoitteen, jota se pitää hetken muistissa rajoittaakseen, montako pyyntöä yksi yhteys voi tehdä; sitä ei tallenneta.',
      'Palvelimemme välittää kysymyksen Anthropicille, Claude-mallin kehittäjälle, joka kirjoittaa vastauksen Yhdysvalloissa. Anthropicin kaupallisten ehtojen mukaan tietoja ei käytetä sen mallien opettamiseen, ja ne poistetaan 30 päivän kuluessa. Me emme säilytä kopiota kysymyksistä emmekä vastauksista.',
      'Ohjelmakoostaja toimii samalla tavalla: kun pyydät sovellusta rakentamaan ohjelman kirjoittamasi kuvauksen pohjalta, kuvaus ja sama yhteenveto lähetetään samaa reittiä.',
      'Myös ohjelman tuonti valokuvasta käyttää tätä reittiä. Valitsemasi kuva pienennetään ja lähetetään, jotta siinä oleva taulukko voidaan lukea; sitä käytetään siihen yhteen tuontiin, eikä sitä säilytetä.',
    ],
  },
  {
    heading: 'Käyttötilastot',
    body: [
      'Jotta näemme, toimiiko sovellus — esimerkiksi onko jokin käyttöönoton vaihe niin vaikea, että siihen jäädään — sovellus lähettää nimettömiä käyttötapahtumia omalle palvelimellemme.',
      'Tapahtuma on nimi ja aika sekä käyttöönoton vaiheissa vaiheen numero ja se, kumman polun valitsit. Ei koskaan sisältöä: ei liikkeen nimeä, ei painoa, ei mittaa, ei kysymyksen tekstiä. Tapahtumien lista on kiinnitetty sovelluksen koodiin, ja palvelin hylkää kaiken sen ulkopuolisen.',
      'Jokainen asennus saa satunnaisen tunnisteen, joka luodaan puhelimessasi. Sitä ei ole kytketty nimeesi, sähköpostiisi, Google-tiliisi eikä mihinkään mainostunnisteeseen, ja se nollautuu, jos asennat sovelluksen uudelleen.',
      'Tapahtumat menevät omalle palvelimellemme eivätkä mihinkään muualle. Niitä säilytetään enintään 24 kuukautta, minkä jälkeen ne poistetaan automaattisesti, eikä niitä jaeta, myydä tai käytetä mainontaan. Voit kytkeä ne pois milloin tahansa kohdasta Asetukset → Käyttötilastot; sen jälkeen sovellus ei lähetä mitään ja hävittää lähetystä odottaneet tapahtumat. Tapahtumat ovat nämä:',
    ],
    bullets: [
      'Sovellus avattiin.',
      'Käyttöönoton vaihe saavutettiin, ja mikä vaihe.',
      'Käyttöönotto valmistui, ja rakensitko ohjelman vai valitsitko valmiin.',
      'Ohjelma otettiin käyttöön.',
      'Treeni aloitettiin.',
      'Treeni tallennettiin.',
      'Pro-sivu avattiin.',
      'Valmentajalle lähetettiin kysymys — se, että kysymys lähti, ei koskaan sen tekstiä.',
    ],
  },
  {
    heading: 'Ketkä auttavat meitä',
    body: [
      'Meillä ei ole omia palvelimia. Kolme yritystä käsittelee tietoja puolestamme sopimuksilla, jotka velvoittavat ne käsittelemään tietoja vain meidän ohjeidemme mukaan ja vain tässä kuvattuihin tarkoituksiin.',
    ],
    bullets: [
      'Vercel (Yhdysvallat): ajaa palvelimemme ja säilyttää pilvivarmuuskopiot ja käyttötapahtumat. Tallennustila on Euroopan unionin alueella.',
      'Anthropic (Yhdysvallat): vastaa valmentajan kysymyksiin, koostaa ohjelmia ja lukee ohjelmakuvia, kuten yllä kuvattiin.',
      'Google (Yhdysvallat): vahvistaa Google-kirjautumisesi, säilyttää oman tilisi Android-varmuuskopion ja hoitaa Google Playn maksut. Suhdettasi Googleen koskee Googlen oma tietosuojakäytäntö.',
    ],
  },
  {
    heading: 'Tiedot Euroopan unionin ulkopuolella',
    body: [
      'Siltä osin kuin tietoja siirtyy Euroopan unionin ulkopuolelle — valmentajan liikenne Anthropicille ja mahdollisesti Vercelin käsittely — siirto perustuu Euroopan komission vakiosopimuslausekkeisiin, jotka ovat osa kunkin palveluntarjoajan kanssamme tekemää tietojenkäsittelysopimusta.',
    ],
  },
  {
    heading: 'Millä perusteella käsittelemme tietojasi',
    body: [
      'Tietosuoja-asetus (GDPR) vaatii jokaiselle käsittelylle laillisen perusteen. Meidän perusteemme ovat nämä.',
    ],
    bullets: [
      'Sovelluksen tarjoaminen sinulle (sopimus): tietojesi säilyttäminen puhelimessasi, Pron toimittaminen ja oman historiasi näyttäminen.',
      'Suostumuksesi: pilvivarmuuskopio (kirjaudut sisään), valmentajan verkkotila (luet ilmoituksen ja lähetät kysymyksen), ohjelmakoostaja ja kuvatuonti (pyydät niitä). Treeni- ja kehontiedot ovat terveystietoja, joten kaikkeen puhelimestasi lähtevään nojaamme nimenomaiseen suostumukseesi. Voit peruuttaa sen milloin tahansa: poista varmuuskopio ja kirjaudu ulos, ja lakkaa lähettämästä kysymyksiä.',
      'Oikeutettu etumme: nimettömät käyttötilastot, jotta näemme, missä sovellus pettää käyttäjät, sekä lyhytaikainen pyyntöjen rajoitus, joka suojaa palvelinta väärinkäytöltä. Voit vastustaa tätä kytkemällä tilastot pois asetuksista tai kirjoittamalla meille.',
      'Lakisääteiset velvoitteet: mikään meidän velvoitteistamme ei tänään koske henkilötietojasi. Google Play on Pron myyjä ja säilyttää ostotiedot; Googlelta saamamme myyntiraportit eivät sisällä henkilötietoja.',
    ],
  },
  {
    heading: 'Mitä sovellus ei tee',
    bullets: [
      'Ei kolmannen osapuolen analytiikkaa eikä muiden yritysten kaatumisraportointityökaluja. Ainoa käyttödata on yllä kuvatut nimettömät tilastot, jotka menevät omalle palvelimellemme eikä kenellekään muulle.',
      'Ei mainoksia, ei mainosverkostoja, ei mainostunnistetta.',
      'Ei seurantaa eikä sosiaalisen median osia. Ei syötettä, ei seuraajia, ei julkista profiilia.',
      'Ei pääsyä sijaintiisi, yhteystietoihisi, mikrofoniin, kameraan tai tiedostoihisi. Kuva luetaan vain, kun itse valitset sen puhelimen omalla valitsimella, ja vain se kuva.',
      'Ei mainosprofiilia. Sovellus kyllä räätälöi ohjelmia ja ehdotuksia vastaustesi ja lokisi perusteella, mutta se tapahtuu puhelimessasi, eikä sinusta päätetä automaattisesti mitään, millä olisi oikeudellisia tai vastaavia vaikutuksia.',
      'Ei tietojesi myyntiä, vuokrausta eikä jakamista kenellekään — lukuun ottamatta kolmea yllä nimettyä palveluntarjoajaa, jotka työskentelevät meille.',
      'Ei tilipakkoa. Kirjautuminen on olemassa vain vapaaehtoista pilvivarmuuskopiota varten.',
    ],
  },
  {
    heading: 'Luvat, joita sovellus pyytää',
    body: [
      'Sovellus pyytää puhelimeltasi hyvin vähän. Tätä se käyttää:',
    ],
    bullets: [
      'Ilmoitukset: kysytään, kun lepoajastin ensimmäisen kerran tarvitsee hälyttää, tai kun kytket ilmoitukset päälle asetuksista. Kieltäydy, ja kaikki muu toimii silti.',
      'Kuvat: puhelimen oma valitsin antaa sovellukselle sen yhden kuvan, jonka valitsit. Lupaa kuvakirjastoosi ei pyydetä.',
      'Internet: vain kolmea yllä kuvattua asiaa varten — varmuuskopio, valmentaja, tilastot. Treenin kirjaaminen ei koskaan tarvitse yhteyttä.',
      'Näytön pitäminen päällä treenin aikana, jos kytket sen päälle asetuksista.',
      'Värinä, haptisia napsautuksia varten — ne voi kytkeä pois.',
    ],
  },
  {
    heading: 'Ilmoitukset',
    body: [
      'Ilmoituksia on kolmea ryhmää: treenin aikana (lepoajastin ja käynnissä oleva treeni), voitot ja koosteet treenin jälkeen sekä muistutukset, kuten punnituspäivä tai treenipäivä. Jokaisen niistä ajastaa sovellus itse puhelimessasi. Ne eivät ole push-ilmoituksia: palvelinta ei ole mukana eikä laitetunnistetta ole olemassa.',
      'Kytke mikä tahansa ryhmä tai kaikki pois kohdasta Asetukset → Ilmoitukset tai Androidin omista ilmoitusasetuksista.',
    ],
  },
  {
    heading: 'Maksut ja kampanjakoodit',
    body: [
      'Jos ostat Pron, maksun hoitaa kokonaan Google Play. Emme koskaan näe korttinumeroasi, laskutusosoitettasi emmekä mitään maksutietoa. Sovellus saa tietää vain, onko Pro voimassa, mikä tilaus ja mihin asti.',
      'Kampanjakoodi tarkistetaan puhelimessasi, ja sovellus tallentaa vain päivän, johon asti se pitää Pron päällä. Siitä ei lähetetä mitään mihinkään.',
    ],
  },
  {
    heading: 'Palaute, arviointi ja jakaminen',
    body: [
      'Lähetä palautetta avaa oman sähköpostisovelluksesi, johon on valmiiksi täytetty osoitteemme ja sovelluksen versio. Sinä päätät, mitä kirjoitat. Me näemme sitten sähköpostiosoitteesi ja viestisi, ja säilytämme ne vain niin kauan kuin palautteen käsittely vaatii.',
      'Arvioi Vinha avaa sovelluksen sivun Google Playssä. Sovellus itse ei lähetä mitään.',
      'Ohjelman tai treenilokin vienti CSV-muodossa sekä kaverin kutsuminen kulkevat puhelimesi jakovalikon kautta valitsemaasi sovellukseen. Me emme koskaan näe, minne ne menevät.',
    ],
  },
  {
    heading: 'Tietoturva',
    body: [
      'Kaikki puhelimestasi lähtevä kulkee salattua yhteyttä pitkin. Palvelimella jokainen varmuuskopiopyyntö tarkistetaan Googlelta ennen kuin mitään luetaan tai kirjoitetaan, varmuuskopiot tallennetaan sekoitetun tunnisteen alle yksityiseen tallennustilaan, treenitietoja ei koskaan kirjoiteta lokeihin, ja pyyntöjen määrää rajoitetaan.',
      'Puhelimessasi sovelluksen tietoja suojaavat puhelimen oma lukitus ja Androidin sovellusten välinen eristys; sovellus ei lisää omaa salaustaan. Kuka tahansa, joka saa puhelimesi auki, voi avata Vinhan ja nähdä treenitietosi — pidä siis puhelin lukittuna.',
    ],
  },
  {
    heading: 'Kuinka kauan säilytämme tiedot',
    bullets: [
      'Puhelimessasi: kunnes nollaat sovelluksen tiedot tai poistat sovelluksen.',
      'Android-varmuuskopio: niin kauan kuin Google-tilisi sitä säilyttää — se on Googlen asetus, ei meidän.',
      'Pilvivarmuuskopio: kunnes poistat sen asetuksista tai pyydät meitä poistamaan sen.',
      'Valmentajan kysymykset, kuvaukset ja kuvat: me emme säilytä niitä lainkaan. Anthropic poistaa ne 30 päivän kuluessa.',
      'Käyttötilastot: enintään 24 kuukautta, sen jälkeen automaattinen poisto.',
      'Palautesähköpostit: niin kauan kuin niiden käsittely vaatii.',
    ],
  },
  {
    heading: 'Oikeutesi',
    body: [
      'Tietosuoja-asetuksen mukaan sinulla on oikeus nähdä sinusta säilyttämämme tiedot, korjata ne, poistaa ne, ottaa ne mukaasi, peruuttaa antamasi suostumus ja vastustaa oikeutettuun etuumme perustuvaa käsittelyä.',
      'Suurimman osan näistä teet itse sovelluksessa keneltäkään kysymättä. Muissa kirjoita meille — vastaamme kuukauden kuluessa.',
    ],
    bullets: [
      'Näe ne: Asetukset → Omat tiedot näyttää profiilisi ja Kehitys lokisi. Pilvivarmuuskopio on sama data, joten meidän puolellamme ei ole mitään lisää näytettävää.',
      'Korjaa ne: muokkaa profiiliasi tai mitä tahansa kirjattua treeniä tai merkintää.',
      'Poista ne: Asetukset → Nollaa kaikki tiedot tyhjentää puhelimen, ja Asetukset → Poista pilvivarmuuskopio tyhjentää palvelimen. Sovelluksen poistaminen poistaa myös puhelimen kopion. Käyttötilastoja ei voi jäljittää sinuun, joten niistä ei löydy mitään sinun.',
      'Ota ne mukaasi: Asetukset → Vie ohjelma (CSV) lähettää ohjelmasi tai jokaisen kirjatun sarjan CSV-tekstinä valitsemaasi sovellukseen.',
      'Peruuta suostumus tai vastusta: poista pilvivarmuuskopio ja kirjaudu ulos; lakkaa lähettämästä kysymyksiä valmentajalle; kytke käyttötilastot pois asetuksista.',
      `Valita: kirjoita ensin osoitteeseen ${LEGAL_ENTITY.email}, jotta voimme korjata asian. Sinulla on myös oikeus tehdä valitus tietosuojaviranomaiselle — Suomessa tietosuojavaltuutetun toimistolle (tietosuoja.fi).`,
    ],
  },
  {
    heading: 'Lapset',
    body: [
      'Vinhaa ei ole tarkoitettu alle 16-vuotiaille, emmekä tietoisesti käsittele heidän tietojaan. Koska meille ei tule mitään nimen kanssa, emme voi erottaa lapsen tietoja kenenkään muun tiedoista — jos uskot lapsen kirjautuneen pilvivarmuuskopioon, kirjoita meille, niin poistamme sen.',
    ],
  },
  {
    heading: 'Muutokset tähän selosteeseen',
    body: [
      'Jos tämä seloste muuttuu tavalla, joka vaikuttaa sinuun, sovellus näyttää muutoksen ennen kuin se astuu voimaan. Yläreunan päiväys kertoo aina, minkä version luet, ja aiemmat versiot saa pyynnöstä.',
    ],
  },
];

const TERMS_EN: LegalSection[] = [
  {
    heading: 'The short version',
    body: [
      'Vinha is a training app. It suggests programmes, tracks what you lift, and has a coach that reads your numbers. It is not a doctor, a physiotherapist or a personal trainer standing next to you, and it cannot see your form or how you feel today. You decide what is safe to lift.',
      'By installing or using Vinha you accept these terms. If you do not accept them, do not use the app.',
    ],
  },
  {
    heading: 'Who provides the service',
    body: [
      `Vinha is provided by ${publisher()} (${LEGAL_ENTITY.country}). Contact: ${LEGAL_ENTITY.email}. How we handle your data is described in the privacy policy, which is part of these terms.`,
    ],
  },
  {
    heading: 'Age',
    body: [
      'You must be at least 16 years old to use Vinha. The app is built around adult strength training and is not designed for children.',
    ],
  },
  {
    heading: 'Your licence to use the app',
    body: [
      'You get a personal, non-exclusive, non-transferable right to use Vinha for your own training, on devices you control. That right lasts as long as you follow these terms.',
    ],
  },
  {
    heading: 'Health and safety — read this one',
    body: [
      'Vinha gives general fitness information. It is not medical advice, and nothing in it diagnoses, treats or prevents any condition.',
      'Talk to a doctor before starting a training programme, especially if you are pregnant, recovering from an injury or illness, have a heart, joint or blood-pressure condition, or have not trained in a long time.',
      'Stop immediately if you feel pain, dizziness, chest tightness or shortness of breath, and get medical help.',
      'Weights are dangerous. You are responsible for your own technique, your warm-up, the equipment you use and the weight you choose. A weight the app suggests is a suggestion drawn from numbers you logged — it knows nothing about how you slept, what hurts today, or whether the bar is loaded correctly.',
      'The coach, in both of its modes, reads your logged numbers and writes about them. It is not a clinician, it does not know your medical history, and — especially in online mode, where a language model writes the answer — it can be confidently wrong. Treat it as a well-read training partner, not as a professional opinion, and check anything that matters.',
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
      'Only import programmes — as CSV or as a photo — that you have the right to use. What you import stays on your phone, and you are responsible for it.',
    ],
  },
  {
    heading: 'Your data, and the backups',
    body: [
      'Your training data lives on your phone. If you do not sign in, there is no copy of it anywhere we can reach, which means we cannot recover it for you if you lose your phone, uninstall the app or reset your data. Export your log as CSV from Settings whenever you want a copy of your own.',
      'If you sign in with Google, the optional cloud backup keeps one copy on our server so that a new phone can restore it. It is a convenience, not a guarantee: keep your own export of anything you cannot afford to lose. The backup can only be restored by signing in with the same Google account, so keep access to that account.',
      'You own your data. We claim no rights to anything you log, build or import, and we use the backup for nothing except giving it back to you.',
    ],
  },
  {
    heading: 'Pro',
    bullets: [
      'The free version is a complete app: every ready-made programme, the full exercise library, unlimited logging, your progress, and export. It has limits on building — three programmes of your own, two in use at a time — and it shows trends and records over the most recent three months.',
      'Pro unlocks the features listed on the Pro page in the app at the time you buy it, including the coach’s online mode up to the monthly number of questions shown in the app. Pro can be a monthly subscription, a yearly subscription, or a one-time lifetime purchase.',
      'Payment is charged through Google Play at the price shown there when you confirm the purchase. We do not handle payments ourselves.',
      'Subscriptions renew automatically unless you cancel at least 24 hours before the period ends. Cancel in Google Play — the End membership screen in the app takes you there. Cancelling stops the next renewal; Pro stays on until the paid period ends.',
      'Lifetime means use of the service for as long as Vinha is offered commercially and maintained. If the service is discontinued for good, the lifetime licence ends with it. It is a single payment with nothing to renew or cancel.',
      'When Pro ends, nothing you logged is lost. Your data, your programmes and your history stay; only the Pro features lock until Pro is on again.',
      'Refunds follow Google Play’s refund policy and your statutory consumer rights, including a right of withdrawal where the law gives you one. Pro starts the moment the purchase is confirmed, and by using it straight away you agree that the service begins at once.',
      'Promo codes may be limited in time or number, can expire, and have no cash value.',
      'If a price changes, you will be told in advance through Google Play, and the change never applies to a period you have already paid for.',
    ],
  },
  {
    heading: 'Features that need our server',
    body: [
      'The coach’s online mode, the programme composer, the photo import and the cloud backup need our server, and the coach also needs Anthropic’s service. They may be slow, unavailable or withdrawn, and we may change the model or the provider behind them. When the server cannot answer, the app falls back to on-device answers or tells you it could not.',
      'To keep these features affordable for everyone, we may limit how often they can be used — for example the monthly number of coach questions, the size of an imported photo, or how many backups an account can send in a short time.',
      'The coach never changes your programme by itself. Every change to what you train is a change you make.',
    ],
  },
  {
    heading: 'What we promise, and what we do not',
    body: [
      'The app is provided as it is. We work to keep it accurate and available, but we do not promise it will be uninterrupted or error-free, or that it will produce any particular result. Strength, weight loss and muscle growth depend on far more than an app: sleep, food, consistency, genetics, stress and time.',
      'To the extent the law allows, our liability for any claim connected to the app is limited to what you paid for it in the twelve months before the claim. Nothing here limits liability that cannot be limited by law — including liability for death or personal injury caused by negligence, for fraud, or your mandatory rights as a consumer.',
      'We are not liable for delays or outages caused by things outside our control, such as power failures, network faults, problems at our service providers, or the actions of authorities.',
    ],
  },
  {
    heading: 'What belongs to whom',
    body: [
      'The app, its design, its ready-made programmes and its exercise library belong to us and are protected by copyright. You may not copy, resell, redistribute or reverse-engineer them.',
      'Your training data, the programmes you build and the notes you write are yours. We claim no ownership of anything you log.',
    ],
  },
  {
    heading: 'Things you may not do',
    bullets: [
      'Reverse-engineer, decompile or modify the app, or work around Pro.',
      'Resell, republish or redistribute the ready-made programmes or exercise content.',
      'Use automated tools to extract content from the app or to flood our server.',
      'Send the coach content that is unlawful, or that belongs to someone else without their permission.',
      'Use the app in any way that breaks the law.',
    ],
  },
  {
    heading: 'Changes and ending',
    body: [
      'We may update these terms as the app changes. Material changes are shown in the app before they take effect, and continuing to use Vinha after that means you accept them. If you do not, stop using the app — and if you have an active subscription, cancel it in Google Play.',
      'You can stop at any time by uninstalling the app. Your data on the phone goes with it; the cloud backup stays until you delete it in Settings.',
      'We may end your access to the server features, or to the app, if you seriously breach these terms. We may also discontinue Vinha or its server features; if that happens, we will say so in the app in advance, and your data stays on your phone and exportable.',
    ],
  },
  {
    heading: 'Governing law and disputes',
    body: [
      'These terms are governed by Finnish law. This does not remove the mandatory consumer protection rights of the country where you live. If a dispute cannot be settled between us, a consumer in Finland can take it to the Consumer Disputes Board (kuluttajariita.fi) after first contacting the Consumer Advisory Service (kkv.fi).',
    ],
  },
];

const TERMS_FI: LegalSection[] = [
  {
    heading: 'Lyhyesti',
    body: [
      'Vinha on treenisovellus. Se ehdottaa ohjelmia, seuraa mitä nostat, ja siinä on valmentaja, joka lukee numeroitasi. Se ei ole lääkäri, fysioterapeutti eikä vieressä seisova personal trainer, eikä se näe tekniikkaasi tai sitä, miltä sinusta tänään tuntuu. Sinä päätät, mikä on turvallista nostaa.',
      'Asentamalla Vinhan tai käyttämällä sitä hyväksyt nämä ehdot. Jos et hyväksy niitä, älä käytä sovellusta.',
    ],
  },
  {
    heading: 'Kuka palvelun tarjoaa',
    body: [
      `Vinhan tarjoaa ${publisher()} (${LEGAL_ENTITY.countryFi}). Yhteystieto: ${LEGAL_ENTITY.email}. Se, miten käsittelemme tietojasi, kuvataan tietosuojaselosteessa, joka on osa näitä ehtoja.`,
    ],
  },
  {
    heading: 'Ikäraja',
    body: [
      'Sinun on oltava vähintään 16-vuotias käyttääksesi Vinhaa. Sovellus on rakennettu aikuisten voimaharjoittelun ympärille, eikä sitä ole suunniteltu lapsille.',
    ],
  },
  {
    heading: 'Käyttöoikeutesi',
    body: [
      'Saat henkilökohtaisen, ei-yksinomaisen ja siirtokelvottoman oikeuden käyttää Vinhaa omaan treenaamiseesi laitteilla, jotka ovat hallinnassasi. Oikeus on voimassa niin kauan kuin noudatat näitä ehtoja.',
    ],
  },
  {
    heading: 'Terveys ja turvallisuus — lue tämä',
    body: [
      'Vinha antaa yleistä kuntoilutietoa. Se ei ole lääketieteellistä neuvontaa, eikä mikään siinä diagnosoi, hoida tai ehkäise mitään sairautta.',
      'Keskustele lääkärin kanssa ennen treeniohjelman aloittamista, erityisesti jos olet raskaana, toivut vammasta tai sairaudesta, sinulla on sydän-, nivel- tai verenpaineongelma tai et ole treenannut pitkään aikaan.',
      'Lopeta heti, jos tunnet kipua, huimausta, puristusta rinnassa tai hengenahdistusta, ja hakeudu lääkäriin.',
      'Painot ovat vaarallisia. Vastaat itse tekniikastasi, lämmittelystäsi, käyttämistäsi välineistä ja valitsemastasi painosta. Sovelluksen ehdottama paino on ehdotus, joka perustuu kirjaamiisi numeroihin — se ei tiedä mitään siitä, miten nukuit, mihin sattuu tänään tai onko tanko ladattu oikein.',
      'Valmentaja lukee kummassakin tilassaan kirjaamiasi numeroita ja kirjoittaa niistä. Se ei ole terveydenhuollon ammattilainen, se ei tunne sairaushistoriaasi, ja — erityisesti verkkotilassa, jossa vastauksen kirjoittaa kielimalli — se voi olla varmalla äänellä väärässä. Suhtaudu siihen lukeneena treenikaverina, älä ammattilaisen lausuntona, ja tarkista kaikki, millä on merkitystä.',
      'Treenaat omalla vastuullasi.',
    ],
  },
  {
    heading: 'Sinun vastuusi',
    bullets: [
      'Syötä tietosi rehellisesti — suositukset ovat vain niin hyviä kuin se, mitä kirjaat.',
      'Käytä sovellusta omaan henkilökohtaiseen, ei-kaupalliseen treenaamiseen.',
      'Älä käytä sovellusta ainoana terveystiedon lähteenäsi.',
      'Pidä laitteesi turvassa. Kuka tahansa, joka saa puhelimesi auki, näkee treenitietosi.',
      'Tuo sovellukseen — CSV:nä tai valokuvana — vain ohjelmia, joihin sinulla on käyttöoikeus. Tuomasi sisältö pysyy puhelimessasi, ja vastaat siitä itse.',
    ],
  },
  {
    heading: 'Tietosi ja varmuuskopiot',
    body: [
      'Treenitietosi ovat puhelimessasi. Jos et kirjaudu sisään, niistä ei ole missään kopiota, johon me pääsisimme käsiksi — emme siis voi palauttaa niitä sinulle, jos hukkaat puhelimesi, poistat sovelluksen tai nollaat tietosi. Vie lokisi CSV-muodossa asetuksista aina, kun haluat oman kopion.',
      'Jos kirjaudut Googlella, vapaaehtoinen pilvivarmuuskopio pitää yhden kopion palvelimellamme, jotta uusi puhelin voi palauttaa sen. Se on helpotus, ei takuu: pidä oma vientisi kaikesta, mitä et voi menettää. Varmuuskopion voi palauttaa vain kirjautumalla samalla Google-tilillä, joten pidä pääsy siihen tiliin tallessa.',
      'Tietosi ovat sinun. Emme vaadi oikeuksia mihinkään, mitä kirjaat, rakennat tai tuot, emmekä käytä varmuuskopiota mihinkään muuhun kuin sen palauttamiseen sinulle.',
    ],
  },
  {
    heading: 'Pro',
    bullets: [
      'Ilmaisversio on kokonainen sovellus: jokainen valmis ohjelma, koko liikekirjasto, rajaton kirjaus, kehityksesi ja vienti. Rakentamisella on rajat — kolme omaa ohjelmaa, kaksi käytössä kerrallaan — ja trendit ja ennätykset näytetään viimeisimmän kolmen kuukauden ajalta.',
      'Pro avaa ne ominaisuudet, jotka on lueteltu sovelluksen Pro-sivulla ostohetkellä, mukaan lukien valmentajan verkkotilan sovelluksessa näytettyyn kuukausittaiseen kysymysmäärään asti. Pro voi olla kuukausitilaus, vuositilaus tai kertaostona elinikäinen.',
      'Maksu veloitetaan Google Playn kautta siellä ostoa vahvistettaessa näkyvällä hinnalla. Emme käsittele maksuja itse.',
      'Tilaus uusiutuu automaattisesti, ellet peruuta sitä vähintään 24 tuntia ennen kauden päättymistä. Peruuta Google Playssä — sovelluksen Lopeta jäsenyys -ruutu vie sinut sinne. Peruutus lopettaa seuraavan uusiutumisen; Pro pysyy päällä maksetun kauden loppuun.',
      'Elinikäinen tarkoittaa palvelun käyttöä niin kauan kuin Vinhaa tarjotaan kaupallisesti ja sitä ylläpidetään. Jos palvelu lopetetaan pysyvästi, elinikäinen käyttöoikeus päättyy samalla. Se on kertamaksu, jossa ei ole mitään uusittavaa tai peruttavaa.',
      'Kun Pro päättyy, mitään kirjaamaasi ei menetetä. Tietosi, ohjelmasi ja historiasi säilyvät; vain Pro-ominaisuudet menevät lukkoon, kunnes Pro on taas päällä.',
      'Palautukset noudattavat Google Playn palautuskäytäntöä ja lakisääteisiä kuluttajaoikeuksiasi, mukaan lukien peruuttamisoikeus silloin, kun laki sen sinulle antaa. Pro alkaa heti, kun osto on vahvistettu, ja ottamalla sen heti käyttöön hyväksyt, että palvelu alkaa välittömästi.',
      'Kampanjakoodit voivat olla aika- tai määrärajattuja, ne voivat vanheta, eikä niillä ole rahallista arvoa.',
      'Jos hinta muuttuu, saat siitä tiedon etukäteen Google Playn kautta, eikä muutos koskaan koske jo maksamaasi kautta.',
    ],
  },
  {
    heading: 'Toiminnot, jotka tarvitsevat palvelimemme',
    body: [
      'Valmentajan verkkotila, ohjelmakoostaja, kuvatuonti ja pilvivarmuuskopio tarvitsevat palvelimemme, ja valmentaja tarvitsee lisäksi Anthropicin palvelua. Ne voivat olla hitaita, poissa käytöstä tai ne voidaan lopettaa, ja voimme vaihtaa niiden takana olevaa mallia tai palveluntarjoajaa. Kun palvelin ei voi vastata, sovellus palaa laitteella muodostettuihin vastauksiin tai kertoo, ettei se onnistunut.',
      'Jotta nämä toiminnot pysyvät kohtuuhintaisina kaikille, voimme rajoittaa niiden käyttötiheyttä — esimerkiksi valmentajan kysymysten kuukausimäärää, tuotavan kuvan kokoa tai sitä, montako varmuuskopiota tili voi lähettää lyhyessä ajassa.',
      'Valmentaja ei koskaan muuta ohjelmaasi itse. Jokainen muutos siihen, mitä treenaat, on sinun tekemäsi.',
    ],
  },
  {
    heading: 'Mitä lupaamme ja mitä emme',
    body: [
      'Sovellus tarjotaan sellaisena kuin se on. Teemme työtä pitääksemme sen paikkansapitävänä ja saatavilla, mutta emme lupaa, että se toimii keskeytyksettä tai virheettömästi, emmekä lupaa mitään tiettyä tulosta. Voima, painonpudotus ja lihaskasvu riippuvat paljon muustakin kuin sovelluksesta: unesta, ruoasta, säännöllisyydestä, perimästä, stressistä ja ajasta.',
      'Siinä määrin kuin laki sallii, vastuumme sovellukseen liittyvistä vaatimuksista rajoittuu siihen, mitä olet siitä maksanut vaatimusta edeltäneiden 12 kuukauden aikana. Mikään tässä ei rajoita vastuuta, jota ei lain mukaan voi rajoittaa — mukaan lukien vastuu huolimattomuudesta aiheutuneesta kuolemasta tai henkilövahingosta, petoksesta tai pakottavista kuluttajaoikeuksistasi.',
      'Emme vastaa viivästyksistä tai palvelukatkoista, jotka johtuvat vaikutusmahdollisuuksiemme ulkopuolella olevista syistä, kuten sähkökatkoista, verkkohäiriöistä, palveluntarjoajien ongelmista tai viranomaistoimista.',
    ],
  },
  {
    heading: 'Kenelle mikäkin kuuluu',
    body: [
      'Sovellus, sen ulkoasu, valmiit ohjelmat ja liikekirjasto kuuluvat meille ja ovat tekijänoikeuden suojaamia. Niitä ei saa kopioida, jälleenmyydä, levittää eikä purkaa takaisinmallinnuksella.',
      'Treenitietosi, rakentamasi ohjelmat ja kirjoittamasi muistiinpanot ovat sinun. Emme väitä omistavamme mitään, mitä kirjaat.',
    ],
  },
  {
    heading: 'Mitä et saa tehdä',
    bullets: [
      'Takaisinmallintaa, purkaa tai muokata sovellusta tai kiertää Pro-lukkoa.',
      'Jälleenmyydä, julkaista uudelleen tai levittää valmiita ohjelmia tai liikesisältöä.',
      'Käyttää automaattisia työkaluja sisällön poimimiseen sovelluksesta tai palvelimemme kuormittamiseen.',
      'Lähettää valmentajalle sisältöä, joka on lainvastaista tai kuuluu jollekulle muulle ilman tämän lupaa.',
      'Käyttää sovellusta lainvastaisella tavalla.',
    ],
  },
  {
    heading: 'Muutokset ja päättyminen',
    body: [
      'Voimme päivittää näitä ehtoja sovelluksen muuttuessa. Olennaiset muutokset näytetään sovelluksessa ennen voimaantuloa, ja käytön jatkaminen sen jälkeen tarkoittaa, että hyväksyt ne. Jos et hyväksy, lopeta sovelluksen käyttö — ja jos sinulla on voimassa oleva tilaus, peruuta se Google Playssä.',
      'Voit lopettaa milloin tahansa poistamalla sovelluksen. Puhelimessa olevat tietosi lähtevät sen mukana; pilvivarmuuskopio säilyy, kunnes poistat sen asetuksista.',
      'Voimme päättää pääsysi palvelintoimintoihin tai sovellukseen, jos rikot näitä ehtoja vakavasti. Voimme myös lopettaa Vinhan tai sen palvelintoiminnot; jos niin käy, kerromme siitä sovelluksessa etukäteen, ja tietosi säilyvät puhelimessasi ja vietävissä.',
    ],
  },
  {
    heading: 'Sovellettava laki ja riidat',
    body: [
      'Näihin ehtoihin sovelletaan Suomen lakia. Tämä ei poista asuinmaasi pakottavia kuluttajansuojaoikeuksia. Jos riitaa ei saada sovittua keskenämme, Suomessa asuva kuluttaja voi viedä sen kuluttajariitalautakuntaan (kuluttajariita.fi) oltuaan ensin yhteydessä kuluttajaneuvontaan (kkv.fi).',
    ],
  },
];

const TITLES: Record<LegalDocumentId, Record<AppLanguage, { title: string; summary: string }>> = {
  privacy: {
    en: {
      title: 'Privacy policy',
      summary: 'What Vinha stores, what leaves your phone, and what you can do about it.',
    },
    fi: {
      title: 'Tietosuojaseloste',
      summary: 'Mitä Vinha tallentaa, mikä lähtee puhelimestasi ja mitä voit sille tehdä.',
    },
  },
  terms: {
    en: {
      title: 'Terms of service',
      summary: 'The rules for using Vinha: the health warning, how Pro billing works, and what we promise.',
    },
    fi: {
      title: 'Käyttöehdot',
      summary: 'Vinhan käytön säännöt: terveysvaroitus, miten Pro-laskutus toimii ja mitä lupaamme.',
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
