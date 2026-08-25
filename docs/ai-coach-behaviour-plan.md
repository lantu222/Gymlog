# AI-valmentajan käytössuunnitelma

Käyttäjän speksi 24.8.2026: *"haluan että se on niinkuin coach — tee
toimintasuunnitelma, etsi tarvittavat tiedot ja taidot. Ota huomioon normaalit
keskustelut. Aina coachin tulisi antaa sitä mitä kysytään, ei tämmöisiä mitä
jokainen voi tietää ja katsoa itse. Yritän kasvattaa rinnanympärystä ja kysyn
siitä ja ruokavaliosta. Voisi myös ehdottaa asioita: haluatko tämän
kotiruutuun, haluatko ilmoituksen joka aamu että muistat punnita itsesi."*

Tämä dokumentti on se suunnitelma. Toteutus vaiheittain omissa sessioissaan.

## Perusperiaate: valmentaja, ei raportti

Yksi sääntö kaiken yllä: **jokainen rivi vastauksessa on joko johtopäätös tai
neuvo — ei koskaan datan toistoa.** Appi näyttää sarjat, painot ja päivämäärät
jo itse; jos vastauksen rivin voisi lukea Progress-välilehdeltä, se rivi on
väärin. Luvut saavat esiintyä vain todisteena väitteelle ("hip thrust ei ole
noussut kolmeen viikkoon → lisää painoa 2,5 kg").

Lokikatselmus 23.8. näytti rikkeen käytännössä: "Analysoi viime treenini" →
miksi-osio oli kuusi riviä sarjalistausta, nolla tulkintaa.

## 1. Kolme viestityyppiä — ja mitä kukin saa vastaukseksi

Nyt jokainen viesti pakotetaan samaan takeaway/miksi/seuraavaksi-muottiin,
minkä takia "Kiitos" tuotti täyden analyysin suunnitelmineen. Jatkossa:

| Tyyppi | Tunnistus | Vastaus | Maksaa kysymyksen? |
|---|---|---|---|
| **Valmennuskysymys** ("analysoi", "miten penkki etenee", "mitä syön") | oletus | täysi rakenne | kyllä |
| **Keskustelu** ("kiitos", "moi", "ok", "hyvä", emoji) | clientissä, ilman API-kutsua | lyhyt kuittaus paikallisesta listasta | ei |
| **Datailmoitus** ("rinnanympärys on 90 cm") | clientissä (measurementIntent, tehty) | kirjaustarjous + korttitarjous | ei |

Lisäksi **jatkokysymykset**: "entä sitten?", "miksi?" eivät toimi, koska
jokainen kysymys lähtee tyhjästä. Pyyntöön mukaan saman istunnon viimeiset
4–6 viestiä (kysymys+takeaway riittää), jotta valmentaja muistaa mistä
puhuttiin. Ei pysyvää muistia — vain auki oleva keskustelu.

## 2. Tarvittavat tiedot (kontekstin laajennus)

Valmentaja tietää nyt vain treenit (sessiot, nostot, rytmi, ohjelmat,
plateaut, fatigue, plannerSetup). **Se ei tiedä kehosta eikä tavoitteista
mitään** — siksi rinnanympärys- ja ruokakysymyksiin ei tule mitään käyttökelpoista.

Kontekstiin lisätään (kaikki on jo AppDatabasessa paitsi tavoitteet):

1. **Paino**: viimeisin + trendi 30/90 pv (kg ja suunta). Ruokavalioneuvot
   ilman painoa ovat arvauksia; painon kanssa proteiini- ja kaloriohje
   voidaan sitoa lukuun (g/kg).
2. **Mitat**: jokaisesta mitatusta kohdasta viimeisin arvo, edellinen ja
   muutos ("rinnanympärys 98 cm, +1,5 cm / 8 viikossa"). Tämä tekee
   "kasvaako rintani" -kysymyksestä vastattavan.
3. **Tavoitteet — uusi asia**: käyttäjän sanoittama tavoite talteen
   (esim. "kasvatan rinnanympärystä", tavoitearvo valinnaisena).
   - Tallennus: `preferences.coachGoals` tms. (pieni lista: kohde, suunta,
     tavoitearvo?, asetettu pvm).
   - Syöttö: valmentaja itse — kun käyttäjä kertoo tavoitteen chatissa,
     tarjotaan "Asetetaanko tavoitteeksi?" samalla kortilla kuin mittakirjaus.
   - Kontekstissa aina mukana → jokainen vastaus voi kytkeytyä tavoitteeseen.
4. **Profiili**: pituus (jos kirjattu) — BMI/proteiinilaskuihin.
5. **Kotiruudun tila**: mitkä mittakortit on kiinnitetty + onko
   punnitusmuistutus päällä → jotta ehdotukset (kohta 4) osataan tehdä vain
   silloin kun asia puuttuu.
6. **Cardio**: viikkomäärä minuutteina, jos kirjattu.

Kustannus: konteksti kasvaa arviolta 10–20 %, ja se on prompt-cachessa —
merkityksetön.

## 3. Tarvittavat taidot (promptin säännöt)

`COACH_SYSTEM_RULES`-muutokset:

- **Analyysisääntö**: "Every why-line must state a conclusion the user could
  not read off the screen themselves; numbers appear only as evidence for a
  claim. Never enumerate the sets of a session back to the user."
- **Vastaa siihen mitä kysyttiin**: "Answer the question that was asked. A
  nutrition question gets a nutrition answer, not a training summary. If the
  context has nothing relevant to the question, say so in one line and give
  the best general answer tied to the user's numbers."
- **Tavoitevalmennus**: kun konteksti sisältää tavoitteen, vastaukset
  sidotaan siihen: rinnanympärystavoite → rinnan viikkovolyymi historiasta
  (sarjat/vko), eteneekö se, mittausrytmi (2–4 vk välein, sama aika ja
  olosuhde), odotettu vauhti realistisesti.
- **Ravinto**: sallittu ja sidottava käyttäjän lukuihin: proteiini
  1,6–2,2 g/kg painosta, ylijäämä/alijäämä tavoitteen mukaan, treenin
  jälkeinen ateria. Yleistieto on ok ravinnossa — mutta luku lasketaan
  käyttäjän painosta, ei "yleensä suositellaan".
- Nykyiset evidenssisäännöt (ei keksittyjä lukuja, <3 sessiota ei ole trendi,
  ei diagnooseja) säilyvät sellaisenaan.

## 4. Ehdotukset — valmentaja tekee aloitteita

Uusi vastauskentän osa: `suggestions` (max 1/vastaus, ettei spämmää).
Palvelin saa ehdottaa tyypitettyjä toimia, client piirtää napin ja hoitaa
toteutuksen — sama kuvio kuin mittakirjaustarjouksessa:

| Ehdotus | Milloin | Mitä nappi tekee |
|---|---|---|
| `pin_stat_card` | puhuttiin mitasta jonka korttia ei ole Kodissa | kiinnittää kortin (koodi on jo olemassa) |
| `weigh_in_reminder` | tavoite vaatii painon seurantaa eikä muistutusta ole | ajastaa aamuilmoituksen (ilmoitusmoottori on jo olemassa; uusi ilmoituslaji) |
| `set_goal` | käyttäjä kuvasi tavoitteen sanallisesti | tallentaa tavoitteen (kohta 2.3) |
| `log_measurement` | (tehty jo clientissä) | kirjaa mitan |
| olemassa olevat `AICoachAction`-navigoinnit | ennallaan | avaa ruudun |

Sääntö promptiin: ehdota vain kun kontekstin `homeState` osoittaa asian
puuttuvan — ei koskaan ehdoteta sitä mikä on jo päällä
(muistisääntö: siru joka on aina päällä on kohinaa).

## 5. Toteutusjärjestys

1. **Vaihe 1 — konteksti + säännöt** (suurin laatuhyppy): paino, mitat,
   tavoitteet kontekstiin; analyysi-, vastaa-mitä-kysyttiin- ja
   ravintosäännöt; tavoitteen tallennus + set_goal-tarjous chatissa.
2. **Vaihe 2 — keskustelut**: smalltalk-tunnistus clientissä (ei kutsua,
   ei veloitusta); istunnon viestihistoria pyyntöön.
3. **Vaihe 3 — ehdotukset**: `suggestions`-kenttä, pin_stat_card ja
   weigh_in_reminder + aamupunnitusilmoitus ilmoitusmoottoriin.
4. **Vaihe 4 — eval**: uudet eval-tapaukset (rinnanympärystavoite,
   ruokakysymys, "analysoi" jossa oikea vastaus on tulkinta, "kiitos",
   jatkokysymys) ja aja live-eval ennen/jälkeen.

Jokaisen vaiheen jälkeen: transkriptiloki + yhteiskatselmus samoilla
kysymyksillä, joilla 23.8. epäonnistuttiin.

## Rajaukset

- Ei pysyvää keskustelumuistia laitteiden yli (vain auki oleva istunto).
- Ei ruokapäiväkirjaa — ravinto neuvotaan painon ja tavoitteen varassa,
  kunnes joskus ehkä muuta.
- Ilmoitusehdotus koskee vain punnitusta; muut muistutuslajit myöhemmin.

## 6. Tarkennukset 25.8. — käyttäjän viisi kohtaa

Vaihe 1 on tehty (`a7090f7`). Nämä viisi tarkentavat vaiheita 2–4, ja jokainen
on päätös eikä idea: mitä tehdään, ja miksi juuri tässä muodossa.

### 6.1 Tavoitteille pääsuositus, ei numeroitua prioriteettia

Ongelma on tosi: `CoachGoal` on lista ilman järjestystä, ja neljä tavoitetta
samalla tasolla tuottaa neljä laimeaa vastausta.

`priority: 1..n` **hylättiin**. Kaksi syytä. Ensinnäkin se on kenttä jota kukaan
ei ylläpidä — asetetaan kerran ja vanhenee hiljaa, sama vikaluokka kuin muissa
kirjoitetuissa muttei kytketyissä oletusarvoissa. Toiseksi ranking ei ratkaise
oikeaa ristiriitaa: rasvanpudotus ja rinnanympärys eivät sovi yhteen
painottamalla, koska kaloriohje voi olla vain joko ylijäämä tai alijäämä.
Järjestys ei valitse, se hämärtää.

Tehdään sen sijaan:

- `preferences.primaryGoalId` — yksi tavoite kerrallaan on "nyt tärkein",
  muut jäävät listalle taustaksi. Vaihdettavissa yhdellä napautuksella.
- Promptisääntö: kun tavoitteet vetävät eri suuntiin, valmentaja **nimeää
  ristiriidan kerran ja kysyy kumpi ensin** — ei jaa eroa. Tämä on sama
  koneisto kuin 6.4, eli se rakentuu ilmaiseksi sen päälle.
- Kontekstiin `goals`-listaan `isPrimary`-lippu.

### 6.2 Ravinto: kentät ovat jo olemassa, lupa laskea puuttuu

Sukupuoli, ikä ja pituus **ovat jo kontekstissa** — `App.tsx` syöttää
`setupGender`, `setupAge` ja `setupHeightCm`, ne kysytään onboardingissa ja
niitä voi muokata Omat tiedot -ruudulla. Kenttiä ei siis tarvitse lisätä.

Puuttuva pala on lupa laskea. Nykyinen sääntö antaa vain proteiinin
(1,6–2,2 g/kg) eikä sano mitään ylläpidosta, joten malli ei tuota sitä
"300 kcal ylijäämää" jota tavoitevalmennus vaatii, vaikka sillä on kaikki
tarvittava. Lisätään sääntö: kun pituus, ikä ja sukupuoli ovat kontekstissa,
laske ylläpito (Mifflin-St Jeor) ja ilmoita ylijäämä tai alijäämä lukuna;
kun jokin niistä puuttuu, anna per kg -sääntö ja sano mitä puuttuu.

**Aktiivisuustasoa ei kysytä.** Appi mittaa sen jo: `sessionsThisWeek`,
`sessionsLast30Days` ja cardio-minuutit. Itse ilmoitettu "kohtalaisen
aktiivinen" on kenttä joka valehtelee kuukauden kuluttua; laskettu treenimäärä
ei. Aktiivisuuskerroin johdetaan näistä.

### 6.3 Ehdotuksille cooldown — hylkäys tarkoittaa ei

Rakennetaan vaiheen 3 mukana, sisään leivottuna eikä jälkikäteen. Malli on jo
olemassa: `ratingPrompt.ts` tekee täsmälleen tämän (kysy viikoittain, katoa kun
on vastattu).

Viisi keskustelua on liian lyhyt. Jos käyttäjä sanoo ei aamupunnitus-
muistutukselle, hän tarkoittaa "ei", ei "kysy ensi viikolla". Siksi:

- ensimmäinen hylkäys → 30 vrk hiljaisuutta sille ehdotustyypille
- toinen hylkäys → ei enää koskaan tälle tyypille
- hyväksytty ehdotus → ei koskaan uudestaan (asia on jo päällä)

Tallennus: `preferences.coachSuggestionState` — tyyppi → `{ rejectedCount,
lastRejectedAt, acceptedAt }`. Sama muistisääntö kuin siruissa: asia joka on
aina esillä on kohinaa.

### 6.4 Kun valmentaja ei tiedä: yksi kysymys, veloituksetta

**Tästä aloitetaan.** Halvin toteuttaa ja muuttaa sävyn neuvomisesta
valmentamiseen: jos mittauksia ei ole koskaan kirjattu, paras vastaus
kysymykseen "miten saan rinnanympäryksen kasvamaan nopeammin" ei ole neuvo
vaan mittauspyyntö.

Koneisto on jo paikallaan, eikä sitä ole kytketty: `AICoachAdvice.unanswered`
on olemassa, ja client jättää veloittamatta kun se on tosi
(`AICoachChatScreen`). Vain palvelin ei ole koskaan asettanut sitä — lippua
asettaa tällä hetkellä pelkkä offline-esikatselu.

Toteutus:

- `AI_COACH_RESPONSE_SCHEMA` saa `unanswered`-kentän (ei pakollinen).
- `validateAnswer` päästää sen läpi.
- Sääntö: kun konteksti ei riitä tarkkaan vastaukseen, älä arvaa äläkä anna
  yleisvastausta — **kysy täsmälleen yksi lyhyt jatkokysymys**, laita se
  `takeaway`iin, jätä muut kentät tyhjiksi ja merkitse `unanswered`.
- Rajaus samaan sääntöön: kysy vain kun puuttuva tieto oikeasti estää
  vastaamisen. Jos hyödyllinen vastaus on olemassa, se annetaan. Muuten
  kysymisestä tulee tapa väistää.
- Kysymys suunnataan siihen mitä appi voi ottaa vastaan (mitta, tavoite,
  paino), jotta vaiheen 3 ehdotusnappi voi tarttua siihen suoraan.

Kaksi ehtoa jotka tekevät tästä oikean eivätkä ärsyttävän: **vastauskysymys ei
saa veloittaa** (viikkokiintiö on 3 ilmaista kysymystä; käyttäjä ei maksa
siitä ettei app tiennyt — ennakkotapaus `dde8c7c`), ja kysymys **tarjotaan
lopulta nappina** eikä pelkkänä tekstinä. Nappi tulee vaiheessa 3; ilman sitä
kysymys on tyhjä lupaus, joten 6.4 ei ole valmis ennen kuin se on kytketty.

### 6.5 Luottamustaso lasketaan, ei arvioida

Tavoite on oikea — "kolmen kuukauden datan perusteella" on eri lause kuin
"näyttää siltä" — mutta **malli ei arvioi omaa luottamustaan**. Se on juuri se
asia jossa kielimallit ovat huonoja, ja lopputulos on hedge-generaattori:
"näyttää siltä" liimataan kaiken eteen ja epävarmuudesta tulee tyylikeino.

Luottamus lasketaan clientissä siitä mitä jo lasketaan (sessiot ikkunassa,
mittausten määrä, historian pituus) ja annetaan kontekstiin **faktana**, ei
arviona: `history.confidence: 'low' | 'medium' | 'high'` sekä luvut joista se
seuraa. Sitten yksi promptisääntö kääntää tason sallituksi sanamuodoksi.
Silloin luottamus ei voi hallusinoitua, koska malli ei keksi sitä.

Alkeismuoto on jo säännöissä ("fewer than three sessions is not a trend");
kyse on sen laajentamisesta portaisiin. **Tasoa ei näytetä käyttäjälle
siruna** — sävy riittää.

### 6.6 Uusi toteutusjärjestys

1. **6.4** — ei-tiedä-kysymys + `unanswered` palvelimelta (aloitettu 25.8.)
2. **6.1** — pääsuositus ja ristiriitasääntö
3. **6.5** — luottamus kontekstifaktana
4. **Vaihe 2** — smalltalk clientissä + istunnon viestihistoria
5. **Vaihe 3 + 6.3** — suggestions-kenttä, napit ja cooldown samassa
6. **Vaihe 4** — eval-tapaukset, myös 6.4:lle (kysyykö se silloin kun pitää,
   ja onko se hiljaa silloin kun ei pidä) ja 6.2:lle (tuleeko kaloriluku)
