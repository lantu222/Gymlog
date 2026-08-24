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
