# Suoritusohjeiden suomi — läpiluku 2026-09-08

> **Tila 2026-09-08: kohdat 1–15 korjattu ja testattu.** Kohta 16 (hengitysohjeet)
> jätettiin ennalleen, kohta 17 (kahvakuulien välinemerkintä) ei kuulu tähän
> tiedostoon; kohta 17 korjattiin erikseen. Kaksi tarkennusta alla oleviin ehdotuksiin, jotka tehtiin toisin:
> kohdassa 8 `kaarra selkää` (rivi 123, penkkipunnerruksen kaari) jätettiin
> paikalleen — se on oikea vihje siellä — ja Good Morningin ensimmäinen askel
> pitää sanan `jännitettynä`, koska englanti sanoo siinä "tight", ei "arched".
> Kohdat 14–15 eivät voineet olla poistoja: molemmat liikkeet ovat ohjelmien
> määräämiä, ja merkinnän poisto pudottaisi ne englantiin ja kaataisi vartijan.
> Turhat askeleet korvattiin oikeilla ohjeilla.

Luettu: kaikki 141 liikettä ja 617 askelta tiedostosta `src/lib/exerciseInstructions.ts`,
englanti rinnalla. Nämä ovat ne ohjeet, jotka valmis ohjelma näyttää — kirjaston
loput 735 liikettä näytetään englanniksi eivätkä ne ole tässä.

Yleisarvio: suomi on hyvää. Se on tiivistetty tarkoituksella (lähdekanta jauhaa
hengitystä ja toistaa "This will be your starting position" lähes joka
merkinnässä), ja tiivistys on onnistunut. Alla on 17 kohtaa, joissa se ei ole.

Rivinumerot viittaavat `src/lib/exerciseInstructions.ts`:ään.

---

## A. Väärin — ohje sanoo jotain muuta kuin tarkoittaa

**1. `vastaote` tarkoittaa maastavedossa väärää otetta. (rivit 65, 237, 782)**

Kolme maastavetoa — perusmaastaveto, deficit ja sumo — kääntävät englannin
"alternate grip" / "over/under grip" / "mixed grip" sanalla **vastaote**.
Yksiselitteinen suomi tälle on **sekaote**: toinen kämmen ylös, toinen alas.
"Vastaote" on se sana, jolla suomeksi tarkoitetaan kämmenet ylöspäin ‑otetta
(vastaotteella tehtävä leuanveto). Lukija, joka ottaa raskaaseen maastavetoon
molemmat kämmenet ylöspäin, on hauiksensa kanssa vaarassa.

- 65 · Barbell Deadlift: `Jos ote ei kestä, käytä vastaotetta tai rannelenkkejä.` → `käytä sekaotetta`
- 237 · Deficit Deadlift: `Käytä yliotetta tai raskaissa sarjoissa vastaotetta.` → `sekaotetta`
- 782 · Sumo Deadlift: `Käytä yliotetta, vastaotetta tai koukkuotetta.` → `yliotetta, sekaotetta tai koukkuotetta`

Tämä on listan tärkein kohta: se koskee juuri niitä liikkeitä, joissa ote ratkaisee.

**2. `väärä ote` (rivi 891, Muscle Up)**

`Ota renkaista väärä ote` — lukija lukee tämän ohjeeksi ottaa väärä ote.
Englannin "false grip" on liikkeen nimetty tekniikka. → `valeote (false grip)`
tai jätä englanniksi ja selitä, kuten rivi jo tekeekin.

**3. `Roiku` istuma-asennossa (rivi 837, Wide-Grip Lat Pulldown)**

`Roiku kädet suorina ja kallista ylävartaloa noin 30 astetta taakse.`
Ylätaljassa istutaan polvituki reisien päällä. Rivi on kopioitu leuanvedon
merkinnästä (rivi 590), jossa se on oikein. → `Ojenna kädet suoriksi ja kallista…`

**4. `pohjekonelaitteen` (rivi 736, Standing Calf Raises)**

Kolmen sanan yhdyssana, jossa kaksi tarkoittaa samaa: pohje + kone + laite.
→ `pohjelaitteen`

**5. Punnerruksen käsien väli: 90 senttimetriä (rivi 609, Pushups)**

Lähde sanoo "36 inches", ja se on käännetty tarkasti. Englanniksi luku menee
ohi silmien; suomeksi "noin 90 senttimetrin päässä toisistaan" lukee täsmälliseltä
ohjeelta, ja se on väärä — normaali punnerrusleveys on 55–70 cm.
→ `hieman hartioita leveämmälle` (lähde on väärässä, älä käännä sitä tarkasti)

**6. Sissy squat: `varpaat koholla` (rivi 829) — tarkistettava**

Lähde sanoo "toes raised", mutta sissy squatissa nousevat kantapäät, eivät
varpaat. Englanti on itsessään epäselvä; suomi valitsi tulkinnan, joka on
todennäköisesti väärä suunta. → `kantapäät koholla` (varmista liikkeestä ensin)

---

## B. Kankeaa — ymmärrettävää, mutta ei suomea jota kukaan puhuu

**7. `Käännä liike` (rivit 632, 728)**

Suora käännöslaina englannin "reverse the motion" ‑fraasista. Tiedosto sanoo
muualla `Palaa…`, `Nouse…`, `Vaihda suuntaa` — nämä kaksi jäivät.

**8. Sama vihje, kolme eri sanaa: "arched back"**

- `kaarra selkää` (123)
- `selkä jännitettynä` (238, 329, 338, 339)
- `kevyessä notkossa` (555, 561, 566, 590, 659, 824)

`jännitettynä` on niistä huonoin: se ei kerro mihin suuntaan selkää pidetään,
ja se on juuri se tieto jota vihje kantaa. Valitse yksi — ehdotus: `kevyessä
notkossa` kaikkialle, koska se sanoo asennon eikä lihastyötä.

**9. Sama ote, kaksi eri sanaa**

`alaote` (191) ja `myötäote` (208) tarkoittavat molemmat kämmenet ylöspäin.
Valitse toinen. `alaote` on yleisempi ja sopii pariin `yliote`n kanssa, jota
tiedosto käyttää 15 kertaa.

**10. `nosta tanko lantiolla` (rivi 645, Romanian Deadlift)**

Kuulostaa siltä, että tanko nostetaan lantion päällä. → `nosta tanko ojentamalla lantio`

**11. `jotta et kompastu` (rivi 732, Stairmaster)**

Porraslaitteessa ei kompastuta vaan pudotaan. → `jotta et putoa`

**12. `kaarretanko` EZ-tangosta (rivit 578, 800, 913)**

Ymmärrettävä, mutta suomalaisessa salissa sanotaan `EZ-tanko`. Kolme esiintymää,
yksi päätös.

**13. `samalla tavalla takaperin` (rivi 503, Monster Walk)**

Englanti sanoo "do just the opposite" — suomi sanoo "samalla tavalla", eli
päinvastoin kuin lähde. Merkitys selviää lopusta, mutta lause sotii itseään vastaan.
→ `Kävele muutaman askeleen jälkeen takaperin takaisin lähtöpisteeseen.`

---

## C. Turhaa — ei ole suoritusohje

**14. Bicycling, Stationary (rivi 869) — koko merkintä**

Yksi askel, ja se kertoo laitteen valikosta: manuaaliasetus, ikä ja paino,
kalorilaskuri. Lukija, joka avaa tämän kesken treenin, ei saa mitään. Sama
englanniksi. Ehdotus: korvaa yhdellä oikealla ohjeella (satulan korkeus,
poljinvastus, kadenssi) tai poista merkintä ja anna liikkeen näyttää lähteen teksti.

**15. Stairmaster, kolmas askel (rivi 733)**

`70-kiloinen polttaa yleensä yli 300 kaloria puolessa tunnissa, kun kävely
polttaa noin 175.` Tämä on markkinointivertailu, ei ohje. Se on myös ainoa
kalorilupaus koko apissa, ja se on peräisin lähdekannasta — ei mistään, mitä
Vinha itse laskee. Ehdotus: poista askel.

---

## D. Sääntö, jota ei sovelleta tasaisesti

**16. Hengitysohjeet**

Tiedoston oma sääntö on, että lähteen hengitysjaarittelu jätetään pois, ja niin
on tehty 139 liikkeessä. Power Clean (rivit 556, 561, 562) pitää ne:
`Vedä henkeä tässä vaiheessa`, `Pidätä hengitystä seuraavaan vaiheeseen asti`.
Joko sääntö tai poikkeus — poikkeus voi olla perusteltu (24-askelinen tekninen
nosto), mutta silloin se kannattaa kirjoittaa tiedoston ohjeeseen näkyviin.

Stomach Vacuum (rivi 769) pitää hengitysohjeet oikein perustein: siinä hengitys
**on** liike.

---

## E. Ei käännösvirhe, mutta lukija näkee sen

**17. Kahvakuulaliikkeet näkyvät käsipainoina** — korjattu 2026-09-08

**54 liikettä** (53 generoitua + oma Kettlebell Swing) kantaa lähdekentässä
`sourceEquipment: "kettlebells"`, mutta normalisoitu `equipment` on `dumbbell`.
Syy on generaattorissa (`scripts/generate_free_exercise_library.mjs:62`):
viisi välinekategoriaa ovat ne, joista suodatinsirut tehdään, eikä
kahvakuulalle ole omaansa.

Kaksi tarkennusta siihen, mitä tässä alun perin väitin:

- **Väite "onboardingin Kettlebells-vaihtoehto on kuollut" oli väärä.**
  `equipmentExerciseFilter.ts` suodattaa liikkeen **nimen** perusteella, ei
  välinekentän: `{ pattern: 'kettlebell', requires: [['Kettlebells']] }`. Siru
  siis toimii, eikä kahvakuulaliikkeitä tarjota sille, joka ei ole valinnut
  kahvakuulia.
- **Lukumäärä oli 46, oikea on 54.** Laskin nimestä; lähdekenttä on tarkempi ja
  löytää myös ne, joiden nimessä ei lue kettlebell (Bent Press, Goblet Squat,
  Lunge Pass Through, Alternating Floor Press).

Kyse oli siis vain siitä, mitä ruudulla lukee. Liikkeen oma sivu osasi jo
näyttää oikein (`ExerciseDetailScreen` suosii `sourceEquipment`-kenttää);
kirjaston listarivi ja liikkeenlisäysvalikko eivät.

Korjaus: `displayEquipmentValue` [libraryLabel.ts](../src/lib/libraryLabel.ts):ssä
palauttaa kahvakuulille lähdearvon ja kaikelle muulle normalisoidun kentän — yksi
poikkeus, ei yleistä `sourceEquipment ?? equipment` ‑sääntöä, joka muuttaisi 199
kehonpainoriviä muotoon "Muu" ja "Body only". Vartija
[libraryLabel.test.cjs](../tests/lib/libraryLabel.test.cjs):ssä, mutaatiotestattu.

Jäljelle jää yksi asia, joka ei ole valhe mutta on outo: suodatinsiru ryhmittelee
kahvakuulat yhä **Käsipainot**-sirun alle, joten sirulla suodattamalla saa rivejä,
joissa lukee "Kahvakuula". Oman sirun tekeminen vaatisi kuudennen arvon
`ExerciseEquipment`-unioniin, ja se koskisi myös AI-koostajan sallittuja
välinejoukkoja — erillinen päätös.

Lisäksi Goblet Squatin suomenkielinen ohje sanoo nyt `kahvakuula sarvista tai
käsipaino pystyssä`, koska suodatin sallii sen molemmilla.

---

## Yhteenveto

| Luokka | Kohtia | Työmäärä |
|---|---:|---|
| A. Väärin | 6 | pieni — 8 riviä, yksi niistä (sekaote) tärkeä |
| B. Kankeaa | 7 | keskisuuri — kohdat 8 ja 9 koskevat 15 riviä |
| C. Turhaa | 2 | päätös, ei työ |
| D. Epäjohdonmukaista | 1 | 3 riviä tai yksi kommentti |
| E. Data | 1 | korjattu — näyttö, ei kategoria |

Kohdat 1–6 kannattaa korjata ennen julkaisua. Kohdat 7–13 ovat laatua, eivät
virheitä, ja ne voi tehdä samalla kertaa koska tiedosto on joka tapauksessa auki.
Kohdat 14–15 ovat sinun päätöksesi siitä, saako lähdekannan täytesisältö jäädä.
