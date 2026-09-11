# Juristin tapaaminen: terveystietojen käsittelyperuste

Valmistelumuistio kohtaan **B · Juristin näkemys terveystietojen käsittelyperusteesta**.

Kaksi osaa. Ensin tosiseikat: missä data on ja mitä lähtee ulos, luettuna koodista
9.9.2026, ei muistista. Sitten kysymykset, numeroituina niin että niihin voi vastata
numerolla.

Rekisterinpitäjä on tänään **Santeri Ylönen, luonnollinen henkilö** (privacy.fi.md
rivi 17). Julkaistu seloste on `docs/legal/privacy.fi.md`, ja se on tämän muistion
mittatikku: jos joku alla oleva tosiseikka ei vastaa selostetta, korjattava on toinen
niistä.

---

## Osa 1 · Missä data säilötään

### 1.1 Puhelimessa

Kuusi AsyncStorage-avainta. Mikään niistä ei ole erikseen salattu; ne nojaavat
Androidin sovelluskohtaiseen hiekkalaatikkoon.

| Avain | Sisältö |
|---|---|
| `@vinha/database/v1` | Omat ohjelmat, treenisessiot, cardio-sessiot, liikelokit sarjoineen, painomerkinnät, kehon mittaukset, oma liikenimikirja |
| `@vinha/preferences/v1` | Asetukset ja **onboardingin vastaukset**: nimi, sukupuoli, ikä, ikähaarukka, pituus, lähtöpaino, tavoite, taso, treenipäivät, välineet, varovaisuusalueet (niska, olkapäät, kyynärpäät, ranteet, alaselkä, lonkat, polvet, nilkat × *info / varovasti / vältä*) |
| `@vinha/workout/v1` | Kesken oleva treeni ja sarjahistoria |
| `@vinha/coach/memory/v1` | Valmentajan omat vastaukset kolmelta viikolta, yhden lauseen tiivistelminä |
| `@vinha/account/v1` | Google-tunniste (`sub`), **sähköpostiosoite**, nimi, viimeisimmän varmuuskopion aika |
| `@vinha/database/corrupt` | Karanteeni: viimeisin lukukelvoton tietokanta, jotta se voidaan palauttaa tukipyynnöllä |

Sähköposti ja Google-tunniste ovat tarkoituksella oma avaimensa eivätkä osa
tietokantaa, koska tietokanta on se, mikä varmuuskopioidaan.

### 1.2 Omalla palvelimella (Vercel Blob, private-tila)

| Mitä | Polku | Kuinka kauan |
|---|---|---|
| Pilvivarmuuskopio | HMAC(Google `sub`, `BACKUP_PATH_SECRET`) | Kunnes käyttäjä poistaa sen |
| Käyttötapahtumat | `events/YYYY-MM-DD/` | 24 kk, päivittäinen cron klo 04 UTC poistaa vanhemmat |
| Valmentajan keskustelut | `transcripts/YYYY-MM-DD/` | **Vain kehityskytkimen ollessa päällä — ks. kohta 4.1** |

**Varmuuskopio** on koko `@vinha/database/v1` liikekirjastoa lukuun ottamatta, plus
treenihistoria. Se sisältää siis myös nimen, iän, sukupuolen, pituuden, painot ja
varovaisuusalueet. Kesken olevaa treeniä ei kopioida. Katto on 2 Mt. Identiteetti
todennetaan jokaisella pyynnöllä Googlen tokeninfo-rajapintaa vasten, eikä palvelin
pidä istuntoa. Sähköpostia tai nimeä ei tallenneta palvelimelle; polku on tiiviste
Google-tunnisteesta.

**Käyttötapahtumat** ovat asennuskohtainen satunnainen UUID, aikaleima ja yksi
kahdeksasta tapahtumanimestä: `app_open`, `onboarding_step`, `onboarding_completed`,
`plan_adopted`, `workout_started`, `workout_completed`, `paywall_viewed`,
`coach_question_asked`. Ainoat lisäkentät ovat `step` (numero) ja `path`
(merkkijono). Sallittu lista on koodissa (`src/lib/analytics.ts`), ja sekä sovellus
että palvelin torjuvat kaiken sen ulkopuolisen. Käyttäjä voi kytkeä nämä pois
asetuksista.

IP-osoite näkyy pyyntörajoituksessa muistinvaraisesti, eikä sitä kirjoiteta levylle.

### 1.3 Muualla

- **Google**: varmentaa kirjautumisen jokaisella varmuuskopiopyynnöllä, säilyttää
  Play-ostot ja tilin oman Android-varmuuskopion.
- **Anthropic**: ks. osa 2.

### 1.4 Kuinka vähän ohjelmavalinta oikeasti tarvitsee

Onboarding kysyy iän, pituuden ja painon. Ohjelman valitseva pisteytys
(`src/lib/recommendationInput.ts`, `recommendationScoring.ts`) lukee niistä tämän:

| Kysytty | Mitä valinta siitä käyttää |
|---|---|
| Ikä | **Yhden bitin**: onko haarukka 41+, ja sekin ratkaisee vain nivelystävällisten ohjelmien kohdalla. Tarkkaa ikävuotta valinta ei lue lainkaan. |
| Sukupuoli | Täsmääkö ohjelman kohdeyleisöön. "En kerro" pisteytyy neutraalisti. |
| Paino | **Vain suunnan**: nykyinen vastaan tavoite, ylös / alas / ennallaan, ja tieto siitä onko tavoitetta. Kilomäärää valinta ei lue. |
| Pituus | **Ei mitään.** Pituus ei kulje pisteytykseen lainkaan. |

Tarkka ikä, kilot ja pituus palvelevat siis muuta kuin ohjelmavalintaa: valmentajan
profiiliriviä, Kehitys-välilehden painoindeksiä ja Omat tiedot -ruutua.

### 1.5 Miksi vastauksia ei voi poistaa onboardingin jälkeen

Vastaukset eivät ole kertakäyttöisiä. `App.tsx` kokoaa niistä `setupSelection`-arvon
uudelleen joka renderöinnillä, ja siitä riippuu ainakin:

- **Suositus itse** ajetaan uudelleen elävästi, joten ohjelman vaihto tai asetuksen
  muutos pisteyttää uudelleen.
- **Kodin tulevat treenit** -lista.
- **Jakson pituus** onboardingin rakentamalle ohjelmalle (Kodin hero laskee viikot).
- **Valmentajan aloitusehdotukset**.
- **Asetusten uudelleenavaus** — muokkausnäkymä alustetaan samasta arvosta.
- **Varovaisuusalueet** luetaan joka kerta, kun liikkeen oma sivu avataan.
- **Pituus** Kehitys-välilehden painoindeksissä, ja pituus, ikä ja sukupuoli
  valmentajan profiilirivillä.

Poisto ei siis olisi siivous vaan toiminnallisuuden purku.

---

## Osa 2 · Mitä Anthropicille menee

Kaikki kolme reittiä kulkevat oman palvelimen kautta osoitteeseen
`api.anthropic.com`, mallina `claude-haiku-4-5`. Sovellus ei koskaan puhu
Anthropicille suoraan.

### 2.1 Valmentajan kysymys

Lähtee: kysymysteksti sellaisenaan, saman keskustelun aiemmat viestit, ja
treeniyhteenveto. Yhteenvedossa on:

- **Profiili**: sukupuoli, **tarkka ikä vuosina**, pituus senttimetreinä
- **Keho**: viimeisin paino, painon muutos 30 ja 90 päivän ajalta, jokaisen mitatun
  kohteen viimeisin ja edellinen lukema päivämäärineen
- **Historia** kahdeksalta viikolta: enintään 24 sessiota (nimi, päivä, kesto,
  volyymi kiloina, sarjamäärä) ja 10 liikettä (painosarja sessioittain, ennätys,
  muutos, montako sessiota jumissa)
- **Ohjelma**: nimi, päivät, jokaisen päivän liikkeet ja sarja×toisto-kaavat
- **Aikataulu**: treenipäivät tai kierto, seuraava treenipäivä, suunniteltu vs. tehty
- **Tavoitteet** teksteineen, kohdearvoineen ja nykyarvoineen
- **Onboardingin vastaukset**: tavoite, päivät viikossa, kokemus, sessiominuutit,
  välineet, palautuminen, mukaan halutut ja vältettävät liikkeet,
  **varovaisuusalueet**
- **Analyysi**: jumit, kuormitussuhde (ACWR), palautumispisteet
- **Valmentajan omat vastaukset** kolmelta viikolta

Ei lähde: nimi, sähköposti, Google-tunniste, laitteen tai asennuksen tunniste.
Treenimuistiinpanojen tekstiä ei lähetetä, vain niiden lukumäärä.

### 2.2 Ohjelmakoostaja

Käyttäjän kirjoittama brief-teksti ja sama treeniyhteenveto.

### 2.3 Ohjelman tuonti valokuvasta

Käyttäjän valitsema kuva base64-muodossa. Kuvan sisältöä ei rajata mitenkään: se on
mitä tahansa käyttäjä valitsee puhelimen kuvavalitsimesta.

### 2.4 Mitä Anthropicilla tapahtuu

Kaupallisten ehtojen mukaan dataa ei käytetä mallien opettamiseen ja se poistetaan 30
päivän kuluessa. Vastauksen kirjoittaminen tapahtuu Yhdysvalloissa.

---

## Osa 3 · Kysymykset juristille

### A. Perusrakenne

1. Onko **6(1)(b) sopimus + 9(2)(a) nimenomainen suostumus** oikea pari tälle
   sovellukselle, vai pitäisikö koko käsittelyn nojata suostumukseen?
2. Nykyinen suostumusteko valmentajan verkkotilaan on ilmoitus, jonka lopussa on
   **"Selvä"**-nappi. Onko se 9(2)(a):n tarkoittama nimenomainen suostumus, vai
   pitääkö napin ja sen yllä olevan lauseen sanoa suostumus ääneen?
3. Varmuuskopion suostumusteko on tällä hetkellä pelkkä **Google-kirjautuminen**.
   Sama kysymys.
4. Jos suostumuksen voi peruuttaa mutta palvelu ei toimi ilman tietoja, onko
   suostumus **vapaaehtoinen** 7 artiklan 4 kohdan mielessä? Tämä koskee erityisesti
   ratkaisua, jossa jatkonappi aktivoituu vasta rastista.
5. Olenko rekisterinpitäjä sille datalle, joka **ei koskaan poistu puhelimesta** ja
   jota en näe? Aiemmin saatu vastaus nojasi kotitalouspoikkeukseen (2 art. 2(c)) —
   pitääkö se paikkansa, vai onko oikea peruste se, etten käsittele dataa lainkaan?

### B. Suostumusten kokoaminen yhteen paikkaan

Suunnitelma: ikä, pituus, paino ja muut profiilikysymykset sekä Google-kirjautuminen
samaan kohtaan onboardingia, ja suostumus ennen niitä.

6. Saako **yksi suostumus** kattaa profiilitiedot, varmuuskopion, valmentajan
   verkkotilan ja käyttötilastot, vai vaatiiko granulaarisuusvaatimus erilliset
   valinnat kullekin tarkoitukselle?
7. Jos erilliset valinnat vaaditaan, saavatko ne olla **samalla ruudulla**?
8. Saako suostumuksen kysyä **ennen** kuin tiedot on kysytty, vai onko sen oltava
   kunkin kentän kohdalla?
9. Mikä on hyväksyttävä **oletustila**? Ennakkorastitus on kielletty, mutta koskeeko
   se myös käyttötilastoja, jotka ovat nyt päällä oletuksena ja pois kytkettävissä?
10. Miten peruutus toteutetaan "yhtä helposti kuin antaminen"? Riittääkö asetusten
    kytkin, vai tarvitaanko oma peruutusnäkymä?
11. Mitä suostumuksesta on **säilytettävä todisteeksi** (7 art. 1 kohta), kun mitään
    tiliä ei ole ja data on laitteella?

### C. Tämän sovelluksen erityispiirteet

12. Valmentajan **vapaa tekstikenttä**: käyttäjä voi kirjoittaa sairaudesta,
    raskaudesta tai lääkityksestä, ja teksti lähtee Anthropicille. Riittääkö yleinen
    suostumus, vai tarvitaanko erillinen varoitus kentän yhteyteen?
13. **Kuvatuonti**: käyttäjän valitsema kuva lähtee Anthropicille sellaisenaan.
    Riittääkö kuvan valinta suostumusteoksi?
14. **Varovaisuusalueet** (esim. "polvet: vältä") valitaan listasta, ne eivät ole
    vapaata tekstiä. Ovatko ne silti 9 artiklan terveystietoa?
15. **Asennustunniste** käyttötilastoissa on satunnainen UUID, joka ei liity tiliin
    eikä sähköpostiin. Onko se anonyymi vai pseudonymisoitu henkilötieto? Jos
    jälkimmäinen, kestääkö **oikeutettu etu**, vai tarvitaanko suostumus myös siihen?
16. Onko päätelaitteelle tallentaminen (**ePrivacy**) oma kysymyksensä analytiikan
    osalta, vai riittääkö GDPR-peruste?
17. **Ikäraja**: mikä on alin ikä, jolle sovellusta saa tarjota ilman huoltajan
    suostumusta, ja mitä se vaatii Play-ikäluokitukselta?
18. **Lääkinnällinen laite**: missä menee raja, kun sovellus antaa harjoitusneuvoja ja
    lukee kehon mittoja? Sovellus ei väitä hoitavansa mitään, mutta valmentaja vastaa
    kysymyksiin vapaasti.
19. **Tekoälyasetus**: koskeeko chatbotin läpinäkyvyysvelvoite tätä, ja riittääkö
    nykyinen ilmoitus siihen?

### D. Siirrot ja alihankkijat

20. Onko **käsittelysopimus (28 art.)** tehtynä Vercelin, Anthropicin ja Googlen
    kanssa, ja mitä niistä pitää tarkistaa?
21. Vakiosopimuslausekkeet on mainittu selosteessa. Tarvitaanko lisäksi kirjallinen
    **siirtovaikutusten arviointi**, ja riittääkö Data Privacy Framework -sertifiointi
    korvaamaan sen?
22. Selosteessa lukee "tallennustila on EU:n alueella". Se koskee tallennustilaa.
    **Palvelinfunktiot ajavat oletusalueella**, jota `vercel.json` ei aseta. Onko
    selosteen muotoilu riittävä, ja pitääkö funktiot siirtää EU-alueelle?
23. Nimetäänkö Anthropic ja Vercel oikein, kun Anthropic on suora sopimuskumppani
    eikä Vercelin alikäsittelijä?

### E. Dokumentaatio ja velvoitteet

24. Tarvitaanko **vaikutustenarviointi (DPIA, 35 art.)**? Kyseessä on erityisryhmien
    käsittely kuluttajasovelluksessa, mutta laajamittaisuus ratkeaa vasta
    käyttäjämäärästä.
25. Tarvitaanko **seloste käsittelytoimista (30 art.)**? Alle 250 työntekijän poikkeus
    ei päde, jos erityisryhmiä käsitellään.
26. Tarvitaanko **tietosuojavastaava (37 art.)**?
27. Onko rekisterinpitäjänä järkevää olla **luonnollinen henkilö**, vai pitäisikö
    perustaa toiminimi tai yhtiö? Tähän liittyy myös se, että kuluttajakauppa
    julkaisee elinkeinonharjoittajan osoitteen.
28. Mikä on **tietoturvaloukkauksen** ilmoitusprosessi käytännössä yhden hengen
    toimijalle (33 art., 72 tuntia)?
29. Play vaatii **tilinpoistosivun verkossa**. Riittääkö sähköpostiosoite, kun tiliä ei
    varsinaisesti ole ja poisto tapahtuu sovelluksesta?
30. Kestääkö **selosteen kieli** tarkastelun? Se on kirjoitettu selkokieliseksi
    tarkoituksella, ei juridiseksi.

### F. Kerätäänkö vähemmän vai poistetaanko jälkikäteen

Harkittu vaihtoehto: onboarding kysyy iän, pituuden ja painon vain ohjelman
valitsemiseksi, ja tiedot poistetaan heti valinnan jälkeen. Osat 1.4 ja 1.5 kertovat,
mitä valinta oikeasti lukee ja mikä poistosta hajoaisi.

31. Poistaako **käytön jälkeinen poisto** tarpeen 9 artiklan perusteelle, vai
    tarvitaanko peruste silti sillä hetkellä, kun ohjelma lasketaan syötetyistä
    tiedoista?
32. Onko **kapeampi kysymys** parempi kuin poisto jälkikäteen? Ohjelmavalinta tarvitsee
    ikähaarukan eikä ikävuotta, painon suunnan eikä kiloja, eikä pituutta lainkaan.
33. Jos tiedot eivät koskaan lähde laitteelta, muuttaako **säilytysajan lyhentäminen**
    vastuuasemaa mitenkään, vai onko kyse pelkästä vahinkoriskin pienentämisestä?
34. Painon ja mittojen jatkuva kirjaaminen on eri asia kuin onboardingin kertakysymys,
    ja **ne kulkevat valmentajalle** riippumatta siitä mitä onboardingin vastauksille
    tehdään. Pitääkö niillä olla oma suostumuksensa?

---

## Osa 4 · Korjattava ennen kuin seloste on totta

### 4.1 Keskustelujen loki on koodissa päällä

`src/lib/aiCoachDebug.ts` asettaa `AI_COACH_DEBUG_TRANSCRIPTS = true`. Kun myös
Vercelin ympäristömuuttuja on `1`, palvelin tallentaa jokaisen **kysymyksen ja
vastauksen** Blob-säiliöön. Seloste sanoo rivillä 63: "Me emme säilytä kopiota
kysymyksistä emmekä vastauksista."

Nämä kaksi eivät voi olla yhtä aikaa totta julkaistussa sovelluksessa.
`tests/releaseReadiness.test.cjs` kaatuu niin kauan kuin kytkin on päällä, ja se
kertoo koko purkuohjeen: kytkin pois, muuttujat pois Verceliltä, `api/transcripts.ts`
ja `scripts/coach-transcripts.cjs` poistettuina, `transcripts/`-hakemisto tyhjäksi.

### 4.2 Mitä 9.9. illan muutokset kuittasivat

Onboarding rakennettiin Lyftan mallin mukaan samana iltana. Se kuittasi
kysymykset 6, 7, 8 ja 9 päätöksenä: ei rastia, yksi passiivinen ehto- ja
selosterivi loppuruudulla, eikä yhtään valmiiksi valittua vastausta.
Kysymys 32 kuitattiin tekemällä: nimi, pituus ja tarkka ikävuosi eivät enää
kysytä, mikä pienensi myös valmentajalle lähtevää profiilia. Ikähaarukan alin
vaihtoehto on 16-18, joten sovellus sanoo olevansa 16 vuotta täyttäneille eikä
kysy huoltajan suostumusta keneltäkään (kysymys 17).

**Ne kaksi hetkeä, joissa terveystietoa oikeasti lähtee laitteelta, ovat
ennallaan.** Valmentajan verkkoilmoituksen nappi lukee yhä "Selvä", ja
varmuuskopion suostumusteko on yhä pelkkä Google-kirjautuminen. Kysymykset 2 ja
3 ovat siis auki täsmälleen kuten ennenkin, ja ne ovat listan tärkeimmät.

Uutta 9.9. jälkeen: 14 päivän Pro-kokeilu on kytketty päälle ja se todella
myönnetään. Se kirjoittaa oman kenttänsä ja ajastaa paikallisen ilmoituksen
kaksi päivää ennen loppua, ja ilmoituslupa kysytään myöntämishetkellä. Seloste
kuvaa ilmoitukset mutta ei kokeilua, joten selosteeseen tarvitaan siitä rivi.

### 4.3 Avoimet kohdat muualta

- Tilinpoistosivun URL puuttuu (Play-ehto).
- Palvelinfunktioiden ajoalue (kysymys 22).

---

## Osa 5 · Miten kilpailija tekee tämän

Lyfta (Lindberg Development AS, Norja) kävelty läpi laitteella 9.9.2026, koska
markkinakäytäntö on osa riskin arviointia.

**Suostumusta kehotiedoille ei oteta missään.** Lyfta kysyy sukupuolen, tavoitteen,
painopistealueet, kokemuksen, päivät, välineet ja painon, ja vasta niiden jälkeen
näyttää tilinluontiruudun, jonka alalaidassa lukee passiivisena rivinä, että jatkamalla
hyväksyt ehdot. Rastia ei ole. Ainoa suostumusruutu koko virrassa on Googlen oma
OAuth-ruutu, ja se koskee Googlen jakamia nimeä, sähköpostia ja profiilikuvaa, ei
Lyftan terveystietojen käsittelyä. Sama ehtorivi toistuu paywallin alalaidassa.

**Lyfta ei kysy pituutta eikä ikää lainkaan.** Se on riippumaton todiste kohdalle 1.4:
pituus ei ole ohjelmavalinnan kysymys.

**Lyftan paperit ovat heikommat kuin meidän.** Seloste luettelee viisi 6 artiklan
perustetta kertomatta mikä koskee mitäkin, ei mainitse 9 artiklaa eikä nimenomaista
suostumusta, ei nimeä vakiosopimuslausekkeita Yhdysvaltoihin menevälle datalle eikä
anna yhtään säilytysaikaa. Play-tietoturvakortti ilmoittaa vain kuntoilutiedot eikä
terveystietoja, ja väittää ettei dataa jaeta kolmansille, vaikka seloste nimeää
Amplituden, Google Analyticsin ja Vercel Analyticsin.

**Yksi kohta, jossa Lyfta ottaa oikean suostumuksen, ja sen tekee käyttöjärjestelmä.**
Health Connect -yhdistämisessä Lyfta näyttää ensin oman selkokielisen ruudun ("kun
yhteys on muodostettu, Lyfta lähettää harjoituksesi automaattisesti Health Connectille,
voit katkaista yhteyden milloin tahansa") ja vasta sen jälkeen tulee Androidin oma
dialogi. Dialogi pyytää **kirjoitusoikeuden, ei lukuoikeutta**, ja vain kahteen
tyyppiin: kaloreita poltettu yhteensä ja liikunta.

Kuvio on hyvä ja kopioitavissa: oma selkokielinen ruutu peruutuslauseineen välittömästi
ennen järjestelmän dialogia. Meidän valmentajamme verkkotilassa järjestelmän dialogia ei
ole, joten oma ruutumme kantaa koko painon yksin. Se on täsmälleen kysymysten 2 ja 3
ydin.

**Suostumusta ei voi peruuttaa Lyftassa lainkaan.** Sen "yksityisyysasetukset" sisältää
yhden asian, eli kuka näkee treenisi (kaikki / seuraajat / vain sinä), ja oletus on
kaikki. Analytiikan kytkintä, suostumuksen peruutusta tai tietojen vientiä ei ole.
Kysymys 10 saa siis kilpailijalta vastauksen "ei mitenkään". Meillä on jo
käyttötilastojen kytkin, varmuuskopion poisto ja tietojen nollaus.

**Tilinpoisto on apissa ja välitön.** Ensin palautekysely, jossa vastaus "liian kallis"
poikii alennustarjouksen, sitten varmistus "poistaa kaikki tietosi pysyvästi, eikä sitä
voi peruuttaa", ja vahvistus kirjoittamalla `delete`. Sen jälkeen sovellus putoaa
ensimmäiseen asennuksenjälkeiseen ruutuun. Kuvio on hyvä, mutta se ei ratkaise omaa
Play-estettämme, joka on nimenomaan verkossa oleva poistosivu (kysymys 29).

**Mitä tästä seuraa.** Kevyempi suostumuskäytäntö on markkinassa vallitseva, ja se on
peruste sille, että riski on kannettavissa. Se ei ole peruste kopioida Lyftan papereita,
jotka ovat joka mitalla ohuemmat kuin meidän jo julkaistu selosteemme.

Yksi rakenteellinen ero kannattaa pitää mielessä: Lyftalla on tili ja palvelin
ensimmäisestä minuutista, joten sen ehtorivi tulee siihen kohtaan, jossa data
tosiasiassa lähtee laitteelta. Meillä onboarding ei lähetä mitään. Meidän vastaava
hetkemme tulee myöhemmin, valmentajan verkkotilassa ja varmuuskopion kirjautumisessa,
eikä Lyftan virta sano niistä mitään.
