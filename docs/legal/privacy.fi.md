# Tietosuojaseloste

*Päivitetty 25.8.2026*

Mitä Vinha tallentaa, missä se pysyy ja mikä ei koskaan lähde puhelimestasi.

## Lyhyesti

Vinha pitää treenitietosi puhelimessasi. Emme näe treenejäsi emmekä voi nähdä — niiden sisällöstä ei lähde mitään, ellet ota AI-valmentajaa käyttöön verkkotilassa, ja silloinkin lähtee vain treeninumeroita, ei henkilöllisyyttäsi. Sovellus lähettää nimettömiä käyttötilastoja (mille ruuduille päästiin, ei koskaan mitä niissä oli) — ne kuvataan omassa osiossaan alla.

Jos poistat sovelluksen, tiedot katoavat puhelimesta. Muualla voi olla kaksi kopiota: oman Google-tilisi Android-varmuuskopio, jos se on käytössä, ja alla kuvattu vapaaehtoinen pilvivarmuuskopio — joka on olemassa vain jos valitsit kirjautumisen, ja jonka voit poistaa asetuksista milloin tahansa.

## Kuka vastaa

Santeri Ylönen (Suomi) julkaisee Vinha Fitness -sovelluksen (”Vinha”) ja toimii rekisterinpitäjänä siinä rajatussa käsittelyssä, joka kuvataan alla.

Kysymykset tästä selosteesta tai tiedoistasi: santeriylonen@gmail.com.

## Mitä sovellus tallentaa

Kaikki alla oleva on joko sinun syöttämääsi tai sovelluksen laskemaa sinun syöttämästäsi. Se tallentuu sovelluksen omaan tallennustilaan laitteellasi.

- Profiili: ikä, pituus, paino, treenitavoite, kokemustaso, käytettävissä olevat päivät ja välineet.
- Treeniloki: liikkeet, sarjat, toistot, painot, ajat ja treenipäivämäärät.
- Kehon tiedot jotka itse lisäät: painomerkinnät ja kehon mitat.
- Asetukset: kieli, yksiköt, ilmoitus- ja ääniasetukset, liikkeet jotka pyysit välttämään.
- Ostotila: onko Pro voimassa, ja käytetty kampanjakoodi jos sellaisen syötit.

## Missä tiedot ovat

Pieni oma avain säilyttää alla kuvattujen nimettömien käyttötapahtumien lähtöjonon — tapahtumanimiä ja aikaleimoja, ei muuta — kunnes ne on lähetetty.

Sovelluksen paikallisessa tallennustilassa laitteellasi, kolmen avaimen alla — yksi treenilokille, yksi kesken olevalle treenille ja yksi pieni asetuksille. Jos kirjaudut pilvivarmuuskopioon, neljäs pieni avain säilyttää tilitietosi (Google-tunniste, sähköposti, viimeisin varmuuskopiohetki). Alla kuvattua vapaaehtoista pilvivarmuuskopiota lukuun ottamatta mitään ei synkronoida meidän palvelimellemme, eikä meillä ole keinoa lukea laitettasi etänä.

Jos sovellus joskus toteaa tallennuksen lukukelvottomaksi, se siirtää vaurioituneen kopion sivuun kolmannen avaimen alle sen sijaan että poistaisi sen, ja aloittaa uuden — rikkoutunut tiedosto ei ole sama asia kuin menetetty treeniloki. Kopio pysyy laitteellasi kuten kaikki muukin, ja sovelluksen tietojen poistaminen poistaa myös sen.

Androidin varmuuskopiointi on tälle sovellukselle päällä. Se tarkoittaa, että laitteesi voi kopioida Vinhan paikallisen datan — treenilokin, paino- ja mittamerkinnät, ohjelmat ja asetukset — oman Google-tilisi varmuuskopioon, jotta uusi puhelin voi palauttaa ne. Ellet kirjaudu alla kuvattuun vapaaehtoiseen pilvivarmuuskopioon, tämä on ainoa tapa jolla historiasi selviää laitteen vaihdosta.

Se kopio on sinun ja Googlen välinen. Me emme näe sitä emmekä voi lukea sitä, eikä mitään lähetetä millekään meidän palvelimellemme. Google salaa sen, ja nykyisissä Android-versioissa avain on sidottu laitteesi PIN-koodiin. Voit kytkeä sen pois milloin tahansa Androidin asetuksista kohdasta Google → Varmuuskopiointi, ja Vinha toimii täsmälleen samalla tavalla.

Pilvivarmuuskopio (vapaaehtoinen): jos sovellus tarjoaa kirjautumisen ja kirjaudut Googlella, sama treenidata lähetetään salattua yhteyttä pitkin varmuuskopiopalvelimellemme ja säilytetään siellä, jotta uusi puhelin voi palauttaa sen kun kirjaudut uudelleen. Kirjautumista ei koskaan vaadita — kaikki toimii ilman sitä. Google-tilistäsi saamme ja säilytämme vain sen tunnisteen ja sähköpostiosoitteen, joita käytetään ainoastaan siihen että tiedämme mikä varmuuskopio on sinun; varmuuskopiota ei käytetä mihinkään muuhun kuin sen palauttamiseen sinulle. Voit poistaa pilvikopion milloin tahansa asetuksista (”Poista pilvivarmuuskopio”).

Tietojen poisto on välitön ja täydellinen: Asetukset → Omat tiedot → nollaus, tai sovelluksen poistaminen.

## AI-valmentaja

AI-valmentajalla on kaksi tilaa.

Laitetila (oletus): vastaukset muodostetaan puhelimessasi omasta treenilokistasi. Mitään ei lähde laitteelta — ei kysymys eikä vastaus.

Verkkotila: kun versio ottaa sen käyttöön, kysymyksesi ja numeerinen yhteenveto viime aikojen treeneistäsi (liikkeiden nimet, sarjat, toistot, kilot, treenipäivämäärät) lähetetään salattua yhteyttä pitkin päätepisteeseemme ja sieltä Anthropicin rajapintaan, joka muodostaa vastauksen. Nimesi, sähköpostisi, laitetunnisteesi ja kehon mittasi eivät kuulu yhteenvetoon. Tietoja käytetään vain sen yhden kysymyksen vastaamiseen. Niillä ei kouluteta malleja, emmekä säilytä niistä kopiota.

Sovellus kertoo sinulle kun avaat valmentajan ensimmäisen kerran verkkotilassa — ennen kuin yhtään kysymystä lähetetään, eikä mitään lähde ennen kuin olet lukenut ilmoituksen.

## Käyttötilastot

Jotta näemme toimiiko sovellus — esimerkiksi onko jokin käyttöönoton vaihe niin vaikea että siihen jäädään — sovellus lähettää nimettömiä käyttötapahtumia omalle palvelimellemme: esimerkiksi "käyttöönoton vaihe 3 saavutettu", "treeni kirjattiin", "valmentajalta kysyttiin".

Jokainen asennus saa satunnaisen tunnisteen, joka luodaan puhelimessasi. Sitä ei ole kytketty nimeesi, sähköpostiisi, tiliisi eikä mainostunnisteisiin, ja se nollautuu jos asennat sovelluksen uudelleen.

Tapahtumissa ei ole sisältöä: ei koskaan liikkeen nimeä, painoa, mittaa tai mitään kirjoittamaasi. Tapahtumien lista on kiinnitetty sovelluksen koodiin, ja palvelin hylkää kaiken sen ulkopuolisen.

Tapahtumat menevät samalle palvelimelle kuin AI-valmentajan liikenne eivätkä mihinkään muualle. Niitä ei jaeta, ei myydä eikä käytetä mainontaan.

## Mitä sovellus ei tee

- Ei kolmannen osapuolen analytiikkaa eikä kaatumisraportointi-SDK:ita. Ainoa käyttödata on alla kuvatut nimettömät tilastot, jotka menevät omalle palvelimellemme eikä kenellekään muulle.
- Ei mainoksia eikä mainosverkostoja.
- Ei kolmannen osapuolen seurantaa eikä sosiaalisen median SDK:ita.
- Ei mainosprofiilia eikä henkilöllisyyttä kiinnitettynä treeneihisi. Kirjautuminen ja kilpailuun osallistuminen ovat ainoat toiminnot jotka tarvitsevat tilin, ja ne keräävät vain sen mitä toimiakseen tarvitsevat.
- Ei pääsyä sijaintiin, yhteystietoihin, mikrofoniin tai tiedostoihisi. Kuvia avataan vain kun itse valitset kuvan ohjelman tuontia varten, ja vain se kuva luetaan.
- Tietojasi ei myydä, vuokrata eikä jaeta. Ei ole ketään kenelle jakaa.

## Ilmoitukset

Palautusajastimet ja muistutukset ajastaa puhelimesi paikallisesti. Ne eivät ole push-ilmoituksia, joten palvelinta ei ole mukana eikä laitetunnistetta ole olemassa. Voit sammuttaa ne Asetuksista tai Androidista.

## Maksut

Jos ostat Pron, maksun hoitaa kokonaan Google Play. Emme näe korttinumeroasi, laskutusosoitettasi emmekä mitään maksutietoa — sovellus saa tietää vain onko tilauksesi voimassa.

## Oikeutesi

GDPR antaa sinulle oikeuden nähdä tietosi, korjata ne, poistaa ne ja ottaa ne mukaasi. Koska tietosi ovat laitteellasi, käytät näitä oikeuksia suoraan ilman että kysyt meiltä — ja jos kirjauduit pilvivarmuuskopioon, myös sen yhden palvelinkopion poistat itse: Asetukset → Poista pilvivarmuuskopio:

- Näe ne: Asetukset → Omat tiedot näyttää mitä on tallennettu.
- Korjaa ne: muokkaa profiiliasi tai mitä tahansa kirjattua treeniä.
- Poista ne: Asetukset → Omat tiedot → nollaa kaikki tiedot, tai poista sovellus.
- Kysy tai tee valitus: santeriylonen@gmail.com. Sinulla on myös oikeus tehdä valitus tietosuojaviranomaiselle (Suomessa tietosuojavaltuutetun toimistolle).

## Lapset

Vinhaa ei ole tarkoitettu alle 16-vuotiaille. Emme tietoisesti käsittele lasten tietoja — eikä meillä ole mitään tunnistettavaa tai poistettavaa, koska emme vastaanota tietoja lainkaan.

## Muutokset tähän selosteeseen

Jos tämä seloste muuttuu tavalla joka vaikuttaa sinuun, sovellus näyttää muutoksen ennen kuin se astuu voimaan. Sivun yläreunan päiväys kertoo aina minkä version luet.
