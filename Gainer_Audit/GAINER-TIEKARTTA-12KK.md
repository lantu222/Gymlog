# GAINER — Käytännön tiekartta (12 kk)

**Kirjoittaja:** GAINERin toimitusjohtaja + teknologiajohtaja + tuotepäällikkö + kasvuneuvonantaja (sama henkilö: sinä)
**Oletukset:** yksinyrittäjä · ~10 h/viikko · pieni budjetti · **ei rahoitustavoitetta** · tavoite = julkaista, saada oikeita käyttäjiä, validoida retentio, rakentaa kestävä bisnes.
**Päivätty:** 4.6.2026

> Tämä ei toista aiempia auditointeja. Ongelmat on jo dokumentoitu (`SECURITY-AUDIT.md`, `ARCHITECTURE-REVIEW.md`, `PRODUCT-UX-REVIEW.md`, `COMPETITIVE-ANALYSIS.md`, `INVESTMENT-MEMO.md`). Tämä dokumentti tekee **päätökset ja järjestyksen** — mitä teet, mitä lykkäät, mitä jätät kokonaan tekemättä.

**Yksi ohjaava periaatе koko vuodelle:** *Älä rakenna backendia, AI:ta, premiumia tai webiä ennen kuin tiedät, että ihmiset pääsevät treeniin #4.* Validoi retentio halvalla nykyisellä offline-sovelluksella ensin. Kaikki raskas työ tulee vasta retentiosignaalin jälkeen.

---

## PART 1 — Launch Blockers (vain P0)

Vain ne asiat, joiden on oltava kunnossa ennen ensimmäistä julkista julkaisua. Pidetty tarkoituksella lyhyenä — pitkä blokkerilista estää julkaisun, ja sinun pitää päästä mittaamaan.

| # | Blokkeri | Miksi estää julkaisun | Työmäärä | Prioriteetti |
|---|---|---|---|---|
| 1 | **Analytiikka + kraschiraportointi** (PostHog + Sentry, ohut `track()`-kerros, ~8 tapahtumaa: onboarding valmis, treeni aloitettu/valmis, sessio #1–#4, retention) | Tavoitteesi on **validoida retentio**. Ilman mittausta julkaisu on sokkona — et opi mitään. Tämä ei ole "nice to have", se on koko julkaisun syy. | ~12–15 h (≈1,5 vko) | **P0** |
| 2 | **Tietosuojaseloste + Play Data Safety + Apple-privacy-labelit** | Kaupat eivät julkaise ilman. Kova vaatimus, ei kierrettävissä. EU/Suomi + terveysdata ⇒ pakollinen. | ~5–6 h | **P0** |
| 3 | **Poista valheellinen UI: "Premium/Live" -nappi ja "Kirjaudu Applella/sähköpostilla"** jotka eivät tee mitään | App Store / Play hylkää toiminnot, jotka mainostavat ostettavaa/ominaisuutta jota ei ole. Hämää myös käyttäjää heti. Korvaa "Premium" → "Preview", piilota kirjautuminen. | ~3–4 h | **P0** |
| 4 | **Ensimmäisen treenin kuittaus** (riko "hiljaisuus 3 sessioon" -sääntö niin että ensitreenin jälkeen tulee 1 rehellinen, eteenpäin katsova lause) | Julkaisu ilman ensitreenin palkintoa polttaa juuri sen hetken, jonka retentiota yrität mitata. Halpa, suora vaikutus tavoitteeseen. | ~3–4 h | **P0** |
| 5 | **Kierrätä OpenAI-avain + poista `.env.openai.local` + `allowBackup=false`** | Elävä avain repossa = rahariski; terveysdata laitevarmuuskopioissa = GDPR-riski. Molemmat triviaaleja korjata, typerää jättää. | ~1–2 h | **P0** |

**Mitä EI ole launch blocker (vastoin intuitiota):** backend, tilit, sync, SQLite, salaus levossa (täysi), live-AI, premium, web, wearablet. Nämä eivät estä pientä Suomi-julkaisua eivätkä retention validointia. Älä koske niihin ennen Part 8:n porttia.

**Yhteensä Part 1 ≈ 25–30 h ≈ 3 viikkoa sinun tahdillasi.**

---

## PART 2 — Ensimmäiset 30 päivää julkaisun jälkeen (top 10, vaikutusjärjestyksessä)

| # | Toimenpide | Odotettu vaikutus | Vaikeus | Miksi juuri nyt |
|---|---|---|---|---|
| 1 | **Puhu 20–30 ensimmäisen käyttäjän kanssa** (DM, treenikaverit, salin porukka) | 🟥 Erittäin suuri | Helppo (vie aikaa) | Tämä on ainoa tapa ymmärtää *miksi* funnel vuotaa. 10 hyvää keskustelua > 1000 latausta ilman dataa. |
| 2 | **Katso aktivaatiofunnel: kuinka moni pääsee treeniin #4?** | 🟥 Erittäin suuri | Helppo | Tämä on koko pelin mittari. Kaikki muu on kohinaa kunnes tiedät tämän luvun. |
| 3 | **Korjaa suurin pudotuskohta ennen treeniä #4** (datan kertoma, ei arvaus) | 🟥 Erittäin suuri | Keskitaso | Yksi kohdennettu korjaus oikeasta kohdasta nostaa retentiota enemmän kuin 10 ominaisuutta. |
| 4 | **Lepopäivän kotinäkymä** ("Lepopäivä — seuraava: Alakroppa A, to") | 🟧 Suuri | Helppo | Sovellus on nyt läsnä vain treenipäivinä. Tämä antaa syyn avata 7 pv/vko ilman painostusta. |
| 5 | **Muokattava setup onboardingin jälkeen** | 🟧 Suuri | Keskitaso | Aloittelijan ensivastaukset ovat arvauksia. Kun ohjelma ei sovi eikä sitä voi muuttaa → churn. |
| 6 | **Opt-in treenipäivämuistutus** (käyttäjän valitsema, 1/treenipäivä, hänen kellonaikaansa) | 🟧 Suuri | Helppo | Ainoa eettinen "cue". Ei syyllistä — käyttäjä valitsi sen. Suurin yksittäinen viikko-1-paluun nostaja. |
| 7 | **ASO suomeksi** (hakusanat, kuvaukset, screenshotit Suomen kaupoissa) | 🟧 Suuri | Helppo | Ilmainen, kompoundoituva kanava. Suomeksi olet harvinainen → korkea sijoitus pienessä lammessa. |
| 8 | **Aikaista ensimmäinen "AI näki jotain" -hetki** (laske datakynnystä niin että aito havainto osuu jo viikolla 1) | 🟧 Suuri | Keskitaso | Retention-ankkuri jonka oma filosofiasi kieltää liian myöhään. Tuo se eteen. |
| 9 | **Viikkokonsistenssinäkymä** (tehdyt/suunnitellut, ei päiväputkea) | 🟨 Keskitaso | Helppo | Filosofian sallima, syyllistämätön motivaatiosilmukka. |
| 10 | **Kerää arvostelut & palaute aktiivisilta käyttäjiltä** (kysy treeni #5:n jälkeen, ei aiemmin) | 🟨 Keskitaso | Helppo | Sosiaalinen todiste + kaupan sijoitus. Kysy vasta kun arvo on koettu. |

**Älä tee näiden 30 päivän aikana:** backendia, premiumia, we\biä, uusia isoja ominaisuuksia. Kuukausi 1 on **mittaa → puhu → korjaa yksi asia**.

---

## PART 3 — Retention-tiekartta: tavoite treeni #4

Tämä on yrityksen tärkein osio. Jos saat ihmiset treeniin #4, loppu seuraa. Jos et, mikään muu ei pelasta.

### Treenin #1 jälkeen — käyttäjän kokemus
**Nyt:** hiljaisuus (insight vaiennettu) + tyhjä AI ("esitä yksi selkeä kysymys"). Eli upea onboarding → ei mitään.
**Pitää olla:** yksi rehellinen, eteenpäin katsova kuittaus — *"Ensimmäinen treeni kirjattu. Tästä alamme seurata kyykkyä, penkkiä ja soutua — näet trendit parin treenin päästä."* Ei tekofanfaaria, vaan "olemme tässä ja seuraamme".

### Treenin #2 jälkeen — käyttäjän kokemus
**Pitää olla:** pieni jatkuvuus — *"Toinen treeni. Volyymi nousi edellisestä."* tai jos ei, neutraali "kirjattu historiaan". + selkeä *seuraava* askel näkyvissä (mikä treeni, milloin). Käyttäjän pitää tuntea, että sovellus rakentaa kuvaa hänestä.

### Treenin #4 jälkeen — käyttäjän kokemus
**Tämä on portti.** Tähän mennessä dataa on tarpeeksi: ensimmäinen aito insight (PR / volyymipiikki / "olet tehnyt 4 treeniä, näin paljon on jo kertynyt"). Tämä on **"se näkee minut" -hetki** — retention-ankkuri jonka ympärille koko kompoundoituva arvo rakentuu. Tee tästä tahallinen, suunniteltu huippukohta.

### Lepopäivinä
- Kotinäkymä kertoo: *seuraava treeni + 1 pieni arvo* (liikkuvuusvinkki, huomisen päänoston tekniikkamuistutus, viikon eteneminen).
- **Ei** push-spämmiä, **ei** putkipainostusta. Läsnäolo ilman ahdistusta.

### Kun käyttäjä katoaa viikoksi
- **Ei syyllistäviä "kaipaamme sinua" -ilmoituksia.** (Tämä on oikein — pidä kiinni.)
- Kun hän palaa: ensimmäinen treeni takaisin on automaattisesti kevyempi, kehystettynä jatkona ei uudelleenaloituksena. Historia ehjä, ei laskelmaa "mitä menetit".
- **Yksi harkittu poikkeus testattavaksi (10–14 pv hiljaisuuden jälkeen):** yksi arvopohjainen, ei-syyllistävä viesti — *"Ohjelmasi on tallessa. Tässä helppo paluutreeni."* Mittaa vaikutus. Absoluuttinen "ei koskaan ilmoituksia" voi maksaa enemmän retentiota kuin suojelee — päätä datalla.

### Retention-parannukset vaikutusjärjestyksessä
1. 🟥 **Ensitreenin kuittaus** (poista hiljaisuus treeni #1:ltä) — halvin, suurin vaikutus.
2. 🟥 **Opt-in treenipäivämuistutus** — ainoa cue, suurin viikko-1-paluun nostaja.
3. 🟥 **Aikaistettu "se näkee minut" -hetki treeniin #4 mennessä.**
4. 🟧 **Muokattava setup** — estää "ohjelma ei sovi" -churnin.
5. 🟧 **Lepopäivän arvo + selkeä seuraava askel.**
6. 🟧 **Kevyt paluutreeni gapin jälkeen.**
7. 🟨 **Viikkokonsistenssi + näkyvä, tyydyttävä treenin valmistumisyhteenveto.**
8. 🟨 **Pitkän aikavälin edistymisnäkymä esiteltynä jo tyhjänä lupauksena** ("tämä täyttyy kun treenaat").

---

## PART 4 — Tuotetiekartta (vaiheet A–D)

Jokaisesta ominaisuudesta: **Mukaan / Lykkää / Poista** + miksi.

### Vaihe A — MVP (julkaisukelpoinen nyt)
| Ominaisuus | Päätös | Miksi |
|---|---|---|
| Treenin loggaus + truthful save | **Mukaan** | Ydin. On jo hyvä. |
| Onboarding → suositeltu ohjelma | **Mukaan** | Vahvin valttisi. |
| Valmiit + custom-ohjelmat | **Mukaan** | Riittävä valikoima. Älä laajenna vielä. |
| Edistyminen + plateau/ACWR-äly | **Mukaan** | Aito erottautuja, jo koodissa. |
| AI Coach **preview-tilassa** (offline, deterministinen) | **Mukaan ilmaisena** | Toimii offline, on yllättävän hyvä — käytä ilmaisena koukkuna, älä piilota. |
| Analytiikka + krasch + tietosuoja | **Mukaan** | Part 1. |
| Premium-maksumuuri | **Poista (toistaiseksi)** | Ei mitään myytävää ennen kuin AI on aito ja retentio validoitu. |
| Oikea kirjautuminen / tilit | **Lykkää** | Ei tarpeen offline-validointiin. |

### Vaihe B — Early Growth (retention validoitu pienessä mitassa)
| Ominaisuus | Päätös | Miksi |
|---|---|---|
| Muokattava setup, lepopäivänäkymä, muistutukset | **Mukaan** | Retention-korjaukset Part 3:sta. |
| Datan vienti (manuaalinen JSON) | **Mukaan** | GDPR + luottamus, halpa. |
| Salaus levossa + write-debounce | **Mukaan** | Halpa kovennus ennen kasvua. |
| Liikevideot / -animaatiot | **Lykkää** | Aloittelija hyötyy, mutta ei estä — tee kun on aikaa. |
| Apple Watch | **Lykkää** | Ei kriittinen Suomi-aloittelijaniche'lle. |
| Sosiaalinen feed | **Poista** | Ei resursseja kilpailla Hevyä vastaan; filosofia kieltää. |

### Vaihe C — Product-Market Fit (retentio todistettu, valmis monetisoimaan)
| Ominaisuus | Päätös | Miksi |
|---|---|---|
| Backend + tilit + sync | **Mukaan** | Mahdollistaa AI-muistin, premiumin, monilaitteen. |
| **Live-AI Coach** (oikea, ei mock) | **Mukaan** | Erottautuja vihdoin tuotteena. Rehellinen + adaptiivinen. |
| Premium (IAP + server-validointi) | **Mukaan** | Arvoon ajoitettu maksumuuri 1. aidon insightin jälkeen. |
| SQLite-migraatio (pois blob-mallista) | **Mukaan** | Kun data kasvaa / ennen backendia. |
| AI-ohjelmageneraattori | **Lykkää** | Vahva premium-koukku myöhemmin. |

### Vaihe D — Scale
| Ominaisuus | Päätös | Miksi |
|---|---|---|
| Web-versio | **Mukaan** | Laajentaa suhdetta; backend mahdollistaa. |
| Pitkän aikavälin analytiikka / trendit | **Mukaan** | Premium-pilari, kompoundoituva. |
| Wearablet | **Mukaan (jos kysyntä)** | Vasta dataohjattuna. |
| Maltillinen opt-in jako (ei feed) | **Mukaan kokeiluna** | Ainoa eettinen kasvusilmukka. |
| Ravinto / hyvinvointi / pelillistys | **Poista pysyvästi** | Identiteetin ulkopuolella; laimentaa. |

---

## PART 5 — Kilpailustrategia

**1. Millä GAINERin EI pidä KOSKAAN kilpailla:**
Hinnalla (Hevy $2,99 + verkostovaikutus voittaa), ohjelmakirjaston laajuudella (Boostcamp 11 000 ilmaista), loggausnopeudella (Strongin 12 v brändi), eikä raa'alla AI-generoinnilla Fitbodia/Alphaa vastaan (heillä on vuosien data). Älä myöskään kilpaile sosiaalisella feedillä.

**2. Mistä GAINERin pitää tulla tunnetuksi:**
**Rehellisestä, adaptiivisesta valmentajasta joka kertoo mitä tehdä, sopeutuu siihen miten oikeasti suoriudut, ja on hiljaa kun sillä ei ole sanottavaa** — ei putkia, ei syyllistystä, ei kohinaa. Plus: *paras voimaharjoittelusovellus suomeksi.*

**3. Vahvin yksittäinen positiointilause:**
> *"Rehellinen tekoälyvalmentaja: se kertoo mitä tehdä, mukautuu suoritukseesi, eikä koskaan syyllistä sinua — ei putkia, ei kohinaa."*

**4. Pienin niche, jossa GAINER voi realistisesti voittaa:**
**Suomenkieliset aloittelija–keskitason voimaharjoittelijat, jotka haluavat selkeän "kerro mitä teen" -ohjauksen ilman pelillistettyä syyllistämistä.** Kaksikielisyys on jo koodissa, CAC on matala, kilpailijat ovat englanti-ensin, ja App Store -sijoitus pienessä lammessa on saavutettavissa. Ole #1 Suomessa ennen kuin yrität maailmaa.

---

## PART 6 — Tekninen tiekartta (ideaali järjestys)

### Do Now (ennen julkaisua / heti)
**Sentry (kraschit) · PostHog (analytiikka) · tietosuojaseloste + Data Safety · avaimen kierto + allowBackup=false · valheellisen premium/kirjautumis-UI:n poisto.**
*Miksi:* nämä mahdollistavat julkaisun ja mittaamisen. Ilman näitä julkaiset sokkona — vastoin koko tavoitettasi.

### Do Next (julkaisun jälkeen, kevyt kovennus + retention)
**Salaus levossa + write-debounce · muokattava setup · ensitreenin kuittaus & aikaistettu insight · manuaalinen datan vienti.**
*Miksi:* halpoja korjauksia jotka suoraan palvelevat retentiota ja luottamusta. Ei vaadi backendia.

### Do Later (vain jos retentio validoituu — Part 8:n portti)
**SQLite-migraatio · backend + tilit + sync · oikea autentikointi · live-AI Coach · premium (IAP + server-validointi).**
*Miksi:* kallista ja aikaa vievää. Tee vasta kun tiedät, että ihmiset jäävät. Tämä on se "raskas" kerros joka mahdollistaa monetisaation — mutta vain validoidulle tuotteelle.

### Do Much Later (skaalaus)
**Web-versio · wearablet · pitkän aikavälin analytiikka · maltillinen jako-/referral-kokeilu.**
*Miksi:* laajentavat tavoittavuutta vasta kun ydin (retentio + ensimaksajat) toimii.

---

## PART 7 — Founder Focus (10 h/viikko)

**Ne 20 % jotka tuottavat 80 % tuloksesta:**
1. **Käyttäjäkeskustelut** (2 h/vko) — ymmärrä miksi funnel vuotaa. Korvaamaton.
2. **Yhden retention-pudotuksen korjaus kerrallaan** datan perusteella (4 h/vko) — ydintyö.
3. **Suomi-ASO + orgaaninen näkyvyys** (1 h/vko) — ilmainen, kompoundoituva kanava.
4. **Analytiikan katsominen + 1 oppi/viikko** (1 h/vko) — pidä mittari elossa.
5. **Pieni sisältöpala / postaus viikossa** (2 h/vko) — "rehellinen valmennus" -teema, rakentaa hidasta orgaanista vetoa.

**Mitä jättää täysin huomiotta seuraavat 6 kk:**
backend, sync, SQLite, live-AI, premium, web, wearablet, sosiaaliset ominaisuudet, ohjelmakirjaston laajennus, A/B-testaus, monikielisyys (englannin lisäksi), täydellinen arkkitehtuuri, rahoituskeskustelut. **Kaikki tämä on tulevaisuuden ongelmia. Tämän vuoden ongelma on: jäävätkö ihmiset treeniin #4.**

---

## PART 8 — Brutaalin rehellinen johtopäätös: 12 kk kuukausi kuukaudelta

Jos olisin henkilökohtaisesti vastuussa GAINERin menestyksestä, en optimoisi teoreettista täydellisyyttä. Optimoisin **todennäköisyyttä saavuttaa: oikeita käyttäjiä → hyvä retentio → ensimaksajat → kestävä kasvu** — tässä järjestyksessä, koska jokainen edellinen on seuraavan edellytys.

**Ratkaiseva idea: koko ensimmäinen puolisko on retention validointia halvalla. Backend ja monetisaatio rakennetaan vasta kuukauden 5 portin jälkeen — ja vain jos data antaa luvan.**

| Kk | Fokus | Konkreettinen tuotos |
|---|---|---|
| **1** | Launch prep (Part 1) | Analytiikka + Sentry + tietosuoja + valheellisen UI:n poisto + ensitreenin kuittaus + avaimen kierto. Soft launch ~20 hengelle (salikaverit, Suomi). |
| **2** | Julkinen Suomi-julkaisu | App Store/Play FI, suomenkielinen ASO. Aloita aktivaatio/retentio-datan keräys. Puhu 20–30 käyttäjälle. |
| **3** | Funnel-analyysi + korjaus #1 | Tunnista suurin pudotus ennen treeniä #4 ja korjaa se. Muokattava setup. Lepopäivänäkymä. |
| **4** | Retention-iteraatio #2 | Opt-in treenipäivämuistutus, aikaistettu ensi-insight, viikkokonsistenssi. Mittaa D7/D30 + treeni-#4-osuus uudestaan. |
| **5** | **PORTTI: onko retentio tarpeeksi hyvä?** | Jos kyllä → aloita backend-suunnittelu. Jos ei → jatka retention-korjausta tai säädä niche. Käynnistä sisältö/ASO-moottori (1 juttu/vko). **Älä etene jos portti ei aukea.** |
| **6** | Backend (vain jos portti aukesi) | Tilit + pilvisync + indeksoitu datakerros. Tämä on mahdollistaja AI:lle, premiumille ja webille. |
| **7–8** | Live-AI Coach + kovennus | Julkaise oikea (ei mock) adaptiivinen AI backendin päälle. Salaus levossa, datan vienti valmis. Premium-rakenne pystyyn. |
| **9** | Premium-julkaisu | IAP + server-validointi. Arvoon ajoitettu maksumuuri 1. aidon AI-insightin jälkeen. **Ensimmäiset maksavat asiakkaat.** |
| **10** | Konversion + maksaja-retention optimointi | SQLite jos datakasvu vaatii. Win-back-virta (arvopohjainen). Vuositilauksen painotus. |
| **11** | Kasvu | Sisältö/ASO kompoundoituu, maltillinen opt-in jako -kokeilu. Apple Watch jos kysyntää. |
| **12** | Yksikkötalouden katselmus | Päätä: skaalaa vai pidä kestävänä. Web-companion jos signaali. Suunnittele vuosi 2. |

### Mitä tämä reitti maksimoi
- **Oikeat käyttäjät:** julkaiset kk 2, et kk 12 — opit todellisilta ihmisiltä aikaisin.
- **Hyvä retentio:** koko kk 1–5 on omistettu yhdelle mittarille (treeni #4) halvoin korjauksin.
- **Ensimaksajat:** premium tulee kk 9 — vasta kun on aito AI ja todistettu retentio, joten myyt jotain mitä ihmiset oikeasti haluavat.
- **Kestävä kasvu:** orgaaninen Suomi-niche + sisältö, ei poltettua mainosbudjettia.

### Brutaali totuus loppuun
Suurin riskisi ei ole koodi — se on **rakentaa 6 kuukautta backendia ja AI:ta tuotteelle, jota kukaan ei käytä neljättä kertaa.** Vastalääke on tämä järjestys: validoi retentio nykyisellä ilmaisella offline-sovelluksella ensin, ja ansaitse oikeus rakentaa raskas kerros vasta sitten. Jos kk 5:n portti ei aukea, **älä rakenna backendia — korjaa retentio tai vaihda niche.** Se yksi kuri ratkaisee, päädytkö kestävään bisnekseen vai kauniiseen sovellukseen jota kukaan ei muista.

Pääset treeniin #4. Kaikki muu seuraa siitä.

---

*Synteesi perustuu repon viiteen aiempaan analyysiin sekä kesäkuun 2026 kilpailijadataan. Tämä on päätösdokumentti, ei ennuste — säädä kk 5:n portin jälkeen sen mukaan, mitä oikea käyttäjädata kertoo.*
