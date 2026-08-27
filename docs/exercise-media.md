# Liikekuvat — omat kuvat, ja mihin ne menevät

Muistiinpano 27.8.2026. Ei toteutettu vielä; tämä on se päätösten joukko jonka
päälle se rakennetaan, jotta seuraava kerta ei ala alusta.

## Mitä ongelmaa ollaan ratkaisemassa

Liikekirjasto on `yuhonas/free-exercise-db` (Unlicense, 873 liikettä, 868
ohjeella, 873 kuvalla). Lisenssi on paras mahdollinen: public domain, ei
nimeämisvelvoitetta eikä share-alikea.

**Vika ei ole liikkeiden määrä. Vika on että kuvat eivät ole apissa.**
`imageUrls[0]` osoittaa `cdn.jsdelivr.net`-osoitteeseen, ja niitä luetaan
ajonaikaisesti neljästä paikasta (`AddExerciseSheet`, `ExerciseLibraryBrowser`,
`CreateTemplateScreen`). Salilla ilman kenttää liikekuvia ei ole, ja koko
kirjaston kuvat riippuvat yhden GitHub-repon pystyssä pysymisestä.

Maksullinen vaihtoehto (ExerciseDB / AscendAPI, 12,99 $/kk alkaen) tarkastettiin
ja **hylättiin**: heidän ehtonsa kieltävät median uudelleenisännöinnin ja
lopettavat käyttöoikeuden tilauksen mukana. Se vaihtaisi offline-apin
tilauspohjaiseen riippuvuuteen — nykyistä huonompi, ei parempi.

## Kokobudjetti on se joka määrää muodon

Mitattu: nykyiset JPG:t ovat 38–73 kt, keskimäärin ~60 kt. Release-APK on
**57 MB**.

| Mitä niputetaan | Lisäys |
|---|---|
| 873 liikettä × 2 kuvaa, nykylaatu | ~105 MB — mahdotonta |
| 274 katalogiliikettä × 2 kuvaa, JPG | ~33 MB — liikaa |
| 274 × 1 kuva, WebP ~640 px | ~8 MB |
| **150 tärkeintä × 1 kuva, WebP ~640 px** | **~4–5 MB** |

**Päätös: yksi kuva per liike, WebP, ~640 px, ja vain osajoukko.** Osajoukon
määrää `liikkeiden-kuvauslista.md` -kertymä: 40 liikettä kattaa 65 % kaikista
valmiiden ohjelmien liikepaikoista, 150 kattaa 88 %.

## Nettisivu on kuvaustyökalu, EI jakelukanava

Tämä on koko muistiinpanon tärkein kohta.

Houkutus on tehdä oma CDN: kuvat Vercel Blobiin ja appi hakee ne sieltä. **Se
toistaisi täsmälleen sen ongelman jota ollaan korjaamassa**, vain omalla
laskulla. Appi ei saa tarvita verkkoa liikekuvaan.

Oikea muoto on kaksivaiheinen:

```
puhelin (kuvaat salilla)
  └─> nettisivu: valitse liike listalta, lataa kuva
        └─> Vercel Blob (välivarasto, ei tuotantopolku)
              └─> npm run exercise:media   (kehityskoneella)
                    ├─ hakee uudet kuvat
                    ├─ muuntaa WebP ~640 px
                    ├─ kirjoittaa assetit repoon
                    └─ generoi kuvakartan
                          └─> kuvat mukana APK:ssa, toimivat offline
```

Nettisivu on **authoring-työkalu**. Mikään appin ajonaikainen polku ei osoita
siihen. Jos sivu kaatuu, appi ei huomaa.

Perustelu miksi sivu kannattaa silti tehdä eikä pelkkää kansiota: kuvat
syntyvät puhelimella salilla, ja puhelin → PC-kansio on se kitka joka pysäyttää
urakan. Vercel ja `@vercel/blob` ovat **jo projektissa** (AI-valmentaja,
varmuuskopiot), joten alusta ei ole uusi riippuvuus.

## Mitä appiin pitää tehdä ENNEN kuin kuvia on

Yksi asia, ja se kannattaa tehdä heti kun urakka päätetään aloittaa:

**Kokoa liikekuvan haku yhteen resolveriin.** Nyt neljä tiedostoa kurottaa
suoraan `item.imageUrls?.[0]`:aan. Kun kuvan lähde muuttuu (CDN → niputettu
asset → molemmat), se on neljä muutosta ja neljä tapaa erkaantua. Yksi
`resolveExerciseImage(item)` -funktio `src/lib/`:ssä tekee siitä yhden.

Resolverin järjestys kun kuvia alkaa tulla:

1. Oma niputettu kuva, jos liikkeelle on sellainen
2. Kirjaston CDN-osoite, jos ei
3. Ei mitään — kutsuja piirtää paikanpitäjän

Näin urakan voi tehdä liike kerrallaan ilman että mikään on välillä rikki, ja
`npm run exercise:sync` voi ajaa kirjaston yli koskematta omiin kuviin.

## Mitä ei ole vielä päätetty

- **Kuvan vai videon.** Animoitu liikerata on se mitä maksulliset myyvät.
  Lyhyt luuppi on isompi kuin still-kuva mutta opettaa enemmän. Ratkaistaan
  kun ensimmäinen erä on kuvattu ja nähdään mitä still-kuva kertoo.
- **Kenen kuvat.** Jos kuvissa on tunnistettava henkilö, siihen tarvitaan
  suostumus ja se koskee myös julkaisua — sama sääntö joka ohjasi
  ohjelmakuvien valintaa (ei kasvoja).
- **Miten kuvaton liike näyttää.** Nykyinen paikanpitäjä riittää, mutta 88 %
  kattavuudella 12 % liikkeistä on ilman — se pitää näyttää tarkoitukselliselta.

## Liittyvät

- `liikkeiden-kuvauslista.md` — 274 liikettä tärkeysjärjestyksessä + 84
  liikettä joille kirjastossa ei ole mitään (Burpee, Bird Dog, Skater Jump ovat
  aitoja aukkoja; loput ovat cardio-blokkeja joita voimakirjastossa ei kuulu
  ollakaan)
- `scripts/generate_free_exercise_library.mjs` — se kuvio jota kuvien
  generointi seuraa
- `src/utils/programImagePicker.ts` + `src/lib/programImageImport.ts` —
  valitsin, base64 ja kokokatto ohjelmakuville; sama kuvio kopioitavaksi jos
  lataus tehdään appista eikä nettisivulta
