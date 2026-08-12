import { ReadyProgramContent } from './readyProgramContent';

/**
 * Finnish mirror of READY_PROGRAM_CONTENT. Kept in its own file because the
 * English map is long-form coaching copy, not UI strings — interleaving the two
 * languages in one object would make either one hard to read or edit.
 *
 * Every key here must exist in the English map; the English side stays the
 * source of truth, and a missing Finnish entry falls back to it rather than
 * showing a gap.
 */
export const READY_PROGRAM_CONTENT_FI: Record<string, ReadyProgramContent> = {
  // ── Vinha programs, written against what each one actually contains ──
  tpl_gainer_dream_body_man_v1: {
    summary:
      'Viisipäiväinen lihaskasvuohjelma, joka rakentaa tasapainoista ja näyttävää fysiikkaa yhdistämällä raskaat perusliikkeet sekä kohdennetut eristävät harjoitteet.',
    audience:
      'Sopii keskitason harjoittelijoille, jotka hallitsevat perusliikkeet ja haluavat kasvattaa lihasmassaa sekä kehittää koko kehoa tasapainoisesti.',
    equipmentProfile:
      'Vaatii monipuolisesti varustellun kuntosalin levytankoineen, käsipainoineen, taljoineen ja laitteineen.',
    whyItWorks:
      'Korkea viikoittainen harjoitusmäärä, tehokkaat perusliikkeet ja riittävä lihaskohtainen harjoitustiheys tukevat tasaista lihaskasvua ja voimakehitystä.',
  },
  tpl_gainer_beginner_bro_split_v1: {
    summary:
      'Perinteinen nelijakoinen lihaskasvuohjelma, jossa jokainen lihasryhmä saa oman harjoituspäivänsä. Selkeä rakenne tekee harjoittelusta helppoa aloittelijalle.',
    audience:
      'Suunniteltu aloittelijoille, jotka haluavat opetella kuntosaliharjoittelun perusteet ja kasvattaa lihasmassaa hallitulla etenemisellä.',
    equipmentProfile:
      'Vaatii tavallisen kuntosalin perusvälineet, kuten levytangot, käsipainot, taljat ja harjoituslaitteet.',
    whyItWorks:
      'Yksi lihasryhmä kerrallaan mahdollistaa hyvän keskittymisen tekniikkaan, riittävän harjoitusvolyymin ja palautumisen harjoitusten välillä.',
  },
  tpl_gainer_advanced_ppl_v1: {
    summary:
      'Kuusipäiväinen Push Pull Legs -ohjelma kokeneille harjoittelijoille. Kaksi erilaista kierrosta viikossa kehittää sekä lihasmassaa että suorituskykyä.',
    audience:
      'Tarkoitettu edistyneille harjoittelijoille, jotka palautuvat hyvin suuresta harjoitusmäärästä ja tavoittelevat maksimaalista lihaskasvua.',
    equipmentProfile:
      'Vaatii täysin varustellun kuntosalin sekä mahdollisuuden tehdä raskaita vapaita liikkeitä turvallisesti.',
    whyItWorks:
      'Korkea harjoitustiheys, suuri viikoittainen volyymi ja erilaiset painotukset varmistavat monipuolisen lihasärsykkeen koko keholle.',
  },
  tpl_gainer_expert_powerbuilding_v1: {
    summary:
      'Powerbuilding-ohjelma yhdistää voimanoston pääharjoitteet ja kehonrakennuksen lihaskasvutyön samaan kokonaisuuteen.',
    audience:
      'Sopii kokeneille nostajille, jotka haluavat kasvattaa sekä maksimivoimaa että lihasmassaa ilman kompromisseja.',
    equipmentProfile:
      'Vaatii hyvin varustellun kuntosalin, kyykkytelineen, penkkipisteen, levytangot ja monipuoliset lisälaitteet.',
    whyItWorks:
      'Raskaat pääliikkeet kehittävät voimaa, kun taas täydentävät hypertrofiasarjat lisäävät lihasmassaa ja tukevat pitkän aikavälin kehitystä.',
  },
  tpl_gainer_lean_shred_v1: {
    summary:
      'Viisipäiväinen ohjelma yhdistää voimaharjoittelun, HIIT-harjoitukset ja koko kehon treenit rasvanpolton sekä lihasmassan säilyttämisen tueksi.',
    audience:
      'Sopii keskitason harjoittelijoille, jotka haluavat pudottaa rasvaprosenttia ilman että lihasvoima tai lihasmassa kärsii.',
    equipmentProfile:
      'Vaatii tavallisen kuntosalin sekä mahdollisuuden tehdä HIIT-harjoittelua esimerkiksi juoksumatolla, pyörällä tai soutulaitteella.',
    whyItWorks:
      'Voimaharjoittelu auttaa säilyttämään lihasmassan, kun taas HIIT lisää energiankulutusta ja kehittää samanaikaisesti kestävyyttä.',
  },
  tpl_gainer_dream_body_female_v1: {
    summary:
      'Viisipäiväinen lihaskasvuohjelma, joka painottaa pakaroita, alavartaloa ja ylävartalon linjakasta kehittämistä tasapainoisen fysiikan rakentamiseksi.',
    audience:
      'Suunniteltu keskitason harjoittelijoille, jotka haluavat kehittää erityisesti pakaroita ja alavartaloa kuitenkaan unohtamatta ylävartalon voimaa.',
    equipmentProfile:
      'Vaatii monipuolisesti varustellun kuntosalin levytankoineen, käsipainoineen, taljoineen ja harjoituslaitteineen.',
    whyItWorks:
      'Pakaroita harjoitetaan useita kertoja viikossa eri kuormituksilla, mikä tukee lihaskasvua, samalla kun koko keho kehittyy tasapainoisesti.',
  },
  tpl_gainer_glute_foundations_v1: {
    summary:
      'Kolmipäiväinen aloittelijan ohjelma, joka opettaa pakaralihasten tehokkaan aktivoinnin ja rakentaa vahvan perustan turvalliselle kehitykselle.',
    audience:
      'Sopii aloittelijoille tai harjoitteluun palaaville, jotka haluavat kehittää pakaroiden voimaa, lihaskasvua ja liiketekniikkaa.',
    equipmentProfile:
      'Vaatii peruskuntosalin välineet sekä mahdollisuuden käyttää vastuskuminauhoja ja kevyitä vapaita painoja.',
    whyItWorks:
      'Harjoitukset etenevät aktivoinnista voimaharjoitteluun, mikä auttaa kehittämään oikeaa liikemallia ja tehokasta pakaralihasten käyttöä.',
  },
  tpl_gainer_advanced_glutes_v1: {
    summary:
      'Edistynyt viisijakoinen ohjelma, jossa pakaroita harjoitetaan useilla erilaisilla ärsykkeillä maksimaalisen lihaskasvun saavuttamiseksi.',
    audience:
      'Suunniteltu kokeneille harjoittelijoille, jotka haluavat nostaa pakaratreeninsä uudelle tasolle suurella harjoitusmäärällä.',
    equipmentProfile:
      'Vaatii täysin varustellun kuntosalin, jossa on vapaat painot, taljat, laitteet ja mahdollisuus raskaisiin hip thrust -harjoituksiin.',
    whyItWorks:
      'Voima-, volyymi- ja pumppiharjoittelu yhdistyvät optimaaliseen harjoitusärsykkeeseen, joka kehittää sekä lihasmassaa että suorituskykyä.',
  },
  tpl_gainer_hourglass_shape_v1: {
    summary:
      'Nelipäiväinen ohjelma, joka painottaa pakaroita, hartioita ja keskivartaloa korostaakseen tasapainoista ja näyttävää kehonmuotoa.',
    audience:
      'Sopii keskitason harjoittelijoille, jotka haluavat kehittää pakaroita, hartialeveyttä ja keskivartalon hallintaa.',
    equipmentProfile:
      'Vaatii tavallisen kuntosalin vapaine painoineen, taljoineen ja harjoituslaitteineen.',
    whyItWorks:
      'Pakaroiden ja hartioiden riittävä harjoitusvolyymi yhdistettynä keskivartalon harjoitteluun rakentaa tasapainoista fysiikkaa.',
  },
  tpl_gainer_fat_burn_hiit_v1: {
    summary:
      'Nelipäiväinen HIIT-ohjelma, joka yhdistää koko kehon intervalliharjoittelun tehokkaaseen rasvanpolttoon ja kunnon kehittämiseen.',
    audience:
      'Suunniteltu aloittelijoille, jotka haluavat kehittää peruskuntoa, lisätä energiankulutusta ja oppia tehokasta intervalliharjoittelua.',
    equipmentProfile:
      'Vaatii käsipainot ja kahvakuulan. Muut harjoitteet tehdään kehonpainolla.',
    whyItWorks:
      'Lyhyet mutta intensiiviset työjaksot nostavat sykettä tehokkaasti ja kehittävät sekä aerobista että anaerobista suorituskykyä.',
  },
  tpl_gainer_mobility_flow_v1: {
    summary:
      'Viisipäiväinen liikkuvuusohjelma, joka parantaa nivelten liikelaajuutta, vähentää jäykkyyttä ja tukee palautumista päivittäisillä harjoituksilla.',
    audience:
      'Sopii aloittelijoille sekä aktiiviliikkujille, jotka haluavat parantaa liikkuvuuttaan, ehkäistä jäykkyyttä ja tukea muuta harjoittelua.',
    equipmentProfile:
      'Ei vaadi kuntosalilaitteita. Kuminauha ja jumppamatto riittävät.',
    whyItWorks:
      'Säännöllinen liikkuvuusharjoittelu ylläpitää nivelten toimintaa, parantaa liikkeiden hallintaa ja voi vähentää harjoittelun aiheuttamaa jäykkyyttä.',
  },
  tpl_gainer_at_home_beginner_v1: {
    summary:
      'Kolmipäiväinen koko kehon ohjelma, joka kehittää voimaa ja lihaskuntoa ilman kuntosalilaitteita käyttäen pääasiassa kehonpainoharjoitteita.',
    audience:
      'Suunniteltu aloittelijoille tai kotona harjoitteleville, jotka haluavat aloittaa säännöllisen voimaharjoittelun ilman kuntosalia.',
    equipmentProfile:
      'Ei vaadi välineitä. Kaikki harjoitukset voidaan tehdä kehonpainolla kotona.',
    whyItWorks:
      'Perusliikkeet kehittävät koko kehon voimaa, lihaskestävyyttä ja liikehallintaa ilman monimutkaista välineistöä.',
  },
  tpl_gainer_calisthenics_mastery_v1: {
    summary:
      'Edistynyt kehonpainoharjoitteluohjelma, joka kehittää voimaa, kehonhallintaa ja taitoliikkeitä kuten muscle-upia, handstandia ja planchea.',
    audience:
      'Sopii kokeneille harjoittelijoille, jotka hallitsevat kehonpainoliikkeiden perusteet ja haluavat edetä vaativampiin taitoihin.',
    equipmentProfile:
      'Vaatii leuanvetotangon sekä mahdollisuuksien mukaan voimistelurenkaat tai vastaavat harjoitteluvälineet.',
    whyItWorks:
      'Taitoharjoittelu, progressiiviset etenemismallit ja kehonpainovoima kehittävät samanaikaisesti voimaa, tasapainoa ja liikkeiden hallintaa.',
  },
  tpl_gainer_strength_5x5_v1: {
    summary:
      'Kolmipäiväinen 5x5-voimaohjelma, joka keskittyy suuriin perusliikkeisiin ja järjestelmälliseen kuormituksen lisäämiseen.',
    audience:
      'Erinomainen aloittelijoille, jotka haluavat rakentaa vahvan voimapohjan turvallisesti ja mitattavasti.',
    equipmentProfile:
      'Vaatii kuntosalin, jossa on levytanko, levypainot, kyykkyteline ja penkkipunnerrusmahdollisuus.',
    whyItWorks:
      'Matala liikemäärä ja selkeä progressiomalli mahdollistavat tekniikan kehittämisen sekä tasaisen voimakehityksen viikosta toiseen.',
  },
  tpl_gainer_athlete_conditioning_v1: {
    summary:
      'Viisipäiväinen suorituskykyohjelma, joka yhdistää räjähtävän voiman, nopeuden, ketteryyden ja kestävyyden urheilullisen suorituskyvyn kehittämiseksi.',
    audience:
      'Suunniteltu edistyneille harjoittelijoille ja urheilijoille, jotka haluavat kehittää monipuolista suorituskykyä pelkän lihaskasvun sijaan.',
    equipmentProfile:
      'Vaatii hyvin varustellun kuntosalin sekä tilaa sprintti-, ketteryys- ja kuntopiiriharjoitteluun.',
    whyItWorks:
      'Voima-, nopeus- ja kestävyysharjoittelu täydentävät toisiaan, jolloin ohjelma kehittää kokonaisvaltaista urheilullista suorituskykyä.',
  },
  tpl_gainer_strong_lean_female_v1: {
    summary:
      'Nelipäiväinen voimapainotteinen ohjelma, joka rakentaa vahvaa ja urheilullista fysiikkaa yhdistämällä raskaat perusliikkeet sekä koko kehon lihaskasvua tukevat harjoitteet.',
    audience:
      'Suunniteltu keskitason harjoittelijoille, jotka haluavat kasvattaa voimaa, kehittää lihaksia ja parantaa suorituskykyä koko kehossa.',
    equipmentProfile:
      'Vaatii tavallisen kuntosalin, jossa on levytangot, käsipainot, taljat ja perusharjoituslaitteet.',
    whyItWorks:
      'Raskaat moninivelliikkeet rakentavat voimaa, kun taas täydentävät harjoitteet kehittävät lihastasapainoa ja tukevat pitkäjänteistä kehitystä.',
  },
  tpl_gainer_joint_friendly_v1: {
    summary:
      'Kolmipäiväinen nivelystävällinen ohjelma, joka kehittää voimaa turvallisilla liikkeillä ja hallitulla kuormituksella.',
    audience:
      'Sopii aloittelijoille, harjoitteluun palaaville tai henkilöille, jotka haluavat vähentää nivelten kuormitusta harjoittelun aikana.',
    equipmentProfile:
      'Hyödyntää pääasiassa kuntosalilaitteita sekä kevyitä vapaita painoja vakaiden ja turvallisten liikkeiden tueksi.',
    whyItWorks:
      'Tuetut liikkeet vähentävät nivelkuormitusta samalla, kun ne kehittävät lihasvoimaa, tasapainoa ja toimintakykyä.',
  },
  tpl_gainer_prenatal_fitness_v1: {
    summary:
      'Kolmipäiväinen raskausajan harjoitusohjelma, joka tukee voimaa, liikkuvuutta ja kehon hallintaa turvallisella harjoittelulla.',
    audience:
      'Suunniteltu odottaville äideille, jotka ovat saaneet luvan liikuntaan terveydenhuollon ammattilaiselta.',
    equipmentProfile:
      'Vaatii käsipainot, kuminauhan, jumppamaton sekä taljan ja kuntopyörän kaltaiset salivälineet.',
    whyItWorks:
      'Kevyt voimaharjoittelu, liikkuvuus ja lantionpohjan huomioiminen tukevat toimintakykyä ja hyvinvointia raskauden aikana.',
  },
  tpl_gainer_postpartum_recovery_v1: {
    summary:
      'Kolmipäiväinen palautumisohjelma synnytyksen jälkeen, joka keskittyy keskivartalon hallinnan palauttamiseen ja voiman asteittaiseen rakentamiseen.',
    audience:
      'Sopii synnytyksen jälkeen harjoitteluun palaaville henkilöille lääkärin tai terveydenhuollon ammattilaisen ohjeiden mukaisesti.',
    equipmentProfile:
      'Vaatii kevyet käsipainot, kuminauhan sekä hieman avointa tilaa turvalliseen harjoitteluun.',
    whyItWorks:
      'Ohjelma etenee hengityksen ja keskivartalon hallinnan palauttamisesta asteittain kohti koko kehon voimaharjoittelua.',
  },
  tpl_gainer_runners_strength_v1: {
    summary:
      'Kolmipäiväinen voimaharjoitteluohjelma juoksijoille, joka kehittää alavartalon voimaa, tasapainoa ja keskivartalon hallintaa tukemaan juoksusuoritusta.',
    audience:
      'Sopii keskitason juoksijoille, jotka haluavat parantaa suorituskykyä, ehkäistä rasitusvammoja ja täydentää juoksuharjoitteluaan.',
    equipmentProfile:
      'Vaatii kuntosalin perusvälineet, kuten levytangon, käsipainot sekä tilaa liikkuvuus- ja tasapainoharjoitteluun.',
    whyItWorks:
      'Yksijalkaiset liikkeet, takaketjun vahvistaminen ja keskivartalon harjoittelu parantavat juoksun taloudellisuutta ja tukevat vammojen ehkäisyä.',
  },

  tpl_strong_elite_v1: {
    summary:
      '12 viikon Pro-voimajakso: viiden sarjan ankkuriliikkeet, raskaat painepäivät ja apuliikkeet jotka suojaavat seuraavaa raskasta treeniä.',
    audience:
      'Kokeneille treenaajille, jotka palautuvat hyvin, osaavat perusliikkeet ulkoa ja haluavat maksimivoiman selkeäksi prioriteetiksi.',
    equipmentProfile: 'Vaatii täyden salin: tanko, teline, penkki, trap bar tai maastavetopaikka, laitteet ja taljat.',
    whyItWorks:
      'Jokainen liikemalli saa viikossa yhden raskaan ja yhden painealtistuksen, joten teho nousee jakson aikana ilman että viikko romahtaa väsymykseen.',
  },
  tpl_fit_elite_v1: {
    summary:
      '12 viikon Pro-jakso, jossa voima-ankkurit pysyvät liikkeessä ja kuntopäätteet rakentavat oikeaa kestävyyttä neljänä päivänä viikossa.',
    audience:
      'Kokeneille yleisosaajille, jotka haluavat voiman, kunnon ja liikkuvuuden yhteen rehelliseen viikkorakenteeseen.',
    equipmentProfile: 'Suositellaan täyttä salia: tanko, käsipainot, laitteet, kahvakuula ja kardiolaite päätteisiin.',
    whyItWorks:
      'Tehopäivät painavat perusliikkeitä ja volyymipäivät lisäävät kuntotiheyttä, joten sekä voima että kestävyys etenevät varastamatta toisiltaan.',
  },
  tpl_shred_elite_v1: {
    summary:
      '12 viikon Pro-rasvanpudotusjakso: viisi päivää, jotka pitävät voima-ankkurit paikallaan HIIT-päätteiden nostaessa energiankulutusta.',
    audience:
      'Kokeneille treenaajille, jotka pudottavat rasvaa mutta kieltäytyvät menettämästä voimapohjaansa kuntovolyymin noustessa.',
    equipmentProfile: 'Suositellaan täyttä salia: tanko, laitteet, kahvakuula sekä juoksumatto tai pyörä intervalleihin.',
    whyItWorks:
      'Joka treeni yhdistää yhden rehellisen voimaosion kuntopäätteeseen, joten vaje syntyy työstä jossa voi oikeasti edetä — ei turhasta volyymista.',
  },
  tpl_3_day_full_body_v1: {
    summary:
      'Kolme koko kehon treeniä, jotka pitävät voimaharjoittelun tiheänä samalla kun viikon kokonaisrasitus pysyy hallittavana.',
    audience:
      'Aloitteleville treenaajille tai kenelle tahansa, joka haluaa yksinkertaisen viikkorakenteen ja toistuvaa harjoittelua perusliikkeillä.',
    equipmentProfile: 'Suositellaan täyttä salia: tanko, penkki, talja, jalkaprässi ja perusvetopaikka.',
    whyItWorks:
      'Pohja toistaa kyykky-, punnerrus-, veto- ja saranaliikkeet viikon aikana, joten eteneminen pysyy ilmiselvänä ilman monimutkaista jakoa.',
  },
  tpl_4_day_upper_lower_v1: {
    summary:
      'Tasapainoinen ylä/ala-jako, jossa on riittävä viikkovolyymi kasvuun ja ankkuriliikkeillä silti selkeät etenemistavoitteet.',
    audience:
      'Keskitason treenaajille, jotka pääsevät salille neljästi viikossa ja haluavat enemmän ylä/ala-volyymia kuin koko kehon treeni antaa.',
    equipmentProfile: 'Suositellaan täyttä salia, erityisesti tangot, käsipainot, laitteet, ylätalja ja soutupaikat.',
    whyItWorks:
      'Jokainen liikemalli saa kaksi altistusta viikossa, mikä tekee palautumisesta ennakoitavaa ja tuottaa enemmän tuottavia kovia sarjoja ilman että jokaisesta päivästä tulee maraton.',
  },
  tpl_5_day_hybrid_v1: {
    summary:
      'Tiheämpi hybridijako, joka yhdistää ylä/ala-rakenteen omiin työntö- ja vetopäiviin tarkempaa erikoistumista varten.',
    audience:
      'Keskitason treenaajille, jotka palautuvat hyvin, haluavat enemmän saliaikaa ja pitävät lihasryhmätunnusta menettämättä etenemisrakennetta.',
    equipmentProfile: 'Vaatii täyden salin. Pohja olettaa laajan välinevalikoiman: tanko, laitteet, käsipainot ja taljat.',
    whyItWorks:
      'Viikko avautuu raskaammalla moninivelrakenteella ja lisää sitten erilliset työntö- ja vetopäivät, joten ylimääräinen volyymi osuu sinne missä sillä on merkitystä paisuttamatta joka treeniä.',
  },
  tpl_2_day_minimal_full_body_v1: {
    summary:
      'Kevytkitkainen kahden päivän kehonpaino-ohjelma viikoille, jolloin haluat koko kehon kattavuuden ilman salia.',
    audience:
      'Aloittelijoille, kiireisiin viikkoihin, kotitreeneihin tai kenelle tahansa treeniin palaavalle, joka haluaa silti rakenteen ja etenemisen.',
    equipmentProfile: 'Koti- ja kehonpainoystävällinen. Lattiatila ja tukeva soutupaikka riittävät ohjelman ytimeen.',
    whyItWorks:
      'Pohja pitää kyykky-, työntö-, veto-, sarana- ja keskivartaloliikkeet viikossa ja käyttää kehonpainon etenemistä salivälineiden sijaan.',
  },
  tpl_3_day_strength_base_v1: {
    summary:
      'Yksinkertainen voima edellä -viikko kolmella raskaalla altistuksella, joten kyykky, punnerrus ja sarana etenevät kaikki toistettavilla raiteilla.',
    audience:
      'Aloitteleville treenaajille, jotka haluavat oikean voimaohjelman hyppäämättä suoraan raskaaseen voimanostosetuppiin.',
    equipmentProfile: 'Suositellaan täyttä salia, erityisesti tankopaikat, soutuvaihtoehto, ylätalja ja alavartalon perusliitteet.',
    whyItWorks:
      'Jokainen treeni alkaa yhdellä ankkuriliikkeellä matalilla toistoilla ja täyttää loppupäivän riittävällä tukityöllä rakentamatta palautumisvelkaa.',
  },
  tpl_4_day_powerbuilding_v1: {
    summary:
      'Nelipäiväinen powerbuilding-ohjelma, jossa viikko avautuu voimatyöllä ja päättyy volyymiin, joka oikeasti rakentaa lihasta.',
    audience:
      'Keskitason treenaajille, jotka välittävät tangon luvuista mutta haluavat silti ylä- ja alavartalopäivien näyttävän kehonrakennustreeneiltä.',
    equipmentProfile: 'Vaatii täyden salin: tangot, käsipainot, ylätalja, soutupaikat ja alavartalon laitteet.',
    whyItWorks:
      'Jako erottaa suorituspäivät volyymipäivistä, joten perusliikkeet pysyvät tuoreina ja rinta, selkä, olkapäät ja jalat keräävät silti tarpeeksi kasvutyötä viikon aikana.',
  },
  tpl_2_day_beginner_strength_v1: {
    summary:
      'Kahden päivän voimaharjoittelun aloituspiste, joka pitää liikevalikoiman yksinkertaisena mutta antaa kyykylle, punnerrukselle, saranalle ja vedolle tilaa edetä.',
    audience:
      'Uusille treenaajille, jotka haluavat selkeää tankoetenemistä sitoutumatta heti kolmeen tai neljään viikkotreeniin.',
    equipmentProfile: 'Suositellaan täyttä salia, mutta liikemäärä pysyy niin pienenä että päivät on helppo oppia ja toistaa.',
    whyItWorks:
      'Ohjelma riisuu voimatyön perusliikkeisiin, joten energia menee toistettaviin nostoihin eikä vaihtelun jahtaamiseen liian aikaisin.',
  },

  tpl_3_day_upper_lower_lite_v1: {
    summary:
      'Kevyempi kolmen päivän ylä/ala-jako, joka pitää viikon tasapainossa vaatimatta pitkiä tai liian tiiviitä treenejä.',
    audience:
      'Aloittelijoille, jotka haluavat koko kehon treeniä vaihtelevampaa mutta eivät ole vielä valmiita klassiseen nelipäiväiseen jakoon.',
    equipmentProfile: 'Tavallinen täysi sali toimii parhaiten, mutta treenin pituus ja liikemäärä pysyvät maltillisina.',
    whyItWorks:
      'Jako antaa ylävartalolle kaksi altistusta ja alavartalolle yhden isomman päivän, joten sekä tekniikkaharjoittelu että palautuminen pysyvät helposti hallinnassa.',
  },

  tpl_3_day_push_pull_legs_v1: {
    summary:
      'Klassinen kolmen päivän PPL, joka pitää jaon tuttuna mutta käyttää selkeitä etenemisraiteita satunnaisen salivolyymin sijaan.',
    audience:
      'Keskitason kasvujaksoihin, kun haluat tunnistettavan lihasryhmäjaon ajautumatta turhaan volyymiin.',
    equipmentProfile: 'Suositellaan täyttä salia, erityisesti punnerruslaitteet, ylätalja/soutupaikat ja kunnollinen alavartalosetuppi.',
    whyItWorks:
      'Jokaisella päivällä on vain yksi iso tehtävä, joten rinta/olkapäät, selkä/kädet ja jalat saavat painetta erikseen ilman että väsymys laahaa läpi viikon.',
  },

  tpl_4_day_muscle_builder_v1: {
    summary:
      'Nelipäiväinen kasvupohja, joka pysyy lähestyttävänä aloitteleville mutta antaa silti riittävän kokonaisvolyymin kasvuun.',
    audience:
      'Aloittelijoille, jotka haluavat siirtyä koko kehon rakenteesta oikeaan ylä/ala-lihaskasvujakoon.',
    equipmentProfile: 'Suositellaan täyttä salia, erityisesti laitteet, käsipainot ja alavartalon perusliitteet.',
    whyItWorks:
      'Jako toistaa ylä- ja alavartalon kahdesti viikossa, mutta liikevalinnat pysyvät aloittelijaystävällisinä, joten kuorma kasvaa ennen monimutkaisuutta.',
  },

  tpl_4_day_strength_size_v1: {
    summary:
      'Nelipäiväinen jakso, joka antaa viikolle selkeät suorituspäivät ja jättää silti tilaa merkitykselliselle kasvutyölle.',
    audience:
      'Keskitason treenaajille, jotka haluavat enemmän raskasta nostoa kuin puhdas kehonrakennusjako mutta enemmän kasvutyötä kuin riisuttu voimaohjelma.',
    equipmentProfile: 'Vaatii täyden salin, erityisesti tangot, ylätalja/soutuvaihtoehdot ja riittävästi alavartalon välineitä raskaille ja kevyemmille päiville.',
    whyItWorks:
      'Viikon alkupuoli hoitaa raskaimman työn ja loppupuoli lisää volyymin, joka pitää koon ja liikesietokyvyn kehittymässä.',
  },
  tpl_2_day_mobility_reset_v1: {
    summary:
      'Kevytkitkainen kahden päivän palautumispohja liikkuvuusosuuksien, hengitysharjoitusten ja helpon liikelaatutyön ympärillä.',
    audience:
      'Palautusviikkoihin, aloitusvaiheisiin tai kenelle tahansa, joka haluaa kevyemmän aloituksen kuin täysi voimajako.',
    equipmentProfile: 'Ei vaadi raskaita välineitä. Ohjelma toimii lattiatilan ja kehonpainon varassa palautusjaksona.',
    whyItWorks:
      'Treenit toistavat yksinkertaisia liikkuvuusmalleja ja hengitystyötä, joten rakennat ensin säännöllisyyden ja lisäät kierroksia vasta kun flow tuntuu luontevalta.',
  },
  tpl_2_day_yoga_recovery_v1: {
    summary:
      'Kahden päivän joogapainotteinen palautusjakso liikkuvuudelle, tasapainolle, hengitykselle ja hitaammalle koko kehon liikeharjoittelulle.',
    audience:
      'Aloittelijoille, liikkuvuuspainotteisiin viikkoihin tai kenelle tahansa, joka haluaa rauhallisemman liikevaihtoehdon Vinhan sisällä.',
    equipmentProfile: 'Mattoystävällinen ja pelkällä kehonpainolla. Ohjelman ydin ei vaadi salia.',
    whyItWorks:
      'Pohja käyttää lyhyitä toistettavia sarjoja monimutkaisen sekvenssin sijaan, joten joogatavan voi rakentaa ilman täyttä studiotuntia joka kerta.',
  },
  tpl_3_day_run_mobility_v1: {
    summary:
      'Aloittelijaystävällinen juoksu- ja palautuspohja, joka yhdistää intervallipohjaiset juoksublokit liikkuvuus- ja palautumistyöhön.',
    audience:
      'Niille, jotka haluavat yksinkertaisen juoksun aloituspisteen Vinhan nykymallissa hyppäämättä suoraan suuriin kilometrimääriin.',
    equipmentProfile: 'Minimaalinen setuppi. Juoksupäivät on rakennettu yksinkertaisiksi blokeiksi ja palautuspäivä vaatii vain lattiatilaa.',
    whyItWorks:
      'Sen sijaan että jahtaisit heti pitkiä lenkkejä, ohjelma vuorottelee kevyitä ja tempotyylisiä juoksublokkeja oman palautuspäivän kanssa, jotta jalat ja lonkat pysyvät mukana.',
  },

  tpl_4_day_ppl_plus_v1: {
    summary:
      'Nelipäiväinen PPL+1-jako, joka lisää klassiseen työntö/veto/jalat-malliin oman ylävartalotreenin viikkovolyymin kasvattamiseksi ilman kuutta treenipäivää.',
    audience:
      'Keskitason treenaajille, jotka ovat kasvaneet ulos kolmen päivän PPL:stä mutta eivät ole valmiita täyteen kuuden päivän sitoumukseen.',
    equipmentProfile: 'Vaatii täyden salin. Pohja olettaa tangon, käsipainot, taljat, ylätaljan ja laitteet läpi viikon.',
    whyItWorks:
      'Kun neljäs päivä on ylävartalon kirimispäivä eikä toinen jalkapäivä, jalat eivät ylikuormitu ja rinta, selkä ja kädet saavat merkityksellisen toisen altistuksen.',
  },

  tpl_5_day_ppl_v1: {
    summary:
      'Viiden päivän PPL-jakso, jossa työntö ja veto ajetaan kahdesti viikossa ja yksi jalkapäivä sijoittuu keskelle, jotta alavartalon palautuminen pysyy siistinä.',
    audience:
      'Keskitason ja edistyneille treenaajille, jotka treenaavat viitenä päivänä viikossa ja haluavat runsasvolyymisen työntö/veto-rakenteen.',
    equipmentProfile: 'Vaatii täyden salin kaikkina viitenä päivänä. Talja- ja laitepääsy on erityisen tärkeää toisilla työntö- ja vetotreeneillä.',
    whyItWorks:
      'Työntö- ja vetomallien ajaminen kahdesti antaa ylävartalolle kaksinkertaisen altistuksen ilman toista raskasta jalkapäivää, joka veisi palautumisen.',
  },

  tpl_5_day_upper_lower_full_v1: {
    summary:
      'Viiden päivän ohjelma, joka ajaa ylä- ja alavartalon kahdesti viikossa ja päättää viikon koko kehon treeniin lisäharjoittelua ja volyymia varten.',
    audience:
      'Keskitason treenaajille, jotka haluavat lisätä viidennen päivän tuplaamatta yhtä lihasryhmää liian aggressiivisesti.',
    equipmentProfile: 'Vaatii täyden salin. Koko kehon päivä on tarkoituksella kevyempi, joten se toimii salilla jossa on perustanko ja laitteet.',
    whyItWorks:
      'Koko kehon päivä toimii tekniikka- ja volyymipuskurina — se pitää jokaisen liikemallin viikossa kolme kertaa kuormittamatta yhtäkään niin että palautuminen kärsisi.',
  },

  tpl_6_day_ppl_v1: {
    summary:
      'Klassinen kuuden päivän PPL-tupla: työntö, veto ja jalat kahdesti viikossa maksimaalisen viikkovolyymin ja -tiheyden vuoksi.',
    audience:
      'Edistyneille treenaajille, jotka palautuvat hyvin suuresta viikkovolyymista ja haluavat treeniviikkoon eniten erikoistumisaikaa.',
    equipmentProfile: 'Vaatii täyden salin kaikkina kuutena päivänä. Laitevalikoima auttaa erityisesti B-treeneissä, joissa volyymi on huipussaan.',
    whyItWorks:
      'Koko PPL-syklin ajaminen kahdesti antaa jokaiselle isolle lihasryhmälle kaksi erillistä ärsykettä viikossa yksittäisen treenin pituuden pysyessä hallittavana.',
  },

  tpl_6_day_arnold_v1: {
    summary:
      'Kuusi päivää rinta/selkä-, olkapäät/kädet- ja jalkatreeniä — Arnold Schwarzeneggerin kuuluisaksi tekemä rakenne modernein kaksoisetenemisraitein.',
    audience:
      'Edistyneille treenaajille, jotka pitävät vastavaikuttajalihasten yhdistämisestä ja haluavat tiheän kehonrakennusjaon vahvalla rakenteellisella logiikalla.',
    equipmentProfile: 'Vaatii täyden salin kaikkina kuutena päivänä, erityisesti punnerruslaitteet, taljat ja täyden alavartalosetupin.',
    whyItWorks:
      'Rinnan yhdistäminen selkään ja olkapäiden käsiin antaa yhden lihaksen palautua toisen työskennellessä, mikä pitää treenin tiheyden korkeana ilman että paikallinen väsymys tappaa tehon.',
  },

  tpl_focus_chest_v1: {
    summary: 'Oma rintatreeni monikulmaisella punnerruksella ja liikkeillä, jotka maksimoivat rintavolyymin yhdellä käynnillä.',
    audience: 'Parhaiten lisäpäivänä, erikoistumisjaksona tai itsenäisenä rintatreeninä omassa viikkosuunnitelmassa.',
    equipmentProfile: 'Vaatii tasa- ja vinopenkin, käsipainot ja mielellään taljan tai pec deck -laitteen.',
    whyItWorks:
      'Treeni osuu rintaan kolmesta kulmasta — tasainen, vino ja avaava — joten sekä ylä- että alaosa saavat suoraa työtä yhdessä tehokkaassa blokissa.',
  },

  tpl_focus_back_v1: {
    summary: 'Täysi selkätreeni, joka kattaa leveän selän, yläselän ja takaolkapäät veto-, soutu- ja kohautusliikkeillä.',
    audience: 'Parhaiten itsenäisenä selkäpäivänä, täydentävänä vetotreeninä tai osana omaa tiheämpää viikkoa.',
    equipmentProfile: 'Vaatii leuanveto- tai ylätaljapaikan, tanko- tai taljasoutusetupin sekä pääsyn kasvoilleveto- tai takaolkapäälaitteelle.',
    whyItWorks:
      'Pysty- ja vaakavetojen yhdistäminen takaolkapääpäätteeseen varmistaa, että kaikki kolme selän pääaluetta — leveä selkä, keskiselkä ja takaolkapää — treenataan yhdessä treenissä.',
  },

  tpl_focus_shoulders_v1: {
    summary:
      'Olkapäihin keskittyvä treeni punnerruksen sekä sivu- ja takaolkapään eristyksen ympärillä, joka lisää viikkovolyymia ylikuormittamatta työntöpäiviä.',
    audience:
      'Treenaajille, jotka haluavat lisää olkapäiden kehitystä nykyisen ohjelman päälle tai kohdennetun olkapääpäivän omaan jakoon.',
    equipmentProfile: 'Vaatii käsipainot, tanko- tai laitepunnerrusvaihtoehdon sekä talja- tai laitepääsyn takaolkapäätyöhön.',
    whyItWorks:
      'Punnerruksen erottaminen eristyksestä antaa sivu- ja takaolkapäille suoraa työtä sen sijaan että ne luottaisivat rintapäivien sivuvaikutukseen.',
  },

  tpl_focus_arms_v1: {
    summary:
      'Itsenäinen käsitreeni hauiskääntöjen ja ojentajaojennusten kanssa useista kulmista suoraa käsikehitystä varten.',
    audience:
      'Treenaajille, jotka haluavat lisää käsivolyymia työntö- ja vetopäivien päälle, tai kenelle tahansa joka ajaa omaa käsipäivää.',
    equipmentProfile: 'Vaatii käsipainot, tangon tai EZ-tangon sekä taljapääsyn kääntöihin ja pushdowneihin.',
    whyItWorks:
      'Suora hauis- ja ojentajatyö samassa treenissä pitää treenin lyhyenä ja varmistaa silti että molemmat lihasryhmät saavat kasvuun riittävän ärsykkeen.',
  },

  tpl_focus_legs_v1: {
    summary:
      'Täydellinen jalkatreeni etureisi-, takareisi-, pakara- ja pohjetyöllä, joka rakentaa alavartalon volyymia yhdellä omistetulla käynnillä.',
    audience: 'Parhaiten itsenäisenä jalkapäivänä, lisätreeninä tai alavartalon ankkurina omassa jaossa.',
    equipmentProfile: 'Vaatii kyykkytelineen, jalkaprässin, takareisikoukistuslaitteen ja pohjenostopaikan.',
    whyItWorks:
      'Treeni ajaa kyykky-, sarana- ja yhden jalan mallit ennen eristystä, mikä vastaa parasta väsymysjärjestystä alavartalon moninivelliikkeille.',
  },

  tpl_focus_glutes_v1: {
    summary:
      'Pakaroihin keskittyvä treeni lantionnoston, taljapotkun ja romanialaisen maastavedon ympärillä kohdennettuun takaketjun kehitykseen.',
    audience:
      'Treenaajille, jotka haluavat enemmän pakaravolyymia kuin tavalliset jalkapäivät antavat, tai kenelle tahansa pakaroiden erikoistumisjaksolla.',
    equipmentProfile: 'Vaatii lantionnostopenkin tai vakaan alustan, taljalaitteen ja mahdollisuuden romanialaiseen maastavetoon.',
    whyItWorks:
      'Treeni priorisoi lonkan ojennusmalleja, jotka kuormittavat pakaroita pitkässä lihaspituudessa — tutkimusten mukaan se tuottaa enemmän kasvua kuin pelkkä moninivelliikkeiden sivuvaikutus.',
  },

  tpl_shred_v1: {
    summary:
      'Kolme koko kehon treeniä, jotka yhdistävät moninivelnostot oikeisiin kuntopäätteisiin — rakennettu rasvanpudotukseen lihasta säilyttäen.',
    audience: 'Kenelle tahansa, jonka päätavoite on rasvanpudotus ja joka haluaa voimatyön ja kunnon samalle käynnille.',
    equipmentProfile: 'Suositellaan täyttä salia: tanko, laitteet, kahvakuula sekä juoksumatto tai pyörä päätteisiin.',
    whyItWorks:
      'Raskaat perusliikkeet suojaavat lihasta kalorivajeessa, ja joka treeni päättyy intervallipäätteeseen joka lisää oikeaa energiankulutusta — nimi toimii vain koska kunto on oikeasti mukana suunnitelmassa.',
  },

  tpl_huge_starter_v1: {
    summary: 'Kaksi tehokasta koko kehon treeniä, jotka rakentavat lihasta pienimmällä mahdollisella viikkokitkalla.',
    audience: 'Uusille treenaajille, jotka haluavat kasvattaa lihasta kahtena salipäivänä viikossa ilman monimutkaista jakoa.',
    equipmentProfile: 'Suositellaan täyttä salia: penkki, jalkaprässi, taljapaikat ja käsipainot.',
    whyItWorks:
      'Jokainen iso lihas treenataan kahdesti viikossa moninivelliikkeillä, ja lyhyet treenit pitävät säännöllisyyden korkealla — aloittelijan kasvun tärkein tekijä.',
  },

  tpl_focus_chest_program_v1: {
    summary:
      'Kolmen päivän erikoistumisjakso, jossa rinta treenataan kahdesti viikossa muun kehon pysyessä ylläpitovolyymilla.',
    audience: 'Keskitason treenaajille, joiden rinta laahaa perässä ja jotka voivat sitoutua kolmeen päivään viikossa.',
    equipmentProfile: 'Vaatii täyden salin: tasa- ja vinopenkki, laitteet, käsipainot ja taljat.',
    whyItWorks:
      'Rinnan tiheyden tuplaaminen raskaalla ja volyymipäivällä ajaa kasvua, ja yksi ylläpitopäivä estää selkää ja jalkoja taantumasta.',
  },

  tpl_focus_back_program_v1: {
    summary:
      'Kolmen päivän erikoistumisjakso, jossa selkä treenataan kahdesti viikossa punnerruksen ja jalkojen pysyessä ylläpitovolyymilla.',
    audience: 'Keskitason treenaajille, jotka haluavat leveämmän ja paksumman selän ja voivat treenata kolmesti viikossa.',
    equipmentProfile: 'Vaatii täyden salin: tanko, ylätalja- ja soutupaikat sekä taljat.',
    whyItWorks:
      'Raskas soutupäivä ja ylätaljavetoinen volyymipäivä tuplaavat selän viikkoärsykkeen, ja yksi koko kehon ylläpitopäivä suojaa muuta edistymistä.',
  },

  tpl_focus_arms_program_v1: {
    summary: 'Kolmen päivän erikoistumisjakso kahdella suoralla käsipäivällä ja yhdellä koko kehon ylläpitopäivällä.',
    audience: 'Keskitason treenaajille, joiden kädet laahaavat rinnan ja selän kehityksen perässä.',
    equipmentProfile: 'Vaatii täyden salin: tanko, EZ-tanko tai käsipainot ja taljapaikat.',
    whyItWorks:
      'Kädet palautuvat nopeasti, joten hauiksen ja ojentajan suora treenaaminen kahdesti viikossa lisää oikeaa volyymia varastamatta palautumista muulta viikolta.',
  },

  tpl_focus_legs_program_v1: {
    summary:
      'Kolmen päivän erikoistumisjakso, jossa jalat treenataan kahdesti viikossa — yksi raskas kyykkypäivä, yksi volyymipäivä — ja yksi ylävartalon ylläpitopäivä.',
    audience: 'Keskitason treenaajille, jotka haluavat tosissaan alavartalon kasvua ja palautuvat kahdesta kovasta jalkapäivästä.',
    equipmentProfile: 'Vaatii täyden salin: kyykkyteline, hack squat tai jalkaprässi, takareisikoukistuslaite ja pohjepaikka.',
    whyItWorks:
      'Kyykkyvetoinen raskas työ ja laitevetoinen volyymityö tuplaavat viikon kasvuärsykkeen, ja ylävartalopäivä estää punnerrusta ja vetoa liukumasta taaksepäin.',
  },

  tpl_focus_glutes_program_v1: {
    summary:
      'Kolmen päivän erikoistumisjakso kahdella pakaravetoisella alavartalopäivällä ja yhdellä ylävartalon ylläpitopäivällä.',
    audience: 'Treenaajille, joille pakaroiden kasvu on seuraavan jakson selkeä ykkösprioriteetti.',
    equipmentProfile: 'Vaatii täyden salin: lantionnostosetuppi, kyykkyteline tai jalkaprässi ja takareisikoukistuslaite.',
    whyItWorks:
      'Lantionnosto- ja saranamallit kuormittavat pakaroita suoraan kahdesti viikossa, ja kyykky- ja askelkyykkyvariaatiot lisäävät ärsykettä toisesta kulmasta.',
  },
};

/** Finnish text for programs generated outside the curated map. */
export const FALLBACK_READY_PROGRAM_CONTENT_FI: ReadyProgramContent = {
  summary:
    'Rakenteinen Vinha-ohjelma, jossa on selkeät treenit, liiketavoitteet ja etenemissäännöt valitulle treeniprofiilille.',
  audience:
    'Käyttäjille, joiden onboarding-valinnat vastaavat tämän ohjelman tyyliä, viikkotiheyttä, kokemustasoa ja treenipainotusta.',
  equipmentProfile:
    'Välinetarpeet seuraavat valitun suunnitelman liikkeitä. Käy ensimmäinen viikko läpi ennen aloitusta, jos salisi valikoima on rajallinen.',
  whyItWorks:
    'Suunnitelma ryhmittelee toisiinsa liittyvät treenipäivät toistettavaksi viikkorakenteeksi ja pitää sarjat, toistot ja lepotavoitteet näkyvissä, joten eteneminen on helppo seurata.',
};
