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
    sessionFocusById: {
      day_1_chest_triceps: 'Ankkurina Penkkipunnerrus. Loput 8 liikettä täydentävät päivän.',
      day_2_back_biceps: 'Ankkurina Lisäpainoleuanveto. Loput 8 liikettä täydentävät päivän.',
      day_3_legs: 'Ankkurina Takakyykky. Loput 8 liikettä täydentävät päivän.',
      day_4_shoulders_abs: 'Ankkurina Seisten pystypunnerrus. Loput 8 liikettä täydentävät päivän.',
      day_5_arms_weak_points: 'Ankkurina Vinopenkkihauiskääntö. Loput 8 liikettä täydentävät päivän.',
    },
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
    sessionFocusById: {
      day_1_chest: 'Ankkurina Penkkipunnerrus. Loput 6 liikettä täydentävät päivän.',
      day_2_back: 'Ankkurina Ylätalja. Loput 6 liikettä täydentävät päivän.',
      day_3_legs: 'Ankkurina Takakyykky. Loput 6 liikettä täydentävät päivän.',
      day_4_shoulders_arms: 'Ankkurina Istuen käsipainopunnerrus. Loput 7 liikettä täydentävät päivän.',
    },
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
    sessionFocusById: {
      push_a_chest_focus: 'Ankkurina Penkkipunnerrus. Loput 8 liikettä täydentävät päivän.',
      pull_a_width_focus: 'Ankkurina Maastaveto. Loput 8 liikettä täydentävät päivän.',
      legs_a_quad_focus: 'Ankkurina Takakyykky. Loput 8 liikettä täydentävät päivän.',
      push_b_shoulder_focus: 'Ankkurina Seisten pystypunnerrus. Loput 8 liikettä täydentävät päivän.',
      pull_b_thickness_focus: 'Ankkurina Pendlay-soutu. Loput 8 liikettä täydentävät päivän.',
      legs_b_posterior_focus: 'Ankkurina Perinteinen maastaveto. Loput 8 liikettä täydentävät päivän.',
    },
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
    sessionFocusById: {
      bench_day: 'Ankkurina Kilpapenkkipunnerrus. Loput 7 liikettä täydentävät päivän.',
      squat_day: 'Ankkurina Kilpakyykky. Loput 7 liikettä täydentävät päivän.',
      pull_day: 'Ankkurina Lisäpainoleuanveto. Loput 7 liikettä täydentävät päivän.',
      deadlift_day: 'Ankkurina Kilpamaastaveto. Loput 7 liikettä täydentävät päivän.',
      press_hypertrophy_pump: 'Ankkurina Seisten pystypunnerrus. Loput 8 liikettä täydentävät päivän.',
    },
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
    sessionFocusById: {
      upper_push_hiit: 'Ankkurina Penkkipunnerrus. Loput 7 liikettä täydentävät päivän.',
      lower_hiit: 'Ankkurina Takakyykky. Loput 7 liikettä täydentävät päivän.',
      upper_pull_hiit: 'Ankkurina Leuanveto. Loput 7 liikettä täydentävät päivän.',
      full_body_circuit: 'Ankkurina Goblet-kyykky. Loput 7 liikettä täydentävät päivän.',
      hiit_cardio_core: 'Ankkurina Roikkuen jalannosto. Loput 7 liikettä täydentävät päivän.',
    },
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
    sessionFocusById: {
      glutes_hamstrings: 'Ankkurina Lantionnosto. Loput 7 liikettä täydentävät päivän.',
      upper_body_sculpt: 'Ankkurina Pystypunnerrus käsipainoilla. Loput 8 liikettä täydentävät päivän.',
      quads_cardio: 'Ankkurina Goblet-kyykky. Loput 7 liikettä täydentävät päivän.',
      back_core: 'Ankkurina Taljasoutu. Loput 8 liikettä täydentävät päivän.',
      full_body_burn: 'Ankkurina Lantionnosto. Loput 7 liikettä täydentävät päivän.',
    },
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
    sessionFocusById: {
      glute_activation: 'Ankkurina Lantionnosto lattialla kuminauhalla. Loput 7 liikettä täydentävät päivän.',
      lower_body_strength: 'Ankkurina Goblet-kyykky. Loput 6 liikettä täydentävät päivän.',
      glute_hypertrophy: 'Ankkurina Lantionnosto kehonpainolla tai kevyellä tangolla. Loput 7 liikettä täydentävät päivän.',
    },
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
    sessionFocusById: {
      heavy_glutes_strength: 'Ankkurina Lantionnosto tangolla. Loput 6 liikettä täydentävät päivän.',
      upper_body_sculpt: 'Ankkurina Ylätalja. Loput 7 liikettä täydentävät päivän.',
      glute_volume_pump: 'Ankkurina Lantionnosto kuminauhalla. Loput 7 liikettä täydentävät päivän.',
      quads_hamstrings: 'Ankkurina Etukyykky. Loput 6 liikettä täydentävät päivän.',
      glute_finisher: 'Ankkurina Yhden jalan lantionnosto. Loput 6 liikettä täydentävät päivän.',
    },
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
    sessionFocusById: {
      glutes_legs: 'Ankkurina Lantionnosto tangolla. Loput 6 liikettä täydentävät päivän.',
      shoulders_back_width: 'Ankkurina Pystypunnerrus käsipainoilla. Loput 7 liikettä täydentävät päivän.',
      glutes_core: 'Ankkurina Taljaveto jalkojen välistä. Loput 7 liikettä täydentävät päivän.',
      upper_body_toning: 'Ankkurina Vinopenkkipunnerrus käsipainoilla. Loput 7 liikettä täydentävät päivän.',
    },
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
    sessionFocusById: {
      upper_body_hiit: 'Ankkurina Punnerrus. Loput 6 liikettä täydentävät päivän.',
      lower_body_hiit: 'Ankkurina Hyppykyykky. Loput 6 liikettä täydentävät päivän.',
      total_body_hiit: 'Ankkurina Burpee. Loput 7 liikettä täydentävät päivän.',
      tabata_finisher: 'Ankkurina Hyppykyykky (20 s / 10 s). Loput 5 liikettä täydentävät päivän.',
    },
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
    sessionFocusById: {
      morning_mobility_full_body: 'Ankkurina Kissa-lehmä. Loput 7 liikettä täydentävät päivän.',
      hip_opening_flow: 'Ankkurina Kyyhkynen (kumpikin puoli). Loput 7 liikettä täydentävät päivän.',
      shoulder_mobility: 'Ankkurina Seinäliuku. Loput 7 liikettä täydentävät päivän.',
      spinal_flexibility: 'Ankkurina Kissa-lehmä. Loput 7 liikettä täydentävät päivän.',
      deep_recovery_stretch: 'Ankkurina Seisten eteentaivutus. Loput 7 liikettä täydentävät päivän.',
    },
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
    sessionFocusById: {
      upper_body_bodyweight: 'Ankkurina Punnerrus (tai polvipunnerrus). Loput 6 liikettä täydentävät päivän.',
      lower_body_bodyweight: 'Ankkurina Kehonpainokyykky. Loput 6 liikettä täydentävät päivän.',
      full_body_circuit: 'Ankkurina Burpee. Loput 7 liikettä täydentävät päivän.',
    },
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
    sessionFocusById: {
      push_handstand_planche_progressions: 'Ankkurina Käsilläseisontapito seinää vasten. Loput 7 liikettä täydentävät päivän.',
      pull_muscle_up_front_lever: 'Ankkurina Lisäpainoleuanveto. Loput 7 liikettä täydentävät päivän.',
      legs_pistol_squats_plyo: 'Ankkurina Pistoolikyykky (kumpikin jalka). Loput 7 liikettä täydentävät päivän.',
      skills_core: 'Ankkurina Käsilläseisonta seinää pitkin. Loput 7 liikettä täydentävät päivän.',
    },
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
    sessionFocusById: {
      workout_a: 'Ankkurina Takakyykky. Loput 4 liikettä täydentävät päivän.',
      workout_b: 'Ankkurina Takakyykky. Loput 4 liikettä täydentävät päivän.',
    },
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
    sessionFocusById: {
      explosive_lower: 'Ankkurina Rinnalleveto. Loput 7 liikettä täydentävät päivän.',
      athletic_upper: 'Ankkurina Työntöpunnerrus. Loput 7 liikettä täydentävät päivän.',
      speed_agility: 'Ankkurina Sprintti 40 m. Loput 7 liikettä täydentävät päivän.',
      strength_circuit: 'Ankkurina Etukyykky. Loput 7 liikettä täydentävät päivän.',
      endurance_conditioning: 'Ankkurina Soutulaite (500 m vedot). Loput 7 liikettä täydentävät päivän.',
    },
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
    sessionFocusById: {
      upper_body_strength: 'Ankkurina Penkkipunnerrus. Loput 7 liikettä täydentävät päivän.',
      lower_body_strength: 'Ankkurina Takakyykky. Loput 6 liikettä täydentävät päivän.',
      push_core: 'Ankkurina Vinopenkkipunnerrus käsipainoilla. Loput 7 liikettä täydentävät päivän.',
      pull_conditioning: 'Ankkurina Tankosoutu. Loput 7 liikettä täydentävät päivän.',
    },
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
    sessionFocusById: {
      lower_body_supported: 'Ankkurina Jalkaprässi. Loput 7 liikettä täydentävät päivän.',
      upper_body_supported: 'Ankkurina Rintaprässi. Loput 7 liikettä täydentävät päivän.',
      full_body_balance: 'Ankkurina Ylösnousu tuolilta. Loput 8 liikettä täydentävät päivän.',
    },
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
    sessionFocusById: {
      gentle_strength: 'Ankkurina Goblet-kyykky kevyellä. Loput 7 liikettä täydentävät päivän.',
      mobility_pelvic_floor: 'Ankkurina Kissa-lehmä. Loput 7 liikettä täydentävät päivän.',
      low_impact_cardio_stability: 'Ankkurina Kuntopyörä (kevyt vauhti). Loput 7 liikettä täydentävät päivän.',
    },
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
    sessionFocusById: {
      core_reconnection: 'Ankkurina Palleahengitys. Loput 7 liikettä täydentävät päivän.',
      gentle_full_body: 'Ankkurina Kehonpainokyykky. Loput 7 liikettä täydentävät päivän.',
      strength_rebuild: 'Ankkurina Goblet-kyykky kevyellä. Loput 7 liikettä täydentävät päivän.',
    },
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
    sessionFocusById: {
      posterior_chain_power: 'Ankkurina Romanialainen maastaveto. Loput 7 liikettä täydentävät päivän.',
      single_leg_stability: 'Ankkurina Bulgarialainen askelkyykky. Loput 7 liikettä täydentävät päivän.',
      core_mobility_for_runners: 'Ankkurina Lankku. Loput 8 liikettä täydentävät päivän.',
    },
  },

  tpl_strong_elite_v1: {
    summary:
      '12 viikon Pro-voimajakso: viiden sarjan ankkuriliikkeet, raskaat painepäivät ja apuliikkeet jotka suojaavat seuraavaa raskasta treeniä.',
    audience:
      'Kokeneille treenaajille, jotka palautuvat hyvin, osaavat perusliikkeet ulkoa ja haluavat maksimivoiman selkeäksi prioriteetiksi.',
    equipmentProfile: 'Vaatii täyden salin: tanko, teline, penkki, trap bar tai maastavetopaikka, laitteet ja taljat.',
    whyItWorks:
      'Jokainen liikemalli saa viikossa yhden raskaan ja yhden painealtistuksen, joten teho nousee jakson aikana ilman että viikko romahtaa väsymykseen.',
    sessionFocusById: {
      strong_elite_upper_heavy: 'Viiden sarjan penkkiankkuri raskaiden soutujen ja punnerrustuen kanssa.',
      strong_elite_lower_heavy: 'Kyykky- ja trap bar -ankkurit — viikon raskain päivä.',
      strong_elite_upper_volume: 'Vinopenkki ja soudut lisäävät painetta hallittavilla kuormilla.',
      strong_elite_lower_volume: 'Etukyykky ja romanialainen maastaveto pitävät laatuvolyymin ankkureiden takana.',
    },
  },
  tpl_fit_elite_v1: {
    summary:
      '12 viikon Pro-jakso, jossa voima-ankkurit pysyvät liikkeessä ja kuntopäätteet rakentavat oikeaa kestävyyttä neljänä päivänä viikossa.',
    audience:
      'Kokeneille yleisosaajille, jotka haluavat voiman, kunnon ja liikkuvuuden yhteen rehelliseen viikkorakenteeseen.',
    equipmentProfile: 'Suositellaan täyttä salia: tanko, käsipainot, laitteet, kahvakuula ja kardiolaite päätteisiin.',
    whyItWorks:
      'Tehopäivät painavat perusliikkeitä ja volyymipäivät lisäävät kuntotiheyttä, joten sekä voima että kestävyys etenevät varastamatta toisiltaan.',
    sessionFocusById: {
      fit_elite_upper_a: 'Penkki- ja soutuankkurit kahvakuulapäätteellä kruunattuna.',
      fit_elite_lower_a: 'Kyykky edellä etenevä alavartalopäivä saranavolyymillä ja keskivartalotyöllä.',
      fit_elite_upper_b: 'Vinopunnerrus- ja ylätaljavolyymi sekä burpee-kierros.',
      fit_elite_lower_b: 'Jalkaprässi- ja lantionnostovolyymi intervallikestävyysblokilla.',
    },
  },
  tpl_shred_elite_v1: {
    summary:
      '12 viikon Pro-rasvanpudotusjakso: viisi päivää, jotka pitävät voima-ankkurit paikallaan HIIT-päätteiden nostaessa energiankulutusta.',
    audience:
      'Kokeneille treenaajille, jotka pudottavat rasvaa mutta kieltäytyvät menettämästä voimapohjaansa kuntovolyymin noustessa.',
    equipmentProfile: 'Suositellaan täyttä salia: tanko, laitteet, kahvakuula sekä juoksumatto tai pyörä intervalleihin.',
    whyItWorks:
      'Joka treeni yhdistää yhden rehellisen voimaosion kuntopäätteeseen, joten vaje syntyy työstä jossa voi oikeasti edetä — ei turhasta volyymista.',
    sessionFocusById: {
      shred_elite_day1: 'Kyykkyankkuri sekä heilautukset ja juoksumattointervallit.',
      shred_elite_day2: 'Penkkiankkuri askelkyykyillä ja burpee-kierroksella.',
      shred_elite_day3: 'Sarana- ja punnerruspäivä pyöräspurteilla kruunattuna.',
      shred_elite_day4: 'Koko kehon laitekierros vuorikiipeilijöillä päätettynä.',
      shred_elite_day5: 'Heilautusvetoinen kestävyyspäivä palauttavalla liikkuvuusosuudella viikon päätteeksi.',
    },
  },
  tpl_3_day_full_body_v1: {
    summary:
      'Kolme koko kehon treeniä, jotka pitävät voimaharjoittelun tiheänä samalla kun viikon kokonaisrasitus pysyy hallittavana.',
    audience:
      'Aloitteleville treenaajille tai kenelle tahansa, joka haluaa yksinkertaisen viikkorakenteen ja toistuvaa harjoittelua perusliikkeillä.',
    equipmentProfile: 'Suositellaan täyttä salia: tanko, penkki, talja, jalkaprässi ja perusvetopaikka.',
    whyItWorks:
      'Pohja toistaa kyykky-, punnerrus-, veto- ja saranaliikkeet viikon aikana, joten eteneminen pysyy ilmiselvänä ilman monimutkaista jakoa.',
    sessionFocusById: {
      full_body_a: 'Kyykky + penkki -ankkuripäivä siistillä koko kehon pohjalla.',
      full_body_b: 'Pystypunnerrus- ja vetopainotus yhden jalan työllä.',
      full_body_c: 'Saranapainotteinen lopetus, joka pitää rinta- ja soutuvolyymin liikkeessä.',
    },
  },
  tpl_4_day_upper_lower_v1: {
    summary:
      'Tasapainoinen ylä/ala-jako, jossa on riittävä viikkovolyymi kasvuun ja ankkuriliikkeillä silti selkeät etenemistavoitteet.',
    audience:
      'Keskitason treenaajille, jotka pääsevät salille neljästi viikossa ja haluavat enemmän ylä/ala-volyymia kuin koko kehon treeni antaa.',
    equipmentProfile: 'Suositellaan täyttä salia, erityisesti tangot, käsipainot, laitteet, ylätalja ja soutupaikat.',
    whyItWorks:
      'Jokainen liikemalli saa kaksi altistusta viikossa, mikä tekee palautumisesta ennakoitavaa ja tuottaa enemmän tuottavia kovia sarjoja ilman että jokaisesta päivästä tulee maraton.',
    sessionFocusById: {
      upper_a: 'Vaakapunnerrus- ja soutupainotus olkapää- ja ojentajatuella.',
      lower_a: 'Kyykky edellä etenevä alavartalopäivä takaketju- ja keskivartalotyöllä.',
      upper_b: 'Pystypunnerrus- ja vetopäivä laiterinta- ja käsipäätteillä.',
      lower_b: 'Saranavetoinen alavartalopäivä yhden jalan työllä sekä pohje- ja keskivartalotuella.',
    },
  },
  tpl_5_day_hybrid_v1: {
    summary:
      'Tiheämpi hybridijako, joka yhdistää ylä/ala-rakenteen omiin työntö- ja vetopäiviin tarkempaa erikoistumista varten.',
    audience:
      'Keskitason treenaajille, jotka palautuvat hyvin, haluavat enemmän saliaikaa ja pitävät lihasryhmätunnusta menettämättä etenemisrakennetta.',
    equipmentProfile: 'Vaatii täyden salin. Pohja olettaa laajan välinevalikoiman: tanko, laitteet, käsipainot ja taljat.',
    whyItWorks:
      'Viikko avautuu raskaammalla moninivelrakenteella ja lisää sitten erilliset työntö- ja vetopäivät, joten ylimääräinen volyymi osuu sinne missä sillä on merkitystä paisuttamatta joka treeniä.',
    sessionFocusById: {
      upper_a: 'Raskas ylävartalopohja penkki ja soutu ankkureina.',
      lower_a: 'Kyykkyvetoinen alavartalopäivä saranatuella ja apuliikkeillä.',
      push: 'Punnerrusvolyymia sekä olkapää- ja ojentajaerikoistumista.',
      pull: 'Selän tiheyttä, leveän selän työtä ja hauisvolyymia yhdessä osiossa.',
      lower_b: 'Toinen alavartaloaltistus saranatyön ja yhden jalan tasapainon ympärillä.',
    },
  },
  tpl_2_day_minimal_full_body_v1: {
    summary:
      'Kevytkitkainen kahden päivän kehonpaino-ohjelma viikoille, jolloin haluat koko kehon kattavuuden ilman salia.',
    audience:
      'Aloittelijoille, kiireisiin viikkoihin, kotitreeneihin tai kenelle tahansa treeniin palaavalle, joka haluaa silti rakenteen ja etenemisen.',
    equipmentProfile: 'Koti- ja kehonpainoystävällinen. Lattiatila ja tukeva soutupaikka riittävät ohjelman ytimeen.',
    whyItWorks:
      'Pohja pitää kyykky-, työntö-, veto-, sarana- ja keskivartaloliikkeet viikossa ja käyttää kehonpainon etenemistä salivälineiden sijaan.',
    sessionFocusById: {
      minimal_full_body_a: 'Kehonpainokyykky, vinopunnerrus, kehonpainosoutu ja keskivartalotyö yhtenä siistinä pohjatreeninä.',
      minimal_full_body_b: 'Askelkyykky, punnerrus, lantionnosto ja kuntoa kehittävä keskivartalotyö ilman laiteriippuvuutta.',
    },
  },
  tpl_3_day_strength_base_v1: {
    summary:
      'Yksinkertainen voima edellä -viikko kolmella raskaalla altistuksella, joten kyykky, punnerrus ja sarana etenevät kaikki toistettavilla raiteilla.',
    audience:
      'Aloitteleville treenaajille, jotka haluavat oikean voimaohjelman hyppäämättä suoraan raskaaseen voimanostosetuppiin.',
    equipmentProfile: 'Suositellaan täyttä salia, erityisesti tankopaikat, soutuvaihtoehto, ylätalja ja alavartalon perusliitteet.',
    whyItWorks:
      'Jokainen treeni alkaa yhdellä ankkuriliikkeellä matalilla toistoilla ja täyttää loppupäivän riittävällä tukityöllä rakentamatta palautumisvelkaa.',
    sessionFocusById: {
      strength_base_a: 'Raskas kyykky- ja penkkipäivä soututuella.',
      strength_base_b: 'Maastaveto- ja pystypunnerruspainotus yhden jalan avustuksella.',
      strength_base_c: 'Etukyykky- ja vinopenkkipäivä, joka pitää etenemisen liikkeessä toistamatta samaa rasitusta kahdesti.',
    },
  },
  tpl_4_day_powerbuilding_v1: {
    summary:
      'Nelipäiväinen powerbuilding-ohjelma, jossa viikko avautuu voimatyöllä ja päättyy volyymiin, joka oikeasti rakentaa lihasta.',
    audience:
      'Keskitason treenaajille, jotka välittävät tangon luvuista mutta haluavat silti ylä- ja alavartalopäivien näyttävän kehonrakennustreeneiltä.',
    equipmentProfile: 'Vaatii täyden salin: tangot, käsipainot, ylätalja, soutupaikat ja alavartalon laitteet.',
    whyItWorks:
      'Jako erottaa suorituspäivät volyymipäivistä, joten perusliikkeet pysyvät tuoreina ja rinta, selkä, olkapäät ja jalat keräävät silti tarpeeksi kasvutyötä viikon aikana.',
    sessionFocusById: {
      power_upper_strength: 'Penkki- ja soutuankkurit pystypunnerrustuella.',
      power_lower_strength: 'Kyykky- ja saranapäivä alavartalon suorituskyvylle rakennettuna.',
      power_upper_volume: 'Ylävartalon kasvuosio enemmällä rinta-, selkä- ja käsityöllä.',
      power_lower_volume: 'Toinen alavartalopäivä etureisi-, sarana- ja yhden jalan volyymille.',
    },
  },
  tpl_2_day_beginner_strength_v1: {
    summary:
      'Kahden päivän voimaharjoittelun aloituspiste, joka pitää liikevalikoiman yksinkertaisena mutta antaa kyykylle, punnerrukselle, saranalle ja vedolle tilaa edetä.',
    audience:
      'Uusille treenaajille, jotka haluavat selkeää tankoetenemistä sitoutumatta heti kolmeen tai neljään viikkotreeniin.',
    equipmentProfile: 'Suositellaan täyttä salia, mutta liikemäärä pysyy niin pienenä että päivät on helppo oppia ja toistaa.',
    whyItWorks:
      'Ohjelma riisuu voimatyön perusliikkeisiin, joten energia menee toistettaviin nostoihin eikä vaihtelun jahtaamiseen liian aikaisin.',
    sessionFocusById: {
      beginner_strength_a: 'Raskas kyykky- ja penkkipohja yksinkertaisella soutu- ja keskivartalolopetuksella.',
      beginner_strength_b: 'Trap bar- ja pystypunnerruspäivä veto- ja yhden jalan tuella.',
    },
  },

  tpl_3_day_upper_lower_lite_v1: {
    summary:
      'Kevyempi kolmen päivän ylä/ala-jako, joka pitää viikon tasapainossa vaatimatta pitkiä tai liian tiiviitä treenejä.',
    audience:
      'Aloittelijoille, jotka haluavat koko kehon treeniä vaihtelevampaa mutta eivät ole vielä valmiita klassiseen nelipäiväiseen jakoon.',
    equipmentProfile: 'Tavallinen täysi sali toimii parhaiten, mutta treenin pituus ja liikemäärä pysyvät maltillisina.',
    whyItWorks:
      'Jako antaa ylävartalolle kaksi altistusta ja alavartalolle yhden isomman päivän, joten sekä tekniikkaharjoittelu että palautuminen pysyvät helposti hallinnassa.',
    sessionFocusById: {
      upper_lower_lite_upper_a: 'Aloittava ylävartalopäivä suoraviivaisella punnerruksella, soudulla ja pystytyöllä.',
      upper_lower_lite_lower: 'Alavartalon ankkuripäivä jalkaprässillä, saranatyöllä ja yksinkertaisilla apuliikkeillä.',
      upper_lower_lite_upper_b: 'Toinen ylävartaloaltistus laitepunnerruksella, souduilla sekä käsi- ja olkapääpäätteillä.',
    },
  },

  tpl_3_day_push_pull_legs_v1: {
    summary:
      'Klassinen kolmen päivän PPL, joka pitää jaon tuttuna mutta käyttää selkeitä etenemisraiteita satunnaisen salivolyymin sijaan.',
    audience:
      'Keskitason kasvujaksoihin, kun haluat tunnistettavan lihasryhmäjaon ajautumatta turhaan volyymiin.',
    equipmentProfile: 'Suositellaan täyttä salia, erityisesti punnerruslaitteet, ylätalja/soutupaikat ja kunnollinen alavartalosetuppi.',
    whyItWorks:
      'Jokaisella päivällä on vain yksi iso tehtävä, joten rinta/olkapäät, selkä/kädet ja jalat saavat painetta erikseen ilman että väsymys laahaa läpi viikon.',
    sessionFocusById: {
      push_pull_legs_push: 'Rinta-, olkapää- ja ojentajapäivä punnerruksilla.',
      push_pull_legs_pull: 'Leveä selkä, yläselkä, takaolkapää ja käsivolyymi yhdessä vetopäivässä.',
      push_pull_legs_legs: 'Yksinkertainen etureisi-, sarana-, takareisi-, pohje- ja keskivartalopäivä.',
    },
  },

  tpl_4_day_muscle_builder_v1: {
    summary:
      'Nelipäiväinen kasvupohja, joka pysyy lähestyttävänä aloitteleville mutta antaa silti riittävän kokonaisvolyymin kasvuun.',
    audience:
      'Aloittelijoille, jotka haluavat siirtyä koko kehon rakenteesta oikeaan ylä/ala-lihaskasvujakoon.',
    equipmentProfile: 'Suositellaan täyttä salia, erityisesti laitteet, käsipainot ja alavartalon perusliitteet.',
    whyItWorks:
      'Jako toistaa ylä- ja alavartalon kahdesti viikossa, mutta liikevalinnat pysyvät aloittelijaystävällisinä, joten kuorma kasvaa ennen monimutkaisuutta.',
    sessionFocusById: {
      muscle_builder_upper_a: 'Yksinkertainen laite-/käsipainoylävartalo rinnalla, leveällä selällä sekä olkapää- ja ojentajatuella.',
      muscle_builder_lower_a: 'Takakyykky- ja saranapäivä klassisella laiteavustuksella.',
      muscle_builder_upper_b: 'Toinen ylävartalopäivä penkillä, soudulla, olkapäätyöllä ja käsivolyymilla.',
      muscle_builder_lower_b: 'Hack squat- ja lantionnostopäivä, joka viimeistelee pakarat, etureidet, takareidet ja pohkeet.',
    },
  },

  tpl_4_day_strength_size_v1: {
    summary:
      'Nelipäiväinen jakso, joka antaa viikolle selkeät suorituspäivät ja jättää silti tilaa merkitykselliselle kasvutyölle.',
    audience:
      'Keskitason treenaajille, jotka haluavat enemmän raskasta nostoa kuin puhdas kehonrakennusjako mutta enemmän kasvutyötä kuin riisuttu voimaohjelma.',
    equipmentProfile: 'Vaatii täyden salin, erityisesti tangot, ylätalja/soutuvaihtoehdot ja riittävästi alavartalon välineitä raskaille ja kevyemmille päiville.',
    whyItWorks:
      'Viikon alkupuoli hoitaa raskaimman työn ja loppupuoli lisää volyymin, joka pitää koon ja liikesietokyvyn kehittymässä.',
    sessionFocusById: {
      strength_size_upper_performance: 'Raskas penkki + soutu -ylävartalopäivä pystytyön tuella.',
      strength_size_lower_performance: 'Raskas kyykky- ja saranatreeni kohdennetulla alavartalotuella.',
      strength_size_upper_growth: 'Ylävartalon kasvujatko enemmällä rinta-, selkä-, olkapää- ja käsityöllä.',
      strength_size_lower_growth: 'Toinen alavartalopäivä etureisi-, sarana- ja yhden jalan kasvuvolyymin ympärillä.',
    },
  },
  tpl_2_day_mobility_reset_v1: {
    summary:
      'Kevytkitkainen kahden päivän palautumispohja liikkuvuusosuuksien, hengitysharjoitusten ja helpon liikelaatutyön ympärillä.',
    audience:
      'Palautusviikkoihin, aloitusvaiheisiin tai kenelle tahansa, joka haluaa kevyemmän aloituksen kuin täysi voimajako.',
    equipmentProfile: 'Ei vaadi raskaita välineitä. Ohjelma toimii lattiatilan ja kehonpainon varassa palautusjaksona.',
    whyItWorks:
      'Treenit toistavat yksinkertaisia liikkuvuusmalleja ja hengitystyötä, joten rakennat ensin säännöllisyyden ja lisäät kierroksia vasta kun flow tuntuu luontevalta.',
    sessionFocusById: {
      mobility_reset_a: 'Yleinen liikkuvuusavaus lonkilla, venytysosuudella ja hengityslopetuksella.',
      mobility_reset_b: 'Lonkka- ja joogapainotteinen palautustreeni, jossa kokonaiskuorma pysyy hyvin kevyenä.',
    },
  },
  tpl_2_day_yoga_recovery_v1: {
    summary:
      'Kahden päivän joogapainotteinen palautusjakso liikkuvuudelle, tasapainolle, hengitykselle ja hitaammalle koko kehon liikeharjoittelulle.',
    audience:
      'Aloittelijoille, liikkuvuuspainotteisiin viikkoihin tai kenelle tahansa, joka haluaa rauhallisemman liikevaihtoehdon Vinhan sisällä.',
    equipmentProfile: 'Mattoystävällinen ja pelkällä kehonpainolla. Ohjelman ydin ei vaadi salia.',
    whyItWorks:
      'Pohja käyttää lyhyitä toistettavia sarjoja monimutkaisen sekvenssin sijaan, joten joogatavan voi rakentaa ilman täyttä studiotuntia joka kerta.',
    sessionFocusById: {
      yoga_recovery_a: 'Aurinkotervehdyksiä, tasapainotyötä ja hengitysharjoittelua.',
      yoga_recovery_b: 'Venytysvetoinen joogapäivä kevyemmällä flow-volyymilla ja palauttavalla työllä.',
    },
  },
  tpl_3_day_run_mobility_v1: {
    summary:
      'Aloittelijaystävällinen juoksu- ja palautuspohja, joka yhdistää intervallipohjaiset juoksublokit liikkuvuus- ja palautumistyöhön.',
    audience:
      'Niille, jotka haluavat yksinkertaisen juoksun aloituspisteen Vinhan nykymallissa hyppäämättä suoraan suuriin kilometrimääriin.',
    equipmentProfile: 'Minimaalinen setuppi. Juoksupäivät on rakennettu yksinkertaisiksi blokeiksi ja palautuspäivä vaatii vain lattiatilaa.',
    whyItWorks:
      'Sen sijaan että jahtaisit heti pitkiä lenkkejä, ohjelma vuorottelee kevyitä ja tempotyylisiä juoksublokkeja oman palautuspäivän kanssa, jotta jalat ja lonkat pysyvät mukana.',
    sessionFocusById: {
      run_mobility_easy: 'Kevyitä juoksublokkeja sekä pohje- ja liikkuvuustukea.',
      run_mobility_tempo: 'Tempopainotteisia intervalleja askeltyöllä ja hengityksen palautuksella.',
      run_mobility_reset: 'Liikkuvuus- ja joogapalautuspäivä juoksutreenien välissä.',
    },
  },

  tpl_4_day_ppl_plus_v1: {
    summary:
      'Nelipäiväinen PPL+1-jako, joka lisää klassiseen työntö/veto/jalat-malliin oman ylävartalotreenin viikkovolyymin kasvattamiseksi ilman kuutta treenipäivää.',
    audience:
      'Keskitason treenaajille, jotka ovat kasvaneet ulos kolmen päivän PPL:stä mutta eivät ole valmiita täyteen kuuden päivän sitoumukseen.',
    equipmentProfile: 'Vaatii täyden salin. Pohja olettaa tangon, käsipainot, taljat, ylätaljan ja laitteet läpi viikon.',
    whyItWorks:
      'Kun neljäs päivä on ylävartalon kirimispäivä eikä toinen jalkapäivä, jalat eivät ylikuormitu ja rinta, selkä ja kädet saavat merkityksellisen toisen altistuksen.',
    sessionFocusById: {
      ppl_plus_push: 'Rinta-, olkapää- ja ojentajapäivä taljaliikepäätteellä.',
      ppl_plus_pull: 'Leveä selkä, yläselkä, takaolkapää ja käsivolyymi yhdessä vetotreenissä.',
      ppl_plus_legs: 'Etureisivetoinen alavartalopäivä sarana-, takareisi-, pohje- ja keskivartalotyöllä.',
      ppl_plus_upper: 'Toinen ylävartaloaltistus vinopunnerruksella, souduilla sekä olkapää- ja käsiapuliikkeillä.',
    },
  },

  tpl_5_day_ppl_v1: {
    summary:
      'Viiden päivän PPL-jakso, jossa työntö ja veto ajetaan kahdesti viikossa ja yksi jalkapäivä sijoittuu keskelle, jotta alavartalon palautuminen pysyy siistinä.',
    audience:
      'Keskitason ja edistyneille treenaajille, jotka treenaavat viitenä päivänä viikossa ja haluavat runsasvolyymisen työntö/veto-rakenteen.',
    equipmentProfile: 'Vaatii täyden salin kaikkina viitenä päivänä. Talja- ja laitepääsy on erityisen tärkeää toisilla työntö- ja vetotreeneillä.',
    whyItWorks:
      'Työntö- ja vetomallien ajaminen kahdesti antaa ylävartalolle kaksinkertaisen altistuksen ilman toista raskasta jalkapäivää, joka veisi palautumisen.',
    sessionFocusById: {
      ppl5_push_a: 'Ensisijainen työntöpäivä tasapenkillä, pystypunnerruksella ja ojentajatyöllä.',
      ppl5_pull_a: 'Ensisijainen vetopäivä maastavedolla, tankosoudulla sekä leveän selän ja käsien volyymilla.',
      ppl5_legs: 'Täysi alavartalotreeni kyykyllä, saranalla, yhden jalan työllä ja pohkeilla.',
      ppl5_push_b: 'Toinen työntöpäivä vinopenkkiin, taljaliikkeisiin, sivuolkapäähän ja ojentajiin keskittyen.',
      ppl5_pull_b: 'Toinen vetopäivä enemmällä leveän selän ja käsien erikoistumisella taljoilla ja käsipainoilla.',
    },
  },

  tpl_5_day_upper_lower_full_v1: {
    summary:
      'Viiden päivän ohjelma, joka ajaa ylä- ja alavartalon kahdesti viikossa ja päättää viikon koko kehon treeniin lisäharjoittelua ja volyymia varten.',
    audience:
      'Keskitason treenaajille, jotka haluavat lisätä viidennen päivän tuplaamatta yhtä lihasryhmää liian aggressiivisesti.',
    equipmentProfile: 'Vaatii täyden salin. Koko kehon päivä on tarkoituksella kevyempi, joten se toimii salilla jossa on perustanko ja laitteet.',
    whyItWorks:
      'Koko kehon päivä toimii tekniikka- ja volyymipuskurina — se pitää jokaisen liikemallin viikossa kolme kertaa kuormittamatta yhtäkään niin että palautuminen kärsisi.',
    sessionFocusById: {
      ulf5_upper_a: 'Voimapainotteinen ylävartalopäivä penkillä, soudulla ja pystypunnerruksella.',
      ulf5_lower_a: 'Kyykkyvetoinen alavartalopäivä sarana-, yhden jalan ja keskivartalotuella.',
      ulf5_full: 'Maltillinen koko kehon treeni harjoitteluun ja volyymiin ilman raskasta kuormaa.',
      ulf5_upper_b: 'Volyymipainotteinen ylävartalopäivä laitepunnerruksella, taljoilla ja käsityöllä.',
      ulf5_lower_b: 'Saranavetoinen alavartalopäivä lantionnostolla, yhden jalan työllä ja pohjepäätteillä.',
    },
  },

  tpl_6_day_ppl_v1: {
    summary:
      'Klassinen kuuden päivän PPL-tupla: työntö, veto ja jalat kahdesti viikossa maksimaalisen viikkovolyymin ja -tiheyden vuoksi.',
    audience:
      'Edistyneille treenaajille, jotka palautuvat hyvin suuresta viikkovolyymista ja haluavat treeniviikkoon eniten erikoistumisaikaa.',
    equipmentProfile: 'Vaatii täyden salin kaikkina kuutena päivänä. Laitevalikoima auttaa erityisesti B-treeneissä, joissa volyymi on huipussaan.',
    whyItWorks:
      'Koko PPL-syklin ajaminen kahdesti antaa jokaiselle isolle lihasryhmälle kaksi erillistä ärsykettä viikossa yksittäisen treenin pituuden pysyessä hallittavana.',
    sessionFocusById: {
      ppl6_push_a: 'Raskas työntöpäivä tasapenkin ja pystypunnerruksen ympärillä.',
      ppl6_pull_a: 'Raskas vetopäivä tankosoudun ja lisäpainoleuanvetojen ympärillä.',
      ppl6_legs_a: 'Kyykkyvetoinen jalkapäivä romanialaisella maastavedolla ja yhden jalan apuliikkeillä.',
      ppl6_push_b: 'Volyymityöntöpäivä vinopenkillä, taljaliikkeillä, sivuolkapäällä ja ojentajaeristyksellä.',
      ppl6_pull_b: 'Volyymivetopäivä taljasouduilla, ylätaljoilla, kasvoillevedoilla ja käsierikoistumisella.',
      ppl6_legs_b: 'Saranavetoinen toinen jalkapäivä lantionnostolla, takareisikoukistuksella sekä pohje- ja keskivartalovolyymilla.',
    },
  },

  tpl_6_day_arnold_v1: {
    summary:
      'Kuusi päivää rinta/selkä-, olkapäät/kädet- ja jalkatreeniä — Arnold Schwarzeneggerin kuuluisaksi tekemä rakenne modernein kaksoisetenemisraitein.',
    audience:
      'Edistyneille treenaajille, jotka pitävät vastavaikuttajalihasten yhdistämisestä ja haluavat tiheän kehonrakennusjaon vahvalla rakenteellisella logiikalla.',
    equipmentProfile: 'Vaatii täyden salin kaikkina kuutena päivänä, erityisesti punnerruslaitteet, taljat ja täyden alavartalosetupin.',
    whyItWorks:
      'Rinnan yhdistäminen selkään ja olkapäiden käsiin antaa yhden lihaksen palautua toisen työskennellessä, mikä pitää treenin tiheyden korkeana ilman että paikallinen väsymys tappaa tehon.',
    sessionFocusById: {
      arnold_chest_back_a: 'Ensisijainen rinta/selkä-päivä penkillä, tankosoudulla sekä talja- ja ylätaljatuella.',
      arnold_shoulders_arms_a: 'Olkapää-, hauis- ja ojentajapäivä punnerruksilla, kääntöliikkeillä ja ojennusvolyymilla.',
      arnold_legs_a: 'Kyykkyvetoinen jalkapäivä saranalla, apuliikkeillä ja keskivartalotyöllä.',
      arnold_chest_back_b: 'Toinen rinta/selkä-päivä vinopunnerruksella, laitesoudulla ja takaolkapään apuliikkeillä.',
      arnold_shoulders_arms_b: 'Toinen olkapää- ja käsipäivä sivunostoilla, taljakääntöliikkeillä ja pään yli tehtävällä ojentajatyöllä.',
      arnold_legs_b: 'Saranavetoinen toinen jalkapäivä lantionnostolla, takareisikoukistuksella ja pohjepäätteillä.',
    },
  },

  tpl_focus_chest_v1: {
    summary: 'Oma rintatreeni monikulmaisella punnerruksella ja liikkeillä, jotka maksimoivat rintavolyymin yhdellä käynnillä.',
    audience: 'Parhaiten lisäpäivänä, erikoistumisjaksona tai itsenäisenä rintatreeninä omassa viikkosuunnitelmassa.',
    equipmentProfile: 'Vaatii tasa- ja vinopenkin, käsipainot ja mielellään taljan tai pec deck -laitteen.',
    whyItWorks:
      'Treeni osuu rintaan kolmesta kulmasta — tasainen, vino ja avaava — joten sekä ylä- että alaosa saavat suoraa työtä yhdessä tehokkaassa blokissa.',
    sessionFocusById: {
      focus_chest: 'Tasapenkki, vinopunnerrus, käsipainoavaus ja taljaavaus koko rinnan kattamiseksi.',
    },
  },

  tpl_focus_back_v1: {
    summary: 'Täysi selkätreeni, joka kattaa leveän selän, yläselän ja takaolkapäät veto-, soutu- ja kohautusliikkeillä.',
    audience: 'Parhaiten itsenäisenä selkäpäivänä, täydentävänä vetotreeninä tai osana omaa tiheämpää viikkoa.',
    equipmentProfile: 'Vaatii leuanveto- tai ylätaljapaikan, tanko- tai taljasoutusetupin sekä pääsyn kasvoilleveto- tai takaolkapäälaitteelle.',
    whyItWorks:
      'Pysty- ja vaakavetojen yhdistäminen takaolkapääpäätteeseen varmistaa, että kaikki kolme selän pääaluetta — leveä selkä, keskiselkä ja takaolkapää — treenataan yhdessä treenissä.',
    sessionFocusById: {
      focus_back: 'Leuanvedot, tankosoutu, taljasoutu, kasvoilleveto ja kohautus koko selän kattamiseksi.',
    },
  },

  tpl_focus_shoulders_v1: {
    summary:
      'Olkapäihin keskittyvä treeni punnerruksen sekä sivu- ja takaolkapään eristyksen ympärillä, joka lisää viikkovolyymia ylikuormittamatta työntöpäiviä.',
    audience:
      'Treenaajille, jotka haluavat lisää olkapäiden kehitystä nykyisen ohjelman päälle tai kohdennetun olkapääpäivän omaan jakoon.',
    equipmentProfile: 'Vaatii käsipainot, tanko- tai laitepunnerrusvaihtoehdon sekä talja- tai laitepääsyn takaolkapäätyöhön.',
    whyItWorks:
      'Punnerruksen erottaminen eristyksestä antaa sivu- ja takaolkapäille suoraa työtä sen sijaan että ne luottaisivat rintapäivien sivuvaikutukseen.',
    sessionFocusById: {
      focus_shoulders: 'Pystypunnerrus, sivunostot, kasvoillevedot ja takaolkapään avaus koko olkapään kattamiseksi.',
    },
  },

  tpl_focus_arms_v1: {
    summary:
      'Itsenäinen käsitreeni hauiskääntöjen ja ojentajaojennusten kanssa useista kulmista suoraa käsikehitystä varten.',
    audience:
      'Treenaajille, jotka haluavat lisää käsivolyymia työntö- ja vetopäivien päälle, tai kenelle tahansa joka ajaa omaa käsipäivää.',
    equipmentProfile: 'Vaatii käsipainot, tangon tai EZ-tangon sekä taljapääsyn kääntöihin ja pushdowneihin.',
    whyItWorks:
      'Suora hauis- ja ojentajatyö samassa treenissä pitää treenin lyhyenä ja varmistaa silti että molemmat lihasryhmät saavat kasvuun riittävän ärsykkeen.',
    sessionFocusById: {
      focus_arms: 'Tankokääntö, käsipainokääntö, ojentajapushdown ja skull crusher täydelle käsivolyymille.',
    },
  },

  tpl_focus_legs_v1: {
    summary:
      'Täydellinen jalkatreeni etureisi-, takareisi-, pakara- ja pohjetyöllä, joka rakentaa alavartalon volyymia yhdellä omistetulla käynnillä.',
    audience: 'Parhaiten itsenäisenä jalkapäivänä, lisätreeninä tai alavartalon ankkurina omassa jaossa.',
    equipmentProfile: 'Vaatii kyykkytelineen, jalkaprässin, takareisikoukistuslaitteen ja pohjenostopaikan.',
    whyItWorks:
      'Treeni ajaa kyykky-, sarana- ja yhden jalan mallit ennen eristystä, mikä vastaa parasta väsymysjärjestystä alavartalon moninivelliikkeille.',
    sessionFocusById: {
      focus_legs: 'Takakyykky, romanialainen maastaveto, jalkaprässi, takareisikoukistus ja pohjenostot koko alavartalolle.',
    },
  },

  tpl_focus_glutes_v1: {
    summary:
      'Pakaroihin keskittyvä treeni lantionnoston, taljapotkun ja romanialaisen maastavedon ympärillä kohdennettuun takaketjun kehitykseen.',
    audience:
      'Treenaajille, jotka haluavat enemmän pakaravolyymia kuin tavalliset jalkapäivät antavat, tai kenelle tahansa pakaroiden erikoistumisjaksolla.',
    equipmentProfile: 'Vaatii lantionnostopenkin tai vakaan alustan, taljalaitteen ja mahdollisuuden romanialaiseen maastavetoon.',
    whyItWorks:
      'Treeni priorisoi lonkan ojennusmalleja, jotka kuormittavat pakaroita pitkässä lihaspituudessa — tutkimusten mukaan se tuottaa enemmän kasvua kuin pelkkä moninivelliikkeiden sivuvaikutus.',
    sessionFocusById: {
      focus_glutes: 'Lantionnosto, romanialainen maastaveto, taljapotku ja sumokyykky täydelle pakaratyölle.',
    },
  },

  tpl_shred_v1: {
    summary:
      'Kolme koko kehon treeniä, jotka yhdistävät moninivelnostot oikeisiin kuntopäätteisiin — rakennettu rasvanpudotukseen lihasta säilyttäen.',
    audience: 'Kenelle tahansa, jonka päätavoite on rasvanpudotus ja joka haluaa voimatyön ja kunnon samalle käynnille.',
    equipmentProfile: 'Suositellaan täyttä salia: tanko, laitteet, kahvakuula sekä juoksumatto tai pyörä päätteisiin.',
    whyItWorks:
      'Raskaat perusliikkeet suojaavat lihasta kalorivajeessa, ja joka treeni päättyy intervallipäätteeseen joka lisää oikeaa energiankulutusta — nimi toimii vain koska kunto on oikeasti mukana suunnitelmassa.',
    sessionFocusById: {
      shred_day1: 'Kyykky- ja punnerruspohja kahvakuulaheilautuksilla ja juoksumatto-HIIT-päätteellä.',
      shred_day2: 'Saranavetoinen koko keho burpee-kierrospäätteellä.',
      shred_day3: 'Laitevetoinen koko keho kantoliikkeillä ja pyöräintervallipäätteellä.',
    },
  },

  tpl_huge_starter_v1: {
    summary: 'Kaksi tehokasta koko kehon treeniä, jotka rakentavat lihasta pienimmällä mahdollisella viikkokitkalla.',
    audience: 'Uusille treenaajille, jotka haluavat kasvattaa lihasta kahtena salipäivänä viikossa ilman monimutkaista jakoa.',
    equipmentProfile: 'Suositellaan täyttä salia: penkki, jalkaprässi, taljapaikat ja käsipainot.',
    whyItWorks:
      'Jokainen iso lihas treenataan kahdesti viikossa moninivelliikkeillä, ja lyhyet treenit pitävät säännöllisyyden korkealla — aloittelijan kasvun tärkein tekijä.',
    sessionFocusById: {
      huge_starter_day1: 'Työntöpainotteinen koko keho: penkki, jalkaprässi ja ylätalja olkapää- ja ojentajapäätteillä.',
      huge_starter_day2: 'Vetopainotteinen koko keho: sarana, soutu ja laitepunnerrus käsi- ja keskivartalopäätteillä.',
    },
  },

  tpl_focus_chest_program_v1: {
    summary:
      'Kolmen päivän erikoistumisjakso, jossa rinta treenataan kahdesti viikossa muun kehon pysyessä ylläpitovolyymilla.',
    audience: 'Keskitason treenaajille, joiden rinta laahaa perässä ja jotka voivat sitoutua kolmeen päivään viikossa.',
    equipmentProfile: 'Vaatii täyden salin: tasa- ja vinopenkki, laitteet, käsipainot ja taljat.',
    whyItWorks:
      'Rinnan tiheyden tuplaaminen raskaalla ja volyymipäivällä ajaa kasvua, ja yksi ylläpitopäivä estää selkää ja jalkoja taantumasta.',
    sessionFocusById: {
      focusp_chest_day1: 'Raskas rintapäivä tasapenkin ympärillä vino- ja avaustuella.',
      focusp_chest_day2: 'Ylläpitopäivä selälle ja jaloille, jotta muu keho pitää pintansa.',
      focusp_chest_day3: 'Volyymirintapäivä: vinopenkki ensin, sitten laitepunnerrus ja avaukset.',
    },
  },

  tpl_focus_back_program_v1: {
    summary:
      'Kolmen päivän erikoistumisjakso, jossa selkä treenataan kahdesti viikossa punnerruksen ja jalkojen pysyessä ylläpitovolyymilla.',
    audience: 'Keskitason treenaajille, jotka haluavat leveämmän ja paksumman selän ja voivat treenata kolmesti viikossa.',
    equipmentProfile: 'Vaatii täyden salin: tanko, ylätalja- ja soutupaikat sekä taljat.',
    whyItWorks:
      'Raskas soutupäivä ja ylätaljavetoinen volyymipäivä tuplaavat selän viikkoärsykkeen, ja yksi koko kehon ylläpitopäivä suojaa muuta edistymistä.',
    sessionFocusById: {
      focusp_back_day1: 'Raskas selkäpäivä tankosoudun ympärillä ylätalja- ja soututuella.',
      focusp_back_day2: 'Ylläpitopäivä punnerrukselle ja jaloille.',
      focusp_back_day3: 'Volyymiselkäpäivä: ylätalja ensin, sitten talja- ja rintatuetut soudut.',
    },
  },

  tpl_focus_arms_program_v1: {
    summary: 'Kolmen päivän erikoistumisjakso kahdella suoralla käsipäivällä ja yhdellä koko kehon ylläpitopäivällä.',
    audience: 'Keskitason treenaajille, joiden kädet laahaavat rinnan ja selän kehityksen perässä.',
    equipmentProfile: 'Vaatii täyden salin: tanko, EZ-tanko tai käsipainot ja taljapaikat.',
    whyItWorks:
      'Kädet palautuvat nopeasti, joten hauiksen ja ojentajan suora treenaaminen kahdesti viikossa lisää oikeaa volyymia varastamatta palautumista muulta viikolta.',
    sessionFocusById: {
      focusp_arms_day1: 'Raskas käsipäivä: kapea penkki ja tankokääntö ankkureina.',
      focusp_arms_day2: 'Koko kehon ylläpitopäivä jaloille, selälle ja olkapäille.',
      focusp_arms_day3: 'Volyymikäsipäivä: pushdownit, saarnaajakäännöt ja eristyspäätteet.',
    },
  },

  tpl_focus_legs_program_v1: {
    summary:
      'Kolmen päivän erikoistumisjakso, jossa jalat treenataan kahdesti viikossa — yksi raskas kyykkypäivä, yksi volyymipäivä — ja yksi ylävartalon ylläpitopäivä.',
    audience: 'Keskitason treenaajille, jotka haluavat tosissaan alavartalon kasvua ja palautuvat kahdesta kovasta jalkapäivästä.',
    equipmentProfile: 'Vaatii täyden salin: kyykkyteline, hack squat tai jalkaprässi, takareisikoukistuslaite ja pohjepaikka.',
    whyItWorks:
      'Kyykkyvetoinen raskas työ ja laitevetoinen volyymityö tuplaavat viikon kasvuärsykkeen, ja ylävartalopäivä estää punnerrusta ja vetoa liukumasta taaksepäin.',
    sessionFocusById: {
      focusp_legs_day1: 'Raskas jalkapäivä takakyykyn ympärillä sarana- ja punnerrustuella.',
      focusp_legs_day2: 'Ylävartalon ylläpitopäivä.',
      focusp_legs_day3: 'Volyymijalkapäivä: hack squat, bulgarialaiset askelkyykyt ja lantionnosto.',
    },
  },

  tpl_focus_glutes_program_v1: {
    summary:
      'Kolmen päivän erikoistumisjakso kahdella pakaravetoisella alavartalopäivällä ja yhdellä ylävartalon ylläpitopäivällä.',
    audience: 'Treenaajille, joille pakaroiden kasvu on seuraavan jakson selkeä ykkösprioriteetti.',
    equipmentProfile: 'Vaatii täyden salin: lantionnostosetuppi, kyykkyteline tai jalkaprässi ja takareisikoukistuslaite.',
    whyItWorks:
      'Lantionnosto- ja saranamallit kuormittavat pakaroita suoraan kahdesti viikossa, ja kyykky- ja askelkyykkyvariaatiot lisäävät ärsykettä toisesta kulmasta.',
    sessionFocusById: {
      focusp_glutes_day1: 'Raskas pakarapäivä lantionnoston ympärillä sarana- ja askelkyykkytuella.',
      focusp_glutes_day2: 'Ylävartalon ylläpitopäivä.',
      focusp_glutes_day3: 'Volyymipakarapäivä: kyykky, lantionnosto ja askelkyykyt peräkkäin.',
    },
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
  sessionFocusById: {},
};
