import { AppLanguage } from '../types/models';

/**
 * App copy dictionaries. English is the source of truth; every key must exist
 * in `en`, and `t` falls back to it so a missing translation can never render
 * an empty string. Coverage grows surface by surface — Welcome first (that is
 * where the language choice lives), then tabs + Home, and outward from there.
 *
 * Templates use `{name}` placeholders resolved by `t(lang, key, vars)`.
 * Exercise names, program catalog titles, and AI responses are data, not UI
 * copy — they stay in English.
 */
const EN = {
  // ── Welcome ────────────────────────────────────────────────────────────
  'welcome.tagline': 'You go to the gym.\nWe handle the rest.',
  'welcome.feature.plans.title': 'AI-built plans',
  'welcome.feature.plans.body': 'Smart programs built for you.',
  'welcome.feature.adaptive.title': 'Adaptive',
  'welcome.feature.adaptive.body': 'We adjust as you improve.',
  'welcome.feature.recovery.title': 'Recovery aware',
  'welcome.feature.recovery.body': 'Optimized training & rest.',
  'welcome.continueGoogle': 'Continue with Google',
  'welcome.continueApple': 'Continue with Apple',
  'welcome.or': 'or',
  'welcome.signUpEmail': 'Sign up with email',
  'welcome.haveAccount': 'I already have an account',

  // ── Bottom tab bar (accessibility labels — the bar is icon-only) ───────
  'tabs.home': 'Home',
  'tabs.programs': 'Programs',
  'tabs.progress': 'Progress',
  'tabs.profile': 'Profile',
  'tabs.aiSession': 'AI session',

  // ── Home ───────────────────────────────────────────────────────────────
  'home.greeting.title': 'Welcome back',
  'home.greeting.subtitle': "Let's get after it today.",
  'home.a11y.openPro': 'Open GAINER Pro',
  'home.a11y.expandCalendar': 'Expand month calendar',
  'home.a11y.collapseCalendar': 'Collapse month calendar',
  'home.a11y.expandSection': 'Expand {title}',
  'home.a11y.collapseSection': 'Collapse {title}',
  'home.a11y.adaptSession': "Adapt today's session",
  'home.a11y.startSession': "Start today's workout",
  'home.a11y.startEmptyWorkout': 'Start empty workout',
  'home.a11y.openCardio': 'Open cardio workouts',
  'home.calendar.training': 'Training',
  'home.calendar.recovery': 'Recovery',
  'home.hero.sessionsProgress': '{done} of {total} sessions',
  'home.section.warmup': 'Warmup',
  'home.section.workout': 'Workout',
  'home.section.cooldown': 'Cooldown',
  'home.section.warmupMeta': '{count} drills · {min} min',
  'home.section.workoutMeta': '{count} exercises · {sets} sets',
  'home.section.cooldownMeta': '{count} stretches · {min} min',
  'home.section.more': '+ {count} more',
  'home.adapt': 'Adapt',
  'home.startWorkout': 'Start workout',
  'home.emptyWorkout.title': 'Empty workout',
  'home.emptyWorkout.meta': 'Log freestyle',
  'home.cardio.title': 'Cardio',
  'home.cardio.meta': 'Runs, cycles & walks',
  'home.history.title': 'History',
  'home.history.seeAll': 'See all',

  // ── Home · Adapt sheet ─────────────────────────────────────────────────
  'home.adaptSheet.title': 'Adapt session',
  'home.adaptSheet.subtitle': "Tweak today's session — your plan stays on track.",
  'home.adaptSheet.shorter.title': 'Shorter session',
  'home.adaptSheet.shorter.sub': 'Trim to ~{min} min · drops {sets} sets',
  'home.adaptSheet.equipment.title': 'Change equipment',
  'home.adaptSheet.equipment.sub': 'Rack taken? Swap to dumbbells',
  'home.adaptSheet.swap.title': 'Swap an exercise',
  'home.adaptSheet.swap.sub': 'Replace any lift with an alternative',
  'home.adaptSheet.energy.title': 'Feeling low energy',
  'home.adaptSheet.energy.sub': 'Lighter loads, same movements',
  'home.adaptSheet.cancel': 'Cancel',

  // ── Home · Pro sheet (placeholder marketing copy) ──────────────────────
  'home.proSheet.badge': '✦ GAINER PRO',
  'home.proSheet.headline': "Train like it's personal.",
  'home.proSheet.subline': 'Your plan adapts every session — with a coach that actually knows your numbers.',
  'home.proSheet.stat.consistency': 'more consistent training',
  'home.proSheet.stat.strength': 'avg. strength in 12 wks',
  'home.proSheet.stat.aiQuestions': 'AI coach questions',
  'home.proSheet.whatYouGet': 'What you get',
  'home.proSheet.free': 'FREE',
  'home.proSheet.pro': 'PRO',
  'home.proSheet.row.log': 'Log workouts & plans',
  'home.proSheet.row.coach': 'AI Coach conversations',
  'home.proSheet.row.analytics': 'Advanced progress analytics',
  'home.proSheet.row.plans': 'Unlimited plans & templates',
  'home.proSheet.row.earlyAccess': 'Early access to new features',
  'home.proSheet.annual': 'Annual',
  'home.proSheet.monthly': 'Monthly',
  'home.proSheet.perMonth': '/mo',
  'home.proSheet.annualNote': '€59.99 billed yearly',
  'home.proSheet.monthlyNote': 'billed monthly',
  'home.proSheet.saveBadge': 'SAVE 40%',
  'home.proSheet.annualFinePrint': '7 days free, then €59.99/year. Cancel anytime.',
  'home.proSheet.monthlyFinePrint': '7 days free, then €8.99/month. Cancel anytime.',
  'home.proSheet.a11y.choosePlan': 'Choose {title} plan',
  'home.proSheet.cta': 'Start 7-day free trial',
  'home.proSheet.notNow': 'Not now',

  // ── Home · Your cards ──────────────────────────────────────────────────
  'cards.title': 'Your cards',
  'cards.edit': 'Edit',
  'cards.done': 'Done',
  'cards.noData': 'No data yet',
  'cards.previous': 'Previous {value} {unit}',
  'cards.firstEntry': 'First entry',
  'cards.addCard': 'Add card',
  'cards.addSheet.title': 'Add a card',
  'cards.addSheet.subtitle': 'Pin the stats you care about to your home screen. Remove any anytime.',
  'cards.addSheet.empty': 'All cards added. Remove one to swap it out.',
  'cards.a11y.open': 'Open {label}',
  'cards.a11y.remove': 'Remove {label}',
  'cards.a11y.add': 'Add {label}',
  'cards.bodyweight': 'Body weight',
  'cards.bodyfat': 'Body fat',
  'cards.waist': 'Waist',

  // ── Home · default warmup/cooldown drills ──────────────────────────────
  'home.drill.rowingMachine': 'Rowing machine',
  'home.drill.hipOpeners': 'Hip openers',
  'home.drill.emptyBarSquats': 'Empty-bar squats',
  'home.drill.bandPullAparts': 'Band pull-aparts',
  'home.drill.pushUps': 'Push-ups',
  'home.drill.scapularPullUps': 'Scapular pull-ups',
  'home.drill.bandFacePulls': 'Band face pulls',
  'home.drill.chestDoorwayStretch': 'Chest doorway stretch',
  'home.drill.tricepsOverheadStretch': 'Triceps overhead stretch',
  'home.drill.latStretchOnRack': 'Lat stretch on rack',
  'home.drill.deadHang': 'Dead hang',
  'home.drill.couchStretch': 'Couch stretch',
} as const;

export type I18nKey = keyof typeof EN;

const FI: Record<I18nKey, string> = {
  // ── Welcome ────────────────────────────────────────────────────────────
  'welcome.tagline': 'Sinä käyt salilla.\nMe hoidamme loput.',
  'welcome.feature.plans.title': 'Tekoälyn ohjelmat',
  'welcome.feature.plans.body': 'Fiksut ohjelmat juuri sinulle.',
  'welcome.feature.adaptive.title': 'Mukautuva',
  'welcome.feature.adaptive.body': 'Säädämme kun kehityt.',
  'welcome.feature.recovery.title': 'Palautuminen',
  'welcome.feature.recovery.body': 'Optimoitu treeni ja lepo.',
  'welcome.continueGoogle': 'Jatka Googlella',
  'welcome.continueApple': 'Jatka Applella',
  'welcome.or': 'tai',
  'welcome.signUpEmail': 'Luo tili sähköpostilla',
  'welcome.haveAccount': 'Minulla on jo tili',

  // ── Bottom tab bar ─────────────────────────────────────────────────────
  'tabs.home': 'Koti',
  'tabs.programs': 'Ohjelmat',
  'tabs.progress': 'Kehitys',
  'tabs.profile': 'Profiili',
  'tabs.aiSession': 'AI-sessio',

  // ── Home ───────────────────────────────────────────────────────────────
  'home.greeting.title': 'Tervetuloa takaisin',
  'home.greeting.subtitle': 'Tänään treenataan.',
  'home.a11y.openPro': 'Avaa GAINER Pro',
  'home.a11y.expandCalendar': 'Laajenna kuukausikalenteri',
  'home.a11y.collapseCalendar': 'Pienennä kuukausikalenteri',
  'home.a11y.expandSection': 'Laajenna {title}',
  'home.a11y.collapseSection': 'Pienennä {title}',
  'home.a11y.adaptSession': 'Mukauta tämän päivän treeniä',
  'home.a11y.startSession': 'Aloita tämän päivän treeni',
  'home.a11y.startEmptyWorkout': 'Aloita tyhjä treeni',
  'home.a11y.openCardio': 'Avaa cardiotreenit',
  'home.calendar.training': 'Treeni',
  'home.calendar.recovery': 'Lepo',
  'home.hero.sessionsProgress': '{done}/{total} treeniä',
  'home.section.warmup': 'Lämmittely',
  'home.section.workout': 'Treeni',
  'home.section.cooldown': 'Jäähdyttely',
  'home.section.warmupMeta': '{count} liikettä · {min} min',
  'home.section.workoutMeta': '{count} liikettä · {sets} sarjaa',
  'home.section.cooldownMeta': '{count} venytystä · {min} min',
  'home.section.more': '+ {count} lisää',
  'home.adapt': 'Mukauta',
  'home.startWorkout': 'Aloita treeni',
  'home.emptyWorkout.title': 'Tyhjä treeni',
  'home.emptyWorkout.meta': 'Kirjaa vapaasti',
  'home.cardio.title': 'Cardio',
  'home.cardio.meta': 'Juoksut, pyöräilyt & kävelyt',
  'home.history.title': 'Historia',
  'home.history.seeAll': 'Näytä kaikki',

  // ── Home · Adapt sheet ─────────────────────────────────────────────────
  'home.adaptSheet.title': 'Mukauta treeniä',
  'home.adaptSheet.subtitle': 'Säädä tämän päivän treeniä — suunnitelmasi pysyy raiteillaan.',
  'home.adaptSheet.shorter.title': 'Lyhyempi treeni',
  'home.adaptSheet.shorter.sub': 'Lyhennä ~{min} min · pudottaa {sets} sarjaa',
  'home.adaptSheet.equipment.title': 'Vaihda välineet',
  'home.adaptSheet.equipment.sub': 'Räkki varattu? Vaihda käsipainoihin',
  'home.adaptSheet.swap.title': 'Vaihda liike',
  'home.adaptSheet.swap.sub': 'Korvaa mikä tahansa liike vaihtoehdolla',
  'home.adaptSheet.energy.title': 'Vähän virtaa tänään',
  'home.adaptSheet.energy.sub': 'Kevyemmät kuormat, samat liikkeet',
  'home.adaptSheet.cancel': 'Peruuta',

  // ── Home · Pro sheet ───────────────────────────────────────────────────
  'home.proSheet.badge': '✦ GAINER PRO',
  'home.proSheet.headline': 'Treenaa kuin se olisi tehty sinulle.',
  'home.proSheet.subline': 'Suunnitelmasi mukautuu joka treenissä — valmentajalla, joka oikeasti tuntee lukusi.',
  'home.proSheet.stat.consistency': 'säännöllisempää treeniä',
  'home.proSheet.stat.strength': 'keskim. voimaa 12 viikossa',
  'home.proSheet.stat.aiQuestions': 'AI-valmentajan kysymystä',
  'home.proSheet.whatYouGet': 'Mitä saat',
  'home.proSheet.free': 'FREE',
  'home.proSheet.pro': 'PRO',
  'home.proSheet.row.log': 'Kirjaa treenit & suunnitelmat',
  'home.proSheet.row.coach': 'AI-valmentajan keskustelut',
  'home.proSheet.row.analytics': 'Edistynyt kehitysanalytiikka',
  'home.proSheet.row.plans': 'Rajattomat suunnitelmat & pohjat',
  'home.proSheet.row.earlyAccess': 'Uudet ominaisuudet ensimmäisenä',
  'home.proSheet.annual': 'Vuosi',
  'home.proSheet.monthly': 'Kuukausi',
  'home.proSheet.perMonth': '/kk',
  'home.proSheet.annualNote': '59,99 € laskutetaan vuosittain',
  'home.proSheet.monthlyNote': 'laskutetaan kuukausittain',
  'home.proSheet.saveBadge': 'SÄÄSTÄ 40 %',
  'home.proSheet.annualFinePrint': '7 päivää ilmaiseksi, sitten 59,99 €/vuosi. Peru milloin vain.',
  'home.proSheet.monthlyFinePrint': '7 päivää ilmaiseksi, sitten 8,99 €/kk. Peru milloin vain.',
  'home.proSheet.a11y.choosePlan': 'Valitse {title}-tilaus',
  'home.proSheet.cta': 'Aloita 7 päivän ilmainen kokeilu',
  'home.proSheet.notNow': 'Ei nyt',

  // ── Home · Your cards ──────────────────────────────────────────────────
  'cards.title': 'Omat kortit',
  'cards.edit': 'Muokkaa',
  'cards.done': 'Valmis',
  'cards.noData': 'Ei vielä dataa',
  'cards.previous': 'Edellinen {value} {unit}',
  'cards.firstEntry': 'Ensimmäinen merkintä',
  'cards.addCard': 'Lisää kortti',
  'cards.addSheet.title': 'Lisää kortti',
  'cards.addSheet.subtitle': 'Kiinnitä tärkeimmät tilastot kotinäytölle. Poista milloin vain.',
  'cards.addSheet.empty': 'Kaikki kortit lisätty. Poista yksi vaihtaaksesi.',
  'cards.a11y.open': 'Avaa {label}',
  'cards.a11y.remove': 'Poista {label}',
  'cards.a11y.add': 'Lisää {label}',
  'cards.bodyweight': 'Kehonpaino',
  'cards.bodyfat': 'Rasvaprosentti',
  'cards.waist': 'Vyötärö',

  // ── Home · default warmup/cooldown drills ──────────────────────────────
  'home.drill.rowingMachine': 'Soutulaite',
  'home.drill.hipOpeners': 'Lonkan avaukset',
  'home.drill.emptyBarSquats': 'Kyykyt tyhjällä tangolla',
  'home.drill.bandPullAparts': 'Kuminauhan levitykset',
  'home.drill.pushUps': 'Punnerrukset',
  'home.drill.scapularPullUps': 'Lapaleuanvedot',
  'home.drill.bandFacePulls': 'Kuminauhavedot kasvoille',
  'home.drill.chestDoorwayStretch': 'Rintalihasvenytys ovensuussa',
  'home.drill.tricepsOverheadStretch': 'Ojentajavenytys pään yli',
  'home.drill.latStretchOnRack': 'Leveän selän venytys räkissä',
  'home.drill.deadHang': 'Roikunta tangossa',
  'home.drill.couchStretch': 'Lonkankoukistajan venytys',
};

const STRINGS: Record<AppLanguage, Record<I18nKey, string>> = {
  en: EN,
  fi: FI,
};

/** Every key in the source-of-truth dictionary, for coverage tests. */
export const I18N_KEYS = Object.keys(EN) as I18nKey[];

export function t(
  language: AppLanguage,
  key: I18nKey,
  vars?: Record<string, string | number>,
): string {
  const template = STRINGS[language]?.[key] ?? EN[key];
  if (!vars) {
    return template;
  }
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match,
  );
}

export const SUPPORTED_LANGUAGES: Array<{ key: AppLanguage; label: string; flag: string }> = [
  { key: 'fi', label: 'FIN', flag: '🇫🇮' },
  { key: 'en', label: 'ENG', flag: '🇬🇧' },
];
