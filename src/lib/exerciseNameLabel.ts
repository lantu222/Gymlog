import { AppLanguage } from '../types/models';

/**
 * Exercise names are stored, matched and filtered as their English text — the
 * library ships from a public English database and the program catalogs name
 * their lifts the same way. So the English name stays the id and only the
 * label moves, exactly like equipment items and caution refinements.
 *
 * The map covers every exercise the program catalogs actually prescribe plus
 * the common library lifts a user meets while browsing. Anything else passes
 * through in English rather than guessing at a translation, which keeps a
 * missing entry honest instead of wrong.
 */
const EXERCISE_NAME_FI: Record<string, string> = {
  // ── Squat pattern ────────────────────────────────────────────────────
  'Back Squat': 'Takakyykky',
  'Barbell Squat': 'Takakyykky',
  'Barbell Full Squat': 'Takakyykky',
  'Front Squat': 'Etukyykky',
  'Hack Squat': 'Hack squat',
  'Box Squat': 'Laatikkokyykky',
  'Chair Squat': 'Tuolikyykky',
  'Bodyweight Squat': 'Kehonpainokyykky',
  'Goblet Squat': 'Goblet-kyykky',
  'Bulgarian Split Squat': 'Bulgarialainen askelkyykky',
  'Barbell Side Split Squat': 'Sivuaskelkyykky tangolla',
  'Sumo Squat': 'Sumokyykky',
  'Leg Press': 'Jalkaprässi',
  'Wall Sit': 'Seinäistunta',

  // ── Hinge pattern ────────────────────────────────────────────────────
  Deadlift: 'Maastaveto',
  'Barbell Deadlift': 'Maastaveto',
  'Romanian Deadlift': 'Romanialainen maastaveto',
  'Trap Bar Deadlift': 'Trap bar -maastaveto',
  'Sumo Deadlift': 'Sumomaastaveto',
  'Stiff-Legged Deadlift': 'Suorin jaloin maastaveto',
  'Good Morning': 'Aamunavaus',
  'Hip Thrust': 'Lantionnosto',
  'Barbell Hip Thrust': 'Lantionnosto tangolla',
  'Glute Bridge': 'Lantionnosto lattialla',
  'Kettlebell Swing': 'Kahvakuulaheilautus',
  'One-Arm Kettlebell Swings': 'Yhden käden kahvakuulaheilautus',
  'Cable Kickback': 'Taljapotku',

  // ── Lunges and single leg ────────────────────────────────────────────
  Lunge: 'Askelkyykky',
  'Walking Lunge': 'Kävelevä askelkyykky',
  'Bodyweight Walking Lunge': 'Kävelevä askelkyykky kehonpainolla',
  'Reverse Lunge': 'Taakse astuva askelkyykky',
  'Step-Up': 'Askelnousu',
  'Step-up with Knee Raise': 'Askelnousu polvennostolla',

  // ── Horizontal press ─────────────────────────────────────────────────
  'Bench Press': 'Penkkipunnerrus',
  'Barbell Bench Press - Medium Grip': 'Penkkipunnerrus',
  'Dumbbell Bench Press': 'Penkkipunnerrus käsipainoilla',
  'Incline Bench Press': 'Vinopenkkipunnerrus',
  'Barbell Incline Bench Press - Medium Grip': 'Vinopenkkipunnerrus',
  'Incline Dumbbell Press': 'Vinopenkkipunnerrus käsipainoilla',
  'Decline Bench Press': 'Laskeva penkkipunnerrus',
  'Close-Grip Bench Press': 'Kapea penkkipunnerrus',
  'Machine Chest Press': 'Rintaprässi',
  'Push-Up': 'Punnerrus',
  Pushups: 'Punnerrus',
  'Push-Up Wide': 'Leveä punnerrus',
  'Incline Push-Up': 'Vinopunnerrus',
  'Decline Push-Up': 'Laskeva punnerrus',
  Dips: 'Dipit',
  'Chest Dip': 'Rintadippi',

  // ── Vertical press ───────────────────────────────────────────────────
  'Overhead Press': 'Pystypunnerrus',
  'Standing Military Press': 'Pystypunnerrus',
  'Dumbbell Shoulder Press': 'Pystypunnerrus käsipainoilla',
  'Arnold Press': 'Arnold-punnerrus',
  'Push Press': 'Työntöpunnerrus',
  'Handstand Push-Ups': 'Käsilläseisontapunnerrus',

  // ── Chest isolation ──────────────────────────────────────────────────
  'Cable Fly': 'Taljaristikkäisveto',
  'Dumbbell Fly': 'Vipunosto rinnalle',
  // The pools spell it plural; the lookup is exact, so both spellings need an entry.
  'Dumbbell Flyes': 'Vipunosto rinnalle',
  'Pec Deck': 'Pec deck',

  // ── Vertical pull ────────────────────────────────────────────────────
  'Pull-Up': 'Leuanveto',
  Pullups: 'Leuanveto',
  'Chin-Up': 'Myötäotteinen leuanveto',
  Chinups: 'Myötäotteinen leuanveto',
  'Scapular Pull-Up': 'Lapaleuanveto',
  'Lat Pulldown': 'Ylätalja',
  'Wide-Grip Lat Pulldown': 'Leveä ylätalja',
  'Close-Grip Front Lat Pulldown': 'Kapea ylätalja',

  // ── Horizontal pull ──────────────────────────────────────────────────
  'Barbell Row': 'Tankosoutu',
  'Bent Over Barbell Row': 'Tankosoutu',
  'Dumbbell Row': 'Käsipainosoutu',
  'One-Arm Dumbbell Row': 'Yhden käden käsipainosoutu',
  'Seated Cable Row': 'Istuen taljasoutu',
  'Chest-Supported Row': 'Rintatuettu soutu',
  'T-Bar Row': 'T-tankosoutu',
  'Inverted Row': 'Kehonpainosoutu',
  'Face Pull': 'Kasvoilleveto',
  Shrug: 'Kohautus',
  'Barbell Shrug': 'Kohautus tangolla',

  // ── Shoulders ────────────────────────────────────────────────────────
  'Lateral Raise': 'Sivunosto',
  'Side Lateral Raise': 'Sivunosto',
  'Front Raise': 'Etunosto',
  'Rear Delt Fly': 'Takaolkapään vipunosto',
  'Reverse Machine Flyes': 'Takaolkapään laitevipunosto',
  'Band Pull Apart': 'Kuminauhan levitys',
  'Upright Row': 'Pystysoutu',

  // ── Biceps ───────────────────────────────────────────────────────────
  'Barbell Curl': 'Hauiskääntö tangolla',
  'Dumbbell Curl': 'Hauiskääntö käsipainoilla',
  'Dumbbell Bicep Curl': 'Hauiskääntö käsipainoilla',
  'Hammer Curl': 'Vasarakääntö',
  'Preacher Curl': 'Saarnaajakääntö',
  'Cable Curl': 'Taljakääntö',
  'Concentration Curls': 'Keskittymiskääntö',

  // ── Triceps ──────────────────────────────────────────────────────────
  'Triceps Pushdown': 'Ojentajapushdown',
  'Triceps Pushdown - Rope Attachment': 'Ojentajapushdown köydellä',
  'Overhead Triceps Extension': 'Ojentajapunnerrus pään yli',
  'Skull Crusher': 'Ranskalainen punnerrus',
  'Lying Triceps Press': 'Ranskalainen punnerrus',
  'Bench Dip': 'Penkkidippi',
  'Bench Dips': 'Penkkidippi',

  // ── Legs isolation ───────────────────────────────────────────────────
  'Leg Curl': 'Takareisikoukistus',
  'Seated Leg Curl': 'Istuen takareisikoukistus',
  'Lying Leg Curl': 'Maaten takareisikoukistus',
  'Leg Extension': 'Reiden ojennus',
  'Calf Raise': 'Pohjenosto',
  'Standing Calf Raise': 'Seisten pohjenosto',
  'Seated Calf Raise': 'Istuen pohjenosto',
  'Calf Press': 'Pohjeprässi',

  // ── Core ─────────────────────────────────────────────────────────────
  Plank: 'Lankku',
  'Side Plank': 'Kylkilankku',
  'Cable Crunch': 'Taljavatsarutistus',
  Crunches: 'Vatsarutistus',
  'Hanging Knee Raise': 'Roikkuen polvennosto',
  'Hanging Leg Raise': 'Roikkuen jalannosto',
  'Russian Twist': 'Venäläinen kierto',
  'Ab Wheel': 'Vatsarulla',
  'Mountain Climbers': 'Vuorikiipeilijä',
  'Mountain Climber': 'Vuorikiipeilijä',
  'Bicycle Crunch': 'Polkupyörärutistus',
  'Farmer Carry': 'Maanviljelijän kävely',

  // ── Conditioning and flows (catalog-only names) ──────────────────────
  Burpee: 'Burpee',
  'Treadmill HIIT (30s on / 30s off)': 'Juoksumatto-HIIT (30 s / 30 s)',
  'Bike HIIT (45s sprint / 15s rest)': 'Pyörä-HIIT (45 s veto / 15 s lepo)',
  'Easy Run Blocks': 'Kevyet juoksublokit',
  'Tempo Run Blocks': 'Tempojuoksublokit',
  'Stride Finishers': 'Askelkiihdytykset',
  'Rowing, Stationary': 'Soutulaite',
  'Bicycling, Stationary': 'Kuntopyörä',
  'Jump Rope': 'Hyppynaru',
  'Mobility Flow': 'Liikkuvuussarja',
  'Hip Mobility Flow': 'Lonkan liikkuvuussarja',
  'Recovery Stretch Flow': 'Palauttava venyttelysarja',
  'Sun Salutation Flow': 'Aurinkotervehdys',
  'Yoga Balance Flow': 'Joogan tasapainosarja',
  'Breath Reset': 'Hengityspalautus',
  'Dead Hang': 'Roikunta tangossa',
};

/** The exercise name as the reader should see it; English is the stored id. */
export function exerciseNameLabel(language: AppLanguage, name: string): string {
  if (language !== 'fi') {
    return name;
  }
  return EXERCISE_NAME_FI[name.trim()] ?? name;
}

/** Exposed for the coverage test — every catalog lift should have an entry. */
export const TRANSLATED_EXERCISE_NAMES = EXERCISE_NAME_FI;
