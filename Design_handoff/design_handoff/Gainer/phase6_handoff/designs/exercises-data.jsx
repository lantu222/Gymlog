/* GAINER — Exercises library: real catalogue slice + atoms.
   Data shape mirrors src/data/generatedExerciseLibrary.ts (name / bodyPart /
   equipment / category). Photos are the live free-exercise-db CDN the app
   loads at runtime — used here verbatim as real placeholders. */

const CDN = 'https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises';
const img = (folder) => `${CDN}/${folder}/0.jpg`;

// id, name, bodyPart, equipment, category, image-folder
const EX = [
  ['bench',   'Barbell Bench Press — Medium Grip', 'chest',     'barbell',   'compound',  'Barbell_Bench_Press_-_Medium_Grip'],
  ['squat',   'Barbell Squat',                     'legs',      'barbell',   'compound',  'Barbell_Squat'],
  ['deadlift','Barbell Deadlift',                  'back',      'barbell',   'compound',  'Barbell_Deadlift'],
  ['curl',    'Barbell Curl',                      'biceps',    'barbell',   'compound',  'Barbell_Curl'],
  ['ohp',     'Barbell Shoulder Press',            'shoulders', 'barbell',   'compound',  'Barbell_Shoulder_Press'],
  ['row',     'Bent Over Barbell Row',             'back',      'barbell',   'compound',  'Bent_Over_Barbell_Row'],
  ['hip',     'Barbell Hip Thrust',                'glutes',    'barbell',   'compound',  'Barbell_Hip_Thrust'],
  ['acsp',    'Alternating Cable Shoulder Press',  'shoulders', 'cable',     'compound',  'Alternating_Cable_Shoulder_Press'],
  ['chin',    'Chin-Up',                           'back',      'body only', 'compound',  'Chin-Up'],
  ['cgbp',    'Close-Grip Barbell Bench Press',    'triceps',   'barbell',   'compound',  'Close-Grip_Barbell_Bench_Press'],
  ['cross',   'Cable Crossover',                   'chest',     'cable',     'isolation', 'Cable_Crossover'],
  ['crunch',  'Crunches',                          'core',      'body only', 'isolation', 'Crunches'],
  ['lunge',   'Barbell Lunge',                     'legs',      'barbell',   'compound',  'Barbell_Lunge'],
  ['arnold',  'Arnold Dumbbell Press',             'shoulders', 'dumbbell',  'compound',  'Arnold_Dumbbell_Press'],
  ['ccrunch', 'Cable Crunch',                      'core',      'cable',     'isolation', 'Cable_Crunch'],
  ['dbrow',   'Bent Over Two-Dumbbell Row',        'back',      'dumbbell',  'compound',  'Bent_Over_Two-Dumbbell_Row'],
  ['fsquat',  'Barbell Full Squat',                'legs',      'barbell',   'compound',  'Barbell_Full_Squat'],
  ['hammer',  'Alternate Hammer Curl',             'biceps',    'dumbbell',  'isolation', 'Alternate_Hammer_Curl'],
  ['incline', 'Barbell Incline Bench Press',       'chest',     'barbell',   'compound',  'Barbell_Incline_Bench_Press_-_Medium_Grip'],
  ['shrug',   'Barbell Shrug',                     'shoulders', 'barbell',   'isolation', 'Barbell_Shrug'],
].map(([id, name, bodyPart, equipment, category, folder]) => ({
  id, name, bodyPart, equipment, category, image: img(folder),
}));

// category rail (matches app's bodyPart options)
const CATS = ['All', 'Chest', 'Back', 'Legs', 'Shoulders', 'Biceps', 'Triceps', 'Core', 'Glutes', 'Full body'];

const POPULAR_IDS = ['bench', 'squat', 'deadlift', 'curl'];
const SUGGESTED_IDS = ['acsp', 'hip', 'row', 'chin'];

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// minimalist body-part glyphs for the category rail
function CatIcon({ name, color }) {
  const s = { width: 14, height: 14, fill: 'none', stroke: color, strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' };
  const p = {
    All:        <path d="M4 7h16M4 12h16M4 17h10" />,
    Chest:      <path d="M4 8c3-2 13-2 16 0M4 8c0 6 4 9 8 9s8-3 8-9M12 8v9" />,
    Back:       <path d="M12 3v18M7 7l5-3 5 3M6 12h12M8 17h8" />,
    Legs:       <path d="M9 3v8l-2 10M15 3v8l2 10M9 11h6" />,
    Shoulders:  <path d="M12 6a3 3 0 100-1M5 19c0-4 3-7 7-7s7 3 7 7" />,
    Biceps:     <path d="M6 16c0-5 2-8 6-8 3 0 5 2 5 5 0 2-1 3-3 3M6 16a3 3 0 003 3" />,
    Triceps:    <path d="M7 5c4 0 7 3 7 8 0 3-1 6-4 6M7 5v14" />,
    Core:       <path d="M5 4h14v16H5zM5 9h14M5 14h14M12 4v16" />,
    Glutes:     <path d="M5 8c0 5 3 8 7 8s7-3 7-8M5 8a3 3 0 016 0M13 8a3 3 0 016 0" />,
    'Full body':<path d="M12 4a2 2 0 100-1M9 21l3-12 3 12M7 11h10" />,
  };
  return <svg viewBox="0 0 24 24" style={s}>{p[name] || p.All}</svg>;
}

Object.assign(window, { EX, CATS, POPULAR_IDS, SUGGESTED_IDS, cap, CatIcon });
