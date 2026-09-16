import { hasWord, hasWordStart } from './wordMatch';

/**
 * What kind of question this is, before anything tries to answer it.
 *
 * The coach's scope is a rule on the server (COACH_SYSTEM_RULES), where the
 * model can read a whole sentence and judge it. Offline there is no model:
 * `aiCoachPreview` matches keywords, and a question about the weather used to
 * come back as a recovery answer with the reader's own numbers in it — the
 * app answering, confidently, something it was never asked.
 *
 * So this is deliberately not a classifier. It names only what it is sure of:
 * a handful of subjects that cannot be training questions, and the words
 * somebody in trouble uses. Everything else is training, because that is what
 * this app is for and a reader phrasing a training question unusually must
 * not be turned away.
 */
export type CoachScopeVerdict = 'training' | 'off_topic' | 'crisis';

/**
 * Said plainly enough that no training reading survives.
 *
 * Whole phrases rather than words: "en jaksa enää" is how a hard week is
 * described as often as anything else, and answering it with a crisis line
 * would be its own kind of wrong.
 */
const CRISIS_PHRASES = [
  'itsemurha',
  'tappaa itseni',
  'tappaisin itseni',
  'satuttaa itseäni',
  'vahingoittaa itseäni',
  'en halua elää',
  'haluan kuolla',
  'suicide',
  'kill myself',
  'killing myself',
  'end my life',
  'ending my life',
  'ending it all',
  'lopettaa kaiken',
  'hurt myself',
  'harm myself',
  'want to die',
];

/**
 * Subjects with no training reading at all.
 *
 * Each one is a word the reader would only write when asking about something
 * else entirely. Words that are also gym words stay out of this list —
 * "ohjelma" is a programme, "python" is not a lift.
 */
const OFF_TOPIC_WORDS = [
  // Code and computers
  'python', 'javascript', 'typescript', 'sql', 'koodi', 'koodaa', 'ohjelmoin', 'debug', 'regex', 'algoritmi',
  // Politics, news, money
  'presidentti', 'eduskunta', 'politii', 'vaalit', 'hallitus', 'president', 'election', 'politic',
  'osake', 'osakkeet', 'bitcoin', 'kryptov', 'sijoit', 'stock market',
  // Weather, travel, entertainment
  'sääennuste', 'sään ennuste', 'sataako', 'weather', 'forecast', 'lentolippu', 'hotelli', 'matkusta', 'flight', 'hotel',
  'elokuva', 'leffa', 'movie', 'netflix', 'jalkapallo-ottelu',
  // Homework and writing
  'runo', 'essee', 'novelli', 'käännä tämä', 'poem', 'essay', 'translate this', 'write me a story',
  // The assistant itself
  'mikä malli olet', 'oletko tekoäly', 'what model are you', 'are you chatgpt', 'gpt-4', 'your system prompt',
];

/**
 * Training words are the veto.
 *
 * "Voinko juosta maratonin ennen vaaleja" is a training question with an
 * election in it, and an off-topic word must not win over a real one.
 */
const TRAINING_STEMS_FI = [
  'treen', 'harjoit', 'sarja', 'toisto', 'lihas', 'voima', 'penkki', 'kyykky', 'maasto', 'kehonpaino',
  'paino', 'palautu', 'lepo', 'uni', 'ravinto', 'proteiin', 'kalori', 'ohjelma', 'liike', 'juoks',
  'kunto', 'venyt', 'liikkuvuus', 'rasva', 'kasvu', 'ennätys', 'sali',
];

const TRAINING_WORDS_EN = [
  'train', 'training', 'workout', 'lift', 'lifting', 'squat', 'bench', 'deadlift', 'rep', 'set', 'muscle',
  'strength', 'recovery', 'recovered', 'rest', 'sleep', 'protein', 'calorie', 'programme', 'program',
  'exercise', 'run', 'running', 'cardio', 'mobility', 'stretch', 'weight', 'bodyweight', 'gym', 'hypertrophy',
];

export function classifyCoachScope(prompt: string): CoachScopeVerdict {
  const text = prompt.toLowerCase();
  if (CRISIS_PHRASES.some((phrase) => text.includes(phrase))) {
    return 'crisis';
  }
  // Finnish stems match from the start of a word; English words match whole,
  // plural included. Matching English the Finnish way is how "run" became the
  // start of "runo" and a request for a poem read as a training question.
  const trains =
    TRAINING_STEMS_FI.some((stem) => hasWordStart(text, stem)) ||
    TRAINING_WORDS_EN.some((word) => hasWord(text, word) || hasWord(text, `${word}s`));
  if (trains) {
    return 'training';
  }

  const offTopic = OFF_TOPIC_WORDS.some((word) =>
    word.includes(' ') ? text.includes(word) : hasWordStart(text, word),
  );
  // Training is the default, not the leftovers: a question this cannot place
  // is far more likely to be an oddly worded training question than an essay.
  return offTopic ? 'off_topic' : 'training';
}
