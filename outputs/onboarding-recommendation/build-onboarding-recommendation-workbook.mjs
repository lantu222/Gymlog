import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { FileBlob, SpreadsheetFile, Workbook } from '@oai/artifact-tool';

const require = createRequire(import.meta.url);

const { WORKOUT_TEMPLATES_V1 } = require('../../.test-dist/features/workout/workoutCatalog.js');
const { RECOMMENDATION_PROGRAMS, getRecommendationProgramDefinition } = require('../../.test-dist/lib/recommendationCatalog.js');
const { DEFAULT_FIRST_RUN_SELECTION, buildFirstRunRecommendationReasons, resolveFirstRunRecommendation } = require('../../.test-dist/lib/firstRunSetup.js');
const { buildRecommendationInput } = require('../../.test-dist/lib/recommendationInput.js');
const { buildRecommendationWeeklyStructure } = require('../../.test-dist/lib/recommendationWeeklyStructure.js');
const { evaluateWorkoutContentFit } = require('../../.test-dist/lib/workoutContentFit.js');
const { buildSessionGuidance } = require('../../.test-dist/lib/sessionGuidance.js');

const outputDir = path.resolve('outputs/onboarding-recommendation');
const outputPath = path.join(outputDir, 'onboarding-recommendation-engine.xlsx');
const previewDir = path.join(os.tmpdir(), 'gymlog-onboarding-recommendation-previews');

const workbook = Workbook.create();

const colors = {
  ink: '#111827',
  muted: '#6B7280',
  header: '#111827',
  headerText: '#FFFFFF',
  band: '#F3F4F6',
  good: '#DCFCE7',
  warning: '#FEF3C7',
  border: '#D1D5DB',
};

function addSheet(name) {
  const sheet = workbook.worksheets.add(name);
  sheet.showGridLines = false;
  return sheet;
}

function normalizeRows(rows) {
  const width = Math.max(...rows.map((row) => row.length));
  return rows.map((row) => [...row, ...Array.from({ length: width - row.length }, () => null)]);
}

function writeRows(sheet, startCell, rows) {
  const normalized = normalizeRows(rows);
  const range = sheet.getRange(startCell).resize(normalized.length, normalized[0].length);
  range.values = normalized;
  return range;
}

function styleTable(sheet, range, headerRows = 1) {
  range.format = {
    font: { color: colors.ink },
    wrapText: true,
    borders: {
      insideHorizontal: { style: 'continuous', color: colors.border },
      insideVertical: { style: 'continuous', color: colors.border },
      edgeBottom: { style: 'continuous', color: colors.border },
      edgeLeft: { style: 'continuous', color: colors.border },
      edgeRight: { style: 'continuous', color: colors.border },
      edgeTop: { style: 'continuous', color: colors.border },
    },
  };
  const headerRange = range.getRangeByIndexes(0, 0, headerRows, range.columnCount);
  headerRange.format = {
    fill: colors.header,
    font: { bold: true, color: colors.headerText },
    wrapText: true,
  };
  sheet.freezePanes.freezeRows(headerRows);
}

function setColumnWidths(sheet, widths) {
  widths.forEach((width, index) => {
    sheet.getRangeByIndexes(0, index, 200, 1).format.columnWidthPx = width;
  });
}

function statusCell(value) {
  return value ? 'Pass' : 'Review';
}

function buildSelection(overrides) {
  return {
    ...DEFAULT_FIRST_RUN_SELECTION,
    gender: 'unspecified',
    age: 30,
    ageRange: '26_35',
    level: 'intermediate',
    daysPerWeek: 3,
    equipment: 'gym',
    secondaryOutcomes: ['consistency'],
    focusAreas: [],
    guidanceMode: 'guided_editable',
    scheduleMode: 'app_managed',
    weeklyMinutes: null,
    availableDays: [],
    currentWeightKg: null,
    targetWeightKg: null,
    unitPreference: 'kg',
    ...overrides,
  };
}

function templateById(programId) {
  return WORKOUT_TEMPLATES_V1.find((template) => template.id === programId);
}

function exerciseSummary(template) {
  return template.sessions
    .map((session) => `${session.name}: ${session.exercises.slice(0, 3).map((exercise) => exercise.exerciseName).join(', ')}`)
    .join(' | ');
}

function countSets(template) {
  return template.sessions.reduce(
    (total, session) => total + session.exercises.reduce((sessionTotal, exercise) => sessionTotal + exercise.sets, 0),
    0,
  );
}

function countExercises(template) {
  return template.sessions.reduce((total, session) => total + session.exercises.length, 0);
}

const acceptanceScenarios = [
  {
    path: 'Full gym + Strength + 2 days',
    mustRecommend: 'Beginner strength',
    mustExplain: 'Low frequency strength base',
    mustInclude: 'Heavy squat/press/hinge/pull exposure',
    selection: buildSelection({ goal: 'strength', level: 'beginner', daysPerWeek: 2, equipment: 'gym' }),
  },
  {
    path: 'Full gym + Strength + 3 days',
    mustRecommend: 'Strength base',
    mustExplain: 'Heavy anchors with manageable recovery',
    mustInclude: '3 required strength days',
    selection: buildSelection({ goal: 'strength', level: 'intermediate', daysPerWeek: 3, equipment: 'gym' }),
  },
  {
    path: 'Full gym + Strength + 4 days',
    mustRecommend: 'Powerbuilding or strength-size',
    mustExplain: 'Heavy + support volume',
    mustInclude: '4 balanced upper/lower days',
    selection: buildSelection({ goal: 'strength', level: 'intermediate', daysPerWeek: 4, equipment: 'gym', secondaryOutcomes: ['muscle'] }),
  },
  {
    path: 'Full gym + Strength + 5 days',
    mustRecommend: '4-day strength fallback',
    mustExplain: '5th day is optional',
    mustInclude: 'Explicit optional accessory/recovery day',
    selection: buildSelection({ goal: 'strength', level: 'intermediate', daysPerWeek: 5, equipment: 'gym', currentWeightKg: 100, targetWeightKg: 120 }),
  },
  {
    path: 'Full gym + Muscle + gain target',
    mustRecommend: 'Hypertrophy plan',
    mustExplain: 'Volume supports gain target',
    mustInclude: 'Enough compounds and accessories',
    selection: buildSelection({ goal: 'muscle', level: 'intermediate', daysPerWeek: 5, equipment: 'gym', currentWeightKg: 80, targetWeightKg: 90 }),
  },
  {
    path: 'Lose weight + lower target',
    mustRecommend: 'Sustainable resistance plan',
    mustExplain: 'Target means fat-loss bias',
    mustInclude: 'Moderate full-body strength plus optional conditioning',
    selection: buildSelection({ goal: 'general', level: 'beginner', daysPerWeek: 3, equipment: 'gym', currentWeightKg: 100, targetWeightKg: 85 }),
  },
  {
    path: 'Home + Muscle',
    mustRecommend: 'Home/bodyweight-safe plan',
    mustExplain: 'No gym-only dependency',
    mustInclude: 'Bodyweight push/pull/legs/core',
    selection: buildSelection({ goal: 'muscle', level: 'beginner', daysPerWeek: 4, equipment: 'home' }),
  },
  {
    path: 'Outdoor + Endurance',
    mustRecommend: 'Run + mobility',
    mustExplain: 'Run/cardio is primary',
    mustInclude: 'Easy run, tempo/stride, reset work',
    selection: buildSelection({
      goal: 'run_mobility',
      level: 'beginner',
      daysPerWeek: 4,
      equipment: 'minimal',
      secondaryOutcomes: ['conditioning', 'mobility'],
      guidanceMode: 'done_for_me',
    }),
  },
];

const finalRegressionScenarios = [
  ['Strength 2 days', buildSelection({ goal: 'strength', level: 'beginner', daysPerWeek: 2, equipment: 'gym' })],
  ['Strength 3 days', buildSelection({ goal: 'strength', level: 'intermediate', daysPerWeek: 3, equipment: 'gym' })],
  ['Strength 4 days', buildSelection({ goal: 'strength', level: 'intermediate', daysPerWeek: 4, equipment: 'gym', secondaryOutcomes: ['muscle'] })],
  ['Strength 5 days', buildSelection({ goal: 'strength', level: 'intermediate', daysPerWeek: 5, equipment: 'gym' })],
  ['Muscle 3 days', buildSelection({ goal: 'muscle', level: 'beginner', daysPerWeek: 3, equipment: 'gym' })],
  ['Muscle 4 days', buildSelection({ goal: 'muscle', level: 'intermediate', daysPerWeek: 4, equipment: 'gym' })],
  ['Muscle 5 days + gain', buildSelection({ goal: 'muscle', level: 'intermediate', daysPerWeek: 5, equipment: 'gym', currentWeightKg: 80, targetWeightKg: 90 })],
  ['Fat loss lower target', buildSelection({ goal: 'general', level: 'beginner', daysPerWeek: 3, equipment: 'gym', currentWeightKg: 100, targetWeightKg: 85 })],
  ['Home muscle', buildSelection({ goal: 'muscle', level: 'beginner', daysPerWeek: 4, equipment: 'home' })],
  ['Endurance 3 days', buildSelection({ goal: 'run_mobility', level: 'beginner', daysPerWeek: 3, equipment: 'minimal', secondaryOutcomes: ['conditioning', 'mobility'], guidanceMode: 'done_for_me' })],
  ['Endurance 4 days', buildSelection({ goal: 'run_mobility', level: 'beginner', daysPerWeek: 4, equipment: 'minimal', secondaryOutcomes: ['conditioning', 'mobility'], guidanceMode: 'done_for_me' })],
  ['Endurance 5 days', buildSelection({ goal: 'run_mobility', level: 'beginner', daysPerWeek: 5, equipment: 'minimal', secondaryOutcomes: ['conditioning', 'mobility'], guidanceMode: 'done_for_me' })],
  ['Beginner strength 5 days', buildSelection({ goal: 'strength', level: 'beginner', daysPerWeek: 5, equipment: 'gym' })],
];

function resolveScenario(selection) {
  const recommendation = resolveFirstRunRecommendation(selection);
  const input = buildRecommendationInput(selection);
  const definition = getRecommendationProgramDefinition(recommendation.featuredProgramId);
  const template = templateById(recommendation.featuredProgramId);
  const weeklyStructure = buildRecommendationWeeklyStructure(selection, recommendation.featuredProgramId);
  const fit = evaluateWorkoutContentFit(recommendation.featuredProgramId, {
    goalType: input.profile.goalType,
    setupContext: input.profile.setupContext,
  });
  const reasons = buildFirstRunRecommendationReasons(selection, {
    projectedDaysPerWeek: definition?.daysPerWeek ?? selection.daysPerWeek,
    estimatedSessionDuration: definition?.estimatedSessionMinutes ?? null,
    mismatchNote: recommendation.mismatchNote,
  });

  return { recommendation, input, definition, template, weeklyStructure, fit, reasons };
}

function addSummarySheet() {
  const rows = [
    ['Gymlog Onboarding Recommendation Engine Review'],
    ['Updated', '2026-04-28'],
    ['Current release standard', 'Good, realistic starter plan for every supported onboarding path; not a perfect coach for every edge case.'],
    ['Automated guardrails', 'Content-fit checks, session guidance checks, substitution coverage, high-risk onboarding regression suite.'],
    ['Plan duration model', 'Week 1 starts a 4-week starter block: baseline, build, build, review/easier week.'],
    ['Fallback behavior', 'Closest safe plan is returned with confidence and fallback metadata when exact day/equipment template is missing.'],
    ['No UI scope', 'This workbook documents backend plan quality only.'],
    [],
    ['Area', 'Status', 'Evidence'],
    ['Acceptance matrix', 'Complete', 'Scenario Matrix tab maps input paths to actual recommendation outputs.'],
    ['Content fit', 'Complete', 'Content Fit Checks tab lists signals and clean issue status by representative path.'],
    ['Session quality', 'Complete', 'Session Quality tab exposes warmup, focus, rest, duration, progression, first action.'],
    ['Fallback confidence', 'Complete', 'Scenario Matrix and Final Checklist include confidence and optional-day behavior.'],
    ['Substitutions', 'Complete', 'Catalog tests require realistic alternatives and bodyweight-safe groups.'],
    ['Known gaps', 'Tracked', 'Catalog Gaps tab lists planned template additions without blocking current safe output.'],
  ];

  const sheet = addSheet('Summary');
  const title = sheet.getRange('A1:C1');
  title.merge();
  title.values = [[rows[0][0]]];
  title.format = { fill: colors.header, font: { bold: true, color: colors.headerText, size: 16 } };
  const range = writeRows(sheet, 'A2', rows.slice(1));
  styleTable(sheet, range.getRangeByIndexes(7, 0, rows.length - 8, 3));
  setColumnWidths(sheet, [210, 150, 620]);
}

function addScenarioMatrixSheet() {
  const rows = [
    ['Path', 'Must recommend', 'Actual program', 'Goal type', 'Setup context', 'Confidence', 'Fallback', 'Must explain / actual explanation', 'Weekly structure'],
  ];

  acceptanceScenarios.forEach((scenario) => {
    const resolved = resolveScenario(scenario.selection);
    rows.push([
      scenario.path,
      scenario.mustRecommend,
      `${resolved.template?.name ?? resolved.recommendation.featuredProgramId} (${resolved.recommendation.featuredProgramId})`,
      resolved.input.profile.goalType,
      resolved.input.profile.setupContext,
      resolved.recommendation.recommendationConfidence,
      resolved.recommendation.fallbackReason ?? resolved.recommendation.mismatchNote ?? '',
      `${scenario.mustExplain}. ${resolved.reasons.join(' ')}`,
      resolved.weeklyStructure?.summary ?? '',
    ]);
  });

  const sheet = addSheet('Scenario Matrix');
  const range = writeRows(sheet, 'A1', rows);
  styleTable(sheet, range);
  setColumnWidths(sheet, [230, 210, 260, 120, 140, 90, 270, 470, 340]);
}

function addProgramCatalogSheet() {
  const definitionsById = new Map(RECOMMENDATION_PROGRAMS.map((definition) => [definition.programId, definition]));
  const rows = [
    ['Program ID', 'Name', 'Goal', 'Level', 'Days', 'Session min', 'Equipment tier', 'Recovery', 'Sessions', 'Exercises', 'Weekly sets', 'Style tags', 'Exercise preview'],
  ];

  WORKOUT_TEMPLATES_V1.forEach((template) => {
    const definition = definitionsById.get(template.id);
    rows.push([
      template.id,
      template.name,
      template.goalType,
      template.level,
      template.daysPerWeek,
      template.estimatedSessionDuration,
      definition?.equipmentTier ?? '',
      definition?.recoveryDemand ?? '',
      template.sessions.length,
      countExercises(template),
      countSets(template),
      definition?.styleTags.join(', ') ?? '',
      exerciseSummary(template),
    ]);
  });

  const sheet = addSheet('Program Catalog');
  const range = writeRows(sheet, 'A1', rows);
  styleTable(sheet, range);
  setColumnWidths(sheet, [250, 220, 110, 120, 70, 100, 140, 110, 90, 90, 100, 220, 700]);
}

function addContentFitSheet() {
  const rows = [
    [
      'Path',
      'Program',
      'Issues',
      'Weekly sets',
      'Primary sets',
      'Run exposures',
      'Loaded exercises',
      'Technical lifts',
      'Max exercises/session',
      'Avg min',
      'Low-rep anchors',
      'Hypertrophy volume',
      'Run work',
      'Mobility',
      'Resistance',
      'Full-gym-only',
    ],
  ];

  acceptanceScenarios.forEach((scenario) => {
    const resolved = resolveScenario(scenario.selection);
    const signals = resolved.fit.signals;
    rows.push([
      scenario.path,
      resolved.recommendation.featuredProgramId,
      resolved.fit.issues.length ? resolved.fit.issues.join(' | ') : 'Clean',
      signals.weeklySetCount,
      signals.primarySetCount,
      signals.runExerciseCount,
      signals.loadedExerciseCount,
      signals.technicalLiftCount,
      signals.maxExercisesPerSession,
      signals.averageSessionMinutes,
      statusCell(signals.hasLowRepLoadedAnchors),
      statusCell(signals.hasHypertrophyVolume),
      statusCell(signals.hasRunWork),
      statusCell(signals.hasMobilityWork),
      statusCell(signals.hasResistanceWork),
      signals.hasFullGymOnlyExercises ? 'Present' : 'No',
    ]);
  });

  const sheet = addSheet('Content Fit Checks');
  const range = writeRows(sheet, 'A1', rows);
  styleTable(sheet, range);
  setColumnWidths(sheet, [230, 250, 230, 95, 95, 105, 110, 105, 130, 80, 120, 135, 90, 90, 100, 120]);
}

function addSessionQualitySheet() {
  const rows = [
    ['Program', 'Session', 'Exercise count', 'Warmup', 'Main focus', 'Support focus', 'Rest', 'Duration', 'Progression hint', 'First action'],
  ];

  WORKOUT_TEMPLATES_V1.forEach((template) => {
    template.sessions.forEach((session) => {
      const guidance = buildSessionGuidance(template, session);
      rows.push([
        template.name,
        session.name,
        session.exercises.length,
        guidance.warmup,
        guidance.mainFocus,
        guidance.supportFocus,
        guidance.restGuidance,
        guidance.estimatedDuration,
        guidance.progressionHint,
        guidance.firstAction,
      ]);
    });
  });

  const sheet = addSheet('Session Quality');
  const range = writeRows(sheet, 'A1', rows);
  styleTable(sheet, range);
  setColumnWidths(sheet, [220, 190, 100, 330, 330, 330, 250, 95, 430, 350]);
}

function addCatalogGapsSheet() {
  const rows = [
    ['Gap', 'Why it matters', 'Current behavior', 'Preferred later fix', 'Blocking now?'],
    ['No true 5-day strength template', 'Some strength users ask for five full training days.', '4-day strength base with optional accessory/recovery day and fallback metadata.', 'Add a true 5-day strength or powerbuilding template if demand is high.', 'No'],
    ['No dedicated 4-day home hypertrophy template', 'Home muscle users currently get a safe low-equipment base plus add-ons.', 'Low-equipment 2-day bodyweight plan avoids gym-only dependency.', 'Add 3-4 day home/bodyweight muscle template.', 'No'],
    ['Endurance has no dedicated 4/5-day template', 'Higher-frequency runners need more specific progression later.', '3-day run + mobility base plus concrete optional add-on days.', 'Add 4/5-day endurance templates.', 'No'],
    ['No explicit equipment metadata per exercise', 'Advanced swaps will need more precise filtering.', 'Fit is inferred from template choice and exercise names; tests guard known risk cases.', 'Add exercise-level equipment metadata before advanced substitutions.', 'No'],
  ];

  const sheet = addSheet('Catalog Gaps');
  const range = writeRows(sheet, 'A1', rows);
  styleTable(sheet, range);
  setColumnWidths(sheet, [260, 360, 420, 360, 110]);
}

function addFinalChecklistSheet() {
  const rows = [
    ['Scenario / Gate', 'Actual program', 'Clean content fit', 'Weekly structure', 'Explanation', 'Training block', 'Confidence', 'Fallback noted', 'Status'],
  ];

  finalRegressionScenarios.forEach(([label, selection]) => {
    const resolved = resolveScenario(selection);
    const cleanFit = resolved.fit.issues.length === 0;
    const hasWeeklyStructure = Boolean(resolved.weeklyStructure?.summary && resolved.weeklyStructure.days.length >= (resolved.definition?.daysPerWeek ?? 0));
    const hasExplanation = resolved.reasons.join(' ').length > 20;
    const hasTrainingBlock =
      resolved.recommendation.trainingBlock?.blockLengthWeeks === 4 &&
      resolved.recommendation.trainingBlock?.currentWeekRole === 'baseline';
    const fallbackNoted =
      resolved.definition?.daysPerWeek === selection.daysPerWeek ||
      Boolean(resolved.recommendation.fallbackReason || resolved.recommendation.mismatchNote);

    rows.push([
      label,
      resolved.recommendation.featuredProgramId,
      statusCell(cleanFit),
      statusCell(hasWeeklyStructure),
      statusCell(hasExplanation),
      statusCell(hasTrainingBlock),
      resolved.recommendation.recommendationConfidence,
      statusCell(fallbackNoted),
      cleanFit && hasWeeklyStructure && hasExplanation && hasTrainingBlock && fallbackNoted ? 'Pass' : 'Review',
    ]);
  });

  const sheet = addSheet('Final User-Ready Checklist');
  const range = writeRows(sheet, 'A1', rows);
  styleTable(sheet, range);
  setColumnWidths(sheet, [230, 260, 130, 140, 120, 120, 100, 120, 100]);
}

addSummarySheet();
addScenarioMatrixSheet();
addProgramCatalogSheet();
addContentFitSheet();
addSessionQualitySheet();
addCatalogGapsSheet();
addFinalChecklistSheet();

await fs.mkdir(previewDir, { recursive: true });
for (const sheetName of [
  'Summary',
  'Scenario Matrix',
  'Program Catalog',
  'Content Fit Checks',
  'Session Quality',
  'Catalog Gaps',
  'Final User-Ready Checklist',
]) {
  const preview = await workbook.render({ sheetName, autoCrop: 'all', scale: 1, format: 'png' });
  await fs.writeFile(path.join(previewDir, `${sheetName.replaceAll(' ', '-')}.png`), new Uint8Array(await preview.arrayBuffer()));
}

const summaryInspect = await workbook.inspect({
  kind: 'table',
  range: 'Summary!A1:C15',
  include: 'values,formulas',
  tableMaxRows: 15,
  tableMaxCols: 3,
});
console.log(summaryInspect.ndjson);

const checklistInspect = await workbook.inspect({
  kind: 'table',
  range: 'Final User-Ready Checklist!A1:I20',
  include: 'values,formulas',
  tableMaxRows: 20,
  tableMaxCols: 9,
});
console.log(checklistInspect.ndjson);

const formulaErrors = await workbook.inspect({
  kind: 'match',
  searchTerm: '#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A',
  options: { useRegex: true, maxResults: 100 },
  summary: 'final formula error scan',
});
console.log(formulaErrors.ndjson);

await fs.mkdir(outputDir, { recursive: true });
const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(outputPath);
const savedWorkbook = await SpreadsheetFile.importXlsx(await FileBlob.load(outputPath));
const savedSheets = await savedWorkbook.inspect({
  kind: 'sheet',
  include: 'name',
});
console.log(savedSheets.ndjson);
console.log(`Saved ${outputPath}`);
