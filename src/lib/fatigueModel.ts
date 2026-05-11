import { ExerciseLog, WorkoutSession } from '../types/models';
import { getSessionTotalVolume } from './progression';

export interface FatigueModelInput {
  workoutSessions: WorkoutSession[];
  exerciseLogs: ExerciseLog[];
}

export type FatigueSignal = 'undertrained' | 'optimal' | 'elevated' | 'high';

export interface FatigueResult {
  acuteLoadKg: number;
  chronicLoadKg: number;
  acwr: number;
  recoveryScore: number;
  signal: FatigueSignal;
  sessionCount7d: number;
  sessionCount28d: number;
}

function resolveSessionVolume(
  session: WorkoutSession,
  logsBySession: Record<string, ExerciseLog[]>,
): number {
  if (typeof session.totalVolumeKg === 'number' && session.totalVolumeKg > 0) {
    return session.totalVolumeKg;
  }
  return getSessionTotalVolume(logsBySession[session.id] ?? []);
}

function computeRecoveryScore(acwr: number): number {
  // peak at ACWR ~1.05, falls off on both sides
  if (acwr <= 0) return 50;
  if (acwr < 0.8) {
    return Math.round((acwr / 0.8) * 65);
  }
  if (acwr <= 1.3) {
    const deviation = Math.abs(acwr - 1.05) / 0.25;
    return Math.round(100 - deviation * 25);
  }
  if (acwr <= 1.5) {
    return Math.round(74 - ((acwr - 1.3) / 0.2) * 24);
  }
  return Math.max(0, Math.round(50 - (acwr - 1.5) * 50));
}

function resolveSignal(acwr: number): FatigueSignal {
  if (acwr < 0.8) return 'undertrained';
  if (acwr <= 1.3) return 'optimal';
  if (acwr <= 1.5) return 'elevated';
  return 'high';
}

export function buildFatigueModel(input: FatigueModelInput, referenceDate?: Date): FatigueResult {
  const now = referenceDate ?? new Date();
  const cutoff7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const cutoff28d = new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000);

  const logsBySession: Record<string, ExerciseLog[]> = {};
  for (const log of input.exerciseLogs) {
    if (!logsBySession[log.sessionId]) {
      logsBySession[log.sessionId] = [];
    }
    logsBySession[log.sessionId].push(log);
  }

  const sessions28d = input.workoutSessions.filter((s) => {
    const d = new Date(s.performedAt);
    return d >= cutoff28d && d <= now;
  });

  const sessions7d = sessions28d.filter((s) => new Date(s.performedAt) >= cutoff7d);

  const acuteLoadKg = sessions7d.reduce(
    (sum, s) => sum + resolveSessionVolume(s, logsBySession),
    0,
  );
  const total28dLoadKg = sessions28d.reduce(
    (sum, s) => sum + resolveSessionVolume(s, logsBySession),
    0,
  );
  const chronicLoadKg = total28dLoadKg / 4;

  const acwr = chronicLoadKg > 0 ? acuteLoadKg / chronicLoadKg : 0;

  return {
    acuteLoadKg: Math.round(acuteLoadKg),
    chronicLoadKg: Math.round(chronicLoadKg),
    acwr: Math.round(acwr * 100) / 100,
    recoveryScore: computeRecoveryScore(acwr),
    signal: resolveSignal(acwr),
    sessionCount7d: sessions7d.length,
    sessionCount28d: sessions28d.length,
  };
}
