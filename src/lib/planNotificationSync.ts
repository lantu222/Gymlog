/**
 * What one sync of the planned notifications does to the OS's pending list:
 * which requests to cancel, which plan items to schedule, which to leave.
 *
 * Pure, so the rule can be tested without expo-notifications; the writes
 * themselves are src/utils/appNotifications.ts.
 */

/** One of our requests the OS reports as pending. */
export interface PendingPlanRequest {
  identifier: string;
  /** The plan item it was scheduled for; empty when it carries none. */
  signature: string;
}

export interface PlanSyncSteps {
  /** Pending requests to cancel, by identifier. */
  cancel: string[];
  /** Plan signatures to schedule, in plan order. */
  schedule: string[];
  /** Plan signatures already pending and left alone. */
  keep: string[];
}

/**
 * The diff between what is pending and what the plan wants.
 *
 * `rearm` asks for everything to be cancelled and scheduled again, and the
 * caller passes it on its first sync in each process (native audit,
 * 2026-09-21). The pending list is expo-notifications' own record, not the
 * OS's alarms: a force-stop, or revoking exact alarms, drops every alarm
 * while the record keeps listing them, and the library re-arms that record
 * only on boot or an app update. Diffing against it alone left an unchanged
 * plan "pending" and silent for good. At most MAX_SCHEDULED (48) requests,
 * once per process start; every later sync in the process diffs, so a
 * foreground does not re-arm a month of alarms for nothing.
 *
 * `allowed` false (no OS permission) or an empty plan cancels everything
 * rather than keep alarms that can no longer be delivered.
 */
export function planNotificationSync(input: {
  pending: readonly PendingPlanRequest[];
  wanted: readonly string[];
  rearm: boolean;
  allowed: boolean;
}): PlanSyncSteps {
  const wanted = [...new Set(input.wanted)];
  if (!input.allowed || wanted.length === 0) {
    return { cancel: input.pending.map((request) => request.identifier), schedule: [], keep: [] };
  }
  if (input.rearm) {
    return { cancel: input.pending.map((request) => request.identifier), schedule: wanted, keep: [] };
  }

  const wantedSet = new Set(wanted);
  const kept = new Set<string>();
  const cancel: string[] = [];
  for (const request of input.pending) {
    // One pending request per plan item; a duplicate goes like a stale one.
    if (wantedSet.has(request.signature) && !kept.has(request.signature)) {
      kept.add(request.signature);
    } else {
      cancel.push(request.identifier);
    }
  }
  return {
    cancel,
    schedule: wanted.filter((signature) => !kept.has(signature)),
    keep: wanted.filter((signature) => kept.has(signature)),
  };
}
