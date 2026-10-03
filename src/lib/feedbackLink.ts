import { LEGAL_ENTITY } from './legalDocuments';
import { AppLanguage } from '../types/models';

/**
 * The "Send feedback" row's destination (design "Vinha — Settings,
 * Notifications & My data", user 2026-09-03: Rate Vinha leaves Settings and
 * this takes its place; the star stays on the Profile).
 *
 * A mail draft rather than a form: a row that opened a screen which then
 * opened mail would be one door too many. The address sits beside the legal
 * documents' own in LEGAL_ENTITY, so there is a single place to change it.
 *
 * The version rides in the subject because the first question about any report
 * is which build it came from — see the Slack workflow, where a report always
 * lags the build it describes.
 */
export function buildFeedbackMailto(language: AppLanguage, appVersion: string): string {
  const subject = language === 'fi' ? `Vinha-palaute (v${appVersion})` : `Vinha feedback (v${appVersion})`;
  return `mailto:${LEGAL_ENTITY.supportEmail}?subject=${encodeURIComponent(subject)}`;
}
