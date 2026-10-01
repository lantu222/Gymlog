import { useRef, useState } from 'react';

import { type LegalDocumentId } from '../lib/legalDocuments';

/**
 * What the hand-off and the terms sheet hold above the route: the document
 * open over either, the terms sheet held while its answer is written, and the
 * refs the route-level back reads at key-press time.
 *
 * Moved out of App.tsx verbatim in the phase-C split (2026-10-01). A hook
 * because the moved code is state and refs: VinhaApp calls it at the slot they
 * stood in — after the aboutYouValues state, before the held session
 * adaptations — so React's hook order is unchanged. The render-phase write of
 * `handoffLegalOpenRef` stays beside its ref, as it was. The other two refs
 * are written where their values are worked out, further down VinhaApp (in
 * useSetupHandoffOverlays); the back listener that reads all three is
 * useRouteBack.
 */
export function useHandoffLegalHolders() {
  /**
   * The document the hand-off screen has open, if any. Kept here rather than
   * routed: the legal screen belongs to the Profile tab, and navigating to it
   * mid-onboarding would end onboarding. Null puts the hand-off back.
   */
  const [handoffLegalDocument, setHandoffLegalDocument] = useState<LegalDocumentId | null>(null);
  /** Read by the route-level back, which is declared before the value is. */
  const legalConsentDueRef = useRef(false);
  /**
   * The terms sheet, held on screen while its answer is being written.
   *
   * `updatePreferences` shows a change before the disk has it and takes it
   * back if the disk refuses. Derived from the preferences alone, the sheet
   * vanished on the optimistic half — before the acceptance was durable — and
   * a refused write mounted a fresh sheet whose error the old one could never
   * show (CI review of #184). Held, it leaves only after the write resolves,
   * and a refusal lands on the sheet that asked.
   */
  const [legalSheetHeld, setLegalSheetHeld] = useState<'first' | 'changed' | null>(null);
  const handoffLegalOpenRef = useRef(false);
  handoffLegalOpenRef.current = handoffLegalDocument !== null;
  // Whether the hand-off is on screen, for the route-level back below. Set
  // where the hand-off plan is worked out, further down.
  const setupHandoffActiveRef = useRef(false);
  return {
    handoffLegalDocument,
    setHandoffLegalDocument,
    legalConsentDueRef,
    legalSheetHeld,
    setLegalSheetHeld,
    handoffLegalOpenRef,
    setupHandoffActiveRef,
  };
}
