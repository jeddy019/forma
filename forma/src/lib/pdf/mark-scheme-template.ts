import type { WorksheetHeaderData } from './worksheet-template';
import type { Branding } from '../branding';

// Type primitives only - the Puppeteer/HTML rendering that used to live
// here (renderMarkSchemeHtml and its helpers) moved to
// render/worksheetHtml.ts (HTML -> Chromium print, same renderer as
// worksheets). These types stay here rather than moving, since
// api/pdf/route.ts still imports MarkSchemeQuestion from this exact path.

export type MarkSchemeHeaderData = Omit<WorksheetHeaderData, 'digitalCode'>;

export interface MarkSchemeQuestionPart {
  part_label: string | null;
  marks: number;
  answer: string;
  M1: string;
  A1: string;
  common_error: string;
  allow: string;
}

export interface MarkSchemeQuestion {
  id: string;
  type: 'warm-up' | 'core' | 'challenge';
  parts: MarkSchemeQuestionPart[];
}

export interface MarkSchemeTemplateData {
  header: MarkSchemeHeaderData;
  questions: MarkSchemeQuestion[];
  /** W1 identity layer - wordmark brand. Defaults to platform defaults. */
  brand?: Branding;
}
