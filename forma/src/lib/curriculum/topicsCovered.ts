// Pure aggregation for Phase 6 Step 35 ("Topics practiced" - see the
// Current Build Status / CHANGELOG.md entry for why this isn't a
// "percentage of syllabus covered" tracker: there is no canonical topic
// list anywhere in this codebase to use as a denominator -
// worksheets.topic is freeform AI-generated text, not drawn from a fixed
// curriculum list, and inventing one would be a real content claim, not
// just code. Per the user: no fixed denominator, no percentage framing,
// just distinct topics with worksheet and question counts per topic.
// Same "pure logic gets its own file and tests" discipline as
// weeklySummary.ts.
export interface WorksheetForCoverage {
  subject: string;
  topic: string;
  questionCount: number;
}

export interface TopicCoverage {
  subject: string;
  topic: string;
  worksheetCount: number;
  questionCount: number;
}

export function computeTopicsCovered(worksheets: WorksheetForCoverage[]): TopicCoverage[] {
  const groups = new Map<string, TopicCoverage>();

  for (const w of worksheets) {
    const key = `${w.subject}::${w.topic}`;
    const existing = groups.get(key);
    if (existing) {
      existing.worksheetCount += 1;
      existing.questionCount += w.questionCount;
    } else {
      groups.set(key, { subject: w.subject, topic: w.topic, worksheetCount: 1, questionCount: w.questionCount });
    }
  }

  return [...groups.values()].sort((a, b) => a.subject.localeCompare(b.subject) || a.topic.localeCompare(b.topic));
}
