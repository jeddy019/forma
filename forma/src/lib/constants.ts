export const CORE_SUBJECTS = [
  'Mathematics',
  'English Language',
  'English Literature',
  'Biology',
  'Chemistry',
  'Physics',
  'Earth Science',
  'Space Science',
  'Combined Science',
] as const;

// "Computer Science" is a UI grouping label only, not a stored value -
// these four are the actual leaf subjects a student/schedule/template
// selects, the same way "Biology, Chemistry, Physics selected individually"
// already replace a generic science pick elsewhere in this catalogue.
// "Programming Concepts" is the general/non-language-specific option (covers
// GCSE/KS3 computational-thinking, algorithms, and systems theory content),
// so there is no separate bare "Computer Science" value - see the AI System
// Prompt section in CLAUDE.md for how each is scoped.
export const CODING_SUBJECTS = ['Python', 'JavaScript', 'HTML/CSS', 'Programming Concepts'] as const;

export const SUBJECTS = [...CORE_SUBJECTS, ...CODING_SUBJECTS] as const;
export type Subject = (typeof SUBJECTS)[number];

// Shown as a non-interactive "More subjects coming soon" section on the
// student subject picker - display only, never selectable, never validated
// or stored anywhere. "Biology (A-Level)" is deliberately distinct from the
// existing "Biology" entry above (which is the GCSE separate-award level) -
// England's A-Level has no "Combined Science" equivalent, so A-Level Biology
// needs its own future entry once built, not a reuse of the GCSE one.
export const COMING_SOON_SUBJECTS = [
  'History',
  'Geography',
  'French',
  'Spanish',
  'Further Mathematics',
  'Biology (A-Level)',
] as const;

export const COUNTRIES = ['england', 'canada_ontario', 'united_states'] as const;
export type Country = (typeof COUNTRIES)[number];

export const CURRICULUM_LEVELS = [
  'KS2',
  'KS3',
  'GCSE',
  'A-Level',
  'Ontario Elementary',
  'Ontario Secondary',
  'US Common Core',
] as const;
export type CurriculumLevel = (typeof CURRICULUM_LEVELS)[number];

export const DIFFICULTY_LEVELS = ['foundation', 'standard', 'higher'] as const;
export type DifficultyLevel = (typeof DIFFICULTY_LEVELS)[number];

// Curated to the 3 countries in the Country and Curriculum Catalogue -
// Ontario is Eastern time only there, so America/Toronto alone covers it;
// the US spans 4 zones.
export const DELIVERY_TIMEZONES = [
  'Europe/London',
  'America/Toronto',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
] as const;
export type DeliveryTimezone = (typeof DELIVERY_TIMEZONES)[number];

export const DAY_OF_WEEK_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;
