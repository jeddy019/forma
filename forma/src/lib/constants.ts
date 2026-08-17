export const SUBJECTS = [
  'Mathematics',
  'English Language',
  'English Literature',
  'Biology',
  'Chemistry',
  'Physics',
  'Combined Science',
  'Computer Science',
] as const;
export type Subject = (typeof SUBJECTS)[number];

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
