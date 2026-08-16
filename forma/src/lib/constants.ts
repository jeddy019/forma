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
