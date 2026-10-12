/** Every member of the crews. Each role is one structured call to Claude. */
export const ROLE_NAMES = [
  'preparer',
  'creator',
  'judge',
  'scriptwriter',
  'director',
  'reviewer',
  'social',
  'rejection-router',
] as const;
export type RoleName = (typeof ROLE_NAMES)[number];

/** output_config.effort of the Claude API */
export const EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max'] as const;
export type Effort = (typeof EFFORTS)[number];
