export const modes = {
  quick: 'quick',
  cangjie: 'cangjie'
} as const;

export type Mode = (typeof modes)[keyof typeof modes];
