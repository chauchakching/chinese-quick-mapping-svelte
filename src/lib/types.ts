export const modes = {
  quick: 'quick',
  cangjie: 'cangjie'
} as const;

export type Mode = (typeof modes)[keyof typeof modes];

export interface SnippetSourceMeta {
  id: string;
  slug: string;
  title: string;
  author: string;
  sourceUrl?: string;
  license?: string;
  snippetCount?: number;
}

export interface NormalizedSnippetsPayload {
  createdAt: string;
  sourceCount: number;
  snippetCount: number;
  minLen: number;
  maxLen: number;
  sources: SnippetSourceMeta[];
  snippets: Array<[string, number]>; // [text, sourceIndex]
}

// Legacy types removed; app consumes only NormalizedSnippetsPayload now
