import { redirect } from '@sveltejs/kit';
import type { PageLoad } from './$types';

export const load: PageLoad = ({ url }) => {
  const snippet = url.searchParams.get('snippet');
  const target = snippet ? `/practice?snippet=${encodeURIComponent(snippet)}` : '/practice';
  redirect(308, target);
};
