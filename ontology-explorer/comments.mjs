/** Optional respondent links only: no external reads, submission or location-derived URLs. */
import { readViewState, viewHash, viewIntent } from './view-state.mjs';

export function canonicalPageId(route, { examplePage = '' } = {}) {
  const state = typeof route === 'string' ? readViewState(route) : readViewState(viewHash(route));
  const intent = viewIntent(state);
  if (intent === 'search') return viewHash({ view: 'all' });
  if (intent === 'term') return viewHash({ term: state.term, role: state.role });
  if (intent === 'module') return viewHash({ module: state.module });
  if (intent === 'example') return viewHash({ example: state.example, page: examplePage || state.page });
  if (intent === 'family') return viewHash({ view: 'family', family: state.family });
  if (intent === 'entry') return viewHash({ view: state.view });
  if (['sources', 'introduction', 'examples'].includes(intent)) return viewHash({ view: intent });
  return viewHash({ view: 'introduction' });
}

export function commentFormConfig(config) {
  if (!config || config.enabled === false) return null;
  try {
    const form = new URL(config.formUrl);
    if (form.protocol !== 'https:' || form.hostname !== 'docs.google.com' || form.port ||
      form.username || form.password || form.search || form.hash ||
      !/^\/forms\/d\/e\/[A-Za-z0-9_-]+\/viewform$/.test(form.pathname)) return null;
    const { pageId, pageTitle } = config.fields ?? {};
    const validField = value => typeof value === 'string' && /^entry\.\d+$/.test(value);
    if (!validField(pageId) || !validField(pageTitle) || pageId === pageTitle) return null;
    return { formUrl: form.href, fields: { pageId, pageTitle } };
  } catch { return null; }
}

export function commentFormUrl(config, pageId, pageTitle) {
  const settings = commentFormConfig(config);
  if (!settings) return null;
  const form = new URL(settings.formUrl);
  form.searchParams.set('usp', 'pp_url');
  form.searchParams.set(settings.fields.pageId, pageId);
  form.searchParams.set(settings.fields.pageTitle, pageTitle);
  return form.href;
}
