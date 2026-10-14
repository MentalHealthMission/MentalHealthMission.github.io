/** Hash-only routes; legacy term/topic/module/source links remain valid. */
export const FILTER_KEYS = ['source', 'type', 'layer', 'scheme'];
const emptyFilters = () => Object.fromEntries(FILTER_KEYS.map(key => [key, '']));
const ENTRIES = ['layers', 'vocabularies', 'classes', 'properties'];
const ROLES = new Set(['class', 'concept', 'individual', 'property', 'scheme', 'shape', 'ontology']);
const safeRole = role => ROLES.has(role) ? role : '';
const entryView = view => ['types', 'dimensions'].includes(view) ? 'classes' : view === 'concepts' ? 'vocabularies' : view;
const searchEntryView = view => ['types', 'dimensions'].includes(view) ? 'classes' : view;
const legacyEntryStep = step => step === 'entry:dimensions' ? 'entry:classes' : step;

// Legacy string ancestors remain neutral. Objects record the role actually visited.
export const pathStepTerm = step => typeof step === 'string' ? step : step.term ?? '';
export const pathStepRole = step => typeof step === 'string' ? '' : safeRole(step.role);
export const termPathStep = (term, role = '') => safeRole(role) ? { term, role: safeRole(role) } : term;
export const examplePathStep = (example, page) => ({ example, page });
export const isExampleStep = step => Boolean(step && typeof step === 'object' &&
  typeof step.example === 'string' && step.example && typeof step.page === 'string' && step.page);

export function readViewState(hash = '') {
  const values = new URLSearchParams(hash.replace(/^#/, ''));
  const metadata = (key, fallback) => {
    try {
      const value = JSON.parse(values.get(key));
      return Array.isArray(value) ? value.flatMap(item => typeof item === 'string' ? [legacyEntryStep(item)] :
        isExampleStep(item) ? [examplePathStep(item.example, item.page)] :
        item && typeof item.term === 'string' && item.term ? [termPathStep(item.term, item.role)] : []) : fallback;
    }
    catch { return fallback; }
  };
  return {
    scope: values.get('scope') || 'all',
    term: values.get('term') ?? values.get('topic') ?? '', module: values.get('module') ?? values.get('source') ?? '',
    example: values.get('example') ?? '', page: values.get('page') ?? '',
    view: entryView(values.get('view') ?? ''), role: safeRole(values.get('role')),
    family: values.get('family') ?? '', query: values.get('q') ?? '',
    searchEntry: searchEntryView(values.get('entry') ?? ''), searchOwner: values.get('owner') ?? '', searchSection: values.get('relation') ?? '',
    path: metadata('path', []),
    searchReturn: (() => { try { const value = JSON.parse(values.get('return')); return value && typeof value === 'object' && !Array.isArray(value) ? value : null; } catch { return null; } })(),
    filters: Object.fromEntries(FILTER_KEYS.map(key => [key, values.get(`filter-${key}`) ?? ''])),
  };
}

export function viewHash(state) {
  const values = new URLSearchParams();
  if (state.term) values.set('term', state.term);
  else if (state.module) values.set('module', state.module);
  else if (state.example) {
    values.set('example', state.example);
    if (state.page) values.set('page', state.page);
  }
  if (state.term && safeRole(state.role)) values.set('role', state.role);
  if (state.view) values.set('view', entryView(state.view));
  if (state.family) values.set('family', state.family);
  if (state.scope && state.scope !== 'all') values.set('scope', state.scope);
  if (state.query) values.set('q', state.query);
  for (const [field, key] of [['searchEntry', 'entry'], ['searchOwner', 'owner'], ['searchSection', 'relation']]) if (state[field]) values.set(key, state[field]);
  if (state.path?.length) values.set('path', JSON.stringify(state.path));
  if (state.searchReturn) values.set('return', JSON.stringify(state.searchReturn));
  for (const key of FILTER_KEYS) if (state.filters?.[key]) values.set(`filter-${key}`, state.filters[key]);
  return `#${values}`;
}

export function destination(state, kind, id = '', role = '') {
  const next = { ...clearSearch(state), term: '', role: '', module: '', example: '', page: '', view: '', family: '', searchReturn: null };
  if (kind === 'term' || kind === 'topic') { next.term = id; next.role = safeRole(role); }
  else if (kind === 'module') next.module = id;
  else if (kind === 'example') { next.example = id; next.page = role; }
  else if (kind === 'family') { next.family = id; next.view = 'family'; next.path = []; }
  else { next.path = []; next.view = kind === 'home' ? '' : entryView(kind); }
  return next;
}

/** Search overlays a retained route; clearing search restores that route. */
export function viewIntent(state) {
  if (state.query.trim() || state.searchEntry || state.searchOwner || state.view === 'all' || Object.values(state.filters).some(Boolean)) return 'search';
  if (state.term) return 'term';
  if (state.module) return 'module';
  if (state.example) return 'example';
  if (['introduction', 'examples'].includes(state.view)) return state.view;
  if (state.view === 'sources') return 'sources';
  if (state.view === 'family' && state.family) return 'family';
  if (ENTRIES.includes(state.view)) return 'entry';
  return 'home';
}

export function clearSearch(state) {
  return { ...state, query: '', searchEntry: '', searchOwner: '', searchSection: '', view: state.view === 'all' ? '' : state.view, filters: emptyFilters() };
}
