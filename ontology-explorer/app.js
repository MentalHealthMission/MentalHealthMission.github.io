import { createCatalogModel, GraphIndex, groupStatements,
  safeExternalUrl, safeLocalUrl } from './model.mjs';
import { createBrowseModel } from './browse-model.mjs';
import { FILTER_KEYS, readViewState, viewHash, destination, viewIntent, clearSearch,
  termPathStep, pathStepTerm, pathStepRole, examplePathStep, isExampleStep } from './view-state.mjs';
import { describeExpression } from './expressions.mjs';
import { createTechnicalView } from './technical-view.mjs';
import { createExampleModel, createExampleView } from './example-view.mjs';
import { canonicalPageId, commentFormConfig, commentFormUrl } from './comments.mjs';

const DESCRIPTION_PREDICATES = new Set([
  'http://www.w3.org/2000/01/rdf-schema#comment', 'http://www.w3.org/2004/02/skos/core#definition',
  'http://purl.obolibrary.org/obo/IAO_0000115', 'http://www.w3.org/ns/prov#definition', 'http://purl.org/dc/terms/description',
  'http://purl.org/dc/elements/1.1/description', 'https://schema.org/description', 'http://schema.org/description',
]);
// Redundant metatypes are represented by the concept kind; keep all asserted RDF in technical views and search.
const INFRASTRUCTURE_TYPES = new Set([
  'http://www.w3.org/2002/07/owl#Class', 'http://www.w3.org/2002/07/owl#NamedIndividual',
  'http://www.w3.org/2002/07/owl#ObjectProperty', 'http://www.w3.org/2002/07/owl#DatatypeProperty',
  'http://www.w3.org/2002/07/owl#AnnotationProperty', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#Property',
  'http://www.w3.org/2000/01/rdf-schema#Class', 'http://www.w3.org/2004/02/skos/core#Concept',
  'http://www.w3.org/2004/02/skos/core#ConceptScheme',
]);
const main = document.getElementById('main');
const graph = new GraphIndex();
const pending = new Map();
let catalog;
let model;
let browse;
let examples, exampleView;
let comments;
let state = readViewState(location.hash);
let routeVersion = 0;
let rdfValue, renderPredicates, renderAssertions, references;

function sourceCollectionLabel(source) {
  return catalog.collections?.find(collection => collection.id === source.collectionId)?.label ?? source.label ?? source.group;
}

function orderedSources() {
  return [...catalog.sources].sort((a, b) =>
    sourceCollectionLabel(a).localeCompare(sourceCollectionLabel(b)) ||
    a.label.localeCompare(b.label) || a.id.localeCompare(b.id));
}

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function action(text, callback, className = 'quiet-button') {
  const button = element('button', className, text);
  button.type = 'button';
  button.addEventListener('click', callback);
  return button;
}

function termLink(id, text, className = 'term-link', requestedRole = '') {
  const link = element('a', className, text ?? model.get(id).label);
  const role = browse.roleFor(id, requestedRole);
  let path = [...state.path];
  let searchReturn = state.searchReturn;
  if (viewIntent(state) === 'search') {
    path = ['search'];
    searchReturn = { ...state, path: state.path, searchReturn: null };
  } else if (state.example) {
    path.push(examplePathStep(state.example, examples.page(state.example, state.page)?.id ?? state.page));
  } else if (state.term && (state.term !== id || state.role !== role)) {
    path.push(termPathStep(state.term, state.role));
  }
  else if (state.module && !path.includes(`module:${state.module}`)) path.push(`module:${state.module}`);
  else if (state.view === 'family' && state.family) path = [`collection:${state.family}`];
  else if (['introduction', 'examples'].includes(state.view)) path = [`entry:${state.view}`];
  else if (state.view && browse?.entryPoints(state.scope).some(entry => entry.id === state.view)) path = [`entry:${state.view}`];
  else if (!state.term && !state.module && !state.view) path = ['entry:introduction'];
  const ancestor = path.findIndex(step => pathStepTerm(step) === id && pathStepRole(step) === role);
  if (ancestor >= 0) path = path.slice(0, ancestor);
  link.href = viewHash({ ...destination(state, 'term', id, role), path, searchReturn });
  return link;
}

function exampleLink(id, page, text, className = 'term-link') {
  const targetPage = examples.page(id, page);
  const link = element('a', className, text ?? targetPage?.title ?? page);
  let path = [...state.path], searchReturn = state.searchReturn;
  if (viewIntent(state) === 'search') {
    path = ['search'];
    searchReturn = { ...state, path: state.path, searchReturn: null };
  } else if (state.term) path.push(termPathStep(state.term, state.role));
  else if (state.module) path.push(`module:${state.module}`);
  else if (state.example) {
    const currentPage = examples.page(state.example, state.page)?.id ?? state.page;
    if (state.example !== id || currentPage !== targetPage?.id) path.push(examplePathStep(state.example, currentPage));
  } else if (state.view) path = [`entry:${state.view}`];
  const ancestor = path.findIndex(step => isExampleStep(step) && step.example === id && step.page === targetPage?.id);
  if (ancestor >= 0) path = path.slice(0, ancestor);
  link.href = viewHash({ ...destination(state, 'example', id, targetPage?.id ?? page), path, searchReturn });
  return link;
}

function sourceLink(id, className = 'source-badge') {
  const source = model.sources.get(id);
  const link = element('a', className, source?.label ?? id);
  let path = [...state.path];
  if (state.term) path.push(termPathStep(state.term, state.role));
  else if (state.module && state.module !== id && !path.includes(`module:${state.module}`)) path.push(`module:${state.module}`);
  else if (state.view === 'family' && state.family) path = [`collection:${state.family}`];
  if (path.includes(`module:${id}`)) path = path.slice(0, path.indexOf(`module:${id}`));
  link.href = viewHash({ ...destination(state, 'module', id), path, searchReturn: state.searchReturn });
  link.title = source ? `${source.group} · ${source.path}` : id;
  return link;
}

function sourceMarks(ids) {
  const row = element('span', 'source-marks');
  for (const id of [...new Set(ids)]) row.append(sourceLink(id));
  return row;
}

function compactIdentifier(id) {
  for (const [prefix, iri] of Object.entries(catalog.namespaces ?? {}).sort((a, b) => b[1].length - a[1].length)) {
    if (id.startsWith(iri) && id.length > iri.length) return `${prefix}:${id.slice(iri.length)}`;
  }
  return id;
}

function heading(parent, level, text, count) {
  const node = element(`h${level}`, '', text);
  if (count !== undefined) node.append(element('span', 'heading-count', count.toLocaleString()));
  parent.append(node);
  return node;
}

function completeList(parent, items, render) {
  const content = element('div', 'complete-items');
  const fragment = document.createDocumentFragment();
  for (const item of items) fragment.append(render(item));
  content.append(fragment);
  parent.append(content);
}


function termRow(resource) {
  const link = termLink(resource.id, undefined, 'term-result');
  link.append(element('span', 'result-meta', resource.kinds.join(' · ')));
  if (resource.descriptions.length) link.append(element('span', 'result-description', resource.descriptions[0].value));
  link.append(originMarks(resource.id));
  if (state.term === resource.id) link.setAttribute('aria-current', 'page');
  return link;
}

async function readJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Could not load ${url}: HTTP ${response.status}`);
  return response.json();
}

async function loadSource(id) {
  if (graph.graphs.has(id)) return graph.graphs.get(id);
  if (pending.has(id)) return pending.get(id);
  const source = model.sources.get(id);
  if (!source) throw new Error(`Module not found: ${id}`);
  const url = safeLocalUrl(source.dataUrl, location.href);
  if (!url) throw new Error(`Invalid module data URL: ${source.dataUrl}`);
  const operation = readJson(url).then(data => {
    if (data.id !== id) throw new Error(`Module identifier mismatch: ${id}`);
    graph.add(data);
    return data;
  }).finally(() => pending.delete(id));
  pending.set(id, operation);
  return operation;
}

function identifiers(parent, resource) {
  const row = element('div', 'identifier-row');
  row.append(element('code', 'full-iri', resource.id));
  parent.append(row);
}



async function renderTerm(id, version) {
  if (!catalog.resources.some(resource => resource.id === id)) {
    const article = element('article', 'missing-concept');
    article.append(breadcrumb('Concept not included in this build'));
    heading(article, 1, 'Concept not included in this build');
    article.append(element('code', 'full-iri', id));
    const link = element('a', 'browse-link', 'Layers');
    link.href = viewHash(destination(state, 'layers'));
    article.append(link); main.replaceChildren(article); return;
  }
  const resource = model.get(id);
  const role = browse.roleFor(id, state.role);
  document.title = `${resource.label} · ${catalog.title}`;
  const article = element('article', 'term-detail');
  article.append(breadcrumb(resource.label));
  heading(article, 1, resource.label);
  article.append(termMetadata(resource, role, 'detail-metadata'));
  const roles = browse.termRoles(id);
  if (!browse.inScope(id, state.scope)) article.append(element('p', 'status', `This linked term is outside the ${state.scope} browsing scope.`));
  if (browse.historicalOnly?.(id)) article.append(element('p', 'status', 'Historical classification reference; not a current authored definition.'));
  main.replaceChildren(article, element('p', 'status loading-detail', 'Loading details…'));
  const sourceIds = [...new Set([...resource.sourceIds, ...resource.referencedIn])];
  await Promise.all(sourceIds.map(loadSource));
  if (version !== routeVersion) return;
  main.querySelector('.loading-detail')?.remove();
  const statements = graph.statements(id);
  const descriptionMatches = description => statements.filter(statement => DESCRIPTION_PREDICATES.has(statement.predicate) &&
    model.sources.get(statement.sourceId)?.group !== 'Classification' && statement.object.type === 'literal' &&
    statement.object.value === description.value &&
    (statement.object.language ?? '') === (description.language ?? '') &&
    (statement.object.datatype ?? '') === (description.datatype ?? ''));
  const skosDefinition = 'http://www.w3.org/2004/02/skos/core#definition';
  const conceptDefinitions = resource.descriptions.filter(description => descriptionMatches(description)
    .some(statement => statement.predicate === skosDefinition));
  const descriptionsForRole = role === 'concept' && conceptDefinitions.length ? conceptDefinitions :
    role && role !== 'concept' && roles.includes('concept') ? resource.descriptions.filter(description =>
      descriptionMatches(description).some(statement => statement.predicate !== skosDefinition)) : resource.descriptions;
  if (descriptionsForRole.length) {
    const descriptions = element('section', 'descriptions');
    heading(descriptions, 2, role === 'concept' && conceptDefinitions.length ? 'Definition' : 'Description');
    for (const description of descriptionsForRole) {
      const row = element('div', 'description');
      row.append(element('div', 'description-text', description.value));
      const matching = descriptionMatches(description);
      row.append(groupMarks(matching.map(statement => statement.sourceId)));
      descriptions.append(row);
    }
    article.append(descriptions);
  }
  const currentStatements = statements.filter(statement => !['Classification', 'Examples'].includes(model.sources.get(statement.sourceId)?.group));
  renderRelationships(article, id, role);
  if (!role || role === 'class') renderProperties(article, id);
  const semanticStatements = role === 'concept' ? currentStatements.filter(statement =>
    !statement.predicate.startsWith('http://www.w3.org/2002/07/owl#') &&
    !statement.predicate.startsWith('http://www.w3.org/ns/shacl#') &&
    statement.predicate !== 'http://www.w3.org/2000/01/rdf-schema#subClassOf') :
    role && role !== 'class' && roles.includes('class') ? currentStatements.filter(statement =>
      statement.predicate !== 'http://www.w3.org/2000/01/rdf-schema#subClassOf' &&
      !(statement.object.type === 'bnode' && statement.predicate.startsWith('http://www.w3.org/2002/07/owl#'))) : currentStatements;
  renderSemanticLiterals(article, semanticStatements, id);
  renderExpressions(article, semanticStatements, id);
  const linkedExamples = examples.forTerm(id);
  if (linkedExamples.length) {
    const section = element('section', 'semantic-relationships');
    heading(section, 2, 'Examples', linkedExamples.length);
    section.append(exampleView.cardGrid(linkedExamples.map(item => ({ ...item, example: examples.example(item.example) }))));
    article.append(section);
  }
  const technical = element('details', 'technical-details concept-technical');
  technical.append(element('summary', '', 'Technical details · identifiers, sources and full RDF'));
  const body = element('div', 'technical-body');
  identifiers(body, resource);
  const provenance = element('section', 'term-provenance');
  if (resource.sourceIds.length) provenance.append(element('p', 'provenance-label', 'Definition sources'), sourceMarks(resource.sourceIds));
  if (resource.referencedIn.length) provenance.append(element('p', 'provenance-label', 'Referenced in sources'), sourceMarks(resource.referencedIn));
  body.append(provenance);
  renderAssertions(body, statements);
  references(body, id);
  technical.append(body);
  article.append(technical);
}

function groupMarks(sourceIds) {
  const row = element('span', 'origin-marks');
  const groups = [...new Set(sourceIds.map(id => model.sources.get(id)).filter(Boolean).map(sourceCollectionLabel))];
  for (const group of groups) row.append(element('span', 'term-tag origin-badge', group));
  return row;
}

function originMarks(id) {
  const row = element('span', 'origin-marks');
  for (const group of browse.origins(id)) row.append(element('span', 'term-tag origin-badge', group));
  return row;
}

function renderRelationships(parent, id, role = '') {
  const propertyDirections = new Set(browse.propertiesFor(id).map(item => item.direction));
  for (const group of browse.conceptSections(id, state.scope, role)) {
    // Outgoing layer assignment is header metadata. Incoming layer membership
    // remains inverse navigation on layer pages.
    if (group.direction === 'outgoing' &&
      group.predicate === 'http://connectdigitalstudy.com/ontology#belongsToLayer') continue;
    if (group.direction === 'incoming' &&
      ((group.predicate === 'http://www.w3.org/2000/01/rdf-schema#domain' && propertyDirections.has('outgoing')) ||
       (group.predicate === 'http://www.w3.org/2000/01/rdf-schema#range' && propertyDirections.has('incoming')))) continue;
    const resources = group.direction === 'outgoing' && group.predicate === 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type'
      ? group.resources.filter(resource => !INFRASTRUCTURE_TYPES.has(resource.id)) : group.resources;
    if (!resources.length) continue;
    const section = element('section', 'semantic-relationships');
    heading(section, 2, group.label, resources.length);
    section.append(cardGrid(resources, resource => browse.relationRole(group, resource.id)));
    parent.append(section);
  }
}

function renderProperties(parent, id) {
  const properties = browse.propertiesFor(id);
  for (const direction of ['outgoing', 'incoming']) {
    const declarations = properties.filter(item => item.direction === direction);
    const grouped = new Map();
    for (const item of declarations) {
      if (!grouped.has(item.property.id)) grouped.set(item.property.id, []);
      grouped.get(item.property.id).push(item);
    }
    const items = [...grouped.values()];
    if (!items.length) continue;
    const section = element('section', 'concept-properties');
    heading(section, 2, direction === 'outgoing' ? 'Properties' : 'Used by properties', items.length);
    for (const declarations of items) {
      const item = declarations[0], row = element('div', 'property-row');
      row.append(termLink(item.property.id, undefined, 'property-title', 'property'));
      const signature = element('div', 'property-signature');
      const targets = direction === 'outgoing' ? item.ranges : item.domains;
      for (const resource of targets) signature.append(termLink(resource.id, undefined, 'term-link', 'class'));
      row.append(signature);
      const declaration = element('div', 'property-declaration');
      for (const origin of declarations) {
        const mark = element('span', 'declaration-origin');
        mark.append(element('span', '', origin.inherited ? 'Inherited · ' : 'Direct · '), termLink(origin.declaredOn.id, undefined, 'term-link', 'class'));
        declaration.append(mark);
      }
      row.append(declaration);
      section.append(row);
    }
    parent.append(section);
  }
}

function renderSemanticLiterals(parent, statements, ownerId) {
  const omit = new Set([...DESCRIPTION_PREDICATES, 'http://www.w3.org/2000/01/rdf-schema#label',
    'http://www.w3.org/2004/02/skos/core#prefLabel', 'http://www.w3.org/2004/02/skos/core#altLabel']);
  const literals = statements.filter(item => item.object.type === 'literal' && !omit.has(item.predicate) &&
    !item.predicate.startsWith('http://www.w3.org/ns/shacl#'));
  if (!literals.length) return 0;
  const section = element('section', 'scientific-literals');
  heading(section, 2, 'Attributes and annotations');
  for (const group of groupStatements(literals)) {
    const block = element('div', 'attribute-block');
    const title = heading(block, 3, model.get(group.predicate).label);
    title.replaceChildren(termLink(group.predicate));
    for (const item of group.values) block.append(element('div', 'attribute-value', item.object.value), groupMarks(item.sourceIds));
    section.append(block);
  }
  parent.append(section);
  return literals.length;
}

function renderExpressions(parent, statements, ownerId) {
  const shacl = 'http://www.w3.org/ns/shacl#';
  const owl = 'http://www.w3.org/2002/07/owl#';
  const blanks = statements.filter(item => item.object.type === 'bnode');
  const logical = blanks.filter(item => item.predicate.startsWith(owl) || item.predicate === 'http://www.w3.org/2000/01/rdf-schema#subClassOf');
  const validation = statements.filter(item => item.predicate.startsWith(shacl));
  const other = blanks.filter(item => !logical.includes(item) && !item.predicate.startsWith(shacl));
  let count = 0;
  for (const [title, values] of [['OWL logical conditions', logical], ['Validation requirements (SHACL)', validation], ['Structured relationships', other]]) {
    const summaries = new Map(values.map(item => [item, item.object.type === 'bnode'
      ? describeExpression(graph, item.object, item.sourceId, id => model.get(id).label) : '']));
    const matching = values;
    if (!matching.length) continue;
    const section = element('section', 'semantic-expressions');
    heading(section, 2, title);
    for (const item of matching) {
      const block = element('div', 'expression-summary');
      block.append(termLink(item.predicate, undefined, 'expression-predicate'));
      if (item.object.type === 'literal') block.append(element('div', 'attribute-value', item.object.value));
      else if (item.object.type === 'iri') block.append(termLink(item.object.value));
      else {
        const summary = summaries.get(item);
        if (summary) block.append(element('p', 'expression-description', summary));
        const details = element('details', 'expression-technical');
        details.append(element('summary', '', 'Inspect expression'), rdfValue(item.object, item.sourceId));
        block.append(details);
      }
      block.append(groupMarks([item.sourceId]));
      section.append(block);
    }
    parent.append(section);
    count += matching.length;
  }
  return count;
}

function sourceMetadata(source, parent) {
  const metadata = element('dl', 'metadata source-metadata');
  metadata.append(element('dt', '', 'Group'), element('dd', '', source.group),
    element('dt', '', 'Path'), element('dd', 'source-path', source.path),
    element('dt', '', 'Format'), element('dd', '', source.format));
  parent.append(metadata);
  if (source.description) {
    const values = Array.isArray(source.description) ? source.description : [source.description];
    for (const value of values) parent.append(element('div', 'source-description', typeof value === 'string' ? value : value.value));
  }
  const downloadUrl = safeLocalUrl(source.downloadUrl, location.href);
  if (downloadUrl) {
    const download = element('a', 'download-link', 'Download source ↓');
    download.href = downloadUrl;
    download.download = source.path.split('/').at(-1);
    parent.append(download);
  }
  const technical = element('details', 'technical-details');
  technical.append(element('summary', '', 'Source details'));
  const fields = element('dl', 'metadata');
  fields.append(element('dt', '', 'Identifier'), element('dd', '', source.id),
    element('dt', '', 'SHA-256'), element('dd', 'full-iri', source.sha256),
    element('dt', '', 'Triples'), element('dd', '', source.tripleCount.toLocaleString()));
  const origin = safeExternalUrl(source.originUrl);
  if (origin) {
    const value = element('dd');
    const link = element('a', '', origin);
    link.href = origin;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    value.append(link);
    fields.append(element('dt', '', 'Source URL'), value);
  }
  technical.append(fields);
  for (const item of source.imports) {
    if (!item.resolution) continue;
    const row = element('div', 'import-resolution');
    row.append(termLink(item.iri, item.iri), element('code', '', item.resolution), sourceMarks(item.sourceIds));
    technical.append(row);
  }
  parent.append(technical);
}

async function renderModule(id, version) {
  const source = model.sources.get(id);
  if (!source) throw new Error(`Module not found: ${id}`);
  document.title = `${source.label} · ${catalog.title}`;
  const article = element('article', 'source-detail');
  article.append(breadcrumb(source.label));
  heading(article, 1, source.label);
  sourceMetadata(source, article);
  if (source.ontologyIds.length) {
    const section = element('section');
    heading(section, 2, 'Ontology');
    for (const iri of source.ontologyIds) section.append(termLink(iri, undefined, 'ontology-link'));
    article.append(section);
  }
  if (source.imports.length) {
    const section = element('section');
    heading(section, 2, 'Imports', source.imports.length);
    for (const item of source.imports) {
      const row = element('div', 'relation-row');
      row.append(termLink(item.iri), sourceMarks(item.sourceIds));
      section.append(row);
    }
    article.append(section);
  }
  main.replaceChildren(article, element('p', 'status loading-detail', 'Loading source…'));
  const data = await loadSource(id);
  if (version !== routeVersion) return;
  main.querySelector('.loading-detail')?.remove();
  if (typeof data.text === 'string') {
    const section = element('section');
    heading(section, 2, 'SPARQL');
    const pre = element('pre', 'source-code');
    pre.append(element('code', '', data.text));
    section.append(pre);
    article.append(section);
  }
  for (const iri of source.ontologyIds) {
    const statements = graph.statements(iri, id);
    if (!statements.length) continue;
    const section = element('section');
    const title = heading(section, 2, model.get(iri).label);
    title.replaceChildren(termLink(iri));
    renderPredicates(section, statements, [], 3);
    article.append(section);
  }
  const subjects = Object.keys(data.nodes ?? {}).filter(subject => !subject.startsWith('_:'));
  const terms = element('section');
  heading(terms, 2, 'Defined terms', subjects.length);
  terms.append(cardGrid(subjects.sort((a, b) => model.get(a).label.localeCompare(model.get(b).label)).map(model.get)));
  article.append(terms);
  const blanks = Object.keys(data.nodes ?? {}).filter(subject => subject.startsWith('_:'));
  if (blanks.length) {
    const details = element('details', 'source-blank-nodes');
    details.append(element('summary', '', `Expressions · ${blanks.length}`));
    let rendered = false;
    details.addEventListener('toggle', () => {
      if (!details.open || rendered) return;
      rendered = true;
      completeList(details, blanks, value => rdfValue({ type: 'bnode', value }, id));
    });
    article.append(details);
  }
}

function renderSources() {
  document.title = catalog.title;
  const article = element('article', 'home-detail');
  article.append(breadcrumb('Sources'));
  heading(article, 1, 'Sources');
  const groups = new Map();
  for (const source of orderedSources()) {
    const label = sourceCollectionLabel(source);
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label).push(source);
  }
  for (const [group, sources] of groups) {
    const section = element('section', 'home-module-group');
    heading(section, 2, group);
    const grid = element('div', 'module-grid');
    for (const source of sources) {
      const card = element('div', 'module-card');
      card.append(sourceLink(source.id, 'module-title'), element('div', 'module-path', source.path));
      grid.append(card);
    }
    section.append(grid);
    article.append(section);
  }
  main.replaceChildren(article);
}

function renderFamily(id) {
  const family = catalog.collections?.find(item => item.id === id);
  if (!family) { renderSources(); return; }
  document.title = `${family.label} · ${catalog.title}`;
  const article = element('article', 'source-family');
  article.append(breadcrumb(family.label));
  heading(article, 1, family.label);
  const grid = element('div', 'module-grid');
  for (const source of orderedSources().filter(item => item.collectionId === id)) {
    const card = element('div', 'module-card');
    card.append(sourceLink(source.id, 'module-title'), element('div', 'module-path', source.path));
    grid.append(card);
  }
  article.append(grid);
  main.replaceChildren(article);
}

function termTypeTags(resource, requestedRole = '', current = false) {
  const role = browse.roleFor(resource.id, requestedRole);
  const roles = browse.termRoles(resource.id);
  const kinds = roles.length ? roles : resource.kinds?.length ? resource.kinds : ['reference'];
  const tags = element('span', 'type-tags');
  for (const kind of kinds) {
    const label = kind[0].toUpperCase() + kind.slice(1);
    if (roles.includes(kind)) {
      const tag = termLink(resource.id, label, `term-tag type-tag type-${kind}`, kind);
      if (kind === role) {
        if (current) tag.setAttribute('aria-current', 'page');
        else {
          tag.classList.toggle('is-contextual', true);
          tag.setAttribute('aria-label', `${label} presentation`);
        }
      }
      tags.append(tag);
    } else tags.append(element('span', `term-tag type-tag type-${kind}`, label));
  }
  return tags;
}

function termMetadata(resource, requestedRole = '', className = '') {
  const metadata = element('div', `term-metadata ${className}`.trim());
  const types = termTypeTags(resource, requestedRole, className === 'detail-metadata');
  types.setAttribute('aria-label', 'Type');
  metadata.append(types);
  const origins = browse.origins(resource.id);
  if (origins.length) {
    const marks = originMarks(resource.id);
    marks.setAttribute('aria-label', 'Source');
    metadata.append(marks);
  }
  const layers = [...new Set(resource.layers ?? [])];
  if (layers.length) {
    const links = element('span', 'metadata-links');
    links.setAttribute('aria-label', 'Layer');
    for (const [index, id] of layers.entries()) {
      if (index) links.append(element('span', 'metadata-divider', ' · '));
      links.append(termLink(id, undefined, 'term-link', 'class'));
    }
    metadata.append(links);
  }
  return metadata;
}

function card(resource, requestedRole = '') {
  const role = browse.roleFor(resource.id, requestedRole);
  const node = element('div', 'browse-card');
  node.append(termLink(resource.id, undefined, 'card-title', role));
  node.append(termMetadata(resource, role, 'card-metadata'));
  if (resource.descriptions?.length) node.append(cardDescription(resource.descriptions[0].value));
  return node;
}

function cardDescription(text) {
  const description = element('div', 'card-description-wrap');
  description.setAttribute('tabindex', '0');
  description.append(element('p', 'card-description', text));
  const full = element('div', 'card-description-full', text);
  full.setAttribute('aria-hidden', 'true');
  description.append(full);
  return description;
}

function cardGrid(resources, requestedRole = '') {
  const collection = element('div', 'card-collection');
  const cards = element('div', 'browse-grid');
  const records = resources.map(resource => {
    const role = typeof requestedRole === 'function' ? requestedRole(resource) : requestedRole;
    const node = card(resource, role);
    cards.append(node);
    return { node, origins: browse.originEntries(resource.id) };
  });
  const represented = [...new Map(records.flatMap(record => record.origins)
    .map(origin => [origin.id, origin])).values()].sort((a, b) => a.label.localeCompare(b.label) || a.id.localeCompare(b.id));
  if (represented.length > 1) {
    const active = new Set(represented.map(origin => origin.id));
    const toggles = element('div', 'source-toggles');
    toggles.setAttribute('role', 'group');
    toggles.setAttribute('aria-label', 'Filter cards by source');
    const refresh = () => {
      for (const record of records) {
        // Terms without declared source provenance remain reachable.
        record.node.hidden = record.origins.length > 0 && !record.origins.some(origin => active.has(origin.id));
      }
    };
    for (const origin of represented) {
      const toggle = action(origin.label, () => {
        if (active.has(origin.id)) active.delete(origin.id); else active.add(origin.id);
        toggle.setAttribute('aria-pressed', String(active.has(origin.id)));
        refresh();
      }, 'term-tag source-toggle');
      toggle.setAttribute('aria-pressed', 'true');
      toggles.append(toggle);
    }
    collection.append(toggles);
  }
  collection.append(cards);
  return collection;
}

function renderBrowseHome() {
  renderOverview('introduction');
}

function renderEntry(id) {
  const entry = browse.entryPoints(state.scope).find(entry => entry.id === id);
  const title = id === 'layers' ? 'Layers' : entry?.label ?? id;
  document.title = `${title} · ${catalog.title}`;
  const article = element('article', 'browse-home');
  article.append(breadcrumb(title));
  heading(article, 1, title);
  const role = { layers: 'class', dimensions: 'class', classes: 'class', properties: 'property', vocabularies: 'scheme' }[id] ?? '';
  const grid = cardGrid(entry?.resources ?? [], role);
  grid.classList.toggle('layer-grid', true);
  article.append(grid);
  main.replaceChildren(article);
}

function renderOverview(view) {
  const title = view === 'introduction' ? 'Introduction' : 'Examples';
  document.title = `${title} · ${catalog.title}`;
  const article = element('article', 'browse-home');
  article.append(breadcrumb(title)); heading(article, 1, title);
  if (view === 'introduction') renderIntroduction(article);
  if (view === 'examples') article.append(exampleView.cardGrid(examples.examples.map(example => ({
    example, page: example.rootPage, title: example.title, description: example.description,
  }))));
  main.replaceChildren(article);
}

function renderIntroduction(article) {
  article.append(element('p', 'description-text',
    'The ontology describes measurements, derived features, digital phenotypes and the context in which data is collected and used. The four Structure views provide different routes through the same ontology.'));
  const sections = [
    ['layers', 'Layers',
      'Group terms by their role: measurements, derived features, digital phenotypes, questionnaires, computations, context and provenance. Open a layer to see the terms assigned to it.'],
    ['vocabularies', 'Vocabularies',
      'Organise concepts—named topics or categories—into groups such as measurement domains, device ecosystems and response formats. Open a vocabulary to browse its concepts, follow broader and narrower relationships, and find the ontology terms linked to them.'],
    ['classes', 'Classes',
      'Define kinds of things, such as participants, measurements, datasets and computations. A subclass is a more specific kind of its superclass. Browse from the roots of the class hierarchy to definitions, subclasses, relationships and declared or inherited properties.'],
    ['properties', 'Properties',
      'Describe relationships, values and annotations, such as a dataset’s participant or a response’s value. Open a property to see its definition, subproperties and any declared domain and range. The domain identifies the type of thing described; the range identifies the type of thing or value linked to it.'],
  ];
  for (const [id, title, description] of sections) {
    const section = element('section');
    const link = element('a', 'term-link introduction-link', title);
    link.href = viewHash({ ...destination(state, id), path: ['entry:introduction'] });
    heading(section, 2, '').append(link);
    section.append(element('p', 'description-text', description));
    article.append(section);
  }
}

function renderExample(id, pageId) {
  const example = examples.example(id), page = examples.page(id, pageId);
  const title = page?.title ?? 'Example not included in this build';
  document.title = `${title} · ${catalog.title}`;
  const article = element('article', 'example-detail');
  article.append(breadcrumb(title)); heading(article, 1, title);
  if (example && page) exampleView.renderPage(article, example, page);
  else {
    const link = element('a', 'browse-link', 'Examples');
    link.href = viewHash(destination(state, 'examples')); article.append(link);
  }
  main.replaceChildren(article);
}

function breadcrumb(currentLabel) {
  const nav = element('nav', 'breadcrumb');
  nav.setAttribute('aria-label', 'Browsing path');
  const entries = new Map(browse.entryPoints(state.scope).map(entry => [entry.id, entry]));
  const path = state.path.filter(step => !pathStepTerm(step).startsWith('relation:') &&
    !(pathStepTerm(step) && pathStepTerm(step) === state.term && pathStepRole(step) === state.role) &&
    !(isExampleStep(step) && step.example === state.example && step.page === examples.page(state.example, state.page)?.id));
  for (const [index, step] of path.entries()) {
    const id = pathStepTerm(step);
    if (index) nav.append(element('span', 'breadcrumb-divider', ' / '));
    const link = element('a', 'breadcrumb-link');
    if (isExampleStep(step)) {
      link.textContent = examples.page(step.example, step.page)?.title ?? step.page;
      link.href = viewHash({ ...destination(state, 'example', step.example, step.page), path: path.slice(0, index), searchReturn: state.searchReturn });
    } else if (id.startsWith('entry:')) {
      const entry = id.slice(6);
      link.textContent = ({ introduction: 'Introduction', examples: 'Examples', concepts: 'Vocabularies' })[entry] ?? entries.get(entry)?.label ?? entry;
      link.href = viewHash({ ...destination(state, entry), searchReturn: state.searchReturn });
    } else if (id.startsWith('collection:')) {
      const family = id.slice(11);
      link.textContent = catalog.collections?.find(item => item.id === family)?.label ?? family;
      link.href = viewHash({ ...destination(state, 'family', family), searchReturn: state.searchReturn });
    } else if (id.startsWith('module:')) {
      const module = id.slice(7);
      link.textContent = model.sources.get(module)?.label ?? module;
      link.href = viewHash({ ...destination(state, 'module', module), path: path.slice(0, index), searchReturn: state.searchReturn });
    } else if (id === 'search') {
      link.textContent = 'Search';
      link.href = viewHash(state.searchReturn ?? { ...destination(state, 'all'), view: 'all' });
    } else {
      link.textContent = model.get(id).label;
      const role = browse.roleFor(id, pathStepRole(step));
      link.href = viewHash({ ...destination(state, 'term', id, role), path: path.slice(0, index), searchReturn: state.searchReturn });
      if (role && id === state.term) link.textContent += ` (${role})`;
    }
    nav.append(link);
  }
  if (path.length) nav.append(element('span', 'breadcrumb-divider', ' / '));
  nav.append(element('span', 'breadcrumb-current', currentLabel));
  return nav;
}

function renderPageComment() {
  const article = main.querySelector('article');
  if (!article) return;
  const anchor = article.querySelector('.detail-metadata') ?? article.querySelector('h1');
  const currentLabel = article.querySelector('.breadcrumb-current')?.textContent;
  if (!anchor || !currentLabel) return;
  const commentUrl = commentFormUrl(comments, canonicalPageId(state, {
    examplePage: examples.page(state.example, state.page)?.id,
  }), currentLabel);
  if (commentUrl) {
    const link = element('a', 'quiet-button comment-link');
    link.href = commentUrl;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.setAttribute('aria-label', `Comment on ${currentLabel} (Google Form, opens in a new tab)`);
    const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    icon.setAttribute('viewBox', '0 0 24 24');
    icon.setAttribute('aria-hidden', 'true');
    icon.setAttribute('focusable', 'false');
    const outline = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    outline.setAttribute('d', 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z');
    icon.append(outline);
    link.append(icon, element('span', '', 'Comment'));
    const row = element('div', 'page-comment');
    row.append(link);
    anchor.after(row);
  }
}

function searchResources() {
  let resources = model.filter({query:state.query,...state.filters}).filter(resource => browse.inScope(resource.id,state.scope)), allowed, label = '';
  if (state.searchEntry) {
    if (state.searchEntry.startsWith('module:')) {
      const sourceId = state.searchEntry.slice(7);
      const subjects = Object.keys(graph.graphs.get(sourceId)?.nodes ?? {});
      allowed = new Set(subjects.length ? subjects.filter(id => !id.startsWith('_:')) : catalog.resources.filter(resource => resource.sourceIds.includes(sourceId)).map(resource => resource.id));
      label = `${model.sources.get(sourceId)?.label ?? sourceId} / Defined terms`;
    } else if (state.searchEntry === 'concepts') {
      // Retain old concept-search links even though Concepts is no longer an entry.
      allowed = new Set(catalog.resources.filter(resource => browse.termRoles(resource.id).includes('concept'))
        .map(resource => resource.id));
      label = 'SKOS concepts';
    } else {
    const entry = browse.entryPoints(state.scope).find(item => item.id === state.searchEntry);
    allowed = new Set((entry?.resources ?? []).map(resource => resource.id));
    label = entry?.label ?? 'Entry';
    }
  } else if (state.searchOwner) {
    let group;
    if (state.searchSection.startsWith('properties:')) {
      const direction = state.searchSection.slice(11);
      group = {label: direction === 'outgoing' ? 'Properties' : 'Used by properties',
        resources: browse.propertiesFor(state.searchOwner).filter(item => item.direction === direction).map(item => item.property)};
    } else group = browse.conceptSections(state.searchOwner, state.scope).find(item => item.id === state.searchSection);
    allowed = new Set((group?.resources ?? []).map(resource => resource.id));
    label = `${model.get(state.searchOwner).label} / ${group?.label ?? 'Relationship'}`;
  }
  if (allowed) resources = resources.filter(resource => allowed.has(resource.id));
  return {resources, label};
}

function renderSearch() {
  const {resources, label} = searchResources();
  document.title = `Search · ${catalog.title}`;
  const article = element('article', 'search-results');
  article.append(breadcrumb('Search'));
  heading(article, 1, 'Search', resources.length);
  if (label) article.append(element('p', 'search-context', label));
  renderFilterControls(article);
  if (!resources.length) article.append(element('p', 'status', 'No matching terms.'));
  completeList(article, resources, termRow);
  main.replaceChildren(article);
}

function renderFilterControls(article) {
  const active = FILTER_KEYS.filter(key => state.filters[key]);
  if (active.length) {
    const filterRow = element('div', 'active-filters');
    for (const key of active) {
      const id = state.filters[key];
      const label = key === 'source' ? model.sources.get(id)?.label ?? id : model.get(id).label;
      filterRow.append(action(`${key}: ${label} ×`, () => changeState({filters:{...state.filters,[key]:''}}), 'filter-chip'));
    }
    filterRow.append(action('Reset advanced filters', () => changeState({filters:emptyFilters()})));
    article.append(filterRow);
  }
  article.append(action('Clear search', () => changeState(clearSearch(state))));
}

function emptyFilters() { return Object.fromEntries(FILTER_KEYS.map(key => [key, ''])); }

function changeState(patch, replace = false, preserveSidebar = false) {
  const next = {...state,...patch};
  const hash = viewHash(next);
  if (replace) { history.replaceState(null, '', hash); renderRoute({preserveSidebar}); }
  else if (hash !== location.hash) location.hash = hash;
}

function renderSidebar() {
  const nav = document.getElementById('browse-navigation');
  nav.replaceChildren();
  heading(nav, 2, 'Overview');
  for (const [id, title] of [['introduction', 'Introduction'], ['examples', 'Examples']]) {
    const link = element('a', 'browse-link', title);
    link.href = viewHash(destination(state, id));
    if (state.view === id || (id === 'examples' && state.example) ||
      (id === 'introduction' && viewIntent(state) === 'home')) link.setAttribute('aria-current', 'page');
    nav.append(link);
  }
  heading(nav, 2, 'Structure');
  for (const entry of browse.entryPoints(state.scope)) {
    const link = element('a', 'browse-link', entry.label);
    link.href = viewHash(destination(state, entry.id));
    if (state.view === entry.id) link.setAttribute('aria-current', 'page');
    nav.append(link);
  }
  if (catalog.collections?.length) {
    heading(nav, 2, 'Sources');
    for (const family of catalog.collections) {
      if (!catalog.sources.some(source => source.collectionId === family.id)) continue;
      const link = element('a', 'browse-link', family.label);
      link.href = viewHash(destination(state, 'family', family.id));
      if (state.view === 'family' && state.family === family.id) link.setAttribute('aria-current', 'page');
      nav.append(link);
    }
  }
}

function syncControls() {
  document.getElementById('search').value = state.query;
  for (const key of FILTER_KEYS) document.getElementById(`${key}-filter`).value = state.filters[key];
  const active = FILTER_KEYS.filter(key => state.filters[key]).length;
  document.getElementById('filter-count').textContent = active ? ` · ${active} active` : '';
  renderSidebar();
}

function showError(error, retry) {
  const section = element('section', 'error');
  heading(section, 2, 'Unable to load');
  section.append(element('p', '', error.message), action('Retry', retry));
  main.append(section);
}

function setSidebar(expanded) {
  document.body.classList.toggle('sidebar-closed', !expanded);
  document.getElementById('browse-toggle').setAttribute('aria-expanded', String(expanded));
}

async function renderRoute({preserveSidebar = false} = {}) {
  const version = ++routeVersion;
  state = readViewState(location.hash);
  state.role = browse.roleFor(state.term, state.role);
  state.path = state.path.map(step => typeof step === 'string' || isExampleStep(step) ? step :
    termPathStep(step.term, browse.roleFor(step.term, step.role)));
  syncControls();
  main.setAttribute('aria-busy', 'true');
  main.scrollTop = 0;
  document.querySelector('.workspace').scrollTop = 0;
  if (!preserveSidebar && matchMedia('(max-width: 760px)').matches) setSidebar(false);
  try {
    const intent = viewIntent(state);
    if (intent === 'search') renderSearch();
    else if (intent === 'term') await renderTerm(state.term, version);
    else if (intent === 'module') await renderModule(state.module, version);
    else if (intent === 'family') renderFamily(state.family);
    else if (intent === 'sources') renderSources();
    else if (intent === 'introduction' || intent === 'examples') renderOverview(intent);
    else if (intent === 'example') renderExample(state.example, state.page);
    else if (intent === 'entry') renderEntry(state.view);
    else renderBrowseHome();
    if (version === routeVersion) renderPageComment();
  } catch (error) {
    if (version === routeVersion) {
      main.querySelector('.loading-detail')?.remove();
      main.querySelector('.error')?.remove();
      showError(error, renderRoute);
    }
  } finally {
    if (version === routeVersion) main.setAttribute('aria-busy', 'false');
  }
}

function initializeNavigation() {
  for (const source of orderedSources()) {
    const option = element('option', '', `${sourceCollectionLabel(source)} · ${source.label}`);
    option.value = source.id;
    document.getElementById('source-filter').append(option);
  }
  for (const [field, selectId] of [['types', 'type-filter'], ['layers', 'layer-filter'], ['schemes', 'scheme-filter']]) {
    const options = model.options(field);
    for (const id of options) {
      const option = element('option', '', model.get(id).label);
      option.value = id;
      option.title = id;
      document.getElementById(selectId).append(option);
    }
    if (field === 'layers') document.getElementById('layer-label').hidden = !options.length;
    if (field === 'schemes') document.getElementById('scheme-label').hidden = !options.length;
  }
  document.getElementById('search').addEventListener('input', event => changeState({query:event.target.value}, Boolean(state.query)));
  for (const key of FILTER_KEYS) {
    document.getElementById(`${key}-filter`).addEventListener('change', event => changeState({filters:{...state.filters,[key]:event.target.value}}));
  }
  document.getElementById('clear-filters').addEventListener('click', () => changeState({filters:emptyFilters()}));
  document.getElementById('site-title').addEventListener('click', event => {
    event.preventDefault();
    changeState(destination(state,'home'));
  });
  document.getElementById('browse-toggle').addEventListener('click', () =>
    setSidebar(document.body.classList.contains('sidebar-closed')));
  document.querySelector('.skip-link').addEventListener('click', event => {
    event.preventDefault();
    main.focus();
  });
  window.addEventListener('hashchange', renderRoute);
  setSidebar(!matchMedia('(max-width: 760px)').matches);
}

async function start() {
  try {
    const [data, navigation, config, exampleData, commentData] = await Promise.all([
      readJson('./catalog.json'), readJson('./navigation.json'), readJson('./browse-config.json'), readJson('./examples.json'),
      readJson('./comments.json').catch(() => null)]);
    comments = commentFormConfig(commentData);
    catalog = data;
    model = createCatalogModel(catalog);
    browse = createBrowseModel(catalog, navigation, config);
    examples = createExampleModel(exampleData);
    exampleView = createExampleView({ element, heading, termLink, exampleLink, cardDescription, baseUrl: () => location.href });
    ({rdfValue,renderPredicates,renderAssertions,references} = createTechnicalView({graph,model,catalog,element,action,termLink,sourceMarks,heading,paged:completeList,compactIdentifier}));
    document.getElementById('site-title').textContent = catalog.title;
    initializeNavigation();
    await renderRoute();
  } catch (error) {
    main.replaceChildren();
    main.setAttribute('aria-busy', 'false');
    showError(error, () => location.reload());
  }
}

start();
