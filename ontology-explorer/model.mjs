/** Pure catalog and RDF graph helpers. No inference or source-specific mapping. */
export function localIdentifier(iri) {
  const split = Math.max(iri.lastIndexOf('#'), iri.lastIndexOf('/'));
  return iri.slice(split + 1) || iri;
}

export function routeHash(kind, id) {
  return `#${new URLSearchParams({ [kind]: id }).toString()}`;
}

export function parseRoute(hash) {
  const values = new URLSearchParams(hash.replace(/^#/, ''));
  if (values.has('term')) return { kind: 'term', id: values.get('term') };
  if (values.has('module') || values.has('source')) {
    return { kind: 'module', id: values.get('module') ?? values.get('source') };
  }
  return { kind: 'home', id: '' };
}

export function safeExternalUrl(value) {
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) ? url.href : null;
  } catch { return null; }
}

export function safeLocalUrl(value, base) {
  try {
    const url = new URL(value, base);
    const origin = new URL(base).origin;
    return ['https:', 'http:'].includes(url.protocol) && url.origin === origin ? url.href : null;
  } catch { return null; }
}

export function objectKey(object) {
  return JSON.stringify([object.type, object.value, object.language ?? '', object.datatype ?? '']);
}

export function groupStatements(statements) {
  const predicates = new Map();
  for (const statement of statements) {
    if (!predicates.has(statement.predicate)) predicates.set(statement.predicate, new Map());
    const objects = predicates.get(statement.predicate);
    const key = objectKey(statement.object);
    if (!objects.has(key)) objects.set(key, { object: statement.object, sourceIds: [] });
    const item = objects.get(key);
    if (!item.sourceIds.includes(statement.sourceId)) item.sourceIds.push(statement.sourceId);
  }
  return [...predicates].map(([predicate, objects]) => ({ predicate, values: [...objects.values()] }));
}

export function createCatalogModel(catalog) {
  const resources = [...catalog.resources].sort((a, b) =>
    a.label.localeCompare(b.label) || a.id.localeCompare(b.id));
  const byId = new Map(resources.map(resource => [resource.id, resource]));
  const sources = new Map(catalog.sources.map(source => [source.id, source]));
  const children = new Map();
  const searchText = new Map();
  for (const resource of resources) {
    searchText.set(resource.id, [resource.id, resource.label, ...(resource.names ?? []),
      ...(resource.labels ?? []).map(label => typeof label === 'string' ? label : label.value),
      ...(resource.descriptions ?? []).map(description => description.value)].join('\n').toLocaleLowerCase());
    for (const parent of resource.parents ?? []) {
      if (!children.has(parent)) children.set(parent, []);
      children.get(parent).push(resource.id);
    }
  }
  function get(id) {
    return byId.get(id) ?? { id, label: localIdentifier(id), descriptions: [], types: [],
      kinds: [], sourceIds: [], referencedIn: [], parents: [], layers: [], schemes: [] };
  }
  function filter({ query = '', source = '', type = '', layer = '', scheme = '' } = {}) {
    const words = query.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
    return resources.filter(resource =>
      words.every(word => searchText.get(resource.id).includes(word)) &&
      (!source || resource.sourceIds.includes(source) || resource.referencedIn.includes(source)) &&
      (!type || resource.types.includes(type)) &&
      (!layer || resource.layers.includes(layer)) &&
      (!scheme || resource.schemes.includes(scheme)));
  }
  function options(field) {
    return [...new Set(resources.flatMap(resource => resource[field] ?? []))]
      .sort((a, b) => get(a).label.localeCompare(get(b).label) || a.localeCompare(b));
  }
  return { resources, byId, sources, get, filter, options, children };
}

export class GraphIndex {
  constructor() {
    this.graphs = new Map();
    this.outgoing = new Map();
    this.incoming = new Map();
  }
  add(graph) {
    if (this.graphs.has(graph.id)) return;
    this.graphs.set(graph.id, graph);
    for (const [subject, statements] of Object.entries(graph.nodes ?? {})) {
      if (!this.outgoing.has(subject)) this.outgoing.set(subject, []);
      for (const statement of statements) {
        const indexed = { ...statement, subject, sourceId: graph.id };
        this.outgoing.get(subject).push(indexed);
        const references = [[statement.predicate, 'predicate']];
        if (statement.object.type === 'iri' || statement.object.type === 'bnode') {
          references.push([statement.object.value, 'object']);
        }
        if (statement.object.type === 'literal' && statement.object.datatype) {
          references.push([statement.object.datatype, 'datatype']);
        }
        for (const [target, role] of references) {
          if (!this.incoming.has(target)) this.incoming.set(target, []);
          this.incoming.get(target).push({ ...indexed, role });
        }
      }
    }
  }
  statements(id, sourceId) {
    return (this.outgoing.get(id) ?? []).filter(statement => !sourceId || statement.sourceId === sourceId);
  }
  references(id) { return this.incoming.get(id) ?? []; }
  list(sourceId, id) {
    const first = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first';
    const rest = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest';
    const nil = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#nil';
    const items = [];
    const visited = new Set();
    let cursor = id;
    while (cursor !== nil) {
      if (visited.has(cursor)) return { items, cycle: true, complete: false, tail: cursor };
      visited.add(cursor);
      const statements = this.statements(cursor, sourceId);
      const heads = statements.filter(statement => statement.predicate === first);
      const tails = statements.filter(statement => statement.predicate === rest);
      if (heads.length !== 1 || tails.length !== 1 || !['iri', 'bnode'].includes(tails[0].object.type)) {
        return { items, cycle: false, complete: false, tail: cursor };
      }
      items.push(heads[0].object);
      cursor = tails[0].object.value;
    }
    return { items, cycle: false, complete: true, tail: nil };
  }
  blankNode(sourceId, id, ancestors = []) {
    const key = `${sourceId}\u0000${id}`;
    return { key, cycle: ancestors.includes(key), ancestors: [...ancestors, key],
      statements: this.statements(id, sourceId) };
  }
}
