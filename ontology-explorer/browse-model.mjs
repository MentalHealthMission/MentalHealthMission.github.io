/** Presentation navigation over asserted named RDF edges. No scientific inference. */
import { localIdentifier } from './model.mjs';

const BASE = 'http://connectdigitalstudy.com/ontology#';
const RDFS = 'http://www.w3.org/2000/01/rdf-schema#';
const RDF = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#';
const OWL = 'http://www.w3.org/2002/07/owl#';
const SKOS = 'http://www.w3.org/2004/02/skos/core#';
export const PREDICATES = Object.freeze({
  type: `${RDF}type`, subClassOf: `${RDFS}subClassOf`, subPropertyOf: `${RDFS}subPropertyOf`,
  broader: `${SKOS}broader`, narrower: `${SKOS}narrower`, domain: `${RDFS}domain`,
  range: `${RDFS}range`, hasCategory: `${BASE}hasCategory`, odimFeature: `${BASE}odimFeature`,
  belongsToLayer: `${BASE}belongsToLayer`, inScheme: `${SKOS}inScheme`,
  hasTopConcept: `${SKOS}hasTopConcept`, topConceptOf: `${SKOS}topConceptOf`,
  inverseOf: `${OWL}inverseOf`,
  operationalizesDomain: 'http://connectdigitalstudy.com/ontology/redcap#operationalizesDomain',
  platform: `${BASE}platform`,
  skosTag: `${BASE}skosTag`,
});
const P = PREDICATES;
const STRUCTURE = new Set([P.subClassOf, P.subPropertyOf, P.broader]);
const EXCLUDED = new Set(['Classification', 'Classifications', 'Examples']);
const TYPE_KINDS = new Map([
  [`${OWL}Class`, 'class'], [`${RDFS}Class`, 'class'],
  [`${RDFS}Datatype`, 'class'],
  [`${OWL}ObjectProperty`, 'property'], [`${OWL}DatatypeProperty`, 'property'],
  [`${OWL}AnnotationProperty`, 'property'], [`${RDF}Property`, 'property'],
  ...['FunctionalProperty', 'InverseFunctionalProperty', 'TransitiveProperty',
    'SymmetricProperty', 'AsymmetricProperty', 'ReflexiveProperty', 'IrreflexiveProperty']
    .map(name => [`${OWL}${name}`, 'property']),
  [`${SKOS}Concept`, 'concept'], [`${SKOS}ConceptScheme`, 'scheme'],
  [`${OWL}NamedIndividual`, 'individual'], [`${OWL}Ontology`, 'ontology'],
  ['http://www.w3.org/ns/shacl#NodeShape', 'shape'],
  ['http://www.w3.org/ns/shacl#PropertyShape', 'shape'],
]);
const KIND_LABELS = { class: 'Classes', property: 'Properties', concept: 'SKOS concepts',
  scheme: 'Concept schemes', individual: 'Individuals', shape: 'SHACL shapes',
  ontology: 'Ontologies', other: 'Other terms', reference: 'Referenced terms' };
const compareResource = (a, b) => a.label.localeCompare(b.label) || a.id.localeCompare(b.id);
const edgeKey = edge => JSON.stringify([edge.subject, edge.predicate, edge.object, edge.sourceId]);
const compareEdge = (a, b) => edgeKey(a).localeCompare(edgeKey(b));

export function createBrowseModel(catalog, navigation, config = {}) {
  const resources = new Map((catalog.resources ?? []).map(resource => [resource.id, resource]));
  const sources = new Map((catalog.sources ?? []).map(source => [source.id, source]));
  const collections = new Map((catalog.collections ?? []).map(collection => [collection.id, collection]));
  const sourceCollection = source => source?.collectionId ?? source?.group;
  const sourceOrigin = source => source?.collectionId
    ? collections.get(source.collectionId)?.label ?? source.collectionId
    : source?.label ?? source?.group;
  const authored = edge => sources.has(edge.sourceId) && !EXCLUDED.has(sources.get(edge.sourceId).group);
  const edges = [...new Map((navigation.edges ?? []).filter(authored)
    .map(edge => [edgeKey(edge), edge])).values()].sort(compareEdge);
  const out = new Map(), into = new Map(), definitions = new Map();
  function add(index, id, item) {
    if (!index.has(id)) index.set(id, []);
    index.get(id).push(item);
  }
  for (const edge of edges) {
    add(out, edge.subject, edge);
    add(into, edge.object, edge);
    add(definitions, edge.subject, edge.sourceId);
  }
  function get(id) {
    return resources.get(id) ?? { id, label: localIdentifier(id), names: [], descriptions: [],
      types: [], kinds: ['reference'], sourceIds: [], referencedIn: [], parents: [], layers: [], schemes: [] };
  }
  function definitionSources(id) {
    return [...new Set([...(resources.get(id)?.sourceIds ?? []), ...(definitions.get(id) ?? [])])];
  }
  function originEntries(id) {
    const groups = new Map();
    for (const source of definitionSources(id).map(sourceId => sources.get(sourceId))
      .filter(source => source && !EXCLUDED.has(source.group))) {
      const label = sourceOrigin(source);
      if (label) groups.set(source.collectionId ? `collection:${source.collectionId}` : `source:${source.id}`, label);
    }
    // Keep the distinction observable; a historical-only term never gains authored origins.
    if (!groups.size && historicalOnly(id)) groups.set('group:Classification', 'Classification');
    return [...groups].map(([id, label]) => ({ id, label }))
      .sort((a, b) => a.label.localeCompare(b.label) || a.id.localeCompare(b.id));
  }
  const origins = id => originEntries(id).map(origin => origin.label);
  function historicalOnly(id) {
    const groups = definitionSources(id).map(sourceId => sources.get(sourceId)?.group).filter(Boolean);
    return groups.length > 0 && groups.every(group => ['Classification', 'Classifications'].includes(group));
  }
  function inScope(id, scope = 'all') {
    if (scope === 'all') return resources.has(id) || out.has(id) || into.has(id);
    return definitionSources(id).some(sourceId => {
      const source = sources.get(sourceId);
      if (!source || EXCLUDED.has(source.group)) return false;
      return sourceCollection(source) === scope || source.group === scope ||
        collections.get(sourceCollection(source))?.label === scope;
    });
  }
  const outgoing = id => [...(out.get(id) ?? [])];
  const incoming = id => [...(into.get(id) ?? [])];
  const parents = id => outgoing(id).filter(edge => STRUCTURE.has(edge.predicate));
  const children = id => incoming(id).filter(edge => STRUCTURE.has(edge.predicate));
  function kinds(id) {
    const result = new Set();
    for (const edge of outgoing(id)) {
      if (edge.predicate === P.type && TYPE_KINDS.has(edge.object)) result.add(TYPE_KINDS.get(edge.object));
      if (edge.predicate === P.subClassOf) result.add('class');
      if (edge.predicate === P.subPropertyOf) result.add('property');
    }
    return [...result];
  }
  function roleFor(id, requested = '') {
    return kinds(id).includes(requested) ? requested : '';
  }
  function termRoles(id) {
    return ['class', 'concept', 'individual', 'property', 'scheme', 'shape', 'ontology']
      .filter(role => kinds(id).includes(role));
  }
  function relationRole(group, target) {
    let role = '';
    if ([P.broader, P.narrower, `${SKOS}related`].includes(group.predicate)) role = 'concept';
    else if (group.predicate === P.inScheme) role = group.direction === 'incoming' ? 'concept' : 'scheme';
    else if (group.predicate === P.skosTag) role = group.direction === 'outgoing' ? 'concept' :
      termRoles(target).find(kind => ['class', 'individual'].includes(kind)) ?? '';
    else if ([P.subClassOf, `${OWL}equivalentClass`].includes(group.predicate)) role = 'class';
    else if ([P.subPropertyOf, P.inverseOf, `${OWL}equivalentProperty`].includes(group.predicate)) role = 'property';
    else if ([P.domain, P.range].includes(group.predicate)) role = group.direction === 'outgoing' ? 'class' : 'property';
    else if (group.predicate === P.type) role = group.direction === 'outgoing' ? 'class' : 'individual';
    else if (group.predicate === 'http://www.w3.org/ns/shacl#targetClass') role = group.direction === 'outgoing' ? 'class' : 'shape';
    else if (group.predicate === P.belongsToLayer) role = group.direction === 'outgoing' ? 'class' :
      termRoles(target).find(kind => ['class', 'property', 'individual'].includes(kind)) ?? '';
    return roleFor(target, role);
  }
  function members(id, scope = 'all') {
    const found = new Map();
    function include(target, relation, evidence) {
      if (target === id || !inScope(target, scope)) return;
      const key = `${relation}\u0000${target}`;
      if (!found.has(key)) found.set(key, { resource: get(target), relation, evidence: [] });
      const item = found.get(key);
      const known = new Set(item.evidence.map(edgeKey));
      for (const edge of evidence) if (!known.has(edgeKey(edge))) {
        item.evidence.push(edge); known.add(edgeKey(edge));
      }
    }
    for (const edge of incoming(id)) {
      if ([P.hasCategory, P.operationalizesDomain, P.platform, P.skosTag].includes(edge.predicate)) {
        include(edge.subject, 'direct', [edge]);
        if (edge.predicate === P.hasCategory) for (const mapping of outgoing(edge.subject)) {
          if (mapping.predicate === P.odimFeature) include(mapping.object, 'mapped', [edge, mapping]);
        }
      }
      if (edge.predicate === P.type) include(edge.subject, 'instance', [edge]);
      if (edge.predicate === P.belongsToLayer) include(edge.subject, 'layer', [edge]);
    }
    // Traverse each hierarchy separately. No subclass/SKOS/subproperty cross-over.
    for (const predicate of [P.subClassOf, P.subPropertyOf, P.broader]) {
      const visited = new Set([id]);
      const queue = [{ id, evidence: [] }];
      for (let cursor = 0; cursor < queue.length; cursor++) {
        const current = queue[cursor];
        const next = incoming(current.id).filter(item => item.predicate === predicate);
        if (predicate === P.broader) next.push(...outgoing(current.id).filter(item => item.predicate === P.narrower));
        for (const edge of next) {
          const evidence = [...current.evidence, edge];
          const child = edge.subject === current.id ? edge.object : edge.subject;
          include(child, 'narrower', evidence);
          if (visited.has(child)) continue;
          visited.add(child);
          queue.push({ id: child, evidence });
        }
      }
    }
    return [...found.values()].sort((a, b) => compareResource(a.resource, b.resource) ||
      a.relation.localeCompare(b.relation));
  }
  function anchors(ids, scope) {
    return [...new Set(ids)].filter(id => resources.has(id) &&
      definitionSources(id).some(sourceId => sources.has(sourceId) && !EXCLUDED.has(sources.get(sourceId).group)))
      .map(id => ({ ...get(id), count: new Set(members(id, scope).map(item => item.resource.id)).size }))
      .filter(resource => inScope(resource.id, scope) || resource.count > 0);
  }
  function subjects(scope = 'all') {
    const configuredTypes = new Set(config.subjectTypes ?? []);
    const typed = edges.filter(edge => edge.predicate === P.type && configuredTypes.has(edge.object))
      .map(edge => edge.subject);
    return anchors([...(config.subjects ?? []), ...typed.sort((a, b) => compareResource(get(a), get(b)))], scope);
  }
  const frameworks = (scope = 'all') => anchors(config.frameworks ?? [], scope);
  function layerMembers(id, scope = 'all') {
    return [...new Set(incoming(id).filter(edge => edge.predicate === P.belongsToLayer)
      .map(edge => edge.subject))].filter(target => inScope(target, scope)).map(get).sort(compareResource);
  }
  function layers(scope = 'all') {
    const ids = new Set(), visited = new Set([`${BASE}OntologyLayer`]);
    const queue = [...visited];
    for (let cursor = 0; cursor < queue.length; cursor++) {
      for (const edge of incoming(queue[cursor]).filter(item => item.predicate === P.subClassOf)) {
        ids.add(edge.subject);
        if (!visited.has(edge.subject)) { visited.add(edge.subject); queue.push(edge.subject); }
      }
    }
    for (const edge of edges) if (edge.predicate === P.belongsToLayer) ids.add(edge.object);
    // Referenced layer targets still have a place under all; they are not invented declarations.
    return [...ids].map(id => ({ ...get(id), count: layerMembers(id, scope).length }))
      .filter(resource => inScope(resource.id, scope) || resource.count > 0)
      .sort(compareResource);
  }
  function roots(kind = 'class', scope = 'all') {
    const predicate = { class: P.subClassOf, property: P.subPropertyOf, concept: P.broader }[kind];
    const candidates = new Set(edges.filter(edge => edge.predicate === P.type && TYPE_KINDS.get(edge.object) === kind)
      .map(edge => edge.subject));
    for (const edge of edges.filter(edge => edge.predicate === predicate)) {
      candidates.add(edge.subject);
      // A named, undeclared parent remains a browsable reference root.
      if (edge.object !== `${OWL}Thing`) candidates.add(edge.object);
    }
    if (kind === 'concept') for (const edge of edges) {
      if (edge.predicate === P.narrower) { candidates.add(edge.subject); candidates.add(edge.object); }
      if ([P.inScheme, P.topConceptOf].includes(edge.predicate)) candidates.add(edge.subject);
      if (edge.predicate === P.hasTopConcept) candidates.add(edge.object);
    }
    if (kind === 'class') candidates.delete(`${OWL}Thing`);
    const ids = [...candidates];
    const parentIds = id => [
      ...outgoing(id).filter(edge => edge.predicate === predicate).map(edge => edge.object),
      ...(kind === 'concept' ? incoming(id).filter(edge => edge.predicate === P.narrower).map(edge => edge.subject) : []),
    ];
    const childIds = id => [
      ...incoming(id).filter(edge => edge.predicate === predicate).map(edge => edge.subject),
      ...(kind === 'concept' ? outgoing(id).filter(edge => edge.predicate === P.narrower).map(edge => edge.object) : []),
    ].filter(child => candidates.has(child));
    const reachesScope = id => {
      const seen = new Set([id]), queue = [id];
      for (let cursor = 0; cursor < queue.length; cursor++) {
        if (inScope(queue[cursor], scope)) return true;
        for (const child of childIds(queue[cursor])) if (!seen.has(child)) { seen.add(child); queue.push(child); }
      }
      return false;
    };
    const visible = new Set(ids.filter(reachesScope));
    const roots = ids.filter(id => visible.has(id) && !parentIds(id).some(parent => visible.has(parent)));
    const reached = new Set(), queue = [...roots];
    for (let cursor = 0; cursor < queue.length; cursor++) {
      const id = queue[cursor];
      if (reached.has(id)) continue;
      reached.add(id);
      queue.push(...childIds(id).filter(child => visible.has(child) && !reached.has(child)));
    }
    // Disconnected cycles have no formal root. Expose their terms as entry points.
    for (const id of ids) if (visible.has(id) && !reached.has(id)) roots.push(id);
    return roots.map(get).sort(compareResource);
  }
  function groupByType(items) {
    const groups = new Map();
    for (const resource of items) {
      const declared = kinds(resource.id);
      const memberships = declared.length ? declared : [out.has(resource.id) ? 'other' : 'reference'];
      for (const id of memberships) {
        if (!groups.has(id)) groups.set(id, { id, label: KIND_LABELS[id], resources: [] });
        groups.get(id).resources.push(resource);
      }
    }
    return [...groups.values()].map(group => ({ ...group, resources: [...new Map(group.resources
      .map(resource => [resource.id, resource])).values()].sort(compareResource) }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }
  const headings = new Map([
    [P.subClassOf, ['Superclasses', 'Subclasses']],
    [P.subPropertyOf, ['Superproperties', 'Subproperties']],
    [P.broader, ['Broader SKOS concepts', 'Narrower SKOS concepts']],
    [P.narrower, ['Narrower SKOS concepts', 'Broader SKOS concepts']],
    [P.type, ['Declared types', 'Instances']],
    [P.domain, ['Domain', 'Properties with this domain']],
    [P.range, ['Range', 'Properties with this range']],
    [P.hasCategory, ['Categories', 'Categorised entries']],
    [P.odimFeature, ['Mapped features', 'Feature mappings']],
    [P.belongsToLayer, ['Ontology layers', 'Direct layer members']],
    [P.inScheme, ['Vocabularies', 'Concepts']],
    [P.inverseOf, ['Inverse properties', 'Inverse properties']],
    [P.operationalizesDomain, ['Operationalised domains', 'Operational definitions']],
    [P.platform, ['Platforms', 'Entries on this platform']],
    [P.skosTag, ['SKOS concepts', 'Tagged terms']],
    [`http://www.w3.org/ns/prov#wasDerivedFrom`, ['Derived from', 'Derived entities']],
    [`${BASE}derivedFrom`, ['Derived from', 'Derived terms']],
    [`${OWL}sameAs`, ['Same as (OWL)', 'Same as (OWL)']],
    [`${OWL}equivalentClass`, ['Equivalent classes (OWL)', 'Equivalent classes (OWL)']],
    [`${OWL}equivalentProperty`, ['Equivalent properties (OWL)', 'Equivalent properties (OWL)']],
    [`${SKOS}related`, ['Related SKOS concepts', 'Related SKOS concepts']],
    ['http://www.w3.org/ns/shacl#targetClass', ['SHACL target classes', 'SHACL shapes targeting this class']],
  ]);
  function relationGroups(id) {
    const groups = new Map();
    for (const [direction, statements] of [['outgoing', outgoing(id)], ['incoming', incoming(id)]]) {
      for (const edge of statements) {
        let predicate = edge.predicate, viewDirection = direction;
        if (predicate === P.narrower) {
          predicate = P.broader;
          viewDirection = direction === 'outgoing' ? 'incoming' : 'outgoing';
        } else if (predicate === P.hasTopConcept) {
          predicate = P.inScheme;
          viewDirection = direction === 'outgoing' ? 'incoming' : 'outgoing';
        } else if (predicate === P.topConceptOf) predicate = P.inScheme;
        const key = `${viewDirection}:${predicate}`;
        if (!groups.has(key)) groups.set(key, {
          id: key, predicate, direction: viewDirection, known: headings.has(predicate),
          label: headings.get(predicate)?.[viewDirection === 'outgoing' ? 0 : 1] ??
            `${get(predicate).label}${viewDirection === 'incoming' ? ' (referencing this term)' : ''}`,
          edges: [],
        });
        const group = groups.get(key);
        group.edges.push(edge);
      }
    }
    for (const group of groups.values()) if ([P.broader, P.inScheme].includes(group.predicate))
      group.targets = group.edges.map(edge => edge.subject === id ? edge.object : edge.subject);
    return [...groups.values()];
  }
  function dimensions(scope = 'all') {
    return [...new Set(config.dimensionRoots ?? [])].filter(id => resources.has(id) &&
      kinds(id).includes('class') && definitionSources(id).some(sourceId =>
        sources.has(sourceId) && !EXCLUDED.has(sources.get(sourceId).group)))
      .filter(id => inScope(id, scope) || members(id, scope).length > 0).map(get).sort(compareResource);
  }
  function vocabularies(scope = 'all') {
    return [...new Set(edges.filter(edge => edge.predicate === P.type && edge.object === `${SKOS}ConceptScheme`)
      .map(edge => edge.subject))].filter(id => inScope(id, scope) ||
        conceptSections(id, scope).some(section => section.resources.length > 0)).map(get).sort(compareResource);
  }
  function entryPoints(scope = 'all') {
    return [
      { id: 'layers', label: 'Layers', resources: layers(scope) },
      { id: 'vocabularies', label: 'Vocabularies', resources: vocabularies(scope) },
      { id: 'classes', label: 'Classes', resources: roots('class', scope) },
      { id: 'properties', label: 'Properties', resources: roots('property', scope) },
    ].filter(group => group.resources.length > 0);
  }
  function conceptSections(id, scope = 'all', role = '') {
    role = roleFor(id, role);
    const result = [];
    function section(group, statements, suffix = '', label = group.label,
      includeTarget = target => inScope(target, scope)) {
      const targetFor = edge => group.targets?.[group.edges.indexOf(edge)] ??
        (group.direction === 'outgoing' ? edge.object : edge.subject);
      const scoped = statements.filter(edge => includeTarget(targetFor(edge)));
      const targets = [...new Set(scoped.map(targetFor))];
      if (targets.length) result.push({ ...group, id: `${group.id}${suffix}`, label,
        resources: targets.map(get).sort(compareResource), edges: scoped });
    }
    const isScheme = kinds(id).includes('scheme');
    for (const group of relationGroups(id)) {
      // Presentation roles do not merge SKOS and OWL semantics. The complete
      // unfiltered relationship index and RDF remain available independently.
      const conceptRelation = [P.broader, P.narrower, P.inScheme, `${SKOS}related`].includes(group.predicate) ||
        (group.predicate === P.skosTag && group.direction === 'incoming');
      const classRelation = [P.subClassOf, `${OWL}equivalentClass`].includes(group.predicate) ||
        ([P.domain, P.range, P.type, 'http://www.w3.org/ns/shacl#targetClass'].includes(group.predicate) && group.direction === 'incoming');
      const propertyRelation = [P.subPropertyOf, P.inverseOf, `${OWL}equivalentProperty`].includes(group.predicate) ||
        ([P.domain, P.range].includes(group.predicate) && group.direction === 'outgoing');
      if (role === 'concept' && (classRelation || propertyRelation || group.predicate === P.type)) continue;
      if (role && role !== 'class' && kinds(id).includes('class') && classRelation) continue;
      if (role && role !== 'property' && kinds(id).includes('property') && propertyRelation) continue;
      if (role && !['concept', 'scheme'].includes(role) && conceptRelation && kinds(id).includes('concept')) continue;
      if (group.predicate === P.belongsToLayer && group.direction === 'incoming') {
        for (const [kind, label] of [['class', 'Classes in this layer'], ['property', 'Properties in this layer']]) {
          section(group, group.edges.filter(edge => kinds(edge.subject).includes(kind)), `:${kind}`, label);
        }
        section(group, group.edges.filter(edge => !kinds(edge.subject).some(kind => ['class', 'property'].includes(kind))),
          ':members', 'Instances and other terms in this layer');
      } else if (isScheme && group.predicate === P.inScheme && group.direction === 'incoming') {
        const members = new Set(group.targets ?? group.edges.map(edge => edge.subject));
        const broaderParents = child => new Set([
          ...outgoing(child).filter(edge => edge.predicate === P.broader).map(edge => edge.object),
          ...incoming(child).filter(edge => edge.predicate === P.narrower).map(edge => edge.subject),
        ].filter(parent => members.has(parent)));
        const assertedTop = new Set(group.edges.filter(edge => [P.hasTopConcept, P.topConceptOf].includes(edge.predicate))
          .map(edge => group.targets[group.edges.indexOf(edge)]));
        const rootIds = [...members].filter(child => assertedTop.has(child) || broaderParents(child).size === 0);
        const reached = new Set(), queue = [...rootIds];
        for (let cursor = 0; cursor < queue.length; cursor++) {
          const parent = queue[cursor];
          if (reached.has(parent)) continue;
          reached.add(parent);
          for (const child of members) if (broaderParents(child).has(parent) && !reached.has(child)) queue.push(child);
        }
        // Keep cycle-only and otherwise disconnected scheme members reachable.
        for (const member of members) if (!reached.has(member)) rootIds.push(member);
        const roots = new Set(rootIds);
        const reachesScope = root => {
          const seen = new Set([root]), queue = [root];
          for (let cursor = 0; cursor < queue.length; cursor++) {
            if (inScope(queue[cursor], scope)) return true;
            for (const member of members) if (!seen.has(member) && broaderParents(member).has(queue[cursor])) {
              seen.add(member); queue.push(member);
            }
          }
          return false;
        };
        section(group, group.edges.filter(edge => roots.has(group.targets?.[group.edges.indexOf(edge)] ?? edge.subject)),
          '', group.label, reachesScope);
      } else section(group, group.edges);
    }
    const directNavigation = new Set([P.subClassOf, P.subPropertyOf, P.broader,
      P.belongsToLayer, P.inScheme, P.type]);
    const priority = section => directNavigation.has(section.predicate)
      ? (section.direction === 'incoming' ? 0 : 1) : 2;
    return result.sort((a, b) => priority(a) - priority(b));
  }
  function propertiesFor(id) {
    if (!kinds(id).includes('class')) return [];
    // Only explicit named superclass paths: no equivalence/restriction reasoning.
    const paths = new Map([[id, []]]), depths = new Map([[id, 0]]), queue = [id];
    for (let cursor = 0; cursor < queue.length; cursor++) {
      const current = queue[cursor];
      for (const edge of outgoing(current).filter(item => item.predicate === P.subClassOf && !item.object.startsWith('_:'))) {
        if (paths.has(edge.object)) continue;
        const assertions = outgoing(current).filter(item => item.predicate === P.subClassOf && item.object === edge.object);
        paths.set(edge.object, [...paths.get(current), ...assertions]);
        depths.set(edge.object, depths.get(current) + 1); queue.push(edge.object);
      }
    }
    const results = [];
    for (const [declaredOn, path] of paths) {
      const grouped = new Map();
      for (const edge of incoming(declaredOn).filter(item => [P.domain, P.range].includes(item.predicate))) {
        const direction = edge.predicate === P.domain ? 'outgoing' : 'incoming';
        const key = `${direction}:${edge.subject}`;
        if (!grouped.has(key)) grouped.set(key, { property: get(edge.subject), direction,
          declaredOn: get(declaredOn), inherited: declaredOn !== id, inheritanceDepth: depths.get(declaredOn),
          domains: [...new Set(outgoing(edge.subject).filter(item => item.predicate === P.domain && !item.object.startsWith('_:')).map(item => item.object))].map(get).sort(compareResource),
          ranges: [...new Set(outgoing(edge.subject).filter(item => item.predicate === P.range && !item.object.startsWith('_:')).map(item => item.object))].map(get).sort(compareResource),
          evidence: [...path] });
        grouped.get(key).evidence.push(edge);
      }
      results.push(...grouped.values());
    }
    return results.sort((a, b) => a.inheritanceDepth - b.inheritanceDepth ||
      compareResource(a.property, b.property) || a.direction.localeCompare(b.direction) || compareResource(a.declaredOn, b.declaredOn));
  }
  return { origins, originEntries, historicalOnly, inScope, subjects, frameworks, members, layers, roots,
    parents, children, outgoing, incoming, layerMembers, groupByType, relationGroups,
    entryPoints, conceptSections, propertiesFor, dimensions, vocabularies,
    roleFor, termRoles, relationRole };
}
