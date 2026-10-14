/** Conservative, source-scoped descriptions. These are not inference or validation. */
const RDF = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#';
const RDFS = 'http://www.w3.org/2000/01/rdf-schema#';
const OWL = 'http://www.w3.org/2002/07/owl#';
const SH = 'http://www.w3.org/ns/shacl#';
const XSD = 'http://www.w3.org/2001/XMLSchema#';
const metadata = new Set([`${RDFS}label`, `${RDFS}comment`]);
const types = new Set(['Restriction', 'Class', 'DataRange'].map(name => OWL + name)
  .concat(['NodeShape', 'PropertyShape'].map(name => SH + name)));
const maxDepth = 16;
const maxList = 128;

/** Plain text only; callers must insert the result as text, never HTML. */
export function describeExpression(index, object, sourceId, labelFor = id => id) {
  if (!sourceId) return null;
  let remaining = 512;
  const label = id => String(labelFor(id) ?? id);
  const one = (fields, key) => fields.get(key)?.length === 1 ? fields.get(key)[0] : null;
  const reference = value => value && ['iri', 'bnode'].includes(value.type);
  const count = value => value?.type === 'literal' && !value.language &&
    (!value.datatype || [XSD + 'integer', XSD + 'nonNegativeInteger'].includes(value.datatype)) &&
    /^\+?\d+$/.test(value.value) ? value.value : null;

  function fieldsFor(id) {
    const fields = new Map();
    const nodeTypes = [];
    for (const { predicate, object: value } of index.statements(id, sourceId)) {
      if (metadata.has(predicate)) {
        if (value.type !== 'literal') return null;
        continue;
      }
      if (predicate === RDF + 'type') {
        if (value.type !== 'iri' || !types.has(value.value)) return null;
        nodeTypes.push(value.value);
        continue;
      }
      if (!fields.has(predicate)) fields.set(predicate, []);
      fields.get(predicate).push(value);
    }
    return { fields, nodeTypes };
  }

  function readList(value, depth, ancestors, renderItem = render) {
    if (!reference(value)) return null;
    // Verify each list cell too: do not hide unrecognised triples on its nodes.
    let cursor = value.value;
    const seen = new Set();
    while (cursor !== RDF + 'nil') {
      if (seen.has(cursor) || seen.size >= maxList) return null;
      seen.add(cursor);
      const statements = index.statements(cursor, sourceId);
      if (statements.some(item => item.predicate === RDF + 'type'
        ? item.object.type !== 'iri' || item.object.value !== RDF + 'List'
        : ![RDF + 'first', RDF + 'rest', ...metadata].includes(item.predicate) ||
          (metadata.has(item.predicate) && item.object.type !== 'literal'))) return null;
      const heads = statements.filter(item => item.predicate === RDF + 'first');
      const tails = statements.filter(item => item.predicate === RDF + 'rest');
      if (heads.length !== 1 || tails.length !== 1 || !reference(tails[0].object)) return null;
      cursor = tails[0].object.value;
    }
    const list = index.list(sourceId, value.value);
    if (!list.complete || list.cycle || !list.items.length) return null;
    const parts = list.items.map(item => renderItem(item, depth + 1, ancestors));
    return parts.every(part => part !== null) ? parts : null;
  }

  function renderOwl(value, depth, ancestors) {
    const text = render(value, depth, ancestors);
    return text?.startsWith('Validation: ') ? null : text;
  }

  function owl(fields, depth, ancestors) {
    const property = one(fields, OWL + 'onProperty');
    if (property) {
      if (property.type !== 'iri') return null;
      const operators = ['someValuesFrom', 'allValuesFrom', 'hasValue', 'cardinality',
        'minCardinality', 'maxCardinality', 'qualifiedCardinality',
        'minQualifiedCardinality', 'maxQualifiedCardinality'];
      const active = operators.filter(name => fields.has(OWL + name));
      if (active.length !== 1) return null;
      const op = active[0];
      const target = one(fields, OWL + op);
      if (!target) return null;
      const allowed = new Set([OWL + 'onProperty', OWL + op]);
      const qualified = op.includes('Qualified') || op === 'qualifiedCardinality';
      const qualifierKeys = ['onClass', 'onDataRange'].filter(name => fields.has(OWL + name));
      let qualifier = '';
      if (qualified) {
        if (qualifierKeys.length !== 1) return null;
        const key = qualifierKeys[0];
        const value = one(fields, OWL + key);
        if (!reference(value)) return null;
        const text = renderOwl(value, depth + 1, ancestors);
        if (text === null) return null;
        allowed.add(OWL + key);
        qualifier = ` ${key === 'onClass' ? 'of type' : 'in data range'} (${text})`;
      } else if (qualifierKeys.length) return null;
      if ([...fields.keys()].some(key => !allowed.has(key))) return null;
      const name = label(property.value);
      if (op.endsWith('Cardinality') || op === 'cardinality' || op === 'qualifiedCardinality') {
        const amount = count(target);
        if (amount === null) return null;
        const quantifier = op.startsWith('min') ? 'at least' : op.startsWith('max') ? 'at most' : 'exactly';
        return `${quantifier} ${amount} ${name} ${/^\+?0*1$/.test(amount) ? 'value' : 'values'}${qualifier}`;
      }
      if (op !== 'hasValue' && !reference(target)) return null;
      if (op === 'hasValue' && target.type === 'bnode') return null;
      const text = renderOwl(target, depth + 1, ancestors);
      if (text === null) return null;
      if (op === 'someValuesFrom') return `at least one ${name} value of type (${text})`;
      if (op === 'allValuesFrom') return `all ${name} values, if present, are of type (${text})`;
      return `has ${name} value (${text})`;
    }
    if (fields.size !== 1) return null;
    for (const [op, wording] of [['intersectionOf', 'all of'], ['unionOf', 'any of'], ['oneOf', 'one of']]) {
      const value = one(fields, OWL + op);
      if (!value) continue;
      const parts = readList(value, depth, ancestors, (item, d, a) =>
        op === 'oneOf' ? (item.type === 'bnode' ? null : render(item, d, a))
          : reference(item) ? renderOwl(item, d, a) : null);
      return parts ? `${wording} (${parts.join('; ')})` : null;
    }
    const complement = one(fields, OWL + 'complementOf');
    if (!reference(complement)) return null;
    const text = renderOwl(complement, depth + 1, ancestors);
    return text === null ? null : `not (${text})`;
  }

  function shape(fields, depth, ancestors) {
    const allowed = new Set(['path', 'minCount', 'maxCount', 'class', 'datatype', 'in', 'or', 'and', 'not'].map(name => SH + name));
    if ([...fields.keys()].some(key => !allowed.has(key) || fields.get(key).length !== 1)) return null;
    const path = one(fields, SH + 'path');
    if (path && path.type !== 'iri') return null;
    const name = path ? `${label(path.value)} values` : 'the value';
    const parts = [];
    for (const [key, wording] of [['minCount', 'at least'], ['maxCount', 'at most']]) {
      const value = one(fields, SH + key);
      if (!value) continue;
      const amount = count(value);
      if (!path || amount === null) return null;
      parts.push(`${wording} ${amount} ${name}`);
    }
    for (const [key, wording] of [['class', 'must be of class'], ['datatype', 'must have datatype']]) {
      const value = one(fields, SH + key);
      if (!value) continue;
      if (value.type !== 'iri') return null;
      parts.push(`${name} ${wording} ${label(value.value)}`);
    }
    const members = one(fields, SH + 'in');
    if (members) {
      const values = readList(members, depth, ancestors, (item, d, a) =>
        item.type === 'bnode' ? null : render(item, d, a));
      if (!values) return null;
      parts.push(`${name} must be one of (${values.join('; ')})`);
    }
    const renderShape = (value, d, a) => {
      if (value.type === 'iri') return `conforms to ${label(value.value)}`;
      if (value.type !== 'bnode') return null;
      const text = render(value, d, a);
      return text?.startsWith('Validation: ') ? text.slice('Validation: '.length) : null;
    };
    for (const [key, wording] of [['or', 'any of'], ['and', 'all of']]) {
      const value = one(fields, SH + key);
      if (!value) continue;
      const constraints = readList(value, depth, ancestors, renderShape);
      if (!constraints) return null;
      parts.push(`${name} must satisfy ${wording} (${constraints.join('; ')})`);
    }
    const negation = one(fields, SH + 'not');
    if (negation) {
      const text = renderShape(negation, depth + 1, ancestors);
      if (text === null) return null;
      parts.push(`${name} must not satisfy (${text})`);
    }
    return parts.length ? `Validation: ${parts.join('; ')}` : null;
  }

  function render(value, depth = 0, ancestors = new Set()) {
    if (!value || depth > maxDepth || remaining-- <= 0) return null;
    if (value.type === 'iri') return label(value.value);
    if (value.type === 'literal') {
      const suffix = value.language ? `@${value.language}` : value.datatype ? `^^${label(value.datatype)}` : '';
      return JSON.stringify(value.value) + suffix;
    }
    if (value.type !== 'bnode' || ancestors.has(value.value)) return null;
    const next = new Set(ancestors).add(value.value);
    const node = fieldsFor(value.value);
    if (!node?.fields.size) return null;
    const isShape = [...node.fields.keys()].some(key => key.startsWith(SH));
    if (node.nodeTypes.some(type => !type.startsWith(isShape ? SH : OWL))) return null;
    return isShape ? shape(node.fields, depth, next) : owl(node.fields, depth, next);
  }
  return render(object);
}
