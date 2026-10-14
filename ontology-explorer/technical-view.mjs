import { groupStatements } from './model.mjs';

/** Lossless, source-scoped RDF drill-down, kept separate from researcher views. */
export function createTechnicalView({ graph, model, catalog, element, action, termLink,
  sourceMarks, heading, paged, compactIdentifier }) {
  const RDF_TYPE = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';
  const RDF_FIRST = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first';
  let blankNodeNumber = 0;

  function literal(object) {
    const wrapper = element('div', 'literal');
    wrapper.append(element('div', 'literal-value', object.value));
    const details = element('details', 'literal-details');
    details.append(element('summary', '', 'Literal details'));
    const metadata = element('dl', 'metadata');
    metadata.append(element('dt', '', 'Lexical form'), element('dd', 'lexical-form', object.value));
    if (object.language) metadata.append(element('dt', '', 'Language'), element('dd', '', object.language));
    if (object.datatype) {
      const value = element('dd');
      value.append(termLink(object.datatype, object.datatype));
      metadata.append(element('dt', '', 'Datatype'), value);
    }
    details.append(metadata);
    wrapper.append(details);
    return wrapper;
  }

  function rdfValue(object, sourceId, ancestors = []) {
    if (object.type === 'literal') return literal(object);
    if (object.type === 'iri') {
      const row = element('div', 'iri-value');
      row.append(termLink(object.value));
      row.append(element('code', 'compact-iri', compactIdentifier(object.value)));
      return row;
    }
    const branch = graph.blankNode(sourceId, object.value, ancestors.map(item => item.key));
    if (branch.cycle) {
      const row = element('div', 'cycle-reference');
      row.append(element('span', '', 'Cycle · '));
      const link = element('a', '', object.value);
      const target = ancestors.find(item => item.key === branch.key);
      link.href = `#${target?.domId ?? 'main'}`;
      link.addEventListener('click', event => {
        event.preventDefault();
        if (target) document.getElementById(target.domId)?.scrollIntoView({ block: 'nearest' });
      });
      row.append(link);
      return row;
    }
    const details = element('details', 'blank-node');
    details.id = `blank-node-${++blankNodeNumber}`;
    const types = branch.statements.filter(statement => statement.predicate === RDF_TYPE && statement.object.type === 'iri');
    const isList = branch.statements.some(statement => statement.predicate === RDF_FIRST);
    const label = types.length ? [...new Set(types.map(statement => model.get(statement.object.value).label))].join(' · ')
      : isList ? 'List' : 'Expression';
    details.append(element('summary', '', `${label} · ${branch.statements.length} statements`));
    details.addEventListener('toggle', () => {
      if (!details.open || details.dataset.rendered) return;
      details.dataset.rendered = 'true';
      const body = element('div', 'blank-node-body');
      const path = [...ancestors, { key: branch.key, domId: details.id }];
      body.append(element('code', 'full-iri expression-identifier', object.value));
      if (isList) {
        const collection = graph.list(sourceId, object.value);
        const ordered = element('ol', 'rdf-list');
        const preview = element('div', 'list-preview');
        preview.append(ordered);
        // The opened collection shows every member in its asserted order.
        for (const item of collection.items) {
          const row = element('li');
          row.append(rdfValue(item, sourceId, path));
          ordered.append(row);
        }
        if (collection.cycle) preview.append(element('p', 'status', 'Cycle'));
        if (!collection.complete && !collection.cycle) preview.append(element('p', 'status', 'Open list'));
        body.append(preview);
      }
      renderPredicates(body, branch.statements, path, 5);
      details.append(body);
    });
    return details;
  }

  function renderPredicates(parent, statements, ancestors = [], level = 4) {
    const groups = groupStatements(statements).sort((a, b) =>
      model.get(a.predicate).label.localeCompare(model.get(b.predicate).label) || a.predicate.localeCompare(b.predicate));
    for (const group of groups) {
      const section = element('section', 'predicate-group');
      const title = element(`h${Math.min(level, 6)}`, 'predicate-heading');
      title.append(termLink(group.predicate));
      title.append(element('code', 'compact-iri', compactIdentifier(group.predicate)));
      section.append(title);
      paged(section, group.values, item => {
        const row = element('div', 'statement-value');
        // Blank-node IDs are source-scoped. Never merge expansions across graphs.
        if (item.object.type === 'bnode' && item.sourceIds.length > 1) {
          for (const id of item.sourceIds) {
            const nested = element('div');
            nested.append(rdfValue(item.object, id, ancestors), sourceMarks([id]));
            row.append(nested);
          }
        } else {
          row.append(rdfValue(item.object, item.sourceIds[0], ancestors), sourceMarks(item.sourceIds));
        }
        return row;
      });
      parent.append(section);
    }
  }

  function renderAssertions(parent, statements) {
    const section = element('section', 'assertions-section');
    heading(section, 2, 'Properties and relationships', statements.length);
    const byGroup = new Map();
    for (const statement of statements) {
      const group = model.sources.get(statement.sourceId)?.group ?? statement.sourceId;
      if (!byGroup.has(group)) byGroup.set(group, []);
      byGroup.get(group).push(statement);
    }
    for (const [group, assertions] of byGroup) {
      const block = element('section', 'assertion-module-group');
      heading(block, 3, group, assertions.length);
      renderPredicates(block, assertions);
      section.append(block);
    }
    parent.append(section);
  }

  function references(parent, id) {
    const incoming = graph.references(id);
    const section = element('section', 'incoming-section');
    heading(section, 2, 'Statements referring to this term', incoming.length);
    paged(section, incoming, statement => {
      const row = element('div', 'incoming-row');
      const subject = statement.subject.startsWith('_:')
        ? rdfValue({ type: 'bnode', value: statement.subject }, statement.sourceId)
        : termLink(statement.subject);
      row.append(subject);
      const predicate = element('div', 'incoming-predicate');
      predicate.append(termLink(statement.predicate));
      if (statement.role === 'predicate' || statement.role === 'datatype') {
        predicate.append(element('span', 'use-label', statement.role === 'predicate' ? 'Used as predicate' : 'Used as datatype'));
        predicate.append(rdfValue(statement.object, statement.sourceId));
      }
      row.append(predicate, sourceMarks([statement.sourceId]));
      return row;
    });
    parent.append(section);
  }
  return {rdfValue, renderPredicates, renderAssertions, references};
}
