/** Finite, data-driven presentation of separately compiled worked examples. */
import { safeLocalUrl } from './model.mjs';

export function createExampleModel(payload) {
  if (payload.schemaVersion !== 1 || !Array.isArray(payload.examples)) throw new Error('Unsupported examples data');
  const examples = new Map(payload.examples.map(example => [example.id, example]));
  const pages = new Map(payload.examples.map(example => [example.id,
    new Map(example.pages.map(page => [page.id, page]))]));
  return {
    examples: payload.examples,
    example: id => examples.get(id),
    page: (id, page) => pages.get(id)?.get(page || examples.get(id)?.rootPage),
    forTerm: id => (payload.termExamples?.[id] ?? []).filter(item => pages.get(item.example)?.has(item.page)),
  };
}

export function createExampleView({ element, heading, termLink, exampleLink, cardDescription, baseUrl }) {
  function metadata(example, page, className = 'detail-metadata') {
    const row = element('div', `term-metadata ${className}`);
    if (page?.types?.length) {
      const types = element('span', 'type-tags');
      types.setAttribute('aria-label', 'Type');
      for (const type of page.types) types.append(termLink(type.id, type.label, 'term-tag type-tag'));
      row.append(types);
    }
    if (example.fictional) row.append(element('span', 'term-tag', 'Fictional data'));
    return row;
  }

  function cardGrid(cards) {
    const grid = element('div', 'browse-grid');
    for (const { example, page, title, description } of cards) {
      const card = element('div', 'browse-card');
      card.append(exampleLink(example.id, page, title, 'card-title'));
      card.append(metadata(example, example.pages.find(item => item.id === page), 'card-metadata'));
      if (description) card.append(cardDescription(description));
      grid.append(card);
    }
    return grid;
  }

  function values(example, items = []) {
    const content = element('div', 'example-values');
    for (const item of items) {
      const value = element('div', 'example-value');
      if (item.kind === 'term') value.append(termLink(item.id, item.text));
      else if (item.kind === 'example') value.append(exampleLink(example.id, item.page, item.text));
      else value.append(element('span', 'literal-value', item.text));
      content.append(value);
    }
    return content;
  }

  function renderPage(parent, example, page) {
    parent.append(metadata(example, page));
    if (page.description) parent.append(element('p', 'description-text', page.description));
    for (const profile of page.sections) {
      const section = element('section', 'example-section');
      if (profile.title) heading(section, 2, profile.title);
      if (profile.type === 'cards') section.append(cardGrid(profile.cards.map(card => ({ ...card, example }))));
      else if (profile.type === 'text') {
        for (const paragraph of profile.paragraphs) section.append(element('p', 'attribute-value', paragraph));
      } else if (profile.type === 'fields') {
        const fields = element('dl', 'metadata');
        for (const item of profile.items) {
          const label = element('dt');
          label.append(item.term ? termLink(item.term, item.label) : element('span', '', item.label));
          const cell = element('dd'); cell.append(values(example, item.values));
          fields.append(label, cell);
        }
        section.append(fields);
      } else if (profile.type === 'table') {
        const wrap = element('div', 'example-table-wrap');
        const table = element('table', 'example-table');
        const head = element('thead'), headers = element('tr');
        for (const column of profile.columns) {
          const cell = element('th'); cell.setAttribute('scope', 'col');
          cell.append(column.term ? termLink(column.term, column.label) : element('span', '', column.label));
          headers.append(cell);
        }
        head.append(headers); table.append(head);
        const body = element('tbody');
        for (const record of profile.rows) {
          const row = element('tr');
          for (const column of profile.columns) {
            const cell = element('td'); cell.append(values(example, record.cells[column.key])); row.append(cell);
          }
          body.append(row);
        }
        table.append(body); wrap.append(table); section.append(wrap);
      } else throw new Error(`Unsupported example section: ${profile.type}`);
      parent.append(section);
    }
    const technical = element('details', 'technical-details concept-technical');
    technical.append(element('summary', '', 'Technical details · sources and SPARQL'));
    const body = element('div', 'technical-body');
    for (const file of page.technical.files) {
      const url = safeLocalUrl(file.url, baseUrl());
      if (!url) continue;
      const link = element('a', 'download-link', file.label); link.href = url; link.download = '';
      const row = element('div'); row.append(link); body.append(row);
    }
    for (const query of page.technical.queries) {
      const section = element('section'); heading(section, 3, query.label);
      const pre = element('pre', 'source-code'); pre.append(element('code', '', query.text));
      section.append(pre); body.append(section);
    }
    technical.append(body); parent.append(technical);
  }
  return { cardGrid, renderPage };
}
