import { render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import LegalDocumentPage from '@/pages/legal/LegalDocumentPage';
import { LEGAL_PAGES } from '@/pages/legal/legalDocuments';

/**
 * The privacy policy rendered its schedules as a black terminal panel in a
 * monospace face, and these are the two independent reasons why.
 *
 * 1. The page passed no GFM plugin, so `react-markdown` — which parses
 *    CommonMark, where tables do not exist — could never reach the `table`,
 *    `th` and `td` overrides the page had defined. Pipe tables came out as
 *    paragraphs of `|`.
 * 2. Because of (1), the documents had taken to DRAWING their tables with box
 *    characters inside fenced blocks, and a fenced block is a code block.
 *
 * Fixing either alone leaves the other. So one test asserts the plugin works,
 * and one asserts the sources no longer contain the workaround.
 */

const renderDocument = (slug: string) =>
  render(
    <MemoryRouter initialEntries={[`/${slug}`]}>
      <Routes>
        <Route path="/:slug" element={<LegalDocumentPage />} />
      </Routes>
    </MemoryRouter>,
  );

describe('a legal document', () => {
  it('renders its schedules as tables, not as pipes', () => {
    const { container } = renderDocument('privacy');

    const tables = container.querySelectorAll('table');
    expect(tables.length).toBeGreaterThan(0);

    // The exact table from the screenshot that started this.
    const taxonomy = [...tables].find((table) =>
      table.textContent?.includes('Technical Fields & Data Elements'),
    );
    expect(taxonomy).toBeDefined();
    expect(within(taxonomy as HTMLElement).getAllByRole('row').length).toBeGreaterThan(4);

    // Without the plugin the same content arrives as a paragraph of pipes.
    expect(container.textContent).not.toMatch(/\|\s*---\s*\|/);
  });

  it('shows no code panel anywhere in the legal corpus', () => {
    /*
      Asserted on the CONTENT rather than on one rendered page: a fence
      reintroduced in any of the nine source documents is the defect coming
      back, and it would only be visible on whichever page happened to be
      opened.
    */
    for (const document of LEGAL_PAGES) {
      expect(document.content, `${document.title} has a fenced block`).not.toContain('```');
      // The box-drawing characters the fences used to contain.
      expect(document.content, `${document.title} still draws a table`).not.toMatch(
        /[─-╿]/,
      );
    }
  });

  it('gives every section an anchor so a clause can be cited', () => {
    // These documents refer to their own sections — "as per §11.1" — which
    // was unreachable in a thirty-thousand-character page with no index.
    const { container } = renderDocument('privacy');

    const nav = screen.getAllByRole('navigation', { name: 'Sections' })[0];
    const links = within(nav).getAllByRole('link');
    expect(links.length).toBeGreaterThan(5);

    for (const link of links) {
      const id = link.getAttribute('href')?.slice(1) ?? '';
      expect(id).not.toBe('');
      expect(container.querySelector(`#${CSS.escape(id)}`)).not.toBeNull();
    }
  });
});
