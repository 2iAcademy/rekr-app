import { describe, it, expect } from 'vitest';
import { htmlToMarkdown, markdownToHtml, parseMarkdown } from './markdown';

describe('markdownToHtml', () => {
  it('rend le gras et l’italique', () => {
    expect(markdownToHtml('Une **équipe** *soudée*')).toBe(
      '<div>Une <strong>équipe</strong> <em>soudée</em></div>',
    );
  });

  it('rend une liste à puces', () => {
    expect(markdownToHtml('- Mutuelle\n- RTT')).toBe('<ul><li>Mutuelle</li><li>RTT</li></ul>');
  });

  it('rend une ligne vide pour un contenu vide', () => {
    expect(markdownToHtml('')).toBe('<div><br></div>');
  });

  /**
   * This string is injected into the editable area, so escaping here is the
   * whole defence: without it, typing a tag would create a real element.
   */
  it('échappe le balisage saisi', () => {
    expect(markdownToHtml('<script>alert(1)</script>')).toBe(
      '<div>&lt;script&gt;alert(1)&lt;/script&gt;</div>',
    );
  });

  it('échappe aussi les esperluettes', () => {
    expect(markdownToHtml('R&D')).toBe('<div>R&amp;D</div>');
  });
});

describe('htmlToMarkdown', () => {
  it('relit le gras, quelle que soit la balise produite par le navigateur', () => {
    expect(htmlToMarkdown('Une <strong>équipe</strong>')).toBe('Une **équipe**');
    expect(htmlToMarkdown('Une <b>équipe</b>')).toBe('Une **équipe**');
  });

  it('relit l’italique, quelle que soit la balise produite', () => {
    expect(htmlToMarkdown('Une <em>équipe</em>')).toBe('Une *équipe*');
    expect(htmlToMarkdown('Une <i>équipe</i>')).toBe('Une *équipe*');
  });

  it('relit les listes à puces', () => {
    expect(htmlToMarkdown('<ul><li>Mutuelle</li><li>RTT</li></ul>')).toBe('- Mutuelle\n- RTT');
  });

  it('traite les blocs et les sauts de ligne', () => {
    expect(htmlToMarkdown('<div>Premier</div><div>Second</div>')).toBe('Premier\nSecond');
    expect(htmlToMarkdown('Premier<br>Second')).toBe('Premier\nSecond');
  });

  it('ignore la mise en forme non gérée sans perdre le texte', () => {
    expect(htmlToMarkdown('<span style="color:red">Rouge</span>')).toBe('Rouge');
  });

  it('rend le texte des balises échappées, pas les balises', () => {
    expect(htmlToMarkdown('<div>&lt;script&gt;</div>')).toBe('<script>');
  });

  // A contentEditable keeps an empty block at the end; storing it would add a
  // stray newline to every value, and to every payload sent to the API.
  it('ignore les lignes vides finales', () => {
    expect(htmlToMarkdown('O<div><br></div>')).toBe('O');
    expect(htmlToMarkdown('<div>A</div><div><br></div><div><br></div>')).toBe('A');
  });

  it('conserve une ligne vide entre deux paragraphes', () => {
    expect(htmlToMarkdown('<div>A</div><div><br></div><div>B</div>')).toBe('A\n\nB');
  });

  it('fait l’aller-retour sans altérer le contenu', () => {
    const source = 'Une **équipe** *soudée*';

    expect(htmlToMarkdown(markdownToHtml(source))).toBe(source);
  });
});

describe('parseMarkdown', () => {
  it('rend un texte simple en un paragraphe', () => {
    expect(parseMarkdown('Une équipe soudée')).toEqual([
      { type: 'paragraph', spans: [{ text: 'Une équipe soudée' }] },
    ]);
  });

  it('reconnaît le gras', () => {
    expect(parseMarkdown('Une **équipe** soudée')).toEqual([
      {
        type: 'paragraph',
        spans: [{ text: 'Une ' }, { text: 'équipe', bold: true }, { text: ' soudée' }],
      },
    ]);
  });

  it('reconnaît l’italique', () => {
    expect(parseMarkdown('Une *équipe* soudée')).toEqual([
      {
        type: 'paragraph',
        spans: [{ text: 'Une ' }, { text: 'équipe', italic: true }, { text: ' soudée' }],
      },
    ]);
  });

  it('combine gras et italique dans la même ligne', () => {
    expect(parseMarkdown('**Notre** métier, *sur mesure*')).toEqual([
      {
        type: 'paragraph',
        spans: [
          { text: 'Notre', bold: true },
          { text: ' métier, ' },
          { text: 'sur mesure', italic: true },
        ],
      },
    ]);
  });

  it('regroupe les lignes à puces en une liste', () => {
    expect(parseMarkdown('- Mutuelle\n- Tickets resto')).toEqual([
      {
        type: 'list',
        items: [[{ text: 'Mutuelle' }], [{ text: 'Tickets resto' }]],
      },
    ]);
  });

  it('sépare les paragraphes sur une ligne vide', () => {
    expect(parseMarkdown('Premier\n\nSecond')).toEqual([
      { type: 'paragraph', spans: [{ text: 'Premier' }] },
      { type: 'paragraph', spans: [{ text: 'Second' }] },
    ]);
  });

  it('enchaîne paragraphe et liste', () => {
    const blocks = parseMarkdown('Nos avantages :\n- Mutuelle');

    expect(blocks).toHaveLength(2);
    expect(blocks[0].type).toBe('paragraph');
    expect(blocks[1]).toEqual({ type: 'list', items: [[{ text: 'Mutuelle' }]] });
  });

  it('laisse un marqueur non fermé tel quel', () => {
    expect(parseMarkdown('Une **équipe soudée')).toEqual([
      { type: 'paragraph', spans: [{ text: 'Une **équipe soudée' }] },
    ]);
  });

  // The whole point of parsing to React nodes: markup in the source is data,
  // never structure. It can never become a tag.
  it('traite le HTML saisi comme du texte, jamais comme du balisage', () => {
    expect(parseMarkdown('<script>alert(1)</script>')).toEqual([
      { type: 'paragraph', spans: [{ text: '<script>alert(1)</script>' }] },
    ]);
  });

  it('ne rend rien pour un texte vide', () => {
    expect(parseMarkdown('   ')).toEqual([]);
  });
});
