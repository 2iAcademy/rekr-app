import { describe, it, expect } from 'vitest';
import { htmlToMarkdown, markdownToHtml } from './markdown';

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
