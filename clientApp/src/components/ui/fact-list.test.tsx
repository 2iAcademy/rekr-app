import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FactList } from './fact-list';

const facts = [
  { label: 'Contrat', value: 'CDI' },
  { label: 'Salaire', value: '45–55 k€' },
];

describe('FactList', () => {
  it('associe chaque valeur à son libellé, dans l’ordre donné', () => {
    render(<FactList facts={facts} />);

    const pairs = screen
      .getAllByRole('term')
      .map((term) => [term.textContent, term.nextElementSibling?.textContent]);

    expect(pairs).toEqual([
      ['Contrat', 'CDI'],
      ['Salaire', '45–55 k€'],
    ]);
  });

  it('ne rend aucune ligne sans fait', () => {
    render(<FactList facts={[]} />);

    expect(screen.queryByRole('term')).not.toBeInTheDocument();
  });
});
