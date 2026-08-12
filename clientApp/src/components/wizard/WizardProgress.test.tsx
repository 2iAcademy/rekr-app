import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { WizardProgress } from './WizardProgress';

describe('WizardProgress', () => {
  it('annonce la position dans le parcours', () => {
    render(<WizardProgress current={3} total={5} />);

    expect(screen.getByText('Étape 3 sur 5')).toBeInTheDocument();
  });

  // `aria-valuemin` is 0, not 1: with a floor of 1, step 1 of 5 would be
  // announced as 0% while the bar visibly shows 20%.
  it('expose une barre de progression accessible bornée au nombre d’étapes', () => {
    render(<WizardProgress current={3} total={5} />);

    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuenow', '3');
    expect(bar).toHaveAttribute('aria-valuemin', '0');
    expect(bar).toHaveAttribute('aria-valuemax', '5');
  });

  it('nomme la barre par le texte visible plutôt qu’en le dupliquant', () => {
    render(<WizardProgress current={3} total={5} />);

    expect(screen.getByRole('progressbar', { name: 'Étape 3 sur 5' })).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).not.toHaveAttribute('aria-label');
  });
});
