import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CandidateAvatar } from './CandidateAvatar';

// Both screens already cover the photo, the missing photo and the empty string.
// Only what they leave untested is asserted here.
describe('CandidateAvatar', () => {
  it('traite une URL réduite à des espaces comme une absence de photo', () => {
    render(<CandidateAvatar name="Camille Moreau" avatarUrl="   " className="size-24" />);

    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByText('C')).toHaveAttribute('aria-hidden', 'true');
  });

  it('met l’initiale en capitale, quelle que soit la casse du prénom saisi', () => {
    render(<CandidateAvatar name="camille moreau" avatarUrl={null} className="size-24" />);

    expect(screen.getByText('C')).toBeInTheDocument();
  });
});
