import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CandidateAvatar } from './CandidateAvatar';

// The two screens that mount it — the applicant row and the profile — already
// cover the photo, its absence and the empty string. Only what they leave
// untested is asserted here.
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
