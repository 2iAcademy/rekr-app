import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MatchPage } from './MatchPage';

const renderPage = (props: Partial<React.ComponentProps<typeof MatchPage>> = {}) =>
  render(
    <MatchPage currentUser={{ name: 'Camille' }} matchedProfile={{ name: 'Acme' }} {...props} />,
  );

describe('MatchPage', () => {
  it('affiche la célébration et les deux parties du match', () => {
    renderPage();

    expect(screen.getByRole('dialog', { name: "C'est un match !" })).toBeInTheDocument();
    expect(screen.getByText('Toi')).toBeInTheDocument();
    expect(screen.getByText('Acme')).toBeInTheDocument();
  });

  it('affiche les actions de messagerie et de continuation', () => {
    renderPage();

    expect(screen.getByRole('button', { name: 'Écrire un message' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continuer à swiper' })).toBeInTheDocument();
  });

  it('déclenche les actions correspondantes', async () => {
    const user = userEvent.setup();
    const onWriteMessage = vi.fn();
    const onContinue = vi.fn();
    renderPage({ onWriteMessage, onContinue });

    await user.click(screen.getByRole('button', { name: 'Écrire un message' }));
    await user.click(screen.getByRole('button', { name: 'Continuer à swiper' }));

    expect(onWriteMessage).toHaveBeenCalledTimes(1);
    expect(onContinue).toHaveBeenCalledTimes(1);
  });
});
