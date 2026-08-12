import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WIZARD_ERROR_ID } from '@/components/wizard/wizardError';
import { ShowcaseStep } from './ShowcaseStep';
import { emptyCandidateOnboarding } from '../state';

const renderStep = (props: Partial<Parameters<typeof ShowcaseStep>[0]> = {}) =>
  render(<ShowcaseStep state={emptyCandidateOnboarding} onChange={vi.fn()} {...props} />);

describe('ShowcaseStep', () => {
  it('rend les compétences, les langues, la bio et les liens', () => {
    renderStep();

    expect(screen.getByLabelText('Compétences')).toBeInTheDocument();
    expect(screen.getByLabelText('Langues (optionnel)')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'À propos de moi' })).toBeInTheDocument();
    expect(screen.getByLabelText('Profil LinkedIn (optionnel)')).toBeInTheDocument();
  });

  it('remonte les compétences ajoutées', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderStep({ onChange });

    await user.type(screen.getByLabelText('Compétences'), 'React{Enter}');

    expect(onChange).toHaveBeenCalledWith({ skills: ['React'] });
  });

  it('remonte les langues ajoutées', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderStep({ onChange });

    await user.type(screen.getByLabelText('Langues (optionnel)'), 'Anglais{Enter}');

    expect(onChange).toHaveBeenCalledWith({ languages: ['Anglais'] });
  });

  it('remonte le lien LinkedIn saisi', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderStep({ onChange });

    await user.type(screen.getByLabelText('Profil LinkedIn (optionnel)'), 'h');

    expect(onChange).toHaveBeenCalledWith({ linkedinUrl: 'h' });
  });

  it('marque la bio fautive et la relie au message d’erreur', () => {
    renderStep({ invalidField: 'bio' });

    const bio = screen.getByRole('textbox', { name: 'À propos de moi' });
    expect(bio).toHaveAttribute('aria-invalid', 'true');
    expect(bio).toHaveAttribute('aria-describedby', expect.stringContaining(WIZARD_ERROR_ID));
  });
});
