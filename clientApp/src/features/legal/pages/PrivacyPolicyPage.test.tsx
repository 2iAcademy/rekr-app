import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { PrivacyPolicyPage } from './PrivacyPolicyPage';

describe('PrivacyPolicyPage', () => {
  it('annonce la durée de conservation des comptes inactifs', () => {
    render(<PrivacyPolicyPage />);

    expect(screen.getByRole('heading', { name: 'Durée de conservation' })).toBeInTheDocument();
    expect(screen.getByText(/24 mois sans connexion/)).toBeInTheDocument();
  });

  it('dit ce que devient chaque donnée quand le compte est supprimé', () => {
    render(<PrivacyPolicyPage />);
    const section = within(
      screen.getByRole('heading', { name: 'Suppression du compte' }).closest('section')!,
    );

    expect(section.getByText(/likes, passages et matchs/)).toBeInTheDocument();
    expect(section.getByText(/CV et photo/)).toBeInTheDocument();
    expect(section.getByText(/dernier membre de votre entreprise/)).toBeInTheDocument();
  });

  it('indique où exercer ses droits depuis l’application', () => {
    render(<PrivacyPolicyPage />);

    expect(screen.getByRole('heading', { name: 'Vos droits' })).toBeInTheDocument();
    expect(screen.getAllByText(/Mon compte/).length).toBeGreaterThan(0);
    expect(screen.getByText(/CNIL/)).toBeInTheDocument();
  });

  it('affiche la version du texte, celle que l’inscription enregistre', () => {
    render(<PrivacyPolicyPage />);

    expect(screen.getByText(/Version du 23 septembre 2026/)).toBeInTheDocument();
  });
});
