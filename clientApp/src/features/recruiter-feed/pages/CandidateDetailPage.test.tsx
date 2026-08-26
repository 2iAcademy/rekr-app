import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { mockFeedCandidates } from '../mocks';
import type { FeedCandidate } from '../types';
import { CandidateDetailPage } from './CandidateDetailPage';

const candidate = (overrides: Partial<FeedCandidate> = {}): FeedCandidate => ({
  ...mockFeedCandidates[0],
  ...overrides,
});

const renderPage = (overrides: Partial<FeedCandidate> = {}) => {
  const onBack = vi.fn();
  const onPass = vi.fn();
  const onLike = vi.fn();

  render(
    <CandidateDetailPage
      candidate={candidate(overrides)}
      onBack={onBack}
      onPass={onPass}
      onLike={onLike}
    />,
  );

  return { onBack, onPass, onLike };
};

const itemsOf = (list: HTMLElement): (string | null)[] =>
  within(list)
    .getAllByRole('listitem')
    .map((item) => item.textContent);

describe('CandidateDetailPage — identité', () => {
  it('titre la page avec le nom et l’âge du candidat', () => {
    renderPage({ firstName: 'Camille', lastName: 'Moreau', age: 29 });

    expect(
      screen.getByRole('heading', { level: 1, name: 'Camille Moreau · 29 ans' }),
    ).toBeVisible();
  });

  it('titre la page avec le nom seul quand l’âge est inconnu', () => {
    renderPage({ firstName: 'Thomas', lastName: 'Leroy', age: null });

    expect(screen.getByRole('heading', { level: 1, name: 'Thomas Leroy' })).toBeVisible();
  });

  it('affiche le poste recherché', () => {
    renderPage({ desiredJobTitle: 'Développeuse back-end' });

    expect(screen.getByText('Développeuse back-end')).toBeVisible();
  });

  it('compose la ligne méta avec le lieu, l’expérience et la disponibilité', () => {
    renderPage({
      city: 'Lyon',
      experienceLevel: 'CONFIRME',
      availability: 'IMMEDIATE',
      availabilityDelayMonths: null,
      availabilityDate: null,
    });

    expect(screen.getByText('Lyon · Confirmé · Dispo immédiate')).toBeVisible();
  });

  it('ne laisse pas de séparateur orphelin quand la ville est inconnue', () => {
    renderPage({
      city: null,
      experienceLevel: 'SENIOR',
      availability: 'WITHIN_DELAY',
      availabilityDelayMonths: 3,
      availabilityDate: null,
    });

    expect(screen.getByText('Senior · Dispo sous 3 mois')).toBeVisible();
  });

  it('affiche la photo du candidat avec son nom complet en texte alternatif', () => {
    renderPage({
      firstName: 'Camille',
      lastName: 'Moreau',
      avatarUrl: 'https://cdn.rekr.test/camille.jpg',
    });

    expect(screen.getByRole('img', { name: 'Camille Moreau' })).toHaveAttribute(
      'src',
      'https://cdn.rekr.test/camille.jpg',
    );
  });

  it('affiche l’initiale du prénom en décor, faute de photo, plutôt qu’une fausse image', () => {
    renderPage({ firstName: 'Camille', lastName: 'Moreau', avatarUrl: null });

    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByText('C')).toHaveAttribute('aria-hidden', 'true');
  });

  // La palette et le landmark `main` appartiennent à `AppShell`, qui enveloppe
  // le feed : un `main` ici en imbriquerait deux.
  it('s’insère dans le shell sans réclamer le landmark principal', () => {
    renderPage();

    expect(screen.queryByRole('main')).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Profil de Camille Moreau' })).toBeInTheDocument();
  });

  it('n’expose qu’un seul titre de niveau 1, les rubriques restant en niveau 2', () => {
    renderPage();

    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getAllByRole('heading', { level: 2 }).length).toBeGreaterThan(0);
    expect(screen.queryByRole('heading', { level: 3 })).not.toBeInTheDocument();
  });
});

describe('CandidateDetailPage — critères de recherche', () => {
  it('liste les compétences dans une liste nommée', () => {
    renderPage({ skills: ['Symfony', 'PostgreSQL', 'Docker'] });

    expect(itemsOf(screen.getByRole('list', { name: 'Compétences' }))).toEqual([
      'Symfony',
      'PostgreSQL',
      'Docker',
    ]);
  });

  it('liste les langues dans une liste nommée', () => {
    renderPage({ languages: ['Français', 'Anglais'] });

    expect(itemsOf(screen.getByRole('list', { name: 'Langues' }))).toEqual(['Français', 'Anglais']);
  });

  it('liste les contrats recherchés avec leurs libellés métier', () => {
    renderPage({ contractTypes: ['CDI', 'ALTERNANCE'] });

    expect(itemsOf(screen.getByRole('list', { name: 'Contrats recherchés' }))).toEqual([
      'CDI',
      'Alternance',
    ]);
  });

  it('affiche la politique de télétravail', () => {
    renderPage({ remotePolicy: 'HYBRID' });

    expect(screen.getByRole('heading', { level: 2, name: 'Télétravail' })).toBeVisible();
    expect(screen.getByText('Hybride')).toBeVisible();
  });

  it('affiche la mobilité nationale', () => {
    renderPage({ mobilityNationwide: true, mobilityRadiusKm: null });

    expect(screen.getByRole('heading', { level: 2, name: 'Mobilité' })).toBeVisible();
    expect(screen.getByText('Mobile dans toute la France')).toBeVisible();
  });

  it('affiche le rayon de mobilité', () => {
    renderPage({ mobilityNationwide: false, mobilityRadiusKm: 30 });

    expect(screen.getByText('Mobile dans un rayon de 30 km')).toBeVisible();
  });

  it('énonce la prétention salariale en une phrase', () => {
    renderPage({ salaryMin: 42000, salaryMax: 48000 });

    expect(screen.getByText('Souhaite 42 - 48 k€')).toBeVisible();
  });

  it('assume une prétention non communiquée', () => {
    renderPage({ salaryMin: null, salaryMax: null });

    expect(screen.getByText('Prétention non communiquée')).toBeVisible();
  });

  it('déroule la bio entière, sans troncature', () => {
    const bio =
      'Sept ans sur des API de paiement, dont trois à porter la migration d’un monolithe.';
    renderPage({ bio });

    expect(screen.getByRole('heading', { level: 2, name: 'À propos' })).toBeVisible();
    expect(screen.getByText(bio)).toBeVisible();
  });
});

describe('CandidateDetailPage — liens et CV', () => {
  it('renvoie vers le profil LinkedIn dans un nouvel onglet, sans fuite d’origine', () => {
    renderPage({
      firstName: 'Camille',
      lastName: 'Moreau',
      linkedinUrl: 'https://www.linkedin.com/in/exemple-camille-moreau',
    });

    const link = screen.getByRole('link', { name: 'Profil LinkedIn de Camille Moreau' });

    expect(link).toHaveAttribute('href', 'https://www.linkedin.com/in/exemple-camille-moreau');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('renvoie vers le portfolio dans un nouvel onglet, sans fuite d’origine', () => {
    renderPage({
      firstName: 'Léa',
      lastName: 'Bonnet',
      portfolioUrl: 'https://www.behance.net/exemple-lea-bonnet',
    });

    const link = screen.getByRole('link', { name: 'Portfolio de Léa Bonnet' });

    expect(link).toHaveAttribute('href', 'https://www.behance.net/exemple-lea-bonnet');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('résout la clé de stockage du CV en URL de lecture', () => {
    renderPage({
      firstName: 'Camille',
      lastName: 'Moreau',
      cvUrl: 'candidates/1/cv/3f1c9a52.pdf',
    });

    const link = screen.getByRole('link', { name: 'CV de Camille Moreau' });

    expect(link).toHaveAttribute('href', '/api/files/candidates/1/cv/3f1c9a52.pdf');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });
});

describe('CandidateDetailPage — décisions', () => {
  it('ramène au feed depuis le bouton de retour', async () => {
    const user = userEvent.setup();
    const { onBack, onPass, onLike } = renderPage();

    await user.click(screen.getByRole('button', { name: 'Retour au feed' }));

    expect(onBack).toHaveBeenCalledTimes(1);
    expect(onPass).not.toHaveBeenCalled();
    expect(onLike).not.toHaveBeenCalled();
  });

  it('passe le profil', async () => {
    const user = userEvent.setup();
    const { onBack, onPass, onLike } = renderPage();

    await user.click(screen.getByRole('button', { name: 'Passer' }));

    expect(onPass).toHaveBeenCalledTimes(1);
    expect(onBack).not.toHaveBeenCalled();
    expect(onLike).not.toHaveBeenCalled();
  });

  it('like le profil', async () => {
    const user = userEvent.setup();
    const { onBack, onPass, onLike } = renderPage();

    await user.click(screen.getByRole('button', { name: 'Liker' }));

    expect(onLike).toHaveBeenCalledTimes(1);
    expect(onBack).not.toHaveBeenCalled();
    expect(onPass).not.toHaveBeenCalled();
  });
});

describe('CandidateDetailPage — prise de focus', () => {
  it('prend le focus à l’ouverture, au lieu de le laisser retomber sur le corps du document', () => {
    renderPage();

    expect(document.activeElement).not.toBe(document.body);
    expect(screen.getByRole('region', { name: 'Profil de Camille Moreau' })).toHaveFocus();
  });

  it('nomme l’écran qui prend le focus, pour que le profil ouvert soit annoncé', () => {
    renderPage({ firstName: 'Camille', lastName: 'Moreau' });

    expect(document.activeElement).toHaveAccessibleName('Profil de Camille Moreau');
  });

  it('n’annonce que l’écran quand le candidat n’a pas de nom', () => {
    renderPage({ firstName: '', lastName: '' });

    expect(screen.getByRole('region', { name: 'Profil' })).toHaveFocus();
  });

  it('laisse le retour au feed en première tabulation depuis l’écran', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.tab();

    expect(screen.getByRole('button', { name: 'Retour au feed' })).toHaveFocus();
  });
});

describe('CandidateDetailPage — profils incomplets', () => {
  it('n’affiche pas de rubrique au-dessus d’une liste vide', () => {
    renderPage({ skills: [], languages: [], contractTypes: [] });

    expect(screen.queryByRole('list', { name: 'Compétences' })).not.toBeInTheDocument();
    expect(screen.queryByText('Compétences')).not.toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Langues' })).not.toBeInTheDocument();
    expect(screen.queryByText('Langues')).not.toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Contrats recherchés' })).not.toBeInTheDocument();
    expect(screen.queryByText('Contrats recherchés')).not.toBeInTheDocument();
  });

  it('tait la mobilité plutôt que d’inventer une limite que le candidat n’a pas donnée', () => {
    renderPage({ mobilityNationwide: null, mobilityRadiusKm: null });

    expect(screen.queryByRole('heading', { name: 'Mobilité' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Télétravail' })).toBeVisible();
  });

  it('tait la mobilité quand le rayon déclaré est nul', () => {
    renderPage({ mobilityNationwide: false, mobilityRadiusKm: 0 });

    expect(screen.queryByRole('heading', { name: 'Mobilité' })).not.toBeInTheDocument();
  });

  it('tait la rubrique « À propos » quand la bio est vide', () => {
    renderPage({ bio: '   ' });

    expect(screen.queryByRole('heading', { name: 'À propos' })).not.toBeInTheDocument();
  });

  it('tait le poste recherché quand il est vide', () => {
    renderPage({ firstName: 'Camille', lastName: 'Moreau', desiredJobTitle: '' });

    expect(
      screen.getByRole('heading', { level: 1, name: 'Camille Moreau · 29 ans' }),
    ).toBeVisible();
  });

  it('n’affiche aucun lien quand le candidat n’a ni LinkedIn, ni portfolio, ni CV', () => {
    renderPage({ linkedinUrl: null, portfolioUrl: null, cvUrl: null });

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.queryByText('Liens')).not.toBeInTheDocument();
  });

  it('traite une URL vide comme une absence d’URL', () => {
    renderPage({ avatarUrl: '', linkedinUrl: '', portfolioUrl: '', cvUrl: '' });

    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByText('C')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.queryByText('Liens')).not.toBeInTheDocument();
  });

  it('garde la rubrique « Liens » dès qu’un seul des trois est renseigné', () => {
    renderPage({
      firstName: 'Yanis',
      lastName: 'Berger',
      linkedinUrl: null,
      portfolioUrl: 'https://github.com/exemple-yanis-berger',
      cvUrl: null,
    });

    expect(screen.getByRole('heading', { level: 2, name: 'Liens' })).toBeVisible();
    expect(screen.getAllByRole('link')).toHaveLength(1);
    expect(screen.getByRole('link', { name: 'Portfolio de Yanis Berger' })).toBeVisible();
  });
});
