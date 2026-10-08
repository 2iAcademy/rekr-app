import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { ApiError } from '@/api/customFetch';
import { chatControllerIssueToken, chatControllerOpenMatchChannel } from '@/api/generated';
import ConversationPage from './ConversationPage';

vi.mock('@/api/generated', () => ({
  chatControllerIssueToken: vi.fn(),
  chatControllerOpenMatchChannel: vi.fn(),
}));

/**
 * The SDK is replaced by plain markup: what is tested here is what this screen
 * decides — who it names, where it links, whether it lets the reader write —
 * not Stream's own rendering.
 */
vi.mock('stream-chat-react', () => {
  const Passthrough = ({ children }: { children?: ReactNode }) => <>{children}</>;
  return {
    Chat: Passthrough,
    Channel: Passthrough,
    Window: Passthrough,
    WithComponents: Passthrough,
    MessageList: () => <div data-testid="message-list" />,
    MessageComposer: () => <textarea aria-label="Votre message" />,
    Streami18n: class {},
    useCreateChatClient: () => ({ userID: '7', channel: vi.fn(() => ({})) }),
  };
});

const issueToken = vi.mocked(chatControllerIssueToken);
const openChannel = vi.mocked(chatControllerOpenMatchChannel);

const session = { apiKey: 'key', userId: '7', token: 'token' };
const channel = (frozen = false) => ({
  channelType: 'messaging',
  channelId: 'match-12',
  counterpartName: 'Canopée Digital',
  offerId: 4,
  frozen,
});

const apiError = (status: number) =>
  new ApiError({ status, statusText: '', url: '/api/matches/12/chat', data: {} });

const renderPage = ({ viewerIsCandidate = true, onBack = vi.fn() } = {}) => {
  render(
    <MemoryRouter>
      <ConversationPage matchId={12} viewerIsCandidate={viewerIsCandidate} onBack={onBack} />
    </MemoryRouter>,
  );
  return { onBack };
};

describe('ConversationPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    issueToken.mockResolvedValue({ data: session } as Awaited<
      ReturnType<typeof chatControllerIssueToken>
    >);
    openChannel.mockResolvedValue({ data: channel() } as Awaited<
      ReturnType<typeof chatControllerOpenMatchChannel>
    >);
  });

  it('affiche le fil et la saisie, sous le nom de l’autre partie', async () => {
    renderPage();

    expect(await screen.findByRole('heading', { name: 'Canopée Digital' })).toBeInTheDocument();
    expect(screen.getByTestId('message-list')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Votre message' })).toBeInTheDocument();
    expect(openChannel).toHaveBeenCalledWith(12);
  });

  it('mène le candidat à l’offre du match', async () => {
    renderPage();

    expect(await screen.findByRole('link', { name: 'Voir l’offre' })).toHaveAttribute(
      'href',
      '/offres/4',
    );
  });

  it('mène le recruteur aux candidats de l’offre', async () => {
    renderPage({ viewerIsCandidate: false });

    expect(await screen.findByRole('link', { name: 'Voir la candidature' })).toHaveAttribute(
      'href',
      '/recruteur/offres/4/candidats',
    );
  });

  it('passe en lecture seule quand l’offre est pourvue ou fermée', async () => {
    openChannel.mockResolvedValue({ data: channel(true) } as Awaited<
      ReturnType<typeof chatControllerOpenMatchChannel>
    >);
    renderPage();

    expect(await screen.findByRole('status')).toHaveTextContent('lecture seule');
    expect(screen.queryByRole('textbox', { name: 'Votre message' })).not.toBeInTheDocument();
  });

  it.each([
    [404, 'Conversation introuvable.'],
    [503, 'La messagerie est momentanément indisponible.'],
    [500, 'Impossible d’ouvrir la conversation. Réessaie dans un instant.'],
  ])('explique un refus %i sans afficher de fil', async (status, message) => {
    openChannel.mockRejectedValue(apiError(status));
    renderPage();

    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(screen.queryByTestId('message-list')).not.toBeInTheDocument();
  });

  it('revient en arrière depuis l’en-tête', async () => {
    const user = userEvent.setup();
    const { onBack } = renderPage();
    await screen.findByRole('heading', { name: 'Canopée Digital' });

    await user.click(screen.getByRole('button', { name: 'Retour' }));

    expect(onBack).toHaveBeenCalledOnce();
  });
});
