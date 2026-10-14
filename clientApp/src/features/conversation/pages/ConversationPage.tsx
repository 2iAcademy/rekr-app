import { ArrowLeft } from 'lucide-react';
import { useCallback, useMemo, useRef } from 'react';
import { Link } from 'react-router';
import {
  Channel,
  Chat,
  MessageComposer,
  MessageList,
  Streami18n,
  Window,
  WithComponents,
  useCreateChatClient,
} from 'stream-chat-react';
import { chatControllerIssueToken, type ChatTokenDto, type MatchChannelDto } from '@/api/generated';
import { applicantsPath } from '@/features/matches/paths';
import { useMatchConversation } from '../useMatchConversation';
import '../chat-theme.css';

const i18n = new Streami18n({ language: 'fr' });

/**
 * No attachment button: a file sent here would sit at Stream, out of reach of
 * the account export and of the storage the API purges. The Stream app refuses
 * uploads on its side too (see the README), this only keeps the button away.
 */
const composerComponents = { AttachmentSelector: () => null };

interface ConversationPageProps {
  matchId: number;
  viewerIsCandidate: boolean;
  onBack: () => void;
}

/**
 * The thread of one match and its composer.
 *
 * Default export: the route loads it lazily, so the Stream SDK and its
 * stylesheet stay out of the bundle of every other screen.
 */
export default function ConversationPage({
  matchId,
  viewerIsCandidate,
  onBack,
}: ConversationPageProps) {
  const conversation = useMatchConversation(matchId);

  return (
    <main className="rekr-conversation mx-auto flex h-dvh w-full max-w-3xl flex-col bg-background">
      {conversation.status === 'ready' ? (
        <ConnectedConversation
          session={conversation.session}
          channel={conversation.channel}
          viewerIsCandidate={viewerIsCandidate}
          onBack={onBack}
        />
      ) : (
        <>
          <ConversationHeader title="Conversation" onBack={onBack} />
          <p className="m-auto px-4 text-center text-sm text-ink-muted">
            {conversation.status === 'loading' ? 'Chargement…' : conversation.message}
          </p>
        </>
      )}
    </main>
  );
}

interface ConnectedConversationProps {
  session: ChatTokenDto;
  channel: MatchChannelDto;
  viewerIsCandidate: boolean;
  onBack: () => void;
}

function ConnectedConversation({
  session,
  channel,
  viewerIsCandidate,
  onBack,
}: ConnectedConversationProps) {
  // The first connection uses the token the page already holds; the SDK calls
  // back here when it expires, an hour later.
  const initialToken = useRef<string | null>(session.token);
  const tokenProvider = useCallback(async () => {
    const token = initialToken.current;
    if (token) {
      initialToken.current = null;
      return token;
    }
    return (await chatControllerIssueToken()).data.token;
  }, []);

  const client = useCreateChatClient({
    apiKey: session.apiKey,
    tokenOrProvider: tokenProvider,
    userData: { id: session.userId },
  });

  const streamChannel = useMemo(
    () => client?.channel(channel.channelType, channel.channelId),
    [client, channel.channelType, channel.channelId],
  );

  if (!client || !streamChannel) {
    return (
      <>
        <ConversationHeader title={channel.counterpartName} onBack={onBack} />
        <p className="m-auto text-sm text-ink-muted">Connexion…</p>
      </>
    );
  }

  return (
    <Chat client={client} i18nInstance={i18n}>
      <Channel channel={streamChannel}>
        <Window>
          <ConversationHeader
            title={channel.counterpartName}
            onBack={onBack}
            link={
              viewerIsCandidate
                ? { to: `/offres/${channel.offerId}`, label: 'Voir l’offre' }
                : { to: applicantsPath(channel.offerId), label: 'Voir la candidature' }
            }
          />
          <MessageList />
          {channel.frozen ? (
            <p
              role="status"
              className="border-t border-border px-4 py-3 text-center text-sm text-ink-muted"
            >
              Cette offre n’est plus publiée : la conversation est en lecture seule.
            </p>
          ) : (
            <WithComponents overrides={composerComponents}>
              <MessageComposer />
            </WithComponents>
          )}
        </Window>
      </Channel>
    </Chat>
  );
}

function ConversationHeader({
  title,
  onBack,
  link,
}: {
  title: string;
  onBack: () => void;
  link?: { to: string; label: string };
}) {
  return (
    <header className="flex items-center gap-3 border-b border-border px-4 py-3">
      <button
        type="button"
        onClick={onBack}
        aria-label="Retour"
        className="flex size-9 shrink-0 items-center justify-center rounded-full hover:bg-muted"
      >
        <ArrowLeft className="size-5" aria-hidden />
      </button>
      <h1 className="min-w-0 flex-1 truncate font-heading text-base font-semibold text-ink">
        {title}
      </h1>
      {link && (
        <Link to={link.to} className="shrink-0 text-sm font-medium text-brand underline">
          {link.label}
        </Link>
      )}
    </header>
  );
}
