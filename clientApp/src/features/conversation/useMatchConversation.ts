import { useEffect, useState } from 'react';
import { ApiError } from '@/api/customFetch';
import {
  chatControllerIssueToken,
  chatControllerOpenMatchChannel,
  type ChatTokenDto,
  type MatchChannelDto,
} from '@/api/generated';

export type MatchConversation =
  | { status: 'loading' }
  | { status: 'ready'; session: ChatTokenDto; channel: MatchChannelDto }
  | { status: 'error'; message: string };

const failureMessage = (cause: unknown): string => {
  if (cause instanceof ApiError && cause.status === 404) return 'Conversation introuvable.';
  if (cause instanceof ApiError && cause.status === 503)
    return 'La messagerie est momentanément indisponible.';
  return 'Impossible d’ouvrir la conversation. Réessaie dans un instant.';
};

/**
 * Asks the API for a Stream session and for the match's channel. The second
 * call is the access check: the API answers 404 to anyone outside the match,
 * and only then creates the channel or adds the caller to it.
 */
export function useMatchConversation(matchId: number): MatchConversation {
  // Keyed on the match, so moving to another conversation reads as loading
  // until its own answer lands, without resetting the state from the effect.
  const [settled, setSettled] = useState<{ matchId: number; result: MatchConversation } | null>(
    null,
  );

  useEffect(() => {
    let cancelled = false;
    const settle = (result: MatchConversation) => {
      if (!cancelled) setSettled({ matchId, result });
    };
    Promise.all([chatControllerIssueToken(), chatControllerOpenMatchChannel(matchId)])
      .then(([session, channel]) =>
        settle({ status: 'ready', session: session.data, channel: channel.data }),
      )
      .catch((cause: unknown) => settle({ status: 'error', message: failureMessage(cause) }));
    return () => {
      cancelled = true;
    };
  }, [matchId]);

  return settled?.matchId === matchId ? settled.result : { status: 'loading' };
}
