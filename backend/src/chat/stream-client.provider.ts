import type { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StreamChat } from 'stream-chat';

export const STREAM_CLIENT = Symbol('STREAM_CLIENT');

/** The part of the Stream server SDK the chat service relies on. */
export type StreamClient = Pick<
  StreamChat,
  'key' | 'upsertUsers' | 'createToken' | 'channel' | 'deleteUser'
>;

/**
 * Null when the keys are absent, like the search client without a node: the
 * rest of the application boots and runs, and only the messaging routes answer
 * 503. The secret signs user tokens and grants every right on the Stream app,
 * so it never leaves the backend.
 */
export const streamClientProvider: Provider = {
  provide: STREAM_CLIENT,
  inject: [ConfigService],
  useFactory: (config: ConfigService): StreamClient | null => {
    const key = config.get<string>('STREAM_API_KEY')?.trim();
    const secret = config.get<string>('STREAM_API_SECRET')?.trim();
    return key && secret
      ? new StreamChat(key, secret, { timeout: 5000 })
      : null;
  },
};
