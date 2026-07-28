if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL =
    'postgresql://postgres:postgres@postgres:5432/rekr_test';
}
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.REFRESH_TOKEN_REPLAY_SECONDS =
  process.env.REFRESH_TOKEN_REPLAY_SECONDS || '1';
