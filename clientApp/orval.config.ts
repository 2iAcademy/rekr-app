import { defineConfig } from 'orval';

export default defineConfig({
  api: {
    // Overridable so the generation can run inside the front container, where
    // the API answers on its compose service name rather than on localhost.
    input: process.env.ORVAL_INPUT ?? 'http://localhost:3001/api/docs-json',
    output: {
      target: './src/api/generated.ts',
      client: 'fetch',
      // Formats the generated file so `npm run format:check` stays green.
      formatter: 'prettier',
      override: {
        // Orval's default fetch implementation resolves on any HTTP status, so
        // a 401/409/400 was indistinguishable from a success. This mutator
        // rejects with an ApiError instead. It must stay configured here: a
        // fix applied by hand to generated.ts would be lost on regeneration.
        mutator: {
          path: './src/api/customFetch.ts',
          name: 'customFetch',
        },
        fetch: {
          // The mutator throws on non-2xx, so the resolved value can only ever
          // be a success response — keep the generated return types in sync.
          forceSuccessResponse: true,
        },
      },
    },
  },
});
