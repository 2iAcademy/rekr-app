import { defineConfig } from 'orval';

export default defineConfig({
  api: {
    input: 'http://localhost:3001/api/docs-json',
    output: {
      target: './src/api/generated.ts',
      client: 'fetch',
    },
  },
});
