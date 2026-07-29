import { readFileSync } from 'node:fs';
import { join } from 'node:path';

type InitOptions = {
  dsn?: string;
  enabled?: boolean;
  environment?: string;
  tracesSampleRate?: number;
};

const init = jest.fn<void, [InitOptions]>();

jest.mock('@sentry/nestjs', () => ({
  init: (options: InitOptions): void => init(options),
}));

const loadInstrument = (): InitOptions => {
  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- the module runs Sentry.init on load, so it has to be re-required per case
    require('./instrument');
  });

  expect(init).toHaveBeenCalledTimes(1);
  const [options] = init.mock.calls[0];
  return options;
};

describe('instrument', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    init.mockClear();
    process.env = { ...originalEnv };
    delete process.env.SENTRY_DSN;
    delete process.env.SENTRY_TRACES_SAMPLE_RATE;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('initialises the SDK disabled when no DSN is configured', () => {
    const options = loadInstrument();

    expect(options.enabled).toBe(false);
  });

  it('enables the SDK when a DSN is configured', () => {
    process.env.SENTRY_DSN = 'https://examplePublicKey@o0.ingest.sentry.io/0';

    const options = loadInstrument();

    expect(options.enabled).toBe(true);
    expect(options.dsn).toBe(process.env.SENTRY_DSN);
  });

  it('treats a blank DSN as absent', () => {
    process.env.SENTRY_DSN = '   ';

    expect(loadInstrument().enabled).toBe(false);
  });

  it('sends no traces unless a sample rate is configured', () => {
    expect(loadInstrument().tracesSampleRate).toBe(0);
  });

  it('reads the trace sample rate from the environment', () => {
    process.env.SENTRY_TRACES_SAMPLE_RATE = '0.25';

    expect(loadInstrument().tracesSampleRate).toBe(0.25);
  });

  /**
   * `Sentry.init` must run before any instrumented module is imported, so the
   * import of `./instrument` has to stay the very first statement of `main.ts`.
   *
   * This is asserted on the source text on purpose: an import sorter, a merge,
   * or a well-meaning cleanup moving that line down would leave every Sentry
   * call a silent no-op, with nothing failing anywhere. That is exactly how the
   * SDK ended up installed and wired into `AppModule` while never capturing a
   * single event.
   */
  it('is imported as the very first statement of main.ts', () => {
    const source = readFileSync(join(__dirname, 'main.ts'), 'utf8');

    const firstStatement = source
      .split('\n')
      .map((line) => line.trim())
      .find((line) => line !== '' && !line.startsWith('//'));

    expect(firstStatement).toBe("import './instrument';");
  });
});
