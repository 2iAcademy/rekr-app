import { externalCall, requestContext } from './failure-log';

describe('external failure logging', () => {
  const output = jest
    .spyOn(console, 'error')
    .mockImplementation(() => undefined);
  afterEach(() => output.mockClear());
  afterAll(() => output.mockRestore());

  it('keeps successful results and emits no failure', async () => {
    await expect(
      externalCall('smtp', 'send_mail', () => Promise.resolve(42)),
    ).resolves.toBe(42);
    expect(output).not.toHaveBeenCalled();
  });

  it('logs once, correlates the request, omits sensitive error data and rethrows the same error', async () => {
    const error = Object.assign(
      new Error('password=secret recipient=person@example.com'),
      { code: 'ECONNREFUSED' },
    );
    await requestContext.run({ request_id: 'request-a' }, async () => {
      await expect(
        externalCall('smtp', 'send_mail', () => Promise.reject(error)),
      ).rejects.toBe(error);
    });
    expect(output).toHaveBeenCalledTimes(1);
    const line = String(output.mock.calls[0][0]);
    const { timestamp } = JSON.parse(line) as { timestamp: unknown };
    expect(typeof timestamp).toBe('number');
    expect(JSON.parse(line)).toMatchObject({
      event: 'external_service_failed',
      dependency: 'smtp',
      operation: 'send_mail',
      request_id: 'request-a',
      error_code: 'ECONNREFUSED',
    });
    expect(line).not.toContain('secret');
    expect(line).not.toContain('person@example.com');
  });

  it('does not leak request IDs between concurrent operations', async () => {
    await Promise.all(
      ['a', 'b'].map((id) =>
        requestContext.run({ request_id: id }, async () => {
          await externalCall('smtp', 'send_mail', async () => {
            await Promise.resolve();
            throw new Error('failed');
          }).catch(() => undefined);
        }),
      ),
    );
    expect(
      output.mock.calls
        .map(
          ([line]) =>
            (JSON.parse(String(line)) as { request_id: string }).request_id,
        )
        .sort(),
    ).toEqual(['a', 'b']);
  });
});
