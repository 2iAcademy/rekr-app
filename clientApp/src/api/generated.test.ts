import { describe, it, expect, vi, afterEach } from 'vitest';
import { ApiError } from './customFetch';
import { authControllerLogin, authControllerSignup, SignupDtoUserType } from './generated';

/**
 * Guards the wiring between the generated client and the customFetch mutator.
 * If `generated.ts` is ever regenerated without the mutator configured in
 * orval.config.ts, the raw fetch client resolves on 401/400 and these tests fail.
 */

const stubFetch = (status: number, body: string) => {
  const response = {
    ok: status >= 200 && status < 300,
    status,
    statusText: '',
    headers: new Headers({ 'content-type': 'application/json' }),
    text: () => Promise.resolve(body),
  } as unknown as Response;

  const fetchSpy = vi.fn().mockResolvedValue(response);
  vi.stubGlobal('fetch', fetchSpy);
  return fetchSpy;
};

afterEach(() => {
  vi.unstubAllGlobals();
});

const credentials = { email: 'user@rekr.fr', password: 'secret42' };

describe('generated API client', () => {
  it('rejects when the login endpoint answers 401', async () => {
    stubFetch(401, '{"message":"Invalid credentials","statusCode":401}');

    const promise = authControllerLogin(credentials);

    await expect(promise).rejects.toBeInstanceOf(ApiError);
    await expect(promise).rejects.toMatchObject({ status: 401 });
  });

  it('rejects when the signup endpoint answers 400', async () => {
    stubFetch(400, '{"message":["password must be longer"],"statusCode":400}');

    const promise = authControllerSignup({
      ...credentials,
      userType: SignupDtoUserType.candidate,
    });

    await expect(promise).rejects.toBeInstanceOf(ApiError);
    await expect(promise).rejects.toMatchObject({
      status: 400,
      data: { message: ['password must be longer'], statusCode: 400 },
    });
  });

  it('rejects when the signup endpoint answers 409', async () => {
    stubFetch(409, '{"message":"Email already registered","statusCode":409}');

    await expect(
      authControllerSignup({ ...credentials, userType: SignupDtoUserType.recruiter }),
    ).rejects.toBeInstanceOf(ApiError);
  });

  it('resolves on a successful login', async () => {
    const fetchSpy = stubFetch(200, '{"accessToken":"jwt"}');

    const result = await authControllerLogin(credentials);

    expect(result.status).toBe(200);
    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/auth/login',
      expect.objectContaining({ method: 'POST', body: JSON.stringify(credentials) }),
    );
  });
});
