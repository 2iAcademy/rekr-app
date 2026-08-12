/**
 * Stubs the city reference (`api-adresse.data.gouv.fr`) with a mirror: whatever
 * pair a payload sends is echoed back as a known municipality.
 *
 * The suite must not depend on a third party being reachable, and the existing
 * fixtures were written before the check existed — several of them pair a real
 * city with a postcode the reference does not actually attach to it. Mirroring
 * keeps them meaningful: they exercise what they were written for, not the
 * lookup. A test that is about the lookup overrides the mock with its own
 * answer.
 */
export const stubCityReference = (): jest.Mock => {
  const mock = jest.fn((input: unknown) => {
    const url = new URL(String(input));
    const city = url.searchParams.get('q') ?? '';
    const postcode = url.searchParams.get('postcode') ?? '00000';

    return Promise.resolve(
      new Response(
        JSON.stringify({
          features: [
            {
              properties: { city, postcode },
              geometry: { coordinates: [4.835, 45.758] },
            },
          ],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );
  });

  global.fetch = mock;

  return mock;
};
