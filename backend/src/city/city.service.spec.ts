import { BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { CityService } from './city.service';

interface BanFeature {
  properties: { city: string; postcode: string };
  geometry: { coordinates: [number, number] };
}

const feature = (
  city: string,
  postcode: string,
  coordinates: [number, number] = [4.835, 45.758],
): BanFeature => ({
  properties: { city, postcode },
  geometry: { coordinates },
});

const banAnswers = (...features: BanFeature[]): Response =>
  new Response(JSON.stringify({ features }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });

describe('CityService', () => {
  let service: CityService;
  let fetchMock: jest.Mock;

  const calledUrl = (index = 0): URL =>
    new URL(String((fetchMock.mock.calls[index] as [string])[0]));

  beforeEach(async () => {
    fetchMock = jest.fn();
    global.fetch = fetchMock;

    const moduleRef = await Test.createTestingModule({
      providers: [CityService],
    }).compile();

    service = moduleRef.get(CityService);
  });

  describe('search', () => {
    it('maps the reference answer to the shape the client needs', async () => {
      fetchMock.mockResolvedValue(
        banAnswers(feature('Lyon', '69001', [4.835, 45.758])),
      );

      await expect(service.search('lyon')).resolves.toEqual([
        {
          name: 'Lyon',
          postalCode: '69001',
          latitude: 45.758,
          longitude: 4.835,
        },
      ]);
    });

    // GeoJSON orders coordinates longitude first; storing them the other way
    // round would drop every profile in the sea off Somalia.
    it('reads the coordinates in GeoJSON order', async () => {
      fetchMock.mockResolvedValue(
        banAnswers(feature('Lyon', '69001', [4.8, 45.7])),
      );

      const [city] = await service.search('lyon');

      expect(city.latitude).toBe(45.7);
      expect(city.longitude).toBe(4.8);
    });

    it('asks the reference for municipalities only', async () => {
      fetchMock.mockResolvedValue(banAnswers());

      await service.search('lyon');

      expect(calledUrl().searchParams.get('type')).toBe('municipality');
      expect(calledUrl().searchParams.get('q')).toBe('lyon');
    });

    it('drops an entry the reference returns without a postcode', async () => {
      fetchMock.mockResolvedValue(
        banAnswers(feature('Lyon', '69001'), {
          properties: { city: 'Nulle part', postcode: '' },
          geometry: { coordinates: [0, 0] },
        }),
      );

      await expect(service.search('lyon')).resolves.toHaveLength(1);
    });

    // Every keystroke reaches this service; the same prefix must not become one
    // request per candidate typing it.
    it('serves a repeated query from its cache', async () => {
      fetchMock.mockResolvedValue(banAnswers(feature('Lyon', '69001')));

      await service.search('lyon');
      await service.search('LYON');

      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('answers with an empty list when the reference is unreachable', async () => {
      fetchMock.mockRejectedValue(new Error('network down'));

      await expect(service.search('lyon')).resolves.toEqual([]);
    });

    it('answers with an empty list when the reference fails', async () => {
      fetchMock.mockResolvedValue(new Response('', { status: 503 }));

      await expect(service.search('lyon')).resolves.toEqual([]);
    });

    it('does not cache a failure', async () => {
      fetchMock.mockRejectedValueOnce(new Error('network down'));
      fetchMock.mockResolvedValue(banAnswers(feature('Lyon', '69001')));

      await expect(service.search('lyon')).resolves.toEqual([]);
      await expect(service.search('lyon')).resolves.toHaveLength(1);
    });

    // The reference serves an empty result under load too, so a negative answer
    // is held for a minute and not for an hour: long enough to absorb a typing
    // loop, short enough that a real commune refused during an outage comes
    // back almost at once.
    it('holds an empty answer for a minute, not for the full hour', async () => {
      jest.useFakeTimers();
      try {
        fetchMock.mockResolvedValueOnce(banAnswers());
        fetchMock.mockResolvedValue(banAnswers(feature('Lyon', '69001')));

        await expect(service.search('lyon')).resolves.toEqual([]);

        jest.advanceTimersByTime(30_000);
        await expect(service.search('lyon')).resolves.toEqual([]);
        expect(fetchMock).toHaveBeenCalledTimes(1);

        jest.advanceTimersByTime(31_000);
        await expect(service.search('lyon')).resolves.toHaveLength(1);
        expect(fetchMock).toHaveBeenCalledTimes(2);
      } finally {
        jest.useRealTimers();
      }
    });

    it('holds a real answer for the full hour', async () => {
      jest.useFakeTimers();
      try {
        fetchMock.mockResolvedValue(banAnswers(feature('Lyon', '69001')));

        await expect(service.search('lyon')).resolves.toHaveLength(1);

        jest.advanceTimersByTime(30 * 60_000);
        await expect(service.search('lyon')).resolves.toHaveLength(1);

        expect(fetchMock).toHaveBeenCalledTimes(1);
      } finally {
        jest.useRealTimers();
      }
    });

    // A `Map` iterates in insertion order, so without the re-insert on a hit
    // the eviction would drop the commune everybody looks up.
    it('keeps a commune that is looked up again', async () => {
      fetchMock.mockResolvedValue(banAnswers(feature('Lyon', '69001')));

      await service.search('lyon');
      await service.search('lyon');

      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('findKnown', () => {
    it('returns the entry matching the pair', async () => {
      fetchMock.mockResolvedValue(banAnswers(feature('Lyon', '69001')));

      await expect(service.findKnown('Lyon', '69001')).resolves.toMatchObject({
        name: 'Lyon',
        postalCode: '69001',
      });
    });

    it('ignores case and accents when matching the name', async () => {
      fetchMock.mockResolvedValue(banAnswers(feature('Nîmes', '30000')));

      await expect(service.findKnown('nimes', '30000')).resolves.toMatchObject({
        name: 'Nîmes',
      });
    });

    // The reference ignores its own `postcode` filter, so the answer for
    // « Lyon 69003 » still contains « Lyon 69001 ». Matching the name alone
    // would accept any postcode for a real city.
    it('refuses a real city paired with the wrong postcode', async () => {
      fetchMock.mockResolvedValue(
        banAnswers(
          feature('Lyon', '69001'),
          feature('Lyon 3e Arrondissement', '69003'),
        ),
      );

      await expect(service.findKnown('Lyon', '69003')).resolves.toBeUndefined();
    });

    it('refuses a city the reference does not know', async () => {
      fetchMock.mockResolvedValue(banAnswers());

      await expect(
        service.findKnown('Wakanda', '69003'),
      ).resolves.toBeUndefined();
    });

    /**
     * Fail-open, deliberately. This check is a data-quality guard, not an
     * authorisation one: an outage of the reference must not make it impossible
     * to finish an onboarding that is otherwise valid, and the candidate has no
     * way to act on the failure. `null` says « could not tell », which is not
     * the same answer as « no such commune ».
     */
    it('cannot tell when the reference is unreachable', async () => {
      fetchMock.mockRejectedValue(new Error('network down'));

      await expect(service.findKnown('Lyon', '69001')).resolves.toBeNull();
    });

    it('cannot tell when the reference fails', async () => {
      fetchMock.mockResolvedValue(new Response('', { status: 503 }));

      await expect(service.findKnown('Lyon', '69001')).resolves.toBeNull();
    });
  });

  describe('assertKnown', () => {
    it('passes when no location is given at all', async () => {
      await expect(service.assertKnown({})).resolves.toBeNull();
      expect(fetchMock).not.toHaveBeenCalled();
    });

    // The coordinates come back from the reference, never from the request, so
    // a payload cannot display one commune and be matched at another's.
    it('returns the coordinates of a pair the reference knows', async () => {
      fetchMock.mockResolvedValue(banAnswers(feature('Lyon', '69001')));

      await expect(
        service.assertKnown({ city: 'Lyon', postalCode: '69001' }),
      ).resolves.toEqual({ latitude: 45.758, longitude: 4.835 });
    });

    // Fail-open: nothing to write, but nothing to refuse either.
    it('returns no coordinates when the reference is unreachable', async () => {
      fetchMock.mockRejectedValue(new Error('network down'));

      await expect(
        service.assertKnown({ city: 'Lyon', postalCode: '69001' }),
      ).resolves.toBeNull();
    });

    // Half a location cannot be checked, and a city without its postcode is
    // exactly what a free-text field used to let through.
    it.each([
      ['a city without its postcode', { city: 'Lyon' }],
      ['a postcode without its city', { postalCode: '69001' }],
    ])('rejects %s', async (_name, location) => {
      await expect(service.assertKnown(location)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('rejects a pair the reference does not know', async () => {
      fetchMock.mockResolvedValue(banAnswers());

      await expect(
        service.assertKnown({ city: 'Wakanda', postalCode: '99999' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    // `null` is what the database hands back for an empty column, and it must
    // read the same as an absent field.
    it('treats null like an absent value', async () => {
      await expect(
        service.assertKnown({ city: null, postalCode: null }),
      ).resolves.toBeNull();
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });
});
