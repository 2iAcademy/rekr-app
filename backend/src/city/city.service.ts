import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { CityDto } from './dto/city.dto';

export interface Location {
  city?: string | null;
  postalCode?: string | null;
}

export interface Coordinates {
  latitude: number;
  longitude: number;
}

const REFERENCE_ENDPOINT = 'https://api-adresse.data.gouv.fr/search/';
const SEARCH_LIMIT = 8;
const VERIFY_LIMIT = 20;
const REQUEST_TIMEOUT_MS = 2_000;
const CACHE_TTL_MS = 60 * 60 * 1_000;

/**
 * A « no such commune » is cached too, but for a minute rather than an hour.
 *
 * Not caching it at all would be worse than caching it for an hour: every
 * keystroke that matches nothing would go out to the reference, and the budget
 * that bounds `/api/cities` is 200 a minute. Get temporarily blocked by the
 * reference and `fetchCities` starts answering `null`, which is fail-open —
 * the data-quality guard switches itself off. A minute is short enough that a
 * commune refused during an outage is usable again almost immediately, and
 * long enough to absorb a typing loop.
 */
const EMPTY_CACHE_TTL_MS = 60 * 1_000;
const CACHE_MAX_ENTRIES = 500;

interface CacheEntry {
  cities: CityDto[];
  expiresAt: number;
}

interface ReferenceFeature {
  properties?: { city?: unknown; postcode?: unknown };
  geometry?: { coordinates?: unknown };
}

/**
 * Trims what separates two spellings of the same commune: case, accents and
 * padding. `Nîmes`, `nimes` and ` NIMES ` are one name.
 */
const normalise = (value: string): string =>
  value
    .trim()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();

const toCity = (feature: ReferenceFeature): CityDto | null => {
  const name = feature.properties?.city;
  const postalCode = feature.properties?.postcode;
  const coordinates = feature.geometry?.coordinates;

  if (typeof name !== 'string' || name === '') {
    return null;
  }
  if (typeof postalCode !== 'string' || postalCode === '') {
    return null;
  }
  if (!Array.isArray(coordinates) || coordinates.length < 2) {
    return null;
  }

  const [longitude, latitude] = coordinates as unknown[];
  if (typeof latitude !== 'number' || typeof longitude !== 'number') {
    return null;
  }

  return { name, postalCode, latitude, longitude };
};

@Injectable()
export class CityService {
  private readonly logger = new Logger(CityService.name);
  private readonly cache = new Map<string, CacheEntry>();

  async search(query: string): Promise<CityDto[]> {
    return (await this.fetchCities(query, SEARCH_LIMIT)) ?? [];
  }

  /**
   * The reference entry matching this exact pair, `undefined` when it knows no
   * such pair, `null` when it could not be reached.
   *
   * Matching the name alone would accept any postcode for a real city: the
   * reference ignores its own `postcode` filter, so the answer for
   * « Lyon 69003 » still contains « Lyon 69001 ». The filter is kept because it
   * improves recall, never as the check itself.
   *
   * Fail-open on purpose. This is a data-quality guard, not an authorisation
   * one: an outage of a third-party reference must not make it impossible to
   * finish an otherwise valid onboarding, and the candidate has no way to act
   * on the failure.
   */
  async findKnown(
    city: string,
    postalCode: string,
  ): Promise<CityDto | null | undefined> {
    const cities = await this.fetchCities(city, VERIFY_LIMIT, postalCode);
    if (cities === null) {
      return null;
    }

    return cities.find(
      (candidate) =>
        normalise(candidate.name) === normalise(city) &&
        candidate.postalCode === postalCode.trim(),
    );
  }

  /**
   * A location is a pair or nothing.
   *
   * Shared by every writer of a `city` / `postal_code` couple — candidate
   * profile, company, offer — so the rule lives here rather than in each of
   * them.
   *
   * Returns the coordinates the reference attaches to the pair, for the caller
   * to store alongside it. They are derived here rather than accepted from the
   * request: a client could otherwise display one commune and be matched at the
   * coordinates of another. `null` means there is nothing to write — either no
   * location was sent, or the reference was unreachable and the pair went
   * through on the fail-open above.
   *
   * Callers spread `null` as « leave the column alone », deliberately: on a
   * create the profile keeps no coordinates at all, and on an update it keeps
   * the ones of the previous commune. Both are wrong in their own way, and the
   * alternative — refusing the write — would turn a third-party outage into a
   * blocked onboarding, which is exactly what the fail-open exists to avoid.
   * A commune stored without its coordinates is recoverable later; a candidate
   * who could not finish is not.
   */
  async assertKnown({
    city,
    postalCode,
  }: Location): Promise<Coordinates | null> {
    if (!city && !postalCode) {
      return null;
    }

    if (!city || !postalCode) {
      throw new BadRequestException(
        'A city must come with its postal code, and the other way round',
      );
    }

    const known = await this.findKnown(city, postalCode);
    if (known === undefined) {
      throw new BadRequestException(
        `Unknown city and postal code pair: ${city} ${postalCode}`,
      );
    }

    return known && { latitude: known.latitude, longitude: known.longitude };
  }

  /** `null` means the reference could not be reached, which is not "no match". */
  private async fetchCities(
    query: string,
    limit: number,
    postalCode?: string,
  ): Promise<CityDto[] | null> {
    const url = this.buildUrl(query, limit, postalCode);
    const cached = this.readCache(url);
    if (cached) {
      return cached;
    }

    let payload: unknown;
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (!response.ok) {
        this.logger.warn(
          `City reference answered ${String(response.status)} for a lookup.`,
        );
        return null;
      }

      payload = await response.json();
    } catch {
      this.logger.warn('City reference is unreachable.');
      return null;
    }

    const cities = this.readFeatures(payload);
    this.writeCache(url, cities);

    return cities;
  }

  private buildUrl(query: string, limit: number, postalCode?: string): string {
    const url = new URL(REFERENCE_ENDPOINT);
    url.searchParams.set('q', query.trim());
    url.searchParams.set('type', 'municipality');
    url.searchParams.set('limit', String(limit));
    if (postalCode) {
      url.searchParams.set('postcode', postalCode.trim());
    }

    return url.toString();
  }

  private readFeatures(payload: unknown): CityDto[] {
    const features = (payload as { features?: unknown })?.features;
    if (!Array.isArray(features)) {
      return [];
    }

    return (features as ReferenceFeature[])
      .map(toCity)
      .filter((city): city is CityDto => city !== null);
  }

  private readCache(url: string): CityDto[] | null {
    const key = url.toLowerCase();
    const entry = this.cache.get(key);
    if (!entry) {
      return null;
    }

    if (entry.expiresAt <= Date.now()) {
      this.cache.delete(key);
      return null;
    }

    // Re-inserted so the eviction below reads as least-recently-used: a `Map`
    // iterates in insertion order, and a hot commune would otherwise be evicted
    // by a burst of queries it has nothing to do with.
    this.cache.delete(key);
    this.cache.set(key, entry);

    return entry.cities;
  }

  // Bounded on purpose: the key is user-supplied, so an unbounded map would let
  // a typing loop grow the process heap for as long as it runs.
  private writeCache(url: string, cities: CityDto[]): void {
    if (this.cache.size >= CACHE_MAX_ENTRIES) {
      const oldest = this.cache.keys().next();
      if (!oldest.done) {
        this.cache.delete(oldest.value);
      }
    }

    this.cache.set(url.toLowerCase(), {
      cities,
      expiresAt:
        Date.now() + (cities.length > 0 ? CACHE_TTL_MS : EMPTY_CACHE_TTL_MS),
    });
  }

  /** Test seam: the cache lives on the instance, which outlives a single spec. */
  clearCache(): void {
    this.cache.clear();
  }
}
