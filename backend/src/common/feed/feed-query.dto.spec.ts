import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { FeedQueryDto } from './feed-query.dto';

const build = (query: Record<string, unknown>): FeedQueryDto =>
  plainToInstance(FeedQueryDto, query);

const failedProperties = (query: Record<string, unknown>): string[] =>
  validateSync(build(query)).map((error) => error.property);

describe('FeedQueryDto', () => {
  it('applies the default limit on an empty query', () => {
    const dto = build({});

    expect(failedProperties({})).toEqual([]);
    expect(dto.limit).toBe(20);
  });

  it('transforms the string query params into numbers', () => {
    const dto = build({ limit: '50' });

    expect(dto.limit).toBe(50);
    expect(validateSync(dto)).toEqual([]);
  });

  // The deck takes no offset. The parameter is gone from the schema, so the
  // pipe's `forbidNonWhitelisted` is what answers a caller still sending it.
  it('carries no page', () => {
    expect(build({})).not.toHaveProperty('page');
  });

  it('rejects a limit above 100', () => {
    expect(failedProperties({ limit: '101' })).toEqual(['limit']);
  });

  it('accepts the enum filters', () => {
    const dto = build({
      contractType: 'CDI',
      experienceLevel: 'SENIOR',
      remotePolicy: 'FULL_REMOTE',
    });

    expect(validateSync(dto)).toEqual([]);
    expect(dto.contractType).toBe('CDI');
    expect(dto.experienceLevel).toBe('SENIOR');
    expect(dto.remotePolicy).toBe('FULL_REMOTE');
  });

  it('rejects a value outside the enum', () => {
    expect(failedProperties({ contractType: 'CDX' })).toEqual(['contractType']);
    expect(failedProperties({ experienceLevel: 'junior' })).toEqual([
      'experienceLevel',
    ]);
    expect(failedProperties({ remotePolicy: 'REMOTE' })).toEqual([
      'remotePolicy',
    ]);
  });

  it('accepts a plain city and leaves the filters undefined when absent', () => {
    const dto = build({ city: 'Saint-Étienne' });

    expect(validateSync(dto)).toEqual([]);
    expect(dto.city).toBe('Saint-Étienne');
    expect(dto.contractType).toBeUndefined();
  });

  it('rejects a city carrying a control character', () => {
    expect(failedProperties({ city: `Lyon${String.fromCharCode(0)}` })).toEqual(
      ['city'],
    );
  });

  it('rejects a city longer than 100 characters', () => {
    expect(failedProperties({ city: 'a'.repeat(101) })).toEqual(['city']);
  });
});
