import { OfferService } from '../offer/offer.service';
import { PrismaService } from '../prisma/prisma.service';
import { CityService } from '../city/city.service';
import { MatchService } from '../match/match.service';
import { JobFamilyService } from '../job-family/job-family.service';
import { SwipeEventsService } from './swipe-events.service';

describe('committed swipe hooks', () => {
  const transaction = jest.fn();
  const decision = jest.fn();
  let service: OfferService;
  beforeEach(() => {
    jest.clearAllMocks();
    service = new OfferService(
      { $transaction: transaction } as unknown as PrismaService,
      {} as CityService,
      {} as MatchService,
      {} as JobFamilyService,
      undefined,
      undefined,
      { decision } as unknown as SwipeEventsService,
    );
  });
  it('does not publish before commit or after rollback', async () => {
    let reject!: (error: Error) => void;
    transaction.mockReturnValue(
      new Promise((_, fail) => {
        reject = fail;
      }),
    );
    const request = service.like(7, 12);
    expect(decision).not.toHaveBeenCalled();
    reject(new Error('rollback'));
    await expect(request).rejects.toThrow('rollback');
    expect(decision).not.toHaveBeenCalled();
  });
  it('emits only newly created candidate decisions and matches', async () => {
    transaction.mockResolvedValue({ likeCreated: true, matchCreated: true });
    await service.like(7, 12);
    expect(decision.mock.calls).toEqual([
      ['like', 7, 12],
      ['match', 7, 12],
    ]);
    decision.mockClear();
    transaction.mockResolvedValue({ likeCreated: false, matchCreated: false });
    await service.like(7, 12);
    expect(decision).not.toHaveBeenCalled();
  });
  it('does not count repeated passes', async () => {
    transaction
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });
    await service.pass(7, 12);
    await service.pass(7, 12);
    expect(decision.mock.calls).toEqual([['pass', 7, 12]]);
  });
  it('records a recruiter-completed match without counting a candidate like twice', async () => {
    transaction.mockResolvedValue({ likeCreated: true, matchCreated: true });
    await service.likeApplicant(9, 12, 7);
    expect(decision.mock.calls).toEqual([['match', 7, 12]]);
  });
});
