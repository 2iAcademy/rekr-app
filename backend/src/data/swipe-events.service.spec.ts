import { Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SwipeEventsService } from './swipe-events.service';

const mockSend = jest
  .fn<Promise<void>, [{ topic: string; messages: { value: string }[] }]>()
  .mockResolvedValue(undefined);
const mockConnect = jest.fn().mockResolvedValue(undefined);
const mockDisconnect = jest.fn().mockResolvedValue(undefined);
jest.mock('kafkajs', () => ({
  Kafka: jest.fn().mockImplementation(() => ({
    producer: () => ({
      send: mockSend,
      connect: mockConnect,
      disconnect: mockDisconnect,
    }),
  })),
  logLevel: { NOTHING: 0 },
}));
const flush = () => new Promise<void>((resolve) => setImmediate(resolve));
describe('SwipeEventsService', () => {
  const findMany = jest.fn();
  let warn: jest.SpyInstance;
  const prisma = { offer: { findMany } } as unknown as PrismaService;
  const previous = process.env.SWIPE_EVENTS_ENABLED;
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.SWIPE_EVENTS_ENABLED = 'true';
    findMany.mockResolvedValue([{ id: 12, jobFamilyId: 3 }]);
    mockSend.mockResolvedValue(undefined);
    mockConnect.mockResolvedValue(undefined);
    warn = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
  });
  afterEach(() => {
    jest.restoreAllMocks();
    if (previous === undefined) delete process.env.SWIPE_EVENTS_ENABLED;
    else process.env.SWIPE_EVENTS_ENABLED = previous;
  });
  it('does nothing with analytics disabled', async () => {
    delete process.env.SWIPE_EVENTS_ENABLED;
    new SwipeEventsService(prisma).decision('like', 7, 12);
    await flush();
    expect(findMany).not.toHaveBeenCalled();
    expect(mockConnect).not.toHaveBeenCalled();
  });
  it('publishes a minimal pseudonymous event and preserves feed order', async () => {
    const service = new SwipeEventsService(prisma);
    service.feed(7, [99, 12]);
    await flush();
    const call = mockSend.mock.calls[0][0];
    expect(call.topic).toBe('rekr.swipe-events');
    expect(JSON.parse(call.messages[0].value)).toEqual({
      schema_version: 1,
      event_id: expect.any(String) as unknown,
      source: 'real',
      type: 'feed_delivered',
      occurred_at: expect.any(String) as unknown,
      candidate_id: 7,
      offer_id: 12,
      job_family_id: 3,
      position: 2,
    });
    await service.onApplicationShutdown();
    service.decision('like', 7, 12);
    expect(mockSend).toHaveBeenCalledTimes(1);
  });
  it('keeps the observed card position on an impression', async () => {
    new SwipeEventsService(prisma).impression(7, 12, 4);
    await flush();
    expect(
      JSON.parse(mockSend.mock.calls[0][0].messages[0].value),
    ).toMatchObject({ type: 'impression', candidate_id: 7, position: 4 });
  });
  it('does not expose a broker failure to the request', async () => {
    mockSend.mockRejectedValue(new Error('offline'));
    const service = new SwipeEventsService(prisma);
    expect(service.decision('pass', 7, 12)).toBeUndefined();
    await flush();
    expect(warn).toHaveBeenCalledWith('swipe_events_dropped: publish_failed');
  });
  it('retries connection on a later event after a failed connection', async () => {
    mockConnect.mockRejectedValueOnce(new Error('offline'));
    const service = new SwipeEventsService(prisma);
    service.decision('like', 7, 12);
    await flush();
    service.decision('match', 7, 12);
    await flush();
    expect(mockConnect).toHaveBeenCalledTimes(2);
    expect(mockSend).toHaveBeenCalledTimes(1);
  });
  it('bounds pending enrichment when a dependency stalls', () => {
    findMany.mockReturnValue(new Promise(() => undefined));
    const service = new SwipeEventsService(prisma);
    for (let i = 0; i < 25; i++) service.decision('like', 7, 12);
    expect(findMany).toHaveBeenCalledTimes(20);
    expect(warn).toHaveBeenCalledWith('swipe_events_dropped: queue_full');
  });
  it('catches enrichment errors and ignores empty feeds', async () => {
    findMany.mockRejectedValue(new Error('database unavailable'));
    const service = new SwipeEventsService(prisma);
    service.feed(7, []);
    service.decision('like', 7, 12);
    await flush();
    expect(findMany).toHaveBeenCalledTimes(1);
    expect(mockSend).not.toHaveBeenCalled();
  });
  it('does not send an event for an offer that no longer exists', async () => {
    findMany.mockResolvedValue([]);
    const service = new SwipeEventsService(prisma);
    service.impression(7, 999, 1);
    await flush();
    expect(mockSend).not.toHaveBeenCalled();
    await service.onApplicationShutdown();
  });
  it('shares a connection across concurrent events and leaves decision position unknown', async () => {
    const service = new SwipeEventsService(prisma);
    service.decision('like', 7, 12);
    service.decision('pass', 8, 12);
    await flush();
    expect(mockConnect).toHaveBeenCalledTimes(1);
    expect(mockSend).toHaveBeenCalledTimes(2);
    const events = mockSend.mock.calls.map(
      ([call]) => JSON.parse(call.messages[0].value) as Record<string, unknown>,
    );
    expect(events).toEqual([
      expect.objectContaining({
        type: 'like',
        candidate_id: 7,
        position: null,
      }),
      expect.objectContaining({
        type: 'pass',
        candidate_id: 8,
        position: null,
      }),
    ]);
    expect(events[0].event_id).not.toEqual(events[1].event_id);
    await service.onApplicationShutdown();
    expect(mockDisconnect).toHaveBeenCalledTimes(1);
  });
  it('releases pending capacity after failed sends so later events can be published', async () => {
    mockSend.mockRejectedValue(new Error('offline'));
    const service = new SwipeEventsService(prisma);
    for (let i = 0; i < 20; i++) service.decision('like', 7, 12);
    await flush();
    mockSend.mockResolvedValue(undefined);
    service.decision('pass', 7, 12);
    await flush();
    expect(mockSend).toHaveBeenCalledTimes(21);
    expect(warn).not.toHaveBeenCalledWith('swipe_events_dropped: queue_full');
    await service.onApplicationShutdown();
  });
});
