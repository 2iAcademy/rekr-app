import { validate } from 'class-validator';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { ImpressionController, ImpressionDto } from './impression.controller';
import { SwipeEventsService } from './swipe-events.service';
import type { AuthUser } from '../auth/auth-user.interface';

describe('ImpressionController', () => {
  it('takes the candidate identity from authentication, not the payload', () => {
    const impression = jest.fn();
    const controller = new ImpressionController({
      impression,
    } as unknown as SwipeEventsService);
    controller.record({ id: 7 } as AuthUser, 12, { position: 3 });
    expect(impression).toHaveBeenCalledWith(7, 12, 3);
    expect(
      Reflect.getMetadata(GUARDS_METADATA, ImpressionController),
    ).toHaveLength(2);
  });
  it.each([0, 101, 1.5, '2', undefined])(
    'rejects invalid position %s',
    async (position) => {
      const dto = Object.assign(new ImpressionDto(), { position });
      expect((await validate(dto)).length).toBeGreaterThan(0);
    },
  );
  it('accepts a position in the feed bounds', async () => {
    expect(
      await validate(Object.assign(new ImpressionDto(), { position: 2 })),
    ).toHaveLength(0);
  });
});
