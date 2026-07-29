import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserType } from '../generated/prisma/client';

export const bearerFor = (
  app: INestApplication,
  userId: number,
  userType: UserType,
): string => {
  const token = app
    .get(JwtService)
    .sign({ userType }, { subject: String(userId) });

  return `Bearer ${token}`;
};
