import { UserType } from '../../generated/prisma/client';

export interface AuthUser {
  id: number;
  userType: UserType;
}
