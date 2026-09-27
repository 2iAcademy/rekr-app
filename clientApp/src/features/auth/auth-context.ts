import { createContext } from 'react';

export type AuthStatus = 'loading' | 'authenticated' | 'anonymous';

export interface AuthenticatedUser {
  id: number;
  email: string;
  role: string;
  userType: string;
  isActive: boolean;
  /** Whether the profile matching `userType` has been created. The session
   * carries it so the onboarding gate costs no request of its own. */
  hasProfile: boolean;
}

export interface AuthContextValue {
  status: AuthStatus;
  user: AuthenticatedUser | null;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, userType: string) => Promise<void>;
  logout: () => Promise<void>;
  /** Forgets the session once the server has erased the account. No request:
   * the tokens died with the account, and the cookie was cleared in the same
   * response. */
  accountDeleted: () => void;
  /** Records that the wizard just created the profile the session was missing.
   * Without it the flag stays stale until the next reload, and the onboarding
   * gate sends the user back to the wizard they have just completed. */
  markProfileCompleted: () => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
