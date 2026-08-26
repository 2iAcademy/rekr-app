import { describe, expect, it } from 'vitest';
import { isCandidate, isRecruiter, USER_TYPES, userTypeLabel } from './userType';

describe('libellé de type d’utilisateur', () => {
  it('traduit un recruteur', () => {
    expect(userTypeLabel('recruiter')).toBe('Recruteur');
  });

  it('traduit un candidat', () => {
    expect(userTypeLabel('candidate')).toBe('Candidat');
  });

  it('donne un libellé non vide à chaque type déclaré', () => {
    for (const userType of USER_TYPES) {
      expect(userTypeLabel(userType).trim()).not.toBe('');
    }
  });

  // `AuthenticatedUser.userType` is an unconstrained string, so a value the
  // front does not know can reach here. It gets the candidate label — the least
  // privileged of the two — rather than advertising a role the session may not
  // hold. These cases lock that choice down instead of leaving it implicit.
  it.each(['', 'admin', 'Recruiter', 'RECRUITER', ' recruiter'])(
    'retombe sur le libellé candidat pour un type inconnu (%j)',
    (unknownType) => {
      expect(userTypeLabel(unknownType)).toBe('Candidat');
    },
  );
});

// The predicates are what the route guards call, so anything they accept by
// mistake widens an authorisation check. They are deliberately exact: no
// trimming, no case folding, and `undefined` is not a recruiter.
describe('prédicats de type d’utilisateur', () => {
  it('reconnaît un recruteur et un candidat', () => {
    expect(isRecruiter('recruiter')).toBe(true);
    expect(isCandidate('candidate')).toBe(true);
  });

  it('ne confond pas les deux types', () => {
    expect(isRecruiter('candidate')).toBe(false);
    expect(isCandidate('recruiter')).toBe(false);
  });

  it.each(['', 'admin', 'Recruiter', 'RECRUITER', ' recruiter', undefined])(
    'refuse le statut de recruteur à une valeur inattendue (%j)',
    (value) => {
      expect(isRecruiter(value)).toBe(false);
    },
  );

  it.each(['', 'admin', 'Candidate', 'CANDIDATE', ' candidate', undefined])(
    'refuse le statut de candidat à une valeur inattendue (%j)',
    (value) => {
      expect(isCandidate(value)).toBe(false);
    },
  );

  it('couvre chaque type déclaré par exactement un prédicat', () => {
    for (const userType of USER_TYPES) {
      expect([isRecruiter(userType), isCandidate(userType)].filter(Boolean)).toHaveLength(1);
    }
  });
});
