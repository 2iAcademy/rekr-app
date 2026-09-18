import { PrismaService } from '../src/prisma/prisma.service';

/**
 * Resolves a reference `job_family` row by label.
 *
 * The twenty rows are seeded by the migration rather than by a fixture, and
 * `resetDb` leaves them alone, so they are there for every test. Their
 * identifiers come from a sequence though, so a suite reads them instead of
 * hard-coding a number that a later migration would quietly shift.
 *
 * Creating an offer or a profile requires a trade, so most suites just need
 * *a* valid one and take the default; those that check the filter itself name
 * a second label to get a family that does not match.
 */
export const DEFAULT_JOB_FAMILY = 'Informatique';

export const OTHER_JOB_FAMILY = 'Restauration';

export const jobFamilyIdFor = async (
  prisma: PrismaService,
  label: string = DEFAULT_JOB_FAMILY,
): Promise<number> => {
  const family = await prisma.jobFamily.findUniqueOrThrow({ where: { label } });

  return family.id;
};
