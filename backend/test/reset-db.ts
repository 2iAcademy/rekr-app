import { PrismaService } from '../src/prisma/prisma.service';

export async function resetDb(prisma: PrismaService): Promise<void> {
  await prisma.candidateLikesOffer.deleteMany();
  await prisma.recruiterLikesCandidate.deleteMany();
  await prisma.candidateTag.deleteMany();
  await prisma.companyTag.deleteMany();
  await prisma.offerTag.deleteMany();
  await prisma.offer.deleteMany();
  await prisma.candidateProfile.deleteMany();
  await prisma.recruiterProfile.deleteMany();
  await prisma.company.deleteMany();
  await prisma.tag.deleteMany();
  await prisma.sector.deleteMany();
  await prisma.user.deleteMany();
}
