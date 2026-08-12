import { Injectable, NotFoundException } from '@nestjs/common';
import { CandidateProfile } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { FileSlotService } from '../storage/file-slot.service';
import { UploadedFile } from '../storage/uploaded-file.interface';

export type CandidateFileKind = 'picture' | 'cv';

interface CandidateFileRead {
  content: Buffer;
  contentType: string;
}

/**
 * The column each kind writes to. `cv` lands in `cv_url`, a name inherited from
 * the schema: it now holds a storage key, and no URL has ever been written there.
 */
const COLUMNS: Record<CandidateFileKind, 'picture' | 'cvUrl'> = {
  picture: 'picture',
  cv: 'cvUrl',
};

@Injectable()
export class CandidateProfileFileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly slots: FileSlotService,
  ) {}

  async replace(
    userId: number,
    kind: CandidateFileKind,
    file: UploadedFile | undefined,
  ): Promise<CandidateProfile> {
    // Resolved before anything is written: a candidate with no profile row must
    // not leave an unreferenced file behind on the way to its 404.
    const profile = await this.requireProfile(userId);
    const column = COLUMNS[kind];

    return this.slots.replace({
      kind,
      ownerId: userId,
      file,
      previousKey: profile[column],
      persist: (key) =>
        this.prisma.candidateProfile.update({
          where: { userId },
          data: { [column]: key },
        }),
    });
  }

  async remove(
    userId: number,
    kind: CandidateFileKind,
  ): Promise<CandidateProfile> {
    const profile = await this.requireProfile(userId);
    const column = COLUMNS[kind];

    return this.slots.remove({
      previousKey: profile[column],
      persist: () =>
        this.prisma.candidateProfile.update({
          where: { userId },
          data: { [column]: null },
        }),
    });
  }

  async readCv(userId: number): Promise<CandidateFileRead> {
    const profile = await this.requireProfile(userId);

    return {
      content: await this.slots.read(profile.cvUrl),
      contentType: 'application/pdf',
    };
  }

  private async requireProfile(userId: number): Promise<CandidateProfile> {
    const profile = await this.prisma.candidateProfile.findUnique({
      where: { userId },
    });
    if (!profile) {
      throw new NotFoundException('Candidate profile not found');
    }

    return profile;
  }
}
