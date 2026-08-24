import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { AppModule } from './../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { configureApp } from '../src/setup-app';
import { bearerFor } from './auth-header';
import {
  gifBuffer,
  jpegBuffer,
  pdfBuffer,
  pngBuffer,
  webpBuffer,
} from './file-fixtures';
import { httpRequest } from './http-client';
import { resetDb } from './reset-db';
import { resetThrottler } from './throttler-reset';

const UPLOADS_ROOT = process.env.UPLOADS_DIR as string;

const storedFiles = async (...segments: string[]): Promise<string[]> => {
  try {
    return await readdir(join(UPLOADS_ROOT, ...segments));
  } catch {
    return [];
  }
};

describe('Profile files (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const createUser = (userType: 'candidate' | 'recruiter') =>
    prisma.user.create({
      data: {
        email: `${userType}-${Date.now()}-${Math.random()}@test.dev`,
        passwordHash: 'x',
        userType,
      },
    });

  const createCandidate = async () => {
    const user = await createUser('candidate');
    await prisma.candidateProfile.create({
      data: { userId: user.id, firstName: 'Ada', lastName: 'Lovelace' },
    });
    return user;
  };

  const createRecruiter = async (companyName = 'Acme') => {
    const user = await createUser('recruiter');
    const company = await prisma.company.create({
      data: { name: companyName },
    });
    await prisma.recruiterProfile.create({
      data: {
        userId: user.id,
        companyId: company.id,
        firstName: 'Rick',
        lastName: 'Deckard',
      },
    });
    return { user, company };
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();

    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    await resetDb(prisma);
    await rm(UPLOADS_ROOT, { recursive: true, force: true });
    resetThrottler(app);
  });

  afterAll(async () => {
    await rm(UPLOADS_ROOT, { recursive: true, force: true });
    await app.close();
  });

  describe('PUT /api/candidate-profiles/me/picture', () => {
    it('rejects an anonymous upload with 401', async () => {
      await httpRequest(app)
        .put('/api/candidate-profiles/me/picture')
        .attach('file', pngBuffer(), 'photo.png')
        .expect(401);
    });

    it('forbids a recruiter from uploading a candidate picture (403)', async () => {
      const { user } = await createRecruiter();

      await httpRequest(app)
        .put('/api/candidate-profiles/me/picture')
        .set('Authorization', bearerFor(app, user.id, 'recruiter'))
        .attach('file', pngBuffer(), 'photo.png')
        .expect(403);
    });

    it('answers 404 for a candidate who has no profile yet', async () => {
      const user = await createUser('candidate');

      await httpRequest(app)
        .put('/api/candidate-profiles/me/picture')
        .set('Authorization', bearerFor(app, user.id, 'candidate'))
        .attach('file', pngBuffer(), 'photo.png')
        .expect(404);

      expect(await storedFiles('candidates')).toEqual([]);
    });

    it.each([
      ['png', pngBuffer()],
      ['jpg', jpegBuffer()],
      ['webp', webpBuffer()],
    ])(
      'stores a %s and writes its key on the profile',
      async (extension, content) => {
        const user = await createCandidate();

        const response = await httpRequest(app)
          .put('/api/candidate-profiles/me/picture')
          .set('Authorization', bearerFor(app, user.id, 'candidate'))
          .attach('file', content, `photo.${extension}`)
          .expect(200);

        const profile = await prisma.candidateProfile.findUniqueOrThrow({
          where: { userId: user.id },
        });
        expect(profile.picture).toMatch(
          new RegExp(
            `^candidates/${user.id}/picture/[0-9a-f-]{36}\\.${extension}$`,
          ),
        );
        expect(response.body).toMatchObject({ picture: profile.picture });
        expect(
          await storedFiles('candidates', String(user.id), 'picture'),
        ).toHaveLength(1);
      },
    );

    it('names the file from its bytes, ignoring the sent name and type', async () => {
      const user = await createCandidate();

      await httpRequest(app)
        .put('/api/candidate-profiles/me/picture')
        .set('Authorization', bearerFor(app, user.id, 'candidate'))
        .attach('file', pngBuffer(), {
          filename: '../../evil.php',
          contentType: 'application/x-php',
        })
        .expect(200);

      const profile = await prisma.candidateProfile.findUniqueOrThrow({
        where: { userId: user.id },
      });
      expect(profile.picture).toMatch(/\.png$/);
      expect(profile.picture).not.toContain('evil');
    });

    it.each([
      ['a PDF', pdfBuffer(), 'cv.pdf'],
      ['a GIF', gifBuffer(), 'anim.gif'],
      [
        'an SVG',
        Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script/></svg>'),
        'x.svg',
      ],
      [
        'a PHP payload renamed as PNG',
        Buffer.from('<?php system($_GET["c"]); ?>'),
        'photo.png',
      ],
    ])('refuses %s with 400', async (_case, content, filename) => {
      const user = await createCandidate();

      await httpRequest(app)
        .put('/api/candidate-profiles/me/picture')
        .set('Authorization', bearerFor(app, user.id, 'candidate'))
        .attach('file', content, filename)
        .expect(400);

      expect(await storedFiles('candidates')).toEqual([]);
    });

    it('refuses a request carrying no file with 400', async () => {
      const user = await createCandidate();

      await httpRequest(app)
        .put('/api/candidate-profiles/me/picture')
        .set('Authorization', bearerFor(app, user.id, 'candidate'))
        .expect(400);
    });

    // `fields: 0` is what keeps an unbounded run of text parts from being
    // buffered into the process, and it is invisible until a field is sent.
    it('refuses a stray text field with 400', async () => {
      const user = await createCandidate();

      await httpRequest(app)
        .put('/api/candidate-profiles/me/picture')
        .set('Authorization', bearerFor(app, user.id, 'candidate'))
        .field('userId', '999999')
        .attach('file', pngBuffer(), 'photo.png')
        .expect(400);

      expect(await storedFiles('candidates')).toEqual([]);
    });

    it('refuses an inactive account with 403', async () => {
      const user = await createCandidate();
      await prisma.user.update({
        where: { id: user.id },
        data: { isActive: false },
      });

      await httpRequest(app)
        .put('/api/candidate-profiles/me/picture')
        .set('Authorization', bearerFor(app, user.id, 'candidate'))
        .attach('file', pngBuffer(), 'photo.png')
        .expect(403);
    });

    it('refuses an image past the 2 MB limit of its kind with 400', async () => {
      const user = await createCandidate();

      await httpRequest(app)
        .put('/api/candidate-profiles/me/picture')
        .set('Authorization', bearerFor(app, user.id, 'candidate'))
        .attach('file', pngBuffer(2 * 1024 * 1024 + 1), 'photo.png')
        .expect(400);

      expect(await storedFiles('candidates')).toEqual([]);
    });

    it('refuses a body past the multer hard limit with 413', async () => {
      const user = await createCandidate();

      const response = await httpRequest(app)
        .put('/api/candidate-profiles/me/picture')
        .set('Authorization', bearerFor(app, user.id, 'candidate'))
        .attach('file', pngBuffer(11 * 1024 * 1024), 'photo.png')
        .expect(413);

      expect(response.body).toMatchObject({ message: 'File too large' });
    });

    it('deletes the previous file when a new one is uploaded', async () => {
      const user = await createCandidate();
      const put = () =>
        httpRequest(app)
          .put('/api/candidate-profiles/me/picture')
          .set('Authorization', bearerFor(app, user.id, 'candidate'));

      await put().attach('file', pngBuffer(), 'photo.png').expect(200);
      const first = (
        await prisma.candidateProfile.findUniqueOrThrow({
          where: { userId: user.id },
        })
      ).picture;

      await put().attach('file', jpegBuffer(), 'photo.jpg').expect(200);
      const second = (
        await prisma.candidateProfile.findUniqueOrThrow({
          where: { userId: user.id },
        })
      ).picture;

      expect(second).not.toBe(first);
      expect(
        await storedFiles('candidates', String(user.id), 'picture'),
      ).toHaveLength(1);
    });
  });

  describe('DELETE /api/candidate-profiles/me/picture', () => {
    it('clears the column and removes the file', async () => {
      const user = await createCandidate();
      await httpRequest(app)
        .put('/api/candidate-profiles/me/picture')
        .set('Authorization', bearerFor(app, user.id, 'candidate'))
        .attach('file', pngBuffer(), 'photo.png')
        .expect(200);

      await httpRequest(app)
        .delete('/api/candidate-profiles/me/picture')
        .set('Authorization', bearerFor(app, user.id, 'candidate'))
        .expect(200);

      const profile = await prisma.candidateProfile.findUniqueOrThrow({
        where: { userId: user.id },
      });
      expect(profile.picture).toBeNull();
      expect(
        await storedFiles('candidates', String(user.id), 'picture'),
      ).toEqual([]);
    });

    it('accepts deleting a picture that was never uploaded', async () => {
      const user = await createCandidate();

      await httpRequest(app)
        .delete('/api/candidate-profiles/me/picture')
        .set('Authorization', bearerFor(app, user.id, 'candidate'))
        .expect(200);
    });

    it('rejects an anonymous delete with 401', async () => {
      await httpRequest(app)
        .delete('/api/candidate-profiles/me/picture')
        .expect(401);
    });
  });

  describe('CV', () => {
    const putCv = (app: INestApplication, userId: number) =>
      httpRequest(app)
        .put('/api/candidate-profiles/me/cv')
        .set('Authorization', bearerFor(app, userId, 'candidate'));

    it('stores a PDF and writes its key in cvUrl', async () => {
      const user = await createCandidate();

      await putCv(app, user.id)
        .attach('file', pdfBuffer(), 'cv.pdf')
        .expect(200);

      const profile = await prisma.candidateProfile.findUniqueOrThrow({
        where: { userId: user.id },
      });
      expect(profile.cvUrl).toMatch(
        new RegExp(`^candidates/${user.id}/cv/[0-9a-f-]{36}\\.pdf$`),
      );
      expect(profile.picture).toBeNull();
    });

    it('refuses an image as a CV with 400', async () => {
      const user = await createCandidate();

      await putCv(app, user.id)
        .attach('file', pngBuffer(), 'cv.png')
        .expect(400);
    });

    it('accepts a CV up to 5 MB, past the picture limit', async () => {
      const user = await createCandidate();

      await putCv(app, user.id)
        .attach('file', pdfBuffer(3 * 1024 * 1024), 'cv.pdf')
        .expect(200);
    });

    it('serves the CV to its owner as an attachment', async () => {
      const user = await createCandidate();
      const content = pdfBuffer();
      await putCv(app, user.id).attach('file', content, 'cv.pdf').expect(200);

      const response = await httpRequest(app)
        .get('/api/candidate-profiles/me/cv')
        .set('Authorization', bearerFor(app, user.id, 'candidate'))
        .expect(200);

      expect(response.headers['content-type']).toContain('application/pdf');
      expect(response.headers['content-disposition']).toContain('attachment');
      expect(response.body).toEqual(content);
    });

    it('answers 404 when no CV was uploaded', async () => {
      const user = await createCandidate();

      await httpRequest(app)
        .get('/api/candidate-profiles/me/cv')
        .set('Authorization', bearerFor(app, user.id, 'candidate'))
        .expect(404);
    });

    it('rejects an anonymous read with 401', async () => {
      await httpRequest(app).get('/api/candidate-profiles/me/cv').expect(401);
    });

    it('forbids a recruiter from reading a CV (403)', async () => {
      const { user } = await createRecruiter();

      await httpRequest(app)
        .get('/api/candidate-profiles/me/cv')
        .set('Authorization', bearerFor(app, user.id, 'recruiter'))
        .expect(403);
    });

    // What stops a candidate from pointing their own row at someone else's CV
    // is that `cvUrl` belongs to no DTO, so `forbidNonWhitelisted` rejects it.
    // That guarantee is a property of an absence, and an absence is exactly what
    // a later commit adds a field to without noticing.
    it('refuses to let a candidate write the key of another one’s CV', async () => {
      const owner = await createCandidate();
      await putCv(app, owner.id)
        .attach('file', pdfBuffer(), 'cv.pdf')
        .expect(200);
      const ownerKey = (
        await prisma.candidateProfile.findUniqueOrThrow({
          where: { userId: owner.id },
        })
      ).cvUrl as string;

      const other = await createCandidate();

      await httpRequest(app)
        .patch('/api/candidate-profiles/me')
        .set('Authorization', bearerFor(app, other.id, 'candidate'))
        .send({ cvUrl: ownerKey })
        .expect(400);

      await httpRequest(app)
        .get('/api/candidate-profiles/me/cv')
        .set('Authorization', bearerFor(app, other.id, 'candidate'))
        .expect(404);
    });

    it('never serves another candidate the first one’s CV', async () => {
      const owner = await createCandidate();
      const other = await createCandidate();
      await putCv(app, owner.id)
        .attach('file', pdfBuffer(), 'cv.pdf')
        .expect(200);

      await httpRequest(app)
        .get('/api/candidate-profiles/me/cv')
        .set('Authorization', bearerFor(app, other.id, 'candidate'))
        .expect(404);
    });

    it('clears the CV on delete', async () => {
      const user = await createCandidate();
      await putCv(app, user.id)
        .attach('file', pdfBuffer(), 'cv.pdf')
        .expect(200);

      await httpRequest(app)
        .delete('/api/candidate-profiles/me/cv')
        .set('Authorization', bearerFor(app, user.id, 'candidate'))
        .expect(200);

      const profile = await prisma.candidateProfile.findUniqueOrThrow({
        where: { userId: user.id },
      });
      expect(profile.cvUrl).toBeNull();
      expect(await storedFiles('candidates', String(user.id), 'cv')).toEqual(
        [],
      );
    });
  });

  describe('Company files', () => {
    const putLogo = (userId: number) =>
      httpRequest(app)
        .put('/api/companies/mine/logo')
        .set('Authorization', bearerFor(app, userId, 'recruiter'));

    it('stores the logo under the company, not the recruiter account', async () => {
      const { user, company } = await createRecruiter();

      await putLogo(user.id)
        .attach('file', pngBuffer(), 'logo.png')
        .expect(200);

      const stored = await prisma.company.findUniqueOrThrow({
        where: { id: company.id },
      });
      expect(stored.logo).toMatch(
        new RegExp(`^companies/${company.id}/logo/[0-9a-f-]{36}\\.png$`),
      );
    });

    it('stores the cover image in its own column', async () => {
      const { user, company } = await createRecruiter();

      await httpRequest(app)
        .put('/api/companies/mine/cover-image')
        .set('Authorization', bearerFor(app, user.id, 'recruiter'))
        .attach('file', webpBuffer(), 'cover.webp')
        .expect(200);

      const stored = await prisma.company.findUniqueOrThrow({
        where: { id: company.id },
      });
      expect(stored.coverImage).toMatch(
        new RegExp(
          `^companies/${company.id}/cover-image/[0-9a-f-]{36}\\.webp$`,
        ),
      );
      expect(stored.logo).toBeNull();
    });

    it('forbids a candidate from uploading a logo (403)', async () => {
      const user = await createCandidate();

      await httpRequest(app)
        .put('/api/companies/mine/logo')
        .set('Authorization', bearerFor(app, user.id, 'candidate'))
        .attach('file', pngBuffer(), 'logo.png')
        .expect(403);
    });

    it('answers 404 for a recruiter without a company', async () => {
      const user = await createUser('recruiter');

      await putLogo(user.id)
        .attach('file', pngBuffer(), 'logo.png')
        .expect(404);
    });

    it('refuses an inactive recruiter with 403', async () => {
      const { user } = await createRecruiter();
      await prisma.user.update({
        where: { id: user.id },
        data: { isActive: false },
      });

      await putLogo(user.id)
        .attach('file', pngBuffer(), 'logo.png')
        .expect(403);
    });

    it('leaves another company untouched', async () => {
      const alice = await createRecruiter('Alice Corp');
      const bob = await createRecruiter('Bob Corp');

      await putLogo(alice.user.id)
        .attach('file', pngBuffer(), 'logo.png')
        .expect(200);

      const bobCompany = await prisma.company.findUniqueOrThrow({
        where: { id: bob.company.id },
      });
      expect(bobCompany.logo).toBeNull();
    });

    it('clears the logo on delete', async () => {
      const { user, company } = await createRecruiter();
      await putLogo(user.id)
        .attach('file', pngBuffer(), 'logo.png')
        .expect(200);

      await httpRequest(app)
        .delete('/api/companies/mine/logo')
        .set('Authorization', bearerFor(app, user.id, 'recruiter'))
        .expect(200);

      const stored = await prisma.company.findUniqueOrThrow({
        where: { id: company.id },
      });
      expect(stored.logo).toBeNull();
      expect(
        await storedFiles('companies', String(company.id), 'logo'),
      ).toEqual([]);
    });
  });

  describe('GET /api/files', () => {
    const uploadPicture = async () => {
      const user = await createCandidate();
      await httpRequest(app)
        .put('/api/candidate-profiles/me/picture')
        .set('Authorization', bearerFor(app, user.id, 'candidate'))
        .attach('file', pngBuffer(), 'photo.png')
        .expect(200);

      const profile = await prisma.candidateProfile.findUniqueOrThrow({
        where: { userId: user.id },
      });
      return { user, key: profile.picture as string };
    };

    it('serves a profile picture without authentication', async () => {
      const { key } = await uploadPicture();

      const response = await httpRequest(app)
        .get(`/api/files/${key}`)
        .expect(200);

      expect(response.headers['content-type']).toContain('image/png');
      expect(response.body).toEqual(pngBuffer());
    });

    // A browser that re-fetches every avatar on every page would spend the
    // `files` budget on bytes it already holds.
    it('lets a browser cache an image whose key is immutable', async () => {
      const { key } = await uploadPicture();

      const response = await httpRequest(app)
        .get(`/api/files/${key}`)
        .expect(200);

      expect(response.headers['cache-control']).toContain('immutable');
    });

    it('serves a company logo without authentication', async () => {
      const { user, company } = await createRecruiter();
      await httpRequest(app)
        .put('/api/companies/mine/logo')
        .set('Authorization', bearerFor(app, user.id, 'recruiter'))
        .attach('file', webpBuffer(), 'logo.webp')
        .expect(200);
      const stored = await prisma.company.findUniqueOrThrow({
        where: { id: company.id },
      });

      const response = await httpRequest(app)
        .get(`/api/files/${stored.logo as string}`)
        .expect(200);

      expect(response.headers['content-type']).toContain('image/webp');
    });

    it('never serves a CV, even to the candidate who owns it', async () => {
      const user = await createCandidate();
      await httpRequest(app)
        .put('/api/candidate-profiles/me/cv')
        .set('Authorization', bearerFor(app, user.id, 'candidate'))
        .attach('file', pdfBuffer(), 'cv.pdf')
        .expect(200);
      const profile = await prisma.candidateProfile.findUniqueOrThrow({
        where: { userId: user.id },
      });

      await httpRequest(app)
        .get(`/api/files/${profile.cvUrl as string}`)
        .set('Authorization', bearerFor(app, user.id, 'candidate'))
        .expect(404);
    });

    it('answers 404 for a well-formed key nothing was ever stored under', async () => {
      await httpRequest(app)
        .get(
          '/api/files/candidates/1/picture/11111111-1111-1111-1111-111111111111.png',
        )
        .expect(404);
    });

    it('answers 404 after the file has been deleted', async () => {
      const { user, key } = await uploadPicture();
      await httpRequest(app)
        .delete('/api/candidate-profiles/me/picture')
        .set('Authorization', bearerFor(app, user.id, 'candidate'))
        .expect(200);

      await httpRequest(app).get(`/api/files/${key}`).expect(404);
    });

    it.each([
      'candidates/1/picture/anything.png',
      'candidates/1/passport/11111111-1111-1111-1111-111111111111.pdf',
      'candidates/1/picture/11111111-1111-1111-1111-111111111111.png.php',
      'candidates/1/picture/%2e%2e%2f%2e%2e%2fetc%2fpasswd',
      'candidates/1/picture/..%2f..%2f..%2fetc%2fpasswd',
      'companies/1/cv/11111111-1111-1111-1111-111111111111.pdf',
    ])('refuses the crafted path %p', async (path) => {
      const response = await httpRequest(app).get(`/api/files/${path}`);

      expect(response.status).toBe(404);
      expect(response.text).not.toContain('root:');
    });
  });
});
