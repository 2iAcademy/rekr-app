import { Controller, Get, INestApplication, UseGuards } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { AuthModule } from '../src/auth/auth.module';
import { JwtAuthGuard } from '../src/auth/jwt-auth.guard';
import { AnyAuthenticatedUser, Roles } from '../src/auth/roles.decorator';
import { RolesGuard } from '../src/auth/roles.guard';
import { PrismaModule } from '../src/prisma/prisma.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { configureApp } from '../src/setup-app';
import { bearerFor } from './auth-header';
import { httpRequest } from './http-client';
import { resetDb } from './reset-db';

/**
 * What a route inherits when nobody decorated it.
 *
 * The production controllers all carry their `@Roles`, so no live URL can show
 * the difference — which is exactly the problem: the omission is invisible
 * until someone commits it. These fixture controllers are the omission,
 * mounted on a real HTTP stack behind the real guards, so the day the default
 * swings back to "open" this file turns red instead of a future endpoint
 * quietly serving everyone.
 */
@Controller('fixture-roles')
@UseGuards(JwtAuthGuard, RolesGuard)
class UndecoratedFixtureController {
  @Get('forgotten')
  forgotten() {
    return { reached: true };
  }

  @Get('recruiter-only')
  @Roles('recruiter')
  recruiterOnly() {
    return { reached: true };
  }

  @Get('deliberately-open')
  @AnyAuthenticatedUser()
  deliberatelyOpen() {
    return { reached: true };
  }
}

@Controller('fixture-roles-class')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('recruiter')
class ClassScopedFixtureController {
  @Get('inherited')
  inherited() {
    return { reached: true };
  }

  @Get('narrowed')
  @Roles('candidate')
  narrowed() {
    return { reached: true };
  }
}

jest.setTimeout(120_000);

describe('RolesGuard default (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let candidateToken: string;
  let recruiterToken: string;

  const get = (path: string, token?: string) => {
    const call = httpRequest(app).get(path);
    return token ? call.set('Authorization', token) : call;
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        PrismaModule,
        AuthModule,
      ],
      controllers: [UndecoratedFixtureController, ClassScopedFixtureController],
    }).compile();

    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.listen(0, '127.0.0.1');

    prisma = app.get(PrismaService);
    await resetDb(prisma);

    const candidate = await prisma.user.create({
      data: {
        email: `roles-candidate-${Date.now()}@test.dev`,
        passwordHash: 'x',
        userType: 'candidate',
      },
    });
    const recruiter = await prisma.user.create({
      data: {
        email: `roles-recruiter-${Date.now()}@test.dev`,
        passwordHash: 'x',
        userType: 'recruiter',
      },
    });

    candidateToken = bearerFor(app, candidate.id, 'candidate');
    recruiterToken = bearerFor(app, recruiter.id, 'recruiter');
  });

  afterAll(async () => {
    await resetDb(prisma);
    await app.close();
  });

  it('refuses a handler nobody decorated, to an authenticated candidate (403)', async () => {
    await get('/api/fixture-roles/forgotten', candidateToken).expect(403);
  });

  it('refuses the same handler to an authenticated recruiter (403)', async () => {
    await get('/api/fixture-roles/forgotten', recruiterToken).expect(403);
  });

  it('still answers 401, not 403, when no token is presented', async () => {
    await get('/api/fixture-roles/forgotten').expect(401);
  });

  it('serves a handler whose role matches (200)', async () => {
    await get('/api/fixture-roles/recruiter-only', recruiterToken).expect(200);
  });

  it('refuses a handler whose role does not match (403)', async () => {
    await get('/api/fixture-roles/recruiter-only', candidateToken).expect(403);
  });

  it('serves a handler marked open to any authenticated user (200)', async () => {
    await get('/api/fixture-roles/deliberately-open', candidateToken).expect(
      200,
    );
    await get('/api/fixture-roles/deliberately-open', recruiterToken).expect(
      200,
    );
  });

  it('applies the class role to a handler that declares none (200/403)', async () => {
    await get('/api/fixture-roles-class/inherited', recruiterToken).expect(200);
    await get('/api/fixture-roles-class/inherited', candidateToken).expect(403);
  });

  it('lets a method role override the class role (200/403)', async () => {
    await get('/api/fixture-roles-class/narrowed', candidateToken).expect(200);
    await get('/api/fixture-roles-class/narrowed', recruiterToken).expect(403);
  });
});
