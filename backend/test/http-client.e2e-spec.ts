import { Controller, Get, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { AddressInfo, Server } from 'node:net';
import { httpRequest } from './http-client';

@Controller('probe')
class ProbeController {
  @Get()
  probe() {
    return { reached: true };
  }
}

/**
 * The flake behind gh#191, pinned where it lives.
 *
 * Handed a server that is not listening, supertest calls `listen(0)` — on every
 * interface, `::` — then dials `127.0.0.1` on that port. macOS accepts that
 * bind even while another process holds `127.0.0.1` on the same port, and
 * routes the loopback traffic to the other process: the test reads a stranger's
 * 404 or an ECONNRESET. Supertest re-listens on a fresh port for every request,
 * a few thousand of them per run, so the suite eventually drew one.
 */
describe('httpRequest (e2e)', () => {
  let app: INestApplication;

  const createApp = async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ProbeController],
    }).compile();
    return moduleRef.createNestApplication();
  };

  beforeAll(async () => {
    app = await createApp();
    await app.listen(0, '127.0.0.1');
  });

  afterAll(async () => {
    await app.close();
  });

  it('refuses an app left to supertest to bind', async () => {
    const unbound = await createApp();
    await unbound.init();
    try {
      expect(() => httpRequest(unbound)).toThrow(/127\.0\.0\.1/);
    } finally {
      await unbound.close();
    }
  });

  it('listens on the loopback address supertest dials, not on every interface', async () => {
    await httpRequest(app).get('/probe').expect(200, { reached: true });

    const server = app.getHttpServer() as Server;
    expect(server.listening).toBe(true);
    expect((server.address() as AddressInfo).address).toBe('127.0.0.1');
  });

  it('keeps the same port from one request to the next', async () => {
    const server = app.getHttpServer() as Server;

    await httpRequest(app).get('/probe').expect(200);
    const first = (server.address() as AddressInfo).port;
    await httpRequest(app).get('/probe').expect(200);

    expect((server.address() as AddressInfo).port).toBe(first);
  });
});
