import './instrument';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SentryLogger } from './common/logging/sentry-logger';
import { configureApp } from './setup-app';
import { mountSwaggerIfExposed } from './swagger';

async function bootstrap() {
  // Buffered until the Sentry logger is in place, so the first lines reach it.
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(new SentryLogger());
  configureApp(app);
  mountSwaggerIfExposed(app);

  app.enableShutdownHooks();
  await app.listen(process.env.PORT ?? 3000, process.env.HOST ?? '0.0.0.0');

  if (process.env.NODE_ENV === 'development') {
    console.info(
      JSON.stringify({
        level: 'info',
        event: 'observability_demo',
        service: 'backend',
        message: 'Backend started: log collection example',
      }),
    );
  }
}
void bootstrap();
