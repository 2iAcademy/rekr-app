import './instrument';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApp } from './setup-app';
import { mountSwaggerIfExposed } from './swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
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
