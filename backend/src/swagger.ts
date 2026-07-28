import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export const SWAGGER_PATH = 'api/docs';

/**
 * Swagger is mounted outside the Nest pipeline — `SwaggerModule.setup`
 * registers its handlers straight on the Express instance, so no `APP_GUARD`
 * applies: `/api/docs` and `/api/docs-json` are neither authenticated nor
 * rate-limited. Publishing a full map of every route and DTO under those terms
 * is a gift to anyone probing the API, so it stays out of production.
 */
export function shouldExposeSwagger(): boolean {
  return process.env.NODE_ENV !== 'production';
}

/**
 * Mounts Swagger UI and returns whether it was exposed.
 *
 * Extracted from `bootstrap()` so the interaction between this page and the
 * hardening middleware of `configureApp` — Swagger UI boots from an inline
 * script that the API's `default-src 'none'` policy would kill — is covered by
 * a test instead of being asserted by hand.
 */
export function mountSwaggerIfExposed(app: INestApplication): boolean {
  if (!shouldExposeSwagger()) {
    return false;
  }

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Rekr API')
    .setDescription('API documentation for the Rekr backend')
    .setVersion('1.0.0')
    .addBearerAuth()
    .build();

  SwaggerModule.setup(
    SWAGGER_PATH,
    app,
    SwaggerModule.createDocument(app, swaggerConfig),
  );

  return true;
}
