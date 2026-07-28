import { Transform } from 'class-transformer';
import { IsUrl } from 'class-validator';

// Mirrors the `@db.VarChar(255)` URL columns: anything longer could never be
// stored.
export const MAX_URL_LENGTH = 255;

/**
 * Protocol whitelist for every user-supplied URL.
 *
 * These values are written by one user and rendered by another inside an
 * `<a href>`. Validated as a plain string, `javascript:alert(document.cookie)`
 * and `data:text/html;base64,...` are both accepted and both become stored XSS
 * the day a client stops sanitising on render — and a client that renders a
 * profile link has no reason to suspect the API let one through.
 *
 * `require_protocol` is what closes the two ways around a scheme whitelist:
 * a bare `evil.example/x` and a protocol-relative `//evil.example/x`, which a
 * browser resolves against the page it is rendered in.
 *
 * The type is read off `IsUrl` itself: the option shape comes from `validator`,
 * which is a transitive dependency here, not one this project declares.
 */
export const HTTP_URL_OPTIONS: Parameters<typeof IsUrl>[0] = {
  protocols: ['http', 'https'],
  require_protocol: true,
  require_valid_protocol: true,
  allow_protocol_relative_urls: false,
  // Everything before an `@` is userinfo, not a host. Without this,
  // `https://www.linkedin.com@evil.example/in/foo` passes the whitelist above:
  // it really is https, and its host really is `evil.example`. Rendered as a
  // link, it reads as LinkedIn to whoever decides whether to click — the same
  // threat the protocol whitelist exists for, one syntax further on. No
  // legitimate profile or company URL carries credentials.
  disallow_auth: true,
};

/**
 * Normalises a cleared URL field to `null` before validation runs.
 *
 * The columns are nullable and the inputs that write them are text boxes:
 * emptying one sends `''`, never `null`. Validated as a URL, `''` is a 400 the
 * user cannot act on — the field is optional, yet it becomes impossible to
 * empty once set. `@IsOptional()` does not help, because it only skips `null`
 * and `undefined`.
 *
 * Mapping to `null` rather than letting `''` through is deliberate: an empty
 * string in a URL column is neither absent nor usable, and every reader would
 * then have to handle both spellings of "no URL".
 */
export const EmptyUrlToNull = (): PropertyDecorator =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' && value.trim() === '' ? null : value,
  );
