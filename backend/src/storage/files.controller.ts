import {
  Controller,
  Get,
  Header,
  NotFoundException,
  Param,
  StreamableFile,
} from '@nestjs/common';
import { ApiOkResponse } from '@nestjs/swagger';
import { ThrottleScope } from '../common/throttling/throttle-scope.decorator';
import { CONTENT_TYPES, FILE_KINDS } from './file-kind';
import { FileSlotService } from './file-slot.service';
import { parseStorageKey } from './storage-key';

/**
 * Public read side of the uploads, for the images a browser loads with no token:
 * avatars, logos, cover images.
 *
 * The route spells out the four segments of a storage key rather than taking a
 * wildcard. Under Express 5 a wildcard parameter yields an array of segments and
 * silently swallows extra ones, which is a poor foundation for the one place
 * where a URL becomes a file path. Four named parameters cannot match a path of
 * any other shape, and the rejoined key still has to satisfy the full grammar.
 *
 * Every rejection is a 404, never a 403: a 403 would confirm that a key exists,
 * which is the one thing an unguessable key is meant not to reveal.
 *
 * `files` rather than the `default` budget: this is the only route a browser
 * calls once per image rather than once per user action, so the two cannot share
 * a limit. See `throttling.config.ts`.
 */
@Controller('files')
@ThrottleScope('files')
export class FilesController {
  constructor(private readonly slots: FileSlotService) {}

  @Get(':scope/:ownerId/:kind/:fileName')
  @ApiOkResponse({ description: 'The stored image.' })
  // A key never changes what it points at: replacing a file mints a fresh uuid
  // and the old key stops resolving. So the bytes behind one are immutable and
  // a browser never needs to ask twice. A deleted file can linger in a cache
  // that already holds it, which costs nothing — the key was public anyway, and
  // the column no longer hands it to anyone.
  @Header('Cache-Control', 'public, max-age=31536000, immutable')
  async read(
    @Param('scope') scope: string,
    @Param('ownerId') ownerId: string,
    @Param('kind') kind: string,
    @Param('fileName') fileName: string,
  ): Promise<StreamableFile> {
    const key = [scope, ownerId, kind, fileName].join('/');
    const parts = parseStorageKey(key);
    if (parts === null || !FILE_KINDS[parts.kind].publiclyReadable) {
      throw new NotFoundException('No file stored.');
    }

    const content = await this.slots.read(key);

    return new StreamableFile(content, {
      type: CONTENT_TYPES[parts.extension],
      disposition: 'inline',
    });
  }
}
