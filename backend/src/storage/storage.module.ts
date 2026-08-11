import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FILE_STORAGE } from './file-storage.interface';
import { FileSlotService } from './file-slot.service';
import { FilesController } from './files.controller';
import { LocalFileStorage } from './local-file-storage';

const DEFAULT_UPLOADS_DIR = '/var/lib/rekr/uploads';

/**
 * `||`, not `??`: an API started outside the container reads `UPLOADS_DIR=` from
 * a dotenv file as an empty string rather than as `undefined`, and `??` would
 * hand that empty string straight to `path.resolve` — which resolves it to the
 * process working directory. Uploads would land in the source tree.
 */
export function resolveUploadsDir(config: ConfigService): string {
  return config.get<string>('UPLOADS_DIR')?.trim() || DEFAULT_UPLOADS_DIR;
}

@Module({
  controllers: [FilesController],
  providers: [
    {
      provide: FILE_STORAGE,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new LocalFileStorage(resolveUploadsDir(config)),
    },
    FileSlotService,
  ],
  exports: [FILE_STORAGE, FileSlotService],
})
export class StorageModule {}
