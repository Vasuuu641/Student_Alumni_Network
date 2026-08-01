// infrastructure/services/file-storage.module.ts
import { Global, Module } from '@nestjs/common';
import { R2FileStorageService } from './file-storage.service';

@Global()
@Module({
  providers: [
    R2FileStorageService,
    { provide: 'FileStorageService', useClass: R2FileStorageService },
  ],
  exports: ['FileStorageService'],
})
export class FileStorageModule {}