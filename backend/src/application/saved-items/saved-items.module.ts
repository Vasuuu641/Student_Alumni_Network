// src/application/saved-items/saved-items.module.ts
import { Module } from '@nestjs/common';
import { PrismaModule } from '../../infrastructure/database/prisma/prisma.module';
import { PrismaSavedItemRepository } from '../../infrastructure/repositories/prisma-saved-item.repository';

@Module({
  imports: [PrismaModule],
  providers: [
    PrismaSavedItemRepository,
    { provide: 'SavedItemRepository', useClass: PrismaSavedItemRepository },
  ],
  exports: ['SavedItemRepository'],
})
export class SavedItemsModule {}