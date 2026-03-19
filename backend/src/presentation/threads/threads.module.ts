import { Module } from '@nestjs/common';
import { ThreadsController } from './threads.controller';

import { CreateThreadUseCase } from '../../application/threads/create-thread.usecase';
import { GetThreadUseCase } from '../../application/threads/get-thread.usecase';
import { ListThreadsUseCase } from '../../application/threads/list-threads.usecase';
import { PostReplyUseCase } from '../../application/threads/post-reply.usecase';
import { EditReplyUseCase } from '../../application/threads/edit-reply.usecase';
import { DeleteReplyUseCase } from '../../application/threads/delete-reply.usecase';
import { VoteThreadUseCase } from '../../application/threads/vote-thread.usecase';
import { VoteReplyUseCase } from '../../application/threads/vote-reply.usecase';
import { UpdateThreadStatusUseCase } from '../../application/threads/update-thread-status.usecase';

import { PrismaThreadRepository } from '../../infrastructure/repositories/prisma-thread.repository';
import { PrismaThreadReplyRepository } from '../../infrastructure/repositories/thread-reply.repository';
import { PrismaThreadVoteRepository } from '../../infrastructure/repositories/thread-vote.repository';

import { PrismaModule } from '../../infrastructure/database/prisma/prisma.module';
import { AuthModule } from '../../auth/auth.module';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [ThreadsController],
  providers: [
    // Use cases
    CreateThreadUseCase,
    GetThreadUseCase,
    ListThreadsUseCase,
    PostReplyUseCase,
    EditReplyUseCase,
    DeleteReplyUseCase,
    VoteThreadUseCase,
    VoteReplyUseCase,
    UpdateThreadStatusUseCase,

    // Repository implementations
    PrismaThreadRepository,
    PrismaThreadReplyRepository,
    PrismaThreadVoteRepository,

    // Injection tokens
    { provide: 'ThreadRepository', useClass: PrismaThreadRepository },
    { provide: 'ThreadReplyRepository', useClass: PrismaThreadReplyRepository },
    { provide: 'ThreadVoteRepository', useClass: PrismaThreadVoteRepository },
  ],
})
export class ThreadsModule {}