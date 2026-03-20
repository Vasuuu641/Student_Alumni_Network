import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  HttpException,
  HttpStatus,
  Logger,
  Inject,
} from '@nestjs/common';
import { JwtStrategy } from '../../auth/jwt.strategy';
import { RolesGuard } from '../../auth/roles.guard';

import { CreateThreadUseCase } from '../../application/threads/create-thread.usecase';
import { GetThreadUseCase } from '../../application/threads/get-thread.usecase';
import { ListThreadsUseCase } from '../../application/threads/list-threads.usecase';
import { PostReplyUseCase } from '../../application/threads/post-reply.usecase';
import { EditReplyUseCase } from '../../application/threads/edit-reply.usecase';
import { DeleteReplyUseCase } from '../../application/threads/delete-reply.usecase';
import { VoteThreadUseCase } from '../../application/threads/vote-thread.usecase';
import { VoteReplyUseCase } from '../../application/threads/vote-reply.usecase';
import { UpdateThreadStatusUseCase } from '../../application/threads/update-thread-status.usecase';
import { ListRepliesUseCase } from '../../application/threads/list-replies.usecase';

import { CreateThreadRequestDto } from './dto/create-thread-request.dto';
import { PostReplyRequestDto } from './dto/post-reply-request.dto';
import { EditReplyRequestDto } from './dto/edit-reply-request.dto';
import { ListThreadsRequestDto } from './dto/list-thread-requests.dto';
import { VoteRequestDto } from './dto/vote-request.dto';
import { UpdateThreadStatusRequestDto } from './dto/update-thread-status-request.dto';

import type { ThreadsRealtimePublisher } from 'src/domain/services/threads-realtime-publisher';
import { Thread, ThreadReply } from 'src/domain/entities/thread.entity';
import type { UserRepository } from 'src/domain/repositories/user.repository';
import type { ThreadVoteRepository } from 'src/domain/repositories/thread.repository';
import { VoteType } from 'src/domain/entities/thread.entity';

type ThreadView = Thread & {
  authorName?: string;
  viewerVote?: VoteType | null;
  upvoteCount?: number;
  downvoteCount?: number;
};

type ReplyView = ThreadReply & {
  authorName?: string;
  viewerVote?: VoteType | null;
  upvoteCount?: number;
  downvoteCount?: number;
};

@Controller('threads')
export class ThreadsController {
  private readonly logger = new Logger(ThreadsController.name);

  constructor(
    private readonly createThreadUseCase: CreateThreadUseCase,
    private readonly getThreadUseCase: GetThreadUseCase,
    private readonly listThreadsUseCase: ListThreadsUseCase,
    private readonly postReplyUseCase: PostReplyUseCase,
    private readonly editReplyUseCase: EditReplyUseCase,
    private readonly deleteReplyUseCase: DeleteReplyUseCase,
    private readonly voteThreadUseCase: VoteThreadUseCase,
    private readonly voteReplyUseCase: VoteReplyUseCase,
    private readonly updateThreadStatusUseCase: UpdateThreadStatusUseCase,
    @Inject('ThreadsRealtimePublisher') 
    private readonly realtimePublisher: ThreadsRealtimePublisher,
    private readonly listRepliesUseCase: ListRepliesUseCase,
    @Inject('UserRepository')
    private readonly userRepository: UserRepository,
    @Inject('ThreadVoteRepository')
    private readonly threadVoteRepository: ThreadVoteRepository,
  ) {}

  /**
   * POST /threads
   * Create a new thread
   */
  @Post()
  @UseGuards(JwtStrategy, RolesGuard)
  async createThread(
    @Req() request: any,
    @Body() body: CreateThreadRequestDto,
  ): Promise<{ threadId: string }> {
    try {
      const { userId, role } = request.user;
      const threadId = await this.createThreadUseCase.execute(
        userId,
        role,
        body.title,
        body.description ?? null,
        body.panel,
      );
      return { threadId };
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to create thread',
        error.status || HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * GET /threads
   * List threads by panel with sorting and pagination
   */
  @Get()
  @UseGuards(JwtStrategy, RolesGuard)
  async listThreads(
    @Req() request: any,
    @Query() query: ListThreadsRequestDto,
  ) {
    try {
      const { role, userId } = request.user;
      const result = await this.listThreadsUseCase.execute({
        panel: query.panel,
        skip: query.skip ?? 0,
        take: query.take ?? 20,
        sortBy: query.sortBy ?? 'newest',
        userRole: role,
      });

      const threadsWithAuthors = await this.withThreadAuthorNames(result.threads);
      const threadsWithVoteCounts = await this.withThreadVoteCounts(threadsWithAuthors);
      const threadsWithVotes = await this.withThreadViewerVotes(threadsWithVoteCounts, userId);
      return {
        ...result,
        threads: threadsWithVotes,
      };
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to list threads',
        error.status || HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * GET /threads/:id
   * Get a single thread by ID
   */
  @Get(':id')
  @UseGuards(JwtStrategy, RolesGuard)
  async getThread(
    @Req() request: any,
    @Param('id') threadId: string,
  ) {
    try {
      const { role, userId } = request.user;
      const thread = await this.getThreadUseCase.execute(threadId, role);
      const [threadWithAuthor] = await this.withThreadAuthorNames([thread]);
      const [threadWithVoteCounts] = await this.withThreadVoteCounts([threadWithAuthor]);
      const [threadWithVote] = await this.withThreadViewerVotes([threadWithVoteCounts], userId);
      return { thread: threadWithVote };
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to get thread',
        error.status || HttpStatus.NOT_FOUND,
      );
    }
  }

  /**
   * PATCH /threads/:id/status
   * Update thread status — close, pin, or reopen
   */
  @Patch(':id/status')
  @UseGuards(JwtStrategy, RolesGuard)
  async updateThreadStatus(
    @Req() request: any,
    @Param('id') threadId: string,
    @Body() body: UpdateThreadStatusRequestDto,
  ): Promise<{ success: boolean }> {
    try {
      const { userId, role } = request.user;
      await this.updateThreadStatusUseCase.execute(
        threadId,
        userId,
        role,
        body.status,
      );
      return { success: true };
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to update thread status',
        error.status || HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * POST /threads/:id/replies
   * Post a reply to a thread
   */
  @Post(':id/replies')
  @UseGuards(JwtStrategy, RolesGuard)
  async postReply(
    @Req() request: any,
    @Param('id') threadId: string,
    @Body() body: PostReplyRequestDto,
  ) {
    try {
      const { userId } = request.user;
      const reply = await this.postReplyUseCase.execute(
        threadId,
        userId,
        body.content,
        body.parentReplyId ?? null,
      );

      const [replyWithAuthor] = await this.withReplyAuthorNames([reply]);
      const [replyWithVoteCounts] = await this.withReplyVoteCounts([replyWithAuthor]);

      this.realtimePublisher.broadcastReplyPosted(threadId, replyWithVoteCounts as ThreadReply);
      return { reply: replyWithVoteCounts };

    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to post reply',
        error.status || HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
 * GET /threads/:id/replies
 * Get all replies for a thread
 */
@Get(':id/replies')
@UseGuards(JwtStrategy, RolesGuard)
async listReplies(
  @Req() request: any,
  @Param('id') threadId: string,
  @Query('skip') skip: string = '0',
  @Query('take') take: string = '50',
  @Query('sortBy') sortBy: string = 'newest',
) {
  try {
    const result = await this.listRepliesUseCase.execute(
      threadId,
      parseInt(skip),
      parseInt(take),
      sortBy as 'newest' | 'topVoted',
    );

    const repliesWithAuthors = await this.withReplyAuthorNames(result.replies);
    const repliesWithVoteCounts = await this.withReplyVoteCounts(repliesWithAuthors);
    const repliesWithVotes = await this.withReplyViewerVotes(repliesWithVoteCounts, request.user.userId);
    return {
      ...result,
      replies: repliesWithVotes,
    };
  } catch (error) {
    throw new HttpException(
      error.message || 'Failed to list replies',
      error.status || HttpStatus.BAD_REQUEST,
    );
  }
}

  /**
   * PATCH /threads/:id/replies/:replyId
   * Edit a reply
   */
  @Patch(':id/replies/:replyId')
  @UseGuards(JwtStrategy, RolesGuard)
  async editReply(
    @Req() request: any,
    @Param('replyId') replyId: string,
    @Param('id') threadId: string,
    @Body() body: EditReplyRequestDto,
  ): Promise<{ success: boolean }> {
    try {
      const { userId } = request.user;
      await this.editReplyUseCase.execute(replyId, userId, body.content);
      this.realtimePublisher.broadcastReplyEdited(threadId, replyId, body.content);
      return { success: true };
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to edit reply',
        error.status || HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * PATCH /threads/:id/replies/:replyId/delete
   * Soft delete a reply
   */
  @Patch(':id/replies/:replyId/delete')
  @UseGuards(JwtStrategy, RolesGuard)
  async deleteReply(
    @Req() request: any,
    @Param('id') threadId: string,
    @Param('replyId') replyId: string,
  ): Promise<{ success: boolean }> {
    try {
      const { userId, role } = request.user;
      await this.deleteReplyUseCase.execute(replyId, userId, role);
      this.realtimePublisher.broadcastReplyDeleted(threadId, replyId);
      return { success: true };
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to delete reply',
        error.status || HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * Post /threads/:id/vote
   * Upvote or downvote a thread
   */
  @Post(':id/vote')
  @UseGuards(JwtStrategy, RolesGuard)
  async voteThread(
    @Req() request: any,
    @Param('id') threadId: string,
    @Body() body: VoteRequestDto,
  ): Promise<{ success: boolean }> {
    try {
      const { userId } = request.user;
      const updatedScore = await this.voteThreadUseCase.execute(threadId, userId, body.voteType);
      const [upvoteCount, downvoteCount] = await Promise.all([
        this.threadVoteRepository.countThreadVotesByType(threadId, VoteType.UPVOTE),
        this.threadVoteRepository.countThreadVotesByType(threadId, VoteType.DOWNVOTE),
      ]);
      this.realtimePublisher.broadcastThreadVoted(threadId, {
        voteScore: updatedScore,
        upvoteCount,
        downvoteCount,
      });
      return { success: true };
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to vote on thread',
        error.status || HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * POST /threads/:id/replies/:replyId/vote
   * Upvote or downvote a reply
   */
  @Post(':id/replies/:replyId/vote')
  @UseGuards(JwtStrategy, RolesGuard)
  async voteReply(
    @Req() request: any,
    @Param('replyId') replyId: string,
    @Param('id') threadId: string,
    @Body() body: VoteRequestDto,
  ): Promise<{ success: boolean }> {
    try {
      const { userId } = request.user;
      const updatedScore = await this.voteReplyUseCase.execute(replyId, userId, body.voteType);
      const [upvoteCount, downvoteCount] = await Promise.all([
        this.threadVoteRepository.countReplyVotesByType(replyId, VoteType.UPVOTE),
        this.threadVoteRepository.countReplyVotesByType(replyId, VoteType.DOWNVOTE),
      ]);
      this.realtimePublisher.broadcastReplyVoted(threadId, replyId, {
        voteScore: updatedScore,
        upvoteCount,
        downvoteCount,
      });
      return { success: true };
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to vote on reply',
        error.status || HttpStatus.BAD_REQUEST,
      );
    }
  }

  private async withThreadAuthorNames(threads: Thread[]): Promise<ThreadView[]> {
    if (!threads.length) return [];

    const userIds = [...new Set(threads.map((thread) => thread.authorId))];
    const userMap = await this.getAuthorNameMap(userIds);

    return threads.map((thread) => Object.assign(thread, {
      authorName: userMap[thread.authorId],
    }));
  }

  private async withReplyAuthorNames(replies: ThreadReply[]): Promise<ReplyView[]> {
    if (!replies.length) return [];

    const userIds = [...new Set(replies.map((reply) => reply.authorId))];
    const userMap = await this.getAuthorNameMap(userIds);

    return replies.map((reply) => Object.assign(reply, {
      authorName: userMap[reply.authorId],
    }));
  }

  private async withThreadVoteCounts(threads: ThreadView[]): Promise<ThreadView[]> {
    if (!threads.length) return [];

    const counts = await Promise.all(
      threads.map(async (thread) => {
        const [upvoteCount, downvoteCount] = await Promise.all([
          this.threadVoteRepository.countThreadVotesByType(thread.id, VoteType.UPVOTE),
          this.threadVoteRepository.countThreadVotesByType(thread.id, VoteType.DOWNVOTE),
        ]);

        return { upvoteCount, downvoteCount };
      }),
    );

    return threads.map((thread, index) => Object.assign(thread, counts[index]));
  }

  private async withReplyVoteCounts(replies: ReplyView[]): Promise<ReplyView[]> {
    if (!replies.length) return [];

    const counts = await Promise.all(
      replies.map(async (reply) => {
        const [upvoteCount, downvoteCount] = await Promise.all([
          this.threadVoteRepository.countReplyVotesByType(reply.id, VoteType.UPVOTE),
          this.threadVoteRepository.countReplyVotesByType(reply.id, VoteType.DOWNVOTE),
        ]);

        return { upvoteCount, downvoteCount };
      }),
    );

    return replies.map((reply, index) => Object.assign(reply, counts[index]));
  }

  private async withThreadViewerVotes(
    threads: ThreadView[],
    userId: string,
  ): Promise<ThreadView[]> {
    if (!threads.length) return [];

    const votes = await Promise.all(
      threads.map((thread) => this.threadVoteRepository.findThreadVote(thread.id, userId)),
    );

    return threads.map((thread, index) => Object.assign(thread, {
      viewerVote: (votes[index]?.voteType as VoteType | undefined) ?? null,
    }));
  }

  private async withReplyViewerVotes(
    replies: ReplyView[],
    userId: string,
  ): Promise<ReplyView[]> {
    if (!replies.length) return [];

    const votes = await Promise.all(
      replies.map((reply) => this.threadVoteRepository.findReplyVote(reply.id, userId)),
    );

    return replies.map((reply, index) => Object.assign(reply, {
      viewerVote: (votes[index]?.voteType as VoteType | undefined) ?? null,
    }));
  }

  private async getAuthorNameMap(userIds: string[]): Promise<Record<string, string>> {
    if (!userIds.length) return {};

    const users = await Promise.all(userIds.map((userId) => this.userRepository.findById(userId)));

    return users.reduce<Record<string, string>>((acc, user, index) => {
      const userId = userIds[index];
      if (!user) {
        acc[userId] = userId;
        return acc;
      }

      const fullName = `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim();
      acc[userId] = fullName || userId;
      return acc;
    }, {});
  }
}