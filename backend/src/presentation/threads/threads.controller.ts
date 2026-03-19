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

import { CreateThreadRequestDto } from './dto/create-thread-request.dto';
import { PostReplyRequestDto } from './dto/post-reply-request.dto';
import { EditReplyRequestDto } from './dto/edit-reply-request.dto';
import { ListThreadsRequestDto } from './dto/list-thread-requests.dto';
import { VoteRequestDto } from './dto/vote-request.dto';
import { UpdateThreadStatusRequestDto } from './dto/update-thread-status-request.dto';

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
      const { role } = request.user;
      const result = await this.listThreadsUseCase.execute({
        panel: query.panel,
        skip: query.skip ?? 0,
        take: query.take ?? 20,
        sortBy: query.sortBy ?? 'newest',
        userRole: role,
      });
      return result;
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
      const { role } = request.user;
      const thread = await this.getThreadUseCase.execute(threadId, role);
      return { thread };
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
      return { reply };
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to post reply',
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
    @Body() body: EditReplyRequestDto,
  ): Promise<{ success: boolean }> {
    try {
      const { userId } = request.user;
      await this.editReplyUseCase.execute(replyId, userId, body.content);
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
    @Param('replyId') replyId: string,
  ): Promise<{ success: boolean }> {
    try {
      const { userId, role } = request.user;
      await this.deleteReplyUseCase.execute(replyId, userId, role);
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
      await this.voteThreadUseCase.execute(threadId, userId, body.voteType);
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
    @Body() body: VoteRequestDto,
  ): Promise<{ success: boolean }> {
    try {
      const { userId } = request.user;
      await this.voteReplyUseCase.execute(replyId, userId, body.voteType);
      return { success: true };
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to vote on reply',
        error.status || HttpStatus.BAD_REQUEST,
      );
    }
  }
}