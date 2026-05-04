import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Inject,
  Param,
  Patch,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtStrategy } from '../../auth/jwt.strategy';
import { RolesGuard } from '../../auth/roles.guard';
import { ListNotificationsUseCase } from 'src/application/notifications/list-notifications.usecase';
import { GetUnreadNotificationCountUseCase } from 'src/application/notifications/get-unread-notification-count.usecase';
import { MarkNotificationReadUseCase } from 'src/application/notifications/mark-notification-read.usecase';
import { MarkAllNotificationsReadUseCase } from 'src/application/notifications/mark-all-notifications-read.usecase';
import { DismissNotificationUseCase } from 'src/application/notifications/dismiss-notification.usecase';
import { GetNotificationPreferencesUseCase } from 'src/application/notifications/get-notification-preferences.usecase';
import { UpdateNotificationPreferencesUseCase } from 'src/application/notifications/update-notification-preferences.usecase';
import { ListNotificationsQueryDto } from './dto/list-notifications-query.dto';
import { UpdateNotificationPreferencesDto } from './dto/update-notification-preferences.dto';

@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly listNotificationsUseCase: ListNotificationsUseCase,
    private readonly getUnreadNotificationCountUseCase: GetUnreadNotificationCountUseCase,
    private readonly markNotificationReadUseCase: MarkNotificationReadUseCase,
    private readonly markAllNotificationsReadUseCase: MarkAllNotificationsReadUseCase,
    private readonly dismissNotificationUseCase: DismissNotificationUseCase,
    private readonly getNotificationPreferencesUseCase: GetNotificationPreferencesUseCase,
    private readonly updateNotificationPreferencesUseCase: UpdateNotificationPreferencesUseCase,
  ) {}

  @Get('unread-count')
  @UseGuards(JwtStrategy, RolesGuard)
  async unreadCount(@Req() request: any): Promise<{ unreadCount: number }> {
    try {
      const userId = request.user.userId;
      const unreadCount = await this.getUnreadNotificationCountUseCase.execute(userId);
      return { unreadCount };
    } catch (error) {
      throw new HttpException(
        this.formatError(error, 'Failed to get unread notification count'),
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Get('preferences')
  @UseGuards(JwtStrategy, RolesGuard)
  async getPreferences(@Req() request: any) {
    try {
      const userId = request.user.userId;
      const preferences = await this.getNotificationPreferencesUseCase.execute(userId);
      return { preferences };
    } catch (error) {
      throw new HttpException(
        this.formatError(error, 'Failed to load notification preferences'),
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Patch('preferences')
  @UseGuards(JwtStrategy, RolesGuard)
  async updatePreferences(@Req() request: any, @Body() body: UpdateNotificationPreferencesDto) {
    try {
      const userId = request.user.userId;
      const preferences = await this.updateNotificationPreferencesUseCase.execute(userId, body);
      return { preferences };
    } catch (error) {
      throw new HttpException(
        this.formatError(error, 'Failed to update notification preferences'),
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Get()
  @UseGuards(JwtStrategy, RolesGuard)
  async listNotifications(@Req() request: any, @Query() query: ListNotificationsQueryDto) {
    try {
      const userId = request.user.userId;
      const result = await this.listNotificationsUseCase.execute(userId, {
        skip: query.skip ?? 0,
        take: query.take ?? 20,
        unreadOnly: query.unreadOnly ?? false,
      });
      return result;
    } catch (error) {
      throw new HttpException(
        this.formatError(error, 'Failed to list notifications'),
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Patch(':id/read')
  @UseGuards(JwtStrategy, RolesGuard)
  async markAsRead(@Req() request: any, @Param('id') notificationId: string) {
    try {
      const userId = request.user.userId;
      const notification = await this.markNotificationReadUseCase.execute(notificationId, userId);
      return { notification };
    } catch (error) {
      throw new HttpException(
        this.formatError(error, 'Failed to mark notification as read'),
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Patch('read-all')
  @UseGuards(JwtStrategy, RolesGuard)
  async markAllAsRead(@Req() request: any) {
    try {
      const userId = request.user.userId;
      const result = await this.markAllNotificationsReadUseCase.execute(userId);
      return result;
    } catch (error) {
      throw new HttpException(
        this.formatError(error, 'Failed to mark notifications as read'),
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Patch(':id/dismiss')
  @UseGuards(JwtStrategy, RolesGuard)
  async dismiss(@Req() request: any, @Param('id') notificationId: string) {
    try {
      const userId = request.user.userId;
      const notification = await this.dismissNotificationUseCase.execute(notificationId, userId);
      return { notification };
    } catch (error) {
      throw new HttpException(
        this.formatError(error, 'Failed to dismiss notification'),
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  private formatError(error: unknown, fallbackMessage: string): string {
    if (error instanceof Error) {
      return error.message || fallbackMessage;
    }

    return fallbackMessage;
  }
}