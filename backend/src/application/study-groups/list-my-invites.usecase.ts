import { Injectable } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import type {
  StudyGroupInviteRepository,
  StudyGroupInviteView,
} from '../../domain/repositories/study-group-invite.repository';

@Injectable()
export class ListMyInvitesUseCase {
  constructor(
    @Inject('StudyGroupInviteRepository')
    private readonly inviteRepository: StudyGroupInviteRepository,
  ) {}

  async execute(userId: string): Promise<StudyGroupInviteView[]> {
    return this.inviteRepository.findPendingForUser(userId, new Date());
  }
}
