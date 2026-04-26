import { Module } from '@nestjs/common';
import { GroupPolicyService } from '../../application/policies/group-policy.service';

import { PrismaModule } from '../../infrastructure/database/prisma/prisma.module';
import { AuthModule } from '../../auth/auth.module';

import { PrismaStudyGroupRepository } from '../../infrastructure/repositories/prisma-study-group.repository';
import { PrismaStudyGroupMemberRepository } from '../../infrastructure/repositories/prisma-study-group-member.repository';
import { PrismaStudyGroupPostRepository } from '../../infrastructure/repositories/prisma-study-group-post.repository';
import { PrismaStudyGroupInviteRepository } from '../../infrastructure/repositories/prisma-study-group-invite.repository';
import { PrismaStudyGroupJoinRequestRepository } from '../../infrastructure/repositories/prisma-study-group-join-request.repository';
import { PrismaStudyGroupUserArchiveRepository } from '../../infrastructure/repositories/prisma-study-group-user-archive.repository';
import { CohereStudyGroupRecommendationService } from '../../infrastructure/ai/cohere/cohere-study-group-recommendation.service';

import { FormGroupUseCase } from '../../application/study-groups/form-group.usecase';
import { JoinGroupUseCase } from '../../application/study-groups/join-group.usecase';
import { GetGroupUseCase } from '../../application/study-groups/get-group.usecase';
import { ListGroupsUseCase } from '../../application/study-groups/list-groups.usecase';
import { UpdateGroupUseCase } from '../../application/study-groups/update-group.usecase';
import { ArchiveGroupUseCase } from '../../application/study-groups/archive-group.usecase';
import { ListMembersUseCase } from '../../application/study-groups/list-members.usecase';
import { LeaveGroupUseCase } from '../../application/study-groups/leave-group.usecase';
import { UpdateMemberRoleUseCase } from '../../application/study-groups/update-member-role.usecase';
import { RemoveMemberUseCase } from '../../application/study-groups/remove-member.usecase';
import { CreateGroupPostUseCase } from '../../application/study-groups/create-group-post.usecase';
import { ListGroupPostsUseCase } from '../../application/study-groups/list-group-posts.usecase';
import { EditGroupPostUseCase } from '../../application/study-groups/edit-group-post.usecase';
import { DeleteGroupPostUseCase } from '../../application/study-groups/delete-group-post.usecase';
import { AddMemberUseCase } from '../../application/study-groups/add-member.usecase';
import { ListMyInvitesUseCase } from '../../application/study-groups/list-my-invites.usecase';
import { RespondInviteUseCase } from '../../application/study-groups/respond-invite.usecase';
import { ListJoinRequestsUseCase } from '../../application/study-groups/list-join-requests.usecase';
import { ReviewJoinRequestUseCase } from '../../application/study-groups/review-join-request.usecase';
import { RecommendGroupsUseCase } from '../../application/study-groups/recommend-groups.usecase';
import { DeleteGroupUseCase } from '../../application/study-groups/delete-group.usecase';
import { ListArchivedGroupsUseCase } from '../../application/study-groups/list-archived-groups.usecase';
import { UnarchiveGroupUseCase } from '../../application/study-groups/unarchive-group.usecase';

import { StudyGroupsGateway } from '../../infrastructure/websocket/study-groups.gateway';

@Module({
  imports: [PrismaModule, AuthModule],
  providers: [
    GroupPolicyService,
    FormGroupUseCase,
    JoinGroupUseCase,
    GetGroupUseCase,
    ListGroupsUseCase,
    UpdateGroupUseCase,
    ArchiveGroupUseCase,
    ListMembersUseCase,
    LeaveGroupUseCase,
    UpdateMemberRoleUseCase,
    RemoveMemberUseCase,
    CreateGroupPostUseCase,
    AddMemberUseCase,
    ListGroupPostsUseCase,
    EditGroupPostUseCase,
    DeleteGroupPostUseCase,
    ListMyInvitesUseCase,
    RespondInviteUseCase,
    ListJoinRequestsUseCase,
    ReviewJoinRequestUseCase,
    RecommendGroupsUseCase,
    DeleteGroupUseCase,
    ListArchivedGroupsUseCase,
    UnarchiveGroupUseCase,
    // repository implementations
    PrismaStudyGroupRepository,
    PrismaStudyGroupMemberRepository,
    PrismaStudyGroupPostRepository,
    PrismaStudyGroupInviteRepository,
    PrismaStudyGroupJoinRequestRepository,
    PrismaStudyGroupUserArchiveRepository,
    CohereStudyGroupRecommendationService,

    // WebSocket gateway
    StudyGroupsGateway,

    // injection tokens
    { provide: 'StudyGroupRepository', useClass: PrismaStudyGroupRepository },
    { provide: 'StudyGroupMemberRepository', useClass: PrismaStudyGroupMemberRepository },
    { provide: 'StudyGroupPostRepository', useClass: PrismaStudyGroupPostRepository },
    { provide: 'StudyGroupInviteRepository', useClass: PrismaStudyGroupInviteRepository },
    { provide: 'StudyGroupJoinRequestRepository', useClass: PrismaStudyGroupJoinRequestRepository },
    { provide: 'StudyGroupUserArchiveRepository', useClass: PrismaStudyGroupUserArchiveRepository },
    { provide: 'StudyGroupRecommendationService', useClass: CohereStudyGroupRecommendationService },
    { provide: 'StudyGroupsRealtimePublisher', useClass: StudyGroupsGateway },
  ],
  controllers: [
    // controller wired to these use-cases
    require('./study-groups.controller').StudyGroupsController,
  ],
  exports: [
    FormGroupUseCase,
    JoinGroupUseCase,
    GetGroupUseCase,
    ListGroupsUseCase,
    UpdateGroupUseCase,
    ArchiveGroupUseCase,
    ListMembersUseCase,
    LeaveGroupUseCase,
    UpdateMemberRoleUseCase,
    RemoveMemberUseCase,
    CreateGroupPostUseCase,
    AddMemberUseCase,
    ListGroupPostsUseCase,
    EditGroupPostUseCase,
    DeleteGroupPostUseCase,
    ListMyInvitesUseCase,
    RespondInviteUseCase,
    ListJoinRequestsUseCase,
    ReviewJoinRequestUseCase,
    RecommendGroupsUseCase,
    DeleteGroupUseCase,
    ListArchivedGroupsUseCase,
    UnarchiveGroupUseCase,
  ],
})
export class StudyGroupsModule {}
