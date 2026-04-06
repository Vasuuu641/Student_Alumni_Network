import { Module } from '@nestjs/common';
import { GroupPolicyService } from '../../application/policies/group-policy.service';

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

@Module({
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
    ListGroupPostsUseCase,
    EditGroupPostUseCase,
    DeleteGroupPostUseCase,
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
    ListGroupPostsUseCase,
    EditGroupPostUseCase,
    DeleteGroupPostUseCase,
  ],
})
export class StudyGroupsModule {}
