import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { FormGroupUseCase } from '../../application/study-groups/form-group.usecase';
import { JoinGroupUseCase } from '../../application/study-groups/join-group.usecase';
import { GetGroupUseCase } from '../../application/study-groups/get-group.usecase';
import { ListGroupsUseCase } from '../../application/study-groups/list-groups.usecase';
import { UpdateGroupUseCase } from '../../application/study-groups/update-group.usecase';
import { ArchiveGroupUseCase } from '../../application/study-groups/archive-group.usecase';
import { ListMembersUseCase } from '../../application/study-groups/list-members.usecase';
import { LeaveGroupUseCase } from '../../application/study-groups/leave-group.usecase';
import { AddMemberUseCase } from '../../application/study-groups/add-member.usecase';
import { UpdateMemberRoleUseCase } from '../../application/study-groups/update-member-role.usecase';
import { RemoveMemberUseCase } from '../../application/study-groups/remove-member.usecase';
import { CreateGroupPostUseCase } from '../../application/study-groups/create-group-post.usecase';
import { ListGroupPostsUseCase } from '../../application/study-groups/list-group-posts.usecase';
import { EditGroupPostUseCase } from '../../application/study-groups/edit-group-post.usecase';
import { DeleteGroupPostUseCase } from '../../application/study-groups/delete-group-post.usecase';
import { JwtStrategy } from '../../auth/jwt.strategy';
import { RolesGuard } from '../../auth/roles.guard';

import { CreateGroupDto } from './dto/create-group.dto';
import { UpdateGroupDto } from './dto/update-group.dto';
import { JoinGroupRequestDto } from './dto/join-group-request.dto';
import { AddMemberDto } from './dto/add-member.dto';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';
import { CreatePostDto } from './dto/create-post.dto';
import { EditPostDto } from './dto/edit-post.dto';

@Controller('study-groups')
export class StudyGroupsController {
  constructor(
    private readonly formGroup: FormGroupUseCase,
    private readonly joinGroup: JoinGroupUseCase,
    private readonly getGroup: GetGroupUseCase,
    private readonly listGroups: ListGroupsUseCase,
    private readonly updateGroup: UpdateGroupUseCase,
    private readonly archiveGroup: ArchiveGroupUseCase,
    private readonly listMembers: ListMembersUseCase,
    private readonly leaveGroup: LeaveGroupUseCase,
    private readonly addMember: AddMemberUseCase,
    private readonly updateMemberRole: UpdateMemberRoleUseCase,
    private readonly removeMember: RemoveMemberUseCase,
    private readonly createPostUseCase: CreateGroupPostUseCase,
    private readonly listPosts: ListGroupPostsUseCase,
    private readonly editPostUseCase: EditGroupPostUseCase,
    private readonly deletePostUseCase: DeleteGroupPostUseCase,
  ) {}

  @Post()
  @UseGuards(JwtStrategy, RolesGuard)
  async createGroup(@Req() request: any, @Body() body: CreateGroupDto) {
    const ownerId = request.user?.userId;
    return this.formGroup.execute({
      name: body.name,
      description: body.description,
      visibility: body.visibility as any,
      ownerId,
      maxMembers: body.maxMembers ?? null,
    });
  }

  @Get()
  @UseGuards(JwtStrategy, RolesGuard)
  async list(@Req() request: any, @Query('visibility') visibility?: string, @Query('ownerId') ownerId?: string) {
    const vis = visibility ? (visibility as any) : undefined;
    // If no explicit ownerId filter provided, default to authenticated user
    const effectiveOwnerId = ownerId ?? request.user?.userId;
    return this.listGroups.execute({ visibility: vis, ownerId: effectiveOwnerId });
  }

  @Get(':id')
  @UseGuards(JwtStrategy, RolesGuard)
  async get(@Param('id') id: string) {
    return this.getGroup.execute({ id });
  }

  @Patch(':id')
  @UseGuards(JwtStrategy, RolesGuard)
  async update(@Req() request: any, @Param('id') id: string, @Body() body: UpdateGroupDto) {
    const requesterId = request.user?.userId;
    return this.updateGroup.execute({ id, requesterId, name: body.name, description: body.description });
  }

  @Patch(':id/archive')
  @UseGuards(JwtStrategy, RolesGuard)
  async archive(@Req() request: any, @Param('id') id: string, @Body() body: { requesterId?: string }) {
    const requesterId = request.user?.userId;
    return this.archiveGroup.execute({ id, requesterId });
  }

  @Post(':id/join')
  @UseGuards(JwtStrategy, RolesGuard)
  async join(@Req() request: any, @Param('id') id: string, @Body() body: JoinGroupRequestDto) {
    const userId = request.user?.userId;
    return this.joinGroup.execute({ studyGroupId: id, userId });
  }

  @Post(':id/leave')
  @UseGuards(JwtStrategy, RolesGuard)
  async leave(@Req() request: any, @Param('id') id: string, @Body() body: { userId?: string }) {
    const userId = request.user?.userId;
    return this.leaveGroup.execute({ studyGroupId: id, userId });
  }

  @Get(':id/members')
  @UseGuards(JwtStrategy, RolesGuard)
  async members(@Param('id') id: string) {
    return this.listMembers.execute({ studyGroupId: id });
  }

  @Post(':id/members')
  @UseGuards(JwtStrategy, RolesGuard)
  async addMemberEndpoint(@Req() request: any, @Param('id') id: string, @Body() body: AddMemberDto) {
    const requesterId = request.user?.userId;
    return this.addMember.execute({ studyGroupId: id, requesterId, userId: body.userId, role: (body.role as any) });
  }

  @Patch(':id/members/:userId/role')
  @UseGuards(JwtStrategy, RolesGuard)
  async updateMemberRoleEndpoint(@Req() request: any, @Param('id') id: string, @Param('userId') userId: string, @Body() body: UpdateMemberRoleDto) {
    const requesterId = request.user?.userId;
    return this.updateMemberRole.execute({ studyGroupId: id, requesterId, userId, role: body.role as any });
  }

  @Delete(':id/members/:userId')
  @UseGuards(JwtStrategy, RolesGuard)
  async removeMemberEndpoint(@Req() request: any, @Param('id') id: string, @Param('userId') userId: string, @Body() body: { requesterId?: string }) {
    const requesterId = request.user?.userId;
    return this.removeMember.execute({ studyGroupId: id, requesterId, userId });
  }

  @Post(':id/posts')
  @UseGuards(JwtStrategy, RolesGuard)
  async createPost(@Req() request: any, @Param('id') id: string, @Body() body: CreatePostDto) {
    const authorId = request.user?.userId;
    return this.createPostUseCase.execute({ studyGroupId: id, authorId, content: body.content });
  }

  @Get(':id/posts')
  @UseGuards(JwtStrategy, RolesGuard)
  async getPosts(@Param('id') id: string) {
    return this.listPosts.execute({ studyGroupId: id });
  }

  @Patch(':id/posts/:postId')
  @UseGuards(JwtStrategy, RolesGuard)
  async editPost(@Req() request: any, @Param('id') id: string, @Param('postId') postId: string, @Body() body: EditPostDto) {
    // editPostUseCase currently doesn't require requesterId; authorization happens in use-case/repo
    return this.editPostUseCase.execute({ postId, content: body.content });
  }

  @Delete(':id/posts/:postId')
  @UseGuards(JwtStrategy, RolesGuard)
  async deletePost(@Req() request: any, @Param('id') id: string, @Param('postId') postId: string) {
    // delete use-case doesn't take requesterId currently; ensure policy enforced in use-case/repo
    return this.deletePostUseCase.execute({ postId });
  }
}
