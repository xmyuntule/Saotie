import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Board,
  BoardPurchase,
  Moderator,
  Thread,
  User,
} from '../../database/entities';
import { HelpersService } from '../../common/helpers.service';

@Injectable()
export class ForumPermissionService {
  constructor(
    @InjectRepository(Moderator)
    private readonly moderators: Repository<Moderator>,
    @InjectRepository(BoardPurchase)
    private readonly boardPurchases: Repository<BoardPurchase>,
    private readonly helpers: HelpersService,
  ) {}

  async isModerator(
    boardId: number,
    viewerId: number | null | undefined,
  ): Promise<boolean> {
    if (!viewerId) return false;
    const u = await this.helpers.getUser(viewerId);
    if (this.helpers.isAdmin(u)) return true;
    return !!(await this.moderators.findOne({
      where: { board_id: boardId, user_id: viewerId },
    }));
  }

  async hasPurchasedBoard(
    boardId: number,
    viewerId: number | null | undefined,
  ): Promise<boolean> {
    if (!viewerId) return false;
    return !!(await this.boardPurchases.findOne({
      where: { user_id: viewerId, board_id: boardId },
    }));
  }

  async canViewBoard(
    board: Board | null,
    viewerId: number | null | undefined,
  ): Promise<boolean> {
    if (!board || !board.is_paid || board.price <= 0) return true;
    if (await this.isModerator(board.id, viewerId)) return true;
    return this.hasPurchasedBoard(board.id, viewerId);
  }

  async boardLockedFor(
    board: Board | null,
    viewerId: number | null | undefined,
  ): Promise<boolean> {
    return !(await this.canViewBoard(board, viewerId));
  }

  async canModerateThread(
    thread: Pick<Thread, 'board_id'>,
    viewerId: number | null | undefined,
  ): Promise<boolean> {
    return this.isModerator(thread.board_id, viewerId);
  }

  canDeleteThread(
    thread: Pick<Thread, 'user_id'>,
    user: Pick<User, 'id' | 'role'> | null | undefined,
    isModerator: boolean,
  ): boolean {
    return isModerator || this.helpers.canManageOwner(user, thread.user_id);
  }
}
