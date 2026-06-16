import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification, User } from '../../database/entities';
import { HelpersService } from '../../common/helpers.service';

/**
 * Ported from server/src/routes/notifications.js. List, unread count, and
 * mark-read (all / single). Response shapes match the Express version.
 */
@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private readonly notifications: Repository<Notification>,
    private readonly helpers: HelpersService,
  ) {}

  // ---- GET /api/notifications ----
  async list(user: User) {
    const rows = await this.notifications.find({
      where: { user_id: user.id },
      order: { created_at: 'DESC' },
      take: 100,
    });
    const notifications: any[] = [];
    for (const n of rows) {
      notifications.push({
        id: n.id,
        type: n.type,
        targetType: n.target_type,
        targetId: n.target_id,
        preview: n.preview,
        read: !!n.read,
        createdAt: n.created_at,
        actor: n.actor_id
          ? await this.helpers.publicUser(
              await this.helpers.getUser(n.actor_id),
              user.id,
            )
          : null,
      });
    }
    return { notifications };
  }

  // ---- GET /api/notifications/unread ----
  async unread(user: User) {
    const c = await this.notifications.count({
      where: { user_id: user.id, read: 0 },
    });
    return { unread: c };
  }

  // ---- POST /api/notifications/read ----
  async readAll(user: User) {
    await this.notifications.update({ user_id: user.id }, { read: 1 });
    return { ok: true };
  }

  // ---- POST /api/notifications/:id/read ----
  async readOne(id: number, user: User) {
    await this.notifications.update({ id, user_id: user.id }, { read: 1 });
    return { ok: true };
  }
}
