import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Comment,
  Like,
  Post,
  Thread,
  User,
} from '../../database/entities';
import { HelpersService } from '../../common/helpers.service';
import { checkSensitive } from '../../common/sensitive';
import { CreateCommentDto } from './dto/comment.dto';

/**
 * Ported from server/src/routes/comments.js. Nested comments on posts and forum
 * threads, comment likes, and deletion — response shapes match the Express
 * version (serializeComment + nested replies tree).
 */
@Injectable()
export class CommentsService {
  constructor(
    @InjectRepository(Comment) private readonly comments: Repository<Comment>,
    @InjectRepository(Like) private readonly likes: Repository<Like>,
    @InjectRepository(Post) private readonly posts: Repository<Post>,
    @InjectRepository(Thread) private readonly threads: Repository<Thread>,
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly helpers: HelpersService,
  ) {}

  private async serializeComment(c: Comment, viewerId: number | null) {
    const liked = viewerId
      ? !!(await this.likes.findOne({
          where: { user_id: viewerId, target_type: 'comment', target_id: c.id },
        }))
      : false;
    return {
      id: c.id,
      content: c.content,
      createdAt: c.created_at,
      likeCount: c.like_count,
      liked,
      parentId: c.parent_id,
      replyTo: c.reply_to
        ? await this.helpers.publicUser(
            await this.helpers.getUser(c.reply_to),
            viewerId,
          )
        : null,
      author: await this.helpers.publicUser(
        await this.helpers.getUser(c.user_id),
        viewerId,
      ),
    };
  }

  // ---- GET /api/comments ----
  async list(
    postId: string | undefined,
    threadId: string | undefined,
    sort: string | undefined,
    viewer: User | null,
  ) {
    const viewerId = viewer?.id || null;
    const id = postId || threadId;
    if (!id) throw new BadRequestException('缺少目标');
    const all = postId
      ? await this.comments.find({
          where: { post_id: Number(postId) },
          order: { created_at: 'ASC' },
        })
      : await this.comments.find({
          where: { thread_id: Number(threadId) },
          order: { created_at: 'ASC' },
        });

    const byId = new Map<number, any>();
    for (const c of all) {
      byId.set(c.id, {
        ...(await this.serializeComment(c, viewerId)),
        replies: [],
      });
    }
    const roots: any[] = [];
    for (const c of all) {
      const node = byId.get(c.id);
      if (c.parent_id && byId.has(c.parent_id))
        byId.get(c.parent_id).replies.push(node);
      else roots.push(node);
    }
    if (sort === 'hot')
      roots.sort(
        (a, b) =>
          b.likeCount - a.likeCount ||
          (b.createdAt || '').localeCompare(a.createdAt || ''),
      );
    else
      roots.sort((a, b) =>
        (b.createdAt || '').localeCompare(a.createdAt || ''),
      );
    return { comments: roots };
  }

  // ---- POST /api/comments ----
  async create(user: User, dto: CreateCommentDto) {
    const text = (dto.content || '').trim();
    const { postId, threadId, parentId, replyTo } = dto;
    if (!text) throw new BadRequestException('评论内容不能为空');
    if (!postId && !threadId) throw new BadRequestException('缺少目标');
    if (checkSensitive(text))
      throw new BadRequestException('评论包含敏感信息，请修改后重试');

    const saved = await this.comments.save(
      this.comments.create({
        post_id: postId || null,
        thread_id: threadId || null,
        user_id: user.id,
        parent_id: parentId || null,
        reply_to: replyTo || null,
        content: text,
        created_at: this.helpers.nowSql(),
      }),
    );

    let authorId: number | null = null;
    if (postId) {
      await this.posts.increment({ id: postId }, 'comment_count', 1);
      const p = await this.posts.findOne({
        where: { id: postId },
        select: ['user_id'],
      });
      authorId = p?.user_id ?? null;
      await this.helpers.notify({
        userId: authorId!,
        actorId: user.id,
        type: 'comment',
        targetType: 'post',
        targetId: postId,
        preview: text.slice(0, 50),
      });
    }
    if (threadId) {
      await this.threads.update(
        { id: threadId },
        {
          reply_count: () => 'reply_count + 1',
          last_reply_at: this.helpers.nowSql(),
        } as any,
      );
      const t = await this.threads.findOne({
        where: { id: threadId },
        select: ['user_id'],
      });
      authorId = t?.user_id ?? null;
      await this.helpers.notify({
        userId: authorId!,
        actorId: user.id,
        type: 'reply',
        targetType: 'thread',
        targetId: threadId,
        preview: text.slice(0, 50),
      });
    }
    if (replyTo && replyTo !== authorId) {
      await this.helpers.notify({
        userId: replyTo,
        actorId: user.id,
        type: 'reply',
        targetType: postId ? 'post' : 'thread',
        targetId: postId || threadId || null,
        preview: text.slice(0, 50),
      });
    }
    for (const name of this.helpers.parseMentions(text)) {
      const target = await this.users
        .createQueryBuilder('u')
        .where('u.username = :name OR u.nickname = :name', { name })
        .getOne();
      if (target)
        await this.helpers.notify({
          userId: target.id,
          actorId: user.id,
          type: 'mention',
          targetType: postId ? 'post' : 'thread',
          targetId: postId || threadId || null,
          preview: text.slice(0, 50),
        });
    }
    await this.helpers.award(user.id, { exp: 2, points: 1 });
    const row = await this.comments.findOne({ where: { id: saved.id } });
    return {
      comment: {
        ...(await this.serializeComment(row!, user.id)),
        replies: [],
      },
    };
  }

  // ---- POST /api/comments/:id/like ----
  async like(id: number, user: User) {
    const c = await this.comments.findOne({ where: { id } });
    if (!c) throw new NotFoundException('评论不存在');
    const liked = await this.likes.findOne({
      where: { user_id: user.id, target_type: 'comment', target_id: c.id },
    });
    if (liked) {
      await this.likes.delete({
        user_id: user.id,
        target_type: 'comment',
        target_id: c.id,
      });
      await this.comments
        .query(
          'UPDATE comments SET like_count = GREATEST(0, like_count - 1) WHERE id = ?',
          [c.id],
        )
        .catch(() =>
          this.comments.query(
            'UPDATE comments SET like_count = GREATEST(0, like_count - 1) WHERE id = $1',
            [c.id],
          ),
        );
      return { liked: false, likeCount: c.like_count - 1 };
    }
    await this.likes.insert({
      user_id: user.id,
      target_type: 'comment',
      target_id: c.id,
      created_at: this.helpers.nowSql(),
    });
    await this.comments.increment({ id: c.id }, 'like_count', 1);
    await this.helpers.notify({
      userId: c.user_id,
      actorId: user.id,
      type: 'like',
      targetType: c.post_id ? 'post' : 'thread',
      targetId: c.post_id || c.thread_id,
      preview: (c.content || '').slice(0, 40),
    });
    return { liked: true, likeCount: c.like_count + 1 };
  }

  // ---- DELETE /api/comments/:id ----
  async remove(id: number, user: User) {
    const c = await this.comments.findOne({ where: { id } });
    if (!c) throw new NotFoundException('评论不存在');
    if (c.user_id !== user.id && user.role !== 'admin')
      throw new ForbiddenException('无权删除');
    await this.comments.delete({ id: c.id });
    if (c.post_id)
      await this.posts
        .query(
          'UPDATE posts SET comment_count = GREATEST(0, comment_count - 1) WHERE id = ?',
          [c.post_id],
        )
        .catch(() =>
          this.posts.query(
            'UPDATE posts SET comment_count = GREATEST(0, comment_count - 1) WHERE id = $1',
            [c.post_id],
          ),
        );
    if (c.thread_id)
      await this.threads
        .query(
          'UPDATE threads SET reply_count = GREATEST(0, reply_count - 1) WHERE id = ?',
          [c.thread_id],
        )
        .catch(() =>
          this.threads.query(
            'UPDATE threads SET reply_count = GREATEST(0, reply_count - 1) WHERE id = $1',
            [c.thread_id],
          ),
        );
    return { ok: true };
  }
}
