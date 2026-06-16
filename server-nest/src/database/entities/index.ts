import { User } from './user.entity';
import { Post } from './post.entity';
import { Comment } from './comment.entity';
import { Follow } from './follow.entity';
import { Like } from './like.entity';
import { Topic } from './topic.entity';
import { Bookmark } from './bookmark.entity';
import { Block } from './block.entity';
import { Notification } from './notification.entity';
import { Purchase } from './purchase.entity';
import { Reward } from './reward.entity';
import { Product } from './product.entity';
import { Order } from './order.entity';
import { Poll, PollOption, PollVote } from './poll.entity';
import { Circle, CircleMember } from './circle.entity';

export {
  User,
  Post,
  Comment,
  Follow,
  Like,
  Topic,
  Bookmark,
  Block,
  Notification,
  Purchase,
  Reward,
  Product,
  Order,
  Poll,
  PollOption,
  PollVote,
  Circle,
  CircleMember,
};

/**
 * All entities registered with TypeORM. As later modules are ported
 * (comments/forum/messages/etc.) add their entities here.
 */
export const entities = [
  User,
  Post,
  Comment,
  Follow,
  Like,
  Topic,
  Bookmark,
  Block,
  Notification,
  Purchase,
  Reward,
  Product,
  Order,
  Poll,
  PollOption,
  PollVote,
  Circle,
  CircleMember,
];
