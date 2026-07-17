import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { Order, Product, User } from '../database/entities';

type ConsumableSelector = {
  exact?: string;
  prefix?: string;
  category?: string;
};

export type ConsumedEntitlement = {
  orderId: number;
  productId: number;
  name: string;
  category: string;
  payload: string;
};

@Injectable()
export class EntitlementService {
  constructor(
    @InjectRepository(Order) private readonly orders: Repository<Order>,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  globalPinMinutes(payload: string): number {
    const raw = String(payload || '').split(':')[1];
    const mins = Math.round(Number(raw));
    if (Number.isFinite(mins) && mins > 0) return Math.min(mins, 30 * 24 * 60);
    return 24 * 60;
  }

  async inventory(userId: number): Promise<Record<string, number>> {
    const rows: { payload: string; c: string }[] = await this.orders
      .createQueryBuilder('o')
      .innerJoin(Product, 'p', 'p.id = o.product_id')
      .select('p.payload', 'payload')
      .addSelect('COUNT(*)', 'c')
      .where("o.user_id = :uid AND p.category = 'item' AND o.used = 0", {
        uid: userId,
      })
      .groupBy('p.payload')
      .getRawMany();
    const inventory: Record<string, number> = {};
    for (const r of rows) inventory[r.payload] = Number(r.c);
    return inventory;
  }

  async consumeRenameCard(
    userId: number,
    opts: { manager?: EntityManager } = {},
  ): Promise<ConsumedEntitlement | null> {
    return this.consumeFirst(userId, { exact: 'rename', category: 'item' }, opts);
  }

  async consumeGlobalPinCard(
    userId: number,
    opts: { manager?: EntityManager } = {},
  ): Promise<ConsumedEntitlement | null> {
    return this.consumeFirst(
      userId,
      { exact: 'pin', prefix: 'pin:', category: 'item' },
      opts,
    );
  }

  async applyProductBenefit(
    userId: number,
    product: Pick<Product, 'category' | 'payload'>,
    opts: { manager?: EntityManager } = {},
  ): Promise<void> {
    const payload = String(product.payload || '');
    if (!payload) return;
    const users = opts.manager?.getRepository(User) || this.users;
    if (product.category === 'title') {
      await users.update({ id: userId }, { title: payload });
    }
    if (product.category === 'frame') {
      await users.update({ id: userId }, { avatar_frame: payload });
    }
  }

  private async consumeFirst(
    userId: number,
    selector: ConsumableSelector,
    opts: { manager?: EntityManager } = {},
  ): Promise<ConsumedEntitlement | null> {
    const orders = opts.manager?.getRepository(Order) || this.orders;
    const qb = orders
      .createQueryBuilder('o')
      .innerJoin(Product, 'p', 'p.id = o.product_id')
      .select('o.id', 'orderId')
      .addSelect('o.product_id', 'productId')
      .addSelect('p.name', 'name')
      .addSelect('p.category', 'category')
      .addSelect('p.payload', 'payload')
      .where('o.user_id = :uid AND o.used = 0', { uid: userId });

    if (selector.category) {
      qb.andWhere('p.category = :category', { category: selector.category });
    }

    const payloadClauses: string[] = [];
    const payloadParams: Record<string, string> = {};
    if (selector.exact) {
      payloadClauses.push('p.payload = :payloadExact');
      payloadParams.payloadExact = selector.exact;
    }
    if (selector.prefix) {
      payloadClauses.push('p.payload LIKE :payloadPrefix');
      payloadParams.payloadPrefix = `${selector.prefix}%`;
    }
    if (payloadClauses.length) {
      qb.andWhere(`(${payloadClauses.join(' OR ')})`, payloadParams);
    }

    const card = await qb
      .orderBy('o.created_at', 'ASC')
      .getRawOne<{
        orderId: number;
        productId: number;
        name: string;
        category: string;
        payload: string;
      }>();

    if (!card) return null;
    const consumed = await orders.update(
      { id: Number(card.orderId), used: 0 },
      { used: 1 },
    );
    if (!consumed.affected) return null;

    return {
      orderId: Number(card.orderId),
      productId: Number(card.productId),
      name: card.name,
      category: card.category,
      payload: card.payload,
    };
  }
}
