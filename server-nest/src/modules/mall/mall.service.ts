import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Like, Repository } from 'typeorm';
import { Order, Product, User } from '../../database/entities';
import { HelpersService } from '../../common/helpers.service';

/**
 * Ported from server/src/routes/mall.js. 积分商城 — product catalog, orders,
 * consumable inventory, and redeem (equips titles / avatar frames). Response
 * shapes match the Express version.
 */
@Injectable()
export class MallService {
  constructor(
    @InjectRepository(Product) private readonly products: Repository<Product>,
    @InjectRepository(Order) private readonly orders: Repository<Order>,
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly helpers: HelpersService,
    private readonly dataSource: DataSource,
  ) {}

  private async serializeProduct(p: Product, viewer: User | null) {
    const owned = viewer?.id
      ? !!(await this.orders.findOne({
          where: { user_id: viewer.id, product_id: p.id },
        }))
      : false;
    const canSeePayload = viewer?.role === 'admin' || owned || p.category !== 'physical';
    return {
      id: p.id,
      name: p.name,
      description: p.description,
      icon: p.icon,
      category: p.category,
      payload: canSeePayload ? p.payload : '',
      price: p.price,
      stock: p.stock,
      sold: p.sold,
      owned,
      soldOut: p.stock >= 0 && p.sold >= p.stock,
    };
  }

  // ---- GET /api/mall/products ----
  async listProducts(viewer: User | null, q?: string) {
    const term = (q || '').trim();
    const rows = await this.products.find({
      where: term ? { name: Like(`%${term}%`) } : {},
      order: { price: 'ASC' },
    });
    const products: any[] = [];
    for (const p of rows)
      products.push(await this.serializeProduct(p, viewer || null));
    return { products };
  }

  // ---- GET /api/mall/orders ----
  async listOrders(user: User) {
    const rows = await this.orders
      .createQueryBuilder('o')
      .innerJoin(Product, 'p', 'p.id = o.product_id')
      .select('o.*')
      .addSelect('p.name', 'name')
      .addSelect('p.icon', 'icon')
      .addSelect('p.category', 'category')
      .addSelect('p.payload', 'payload')
      .addSelect('p.description', 'description')
      .where('o.user_id = :uid', { uid: user.id })
      .orderBy('o.created_at', 'DESC')
      .getRawMany();
    return { orders: rows };
  }

  // ---- GET /api/mall/inventory ----
  async inventory(user: User) {
    const rows: { payload: string; c: string }[] = await this.orders
      .createQueryBuilder('o')
      .innerJoin(Product, 'p', 'p.id = o.product_id')
      .select('p.payload', 'payload')
      .addSelect('COUNT(*)', 'c')
      .where("o.user_id = :uid AND p.category = 'item' AND o.used = 0", {
        uid: user.id,
      })
      .groupBy('p.payload')
      .getRawMany();
    const inventory: Record<string, number> = {};
    for (const r of rows) inventory[r.payload] = Number(r.c);
    return { inventory };
  }

  // ---- GET /api/mall/admin/orders —— 管理员：兑换记录(近50) + 汇总(总兑换/消耗积分)。其他类商品标记待发放 ----
  async adminOrders(user: User) {
    if (user.role !== 'admin') throw new ForbiddenException('无权操作');
    const rows = await this.orders.find({ order: { id: 'DESC' }, take: 50 });
    const uIds = [...new Set(rows.map((o) => o.user_id))];
    const pIds = [...new Set(rows.map((o) => o.product_id))];
    const us = uIds.length ? await this.users.find({ where: { id: In(uIds) } }) : [];
    const ps = pIds.length ? await this.products.find({ where: { id: In(pIds) } }) : [];
    const umap = new Map(us.map((u) => [u.id, u]));
    const pmap = new Map(ps.map((p) => [p.id, p]));
    const total = await this.orders.count();
    const sumRaw = await this.orders.createQueryBuilder('o').select('COALESCE(SUM(o.price),0)', 's').getRawOne();
    return {
      stats: { total, pointsSpent: Number(sumRaw?.s || 0) },
      orders: rows.map((o) => {
        const u = umap.get(o.user_id);
        const p = pmap.get(o.product_id);
        return {
          id: o.id,
          user: u ? { id: u.id, nickname: u.nickname, username: u.username } : null,
          product: p ? { name: p.name, category: p.category, icon: p.icon, payload: p.payload, description: p.description } : null,
          price: o.price,
          used: o.used,
          createdAt: o.created_at,
        };
      }),
    };
  }

  // ---- POST /api/mall/products/:id/redeem ----
  async redeem(id: number, user: User) {
    const p = await this.products.findOne({ where: { id } });
    if (!p) throw new NotFoundException('商品不存在');
    if (p.stock >= 0 && p.sold >= p.stock)
      throw new BadRequestException('已售罄');
    const existing = await this.orders.findOne({
      where: { user_id: user.id, product_id: p.id },
    });
    if (existing && p.category !== 'item')
      throw new BadRequestException('你已拥有该商品');
    const u = await this.helpers.getUser(user.id);
    if ((u?.points ?? 0) < p.price)
      throw new HttpException('积分不足', 402);

    await this.dataSource.transaction(async (mgr) => {
      await mgr.decrement(User, { id: u!.id }, 'points', p.price);
      await mgr.increment(Product, { id: p.id }, 'sold', 1);
      await mgr.insert(Order, {
        user_id: u!.id,
        product_id: p.id,
        price: p.price,
        created_at: this.helpers.nowSql(),
      });
      if (p.category === 'title' && p.payload)
        await mgr.update(User, { id: u!.id }, { title: p.payload });
      if (p.category === 'frame' && p.payload)
        await mgr.update(User, { id: u!.id }, { avatar_frame: p.payload });
    });
    await this.helpers.notify({
      userId: u!.id,
      actorId: null,
      type: 'system',
      preview: `兑换成功：${p.name} 🎉`,
    });
    return {
      ok: true,
      user: await this.helpers.publicUser(
        await this.helpers.getUser(u!.id),
        u!.id,
      ),
    };
  }
}
