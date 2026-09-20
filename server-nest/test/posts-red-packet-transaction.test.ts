import 'reflect-metadata';
import { describe, expect, test, vi } from 'vitest';
import { Post, RedPacket } from '../src/database/entities';
import { PostsService } from '../src/modules/posts/posts.service';

describe('PostsService red packet escrow transaction', () => {
  test('rolls post and packet back when the atomic point debit loses a balance race', async () => {
    const state: any = { posts: [], packets: [] };
    const debitCalls: any[] = [];
    const postRepo = {
      create: (value: any) => value,
      save: async (value: any) => {
        const saved = { id: 101, ...value };
        state.posts.push(saved);
        return saved;
      },
    };
    const packetRepo = {
      create: (value: any) => value,
      save: async (value: any) => {
        const saved = { id: 202, ...value };
        state.packets.push(saved);
        return saved;
      },
    };
    const manager: any = {
      getRepository: (entity: any) => entity === Post ? postRepo : entity === RedPacket ? packetRepo : null,
      query: async () => undefined,
    };
    const dataSource = {
      query: async () => [],
      transaction: async (work: (tx: any) => Promise<any>) => {
        const snapshot = { posts: [...state.posts], packets: [...state.packets] };
        try {
          return await work(manager);
        } catch (error) {
          state.posts = snapshot.posts;
          state.packets = snapshot.packets;
          throw error;
        }
      },
    };
    const helpers = {
      parseTopics: () => [],
      getUser: async () => ({ id: 7, points: 100 }),
      nowSql: () => '2026-09-20 00:00:00',
      adjustPoints: async (...args: any[]) => {
        debitCalls.push(args);
        return null;
      },
      award: vi.fn(),
    };
    const svc = new PostsService(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      { findOne: async () => null } as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      helpers as any,
      {} as any,
      dataSource as any,
      { enforce: async () => undefined } as any,
      {} as any,
      {} as any,
    );

    await expect(svc.create(
      { id: 7 } as any,
      { content: '红包测试', redPacket: { points: 50, count: 5, blessing: '好运' } },
    )).rejects.toThrow('积分不足，发 50 积分红包需要这么多积分');

    expect(state.posts).toHaveLength(0);
    expect(state.packets).toHaveLength(0);
    expect(helpers.award).not.toHaveBeenCalled();
    expect(debitCalls).toHaveLength(1);
    expect(debitCalls[0][1]).toBe(-50);
    expect(debitCalls[0][5]).toEqual({ manager, requireSufficient: true });
  });
});
