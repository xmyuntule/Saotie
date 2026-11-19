import 'reflect-metadata';
import { expect, test, vi } from 'vitest';
import { MessagesService } from '../src/modules/messages/messages.service';

function setup(rows: any[]) {
  const qb = {
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    getMany: vi.fn().mockResolvedValue(rows),
  };
  const messages = { createQueryBuilder: () => qb, update: vi.fn().mockResolvedValue({ affected: 1 }) };
  const helpers = { getUser: vi.fn(async (id) => ({ id })), publicUser: vi.fn(async (user) => user) };
  const service = new MessagesService(messages as any, {} as any, {} as any, {} as any, helpers as any, {} as any);
  return { service, qb, messages };
}

test('read receipts acknowledge only received messages present in the latest snapshot', async () => {
  const { service, qb, messages } = setup([
    { id: 203, sender_id: 2, receiver_id: 1, read: 0 },
    { id: 202, sender_id: 1, receiver_id: 2, read: 0 },
    { id: 201, sender_id: 2, receiver_id: 1, read: 1 },
  ]);
  const result = await service.thread({ id: 1 } as any, 2);
  expect(qb.orderBy).toHaveBeenCalledWith('m.id', 'DESC');
  expect(qb.limit).toHaveBeenCalledWith(200);
  expect(result.messages.map((m) => m.id)).toEqual([201, 202, 203]);
  const criteria = messages.update.mock.calls[0][0] as any;
  expect(criteria.id.value).toEqual([203]); // A later arrival (204) must remain unread.
  expect(criteria).toMatchObject({ sender_id: 2, receiver_id: 1, read: 0 });
  expect(result.messages.map((m) => m.read)).toEqual([1, 0, 1]);
});

test('fetching outgoing messages never marks them read on behalf of the recipient', async () => {
  const { service, messages } = setup([{ id: 20, sender_id: 1, receiver_id: 2, read: 0 }]);
  const result = await service.thread({ id: 1 } as any, 2);
  expect(messages.update).not.toHaveBeenCalled();
  expect(result.messages[0].read).toBe(0);
});
