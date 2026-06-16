import { Router } from 'express';
import db from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { getUser, publicUser, notify } from '../helpers.js';

const router = Router();

function serializeProduct(p, userId) {
  const owned = userId ? !!db.prepare('SELECT 1 FROM orders WHERE user_id=? AND product_id=?').get(userId, p.id) : false;
  return {
    id: p.id, name: p.name, description: p.description, icon: p.icon,
    category: p.category, payload: p.payload, price: p.price,
    stock: p.stock, sold: p.sold, owned,
    soldOut: p.stock >= 0 && p.sold >= p.stock,
  };
}

router.get('/products', (req, res) => {
  const rows = db.prepare('SELECT * FROM products ORDER BY price ASC').all();
  res.json({ products: rows.map(p => serializeProduct(p, req.user?.id)) });
});

router.get('/orders', requireAuth, (req, res) => {
  const rows = db.prepare(`SELECT o.*, p.name, p.icon, p.category FROM orders o JOIN products p ON p.id=o.product_id
    WHERE o.user_id=? ORDER BY o.created_at DESC`).all(req.user.id);
  res.json({ orders: rows });
});

// Unused consumable items (改名卡/置顶卡) keyed by payload, e.g. { rename: 1 }
router.get('/inventory', requireAuth, (req, res) => {
  const rows = db.prepare(`SELECT p.payload, COUNT(*) c FROM orders o JOIN products p ON p.id=o.product_id
    WHERE o.user_id=? AND p.category='item' AND o.used=0 GROUP BY p.payload`).all(req.user.id);
  const inventory = {};
  for (const r of rows) inventory[r.payload] = r.c;
  res.json({ inventory });
});

router.post('/products/:id/redeem', requireAuth, (req, res) => {
  const p = db.prepare('SELECT * FROM products WHERE id=?').get(req.params.id);
  if (!p) return res.status(404).json({ error: '商品不存在' });
  if (p.stock >= 0 && p.sold >= p.stock) return res.status(400).json({ error: '已售罄' });
  if (db.prepare('SELECT 1 FROM orders WHERE user_id=? AND product_id=?').get(req.user.id, p.id) && p.category !== 'item')
    return res.status(400).json({ error: '你已拥有该商品' });
  const u = getUser(req.user.id);
  if (u.points < p.price) return res.status(402).json({ error: '积分不足' });

  const tx = db.transaction(() => {
    db.prepare('UPDATE users SET points = points - ? WHERE id=?').run(p.price, u.id);
    db.prepare('UPDATE products SET sold = sold + 1 WHERE id=?').run(p.id);
    db.prepare('INSERT INTO orders (user_id, product_id, price) VALUES (?,?,?)').run(u.id, p.id, p.price);
    // equip a title / avatar frame immediately
    if (p.category === 'title' && p.payload) db.prepare('UPDATE users SET title=? WHERE id=?').run(p.payload, u.id);
    if (p.category === 'frame' && p.payload) db.prepare('UPDATE users SET avatar_frame=? WHERE id=?').run(p.payload, u.id);
  });
  tx();
  notify({ userId: u.id, actorId: null, type: 'system', preview: `兑换成功：${p.name} 🎉` });
  res.json({ ok: true, user: publicUser(getUser(u.id), u.id) });
});

export default router;
