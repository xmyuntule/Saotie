/**
 * 新用户默认头像（spec 03 §3.5）。
 *
 * 默认返回空串 → 前端 Avatar 组件会按昵称确定性渲染「首字母 + 渐变色」的本地头像，
 * 零外部依赖。此前写死 `i.pravatar.cc` 外链，该域在大陆（主要受众）不稳，挂掉时新用户
 * 头像会闪一下裂图（虽有 onError 兜底，但依赖外链本就不必要）。
 *
 * 想沿用外部随机头像的部署可设 `AVATAR_PROVIDER=pravatar` 切回。
 */
export function defaultAvatar(
  username: string,
  provider: string | undefined = process.env.AVATAR_PROVIDER,
): string {
  if (provider === 'pravatar') {
    return `https://i.pravatar.cc/240?u=${encodeURIComponent(username)}`;
  }
  return '';
}
