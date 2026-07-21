/**
 * 新用户默认头像（spec 03 §3.5）。
 *
 * 默认返回空串 → 前端 Avatar 组件会按昵称确定性渲染「首字母 + 渐变色」的本地头像，
 * 零外部依赖。此前写死外部随机头像服务，该域不稳定且可能被跨域策略拦截，
 * 头像会闪一下裂图（虽有 onError 兜底，但依赖外链本就不必要）。
 */
export function defaultAvatar(_username: string, _provider?: string): string {
  return '';
}
