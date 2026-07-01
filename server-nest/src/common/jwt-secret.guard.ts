/**
 * JWT 密钥安全守卫（单一事实来源）。
 *
 * 背景：未设 JWT_SECRET 时，配置会回退到这个「公开仓库可见」的开发占位串。用它签发的令牌
 * 任何人都能伪造（含 role:'admin'）→ 完全认证绕过。曾因线上漏配 JWT_SECRET 而中招（已修）。
 * 故：启动时若解析出的密钥仍是该占位串，且未显式设 ALLOW_INSECURE_JWT_SECRET=true（仅供本地
 * 开发的逃生阀），则拒绝启动（fail-fast），避免任何部署「静默」以不安全密钥运行。
 */
export const DEV_JWT_PLACEHOLDER = 'hahasns-dev-secret-change-me';

/** 解析后的 JWT 密钥是否「不安全」（= 空/占位串 且 未显式放行）→ true 表示应拒绝启动。 */
export function isInsecureJwtSecret(
  secret: string | undefined | null,
  allowInsecure: string | undefined | null,
): boolean {
  const usingPlaceholder = !secret || secret === DEV_JWT_PLACEHOLDER;
  return usingPlaceholder && allowInsecure !== 'true';
}
