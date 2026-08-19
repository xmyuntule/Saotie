export const USERNAME_MAX_LENGTH = 20;
export const DEFAULT_REGISTER_MIN_USERNAME_LENGTH = 4;

// These names are always reserved because they can be mistaken for platform staff.
export const BUILTIN_RESERVED_USERNAMES = [
  'admin',
  'administrator',
  'root',
  'system',
  'support',
  'service',
  'staff',
  'moderator',
  'official',
  'saotie',
  'saotiesns',
];

export const USERNAME_FORMAT_RE = new RegExp(
  `^[A-Za-z0-9_]{2,${USERNAME_MAX_LENGTH}}$`,
);

export function normalizeUsername(value: string): string {
  return String(value || '').trim().toLowerCase();
}

export function parseCustomReservedUsernames(raw: string | null | undefined): string[] {
  return String(raw || '')
    .split(/[\s,，、;；]+/)
    .map(normalizeUsername)
    .filter((name, index, list) => (
      USERNAME_FORMAT_RE.test(name) && list.indexOf(name) === index
    ));
}

export function isReservedUsername(
  username: string,
  customReserved = '',
): boolean {
  const name = normalizeUsername(username);
  if (BUILTIN_RESERVED_USERNAMES.includes(name)) return true;
  return parseCustomReservedUsernames(customReserved).includes(name);
}

export function usernameRuleText(minLength: number): string {
  return `用户名需为 ${minLength}-${USERNAME_MAX_LENGTH} 位字母、数字或下划线`;
}
