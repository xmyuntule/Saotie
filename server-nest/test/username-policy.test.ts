import { describe, expect, test } from 'vitest';
import {
  BUILTIN_RESERVED_USERNAMES,
  isReservedUsername,
  parseCustomReservedUsernames,
  usernameRuleText,
} from '../src/modules/auth/username-policy';

describe('username registration policy', () => {
  test('built-in reserved names are case-insensitive', () => {
    expect(BUILTIN_RESERVED_USERNAMES).toContain('admin');
    expect(isReservedUsername('Admin')).toBe(true);
    expect(isReservedUsername('platform_staff')).toBe(false);
  });

  test('custom names accept common separators and deduplicate', () => {
    expect(parseCustomReservedUsernames('support_team, editor\neditor')).toEqual(['support_team', 'editor']);
    expect(isReservedUsername('Editor', 'support_team, editor')).toBe(true);
  });

  test('rule text reflects the configured minimum length', () => {
    expect(usernameRuleText(6)).toContain('6-20');
  });
});
