import { validatePassword } from '@/utils/passwordValidation';

describe('validatePassword', () => {
  it('accepts a strong password', () => {
    const result = validatePassword('Str0ng!Pass');
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects a password shorter than 8 characters', () => {
    const result = validatePassword('Ab1!');
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('At least 8 characters');
  });

  it('rejects a password without an uppercase letter', () => {
    const result = validatePassword('nouppercase1!');
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('One uppercase letter');
  });

  it('rejects a password without a lowercase letter', () => {
    const result = validatePassword('NOLOWER123!');
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('One lowercase letter');
  });

  it('rejects a password without a number', () => {
    const result = validatePassword('NoNumber!!');
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('One number');
  });

  it('rejects a password without a special character', () => {
    const result = validatePassword('NoSpecial123');
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('One special character');
  });

  it('returns multiple errors for a very weak password', () => {
    const result = validatePassword('abc');
    expect(result.isValid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(3);
  });
});
