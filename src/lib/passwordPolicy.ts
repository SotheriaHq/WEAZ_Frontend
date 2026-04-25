export const PASSWORD_POLICY_MIN_LENGTH = 12;

export const PASSWORD_POLICY_HINT =
  'Use at least 12 characters. Longer passphrases are better, and avoid common or personal words.';

export const getPasswordLength = (password: string): number => Array.from(password).length;

export const isPasswordLengthValid = (password: string): boolean =>
  getPasswordLength(password) >= PASSWORD_POLICY_MIN_LENGTH;

export const getPasswordPolicyErrorMessage = (label = 'Password'): string =>
  `${label} must be at least ${PASSWORD_POLICY_MIN_LENGTH} characters long.`;
