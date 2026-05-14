export const PASSWORD_POLICY_MIN_LENGTH = 12;

export const PASSWORD_POLICY_HINT =
  'Use at least 12 characters. Longer passphrases are better, and avoid common or personal words.';

export const getPasswordLength = (password: string): number => Array.from(password).length;

export const isPasswordLengthValid = (password: string): boolean =>
  getPasswordLength(password) >= PASSWORD_POLICY_MIN_LENGTH;

export const getPasswordPolicyErrorMessage = (label = 'Password'): string =>
  `${label} must be at least ${PASSWORD_POLICY_MIN_LENGTH} characters long.`;

export const hasUppercase = (password: string): boolean => /[A-Z]/.test(password);
export const hasNumber = (password: string): boolean => /\d/.test(password);
export const hasSpecialChar = (password: string): boolean =>
  /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/.test(password);

export type PasswordStrength = 'weak' | 'fair' | 'strong' | 'very-strong';

export const getPasswordStrength = (password: string): PasswordStrength => {
  if (!password) return 'weak';
  let score = 0;
  if (isPasswordLengthValid(password)) score++;
  if (hasUppercase(password)) score++;
  if (hasNumber(password)) score++;
  if (hasSpecialChar(password)) score++;
  if (getPasswordLength(password) >= 16) score++; // bonus for extra length
  if (score <= 1) return 'weak';
  if (score === 2) return 'fair';
  if (score === 3) return 'strong';
  return 'very-strong';
};

export const PASSWORD_REQUIREMENTS = [
  { key: 'length', label: `At least ${PASSWORD_POLICY_MIN_LENGTH} characters`, check: isPasswordLengthValid },
  { key: 'uppercase', label: 'At least one uppercase letter', check: hasUppercase },
  { key: 'number', label: 'At least one number', check: hasNumber },
  { key: 'special', label: 'At least one special character', check: hasSpecialChar },
] as const;

export const allRequirementsMet = (password: string): boolean =>
  PASSWORD_REQUIREMENTS.every((req) => req.check(password));
