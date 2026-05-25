import VLoader from '@/components/loaders/VLoader';
import { GoogleLogoIcon } from '@/components/auth/SocialAuthIcons';

type GoogleSignInButtonProps = {
  label?: string;
  loading?: boolean;
  disabled?: boolean;
  onClick: () => void;
  testId?: string;
};

export default function GoogleSignInButton({
  label = 'Continue with Google',
  loading = false,
  disabled = false,
  onClick,
  testId,
}: GoogleSignInButtonProps) {
  return (
    <button
      type="button"
      data-testid={testId}
      disabled={disabled || loading}
      onClick={onClick}
      className="auth-social-btn flex w-full items-center justify-center gap-3 rounded-xl py-3 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60"
    >
      {loading ? (
        <VLoader size={16} phase="loading" showLabel={false} />
      ) : (
        <GoogleLogoIcon />
      )}
      <span className="transition-colors group-hover:text-[#D4AF37]">{loading ? 'Opening Google...' : label}</span>
    </button>
  );
}
