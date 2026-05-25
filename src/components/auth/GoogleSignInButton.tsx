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
      aria-busy={loading}
      className="auth-social-btn flex min-h-14 w-full items-center justify-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60"
    >
      {loading ? (
        <span
          data-testid="google-button-loader"
          className="h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-white/25 border-t-[#D4AF37]"
          aria-hidden="true"
        />
      ) : (
        <GoogleLogoIcon />
      )}
      <span className="min-w-0 transition-colors group-hover:text-[#D4AF37]">{label}</span>
    </button>
  );
}
