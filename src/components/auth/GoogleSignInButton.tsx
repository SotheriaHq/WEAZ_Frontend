import { GoogleLogoIcon } from '@/components/auth/SocialAuthIcons';
import { MuseLoader } from '@/components/loaders/MuseLoader';

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
        <span data-testid="google-button-loader" className="inline-flex shrink-0 text-[#D4AF37]">
          {/* `current` so the mark takes the sheet's gold rather than the
              system violet, which is barely visible on this button's ground. */}
          <MuseLoader size={20} tone="current" label="Signing in" />
        </span>
      ) : (
        <GoogleLogoIcon />
      )}
      <span className="min-w-0 transition-colors group-hover:text-[#D4AF37]">{label}</span>
    </button>
  );
}
