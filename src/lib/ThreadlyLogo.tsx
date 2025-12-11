// React import not required with the new JSX transform

// Reusable voguely Logo Component
const voguelyLogo = ({ size = 40, className = "" }) => {
  return (
    <div className={`relative ${className}`} style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="drop-shadow-sm"
      >
        {/* Thread spool */}
        <ellipse cx="50" cy="70" rx="25" ry="8" fill="url(#woodGradient)" />
        <rect x="25" y="35" width="50" height="35" rx="2" fill="url(#woodGradient)" />
        <ellipse cx="50" cy="35" rx="25" ry="8" fill="url(#woodLightGradient)" />
        {/* Thread wrapping */}
        <path d="M28 40 Q50 38 72 40" stroke="url(#threadGradient)" strokeWidth="2" fill="none" />
        <path d="M28 45 Q50 43 72 45" stroke="url(#threadGradient)" strokeWidth="2" fill="none" />
        <path d="M28 50 Q50 48 72 50" stroke="url(#threadGradient)" strokeWidth="2" fill="none" />
        <path d="M28 55 Q50 53 72 55" stroke="url(#threadGradient)" strokeWidth="2" fill="none" />
        <path d="M28 60 Q50 58 72 60" stroke="url(#threadGradient)" strokeWidth="2" fill="none" />
        <path d="M28 65 Q50 63 72 65" stroke="url(#threadGradient)" strokeWidth="2" fill="none" />
        {/* Needle */}
        <line x1="65" y1="15" x2="65" y2="45" stroke="url(#needleGradient)" strokeWidth="1.5" />
        <circle cx="65" cy="18" r="3" fill="none" stroke="url(#needleGradient)" strokeWidth="1.5" />
        <path d="M64 45 L65 50 L66 45 Z" fill="url(#needleGradient)" />
        {/* Thread from needle */}
        <path d="M65 50 Q60 55 55 58" stroke="url(#threadGradient)" strokeWidth="1.5" fill="none" />
        {/* Gradients */}
        <defs>
          <linearGradient id="woodGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#D2B48C" />
            <stop offset="100%" stopColor="#8B7355" />
          </linearGradient>
          <linearGradient id="woodLightGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#F5DEB3" />
            <stop offset="100%" stopColor="#D2B48C" />
          </linearGradient>
          <linearGradient id="threadGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--brand-primary)" />
            <stop offset="100%" stopColor="var(--brand-primary-strong)" />
          </linearGradient>
          <linearGradient id="needleGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#E5E7EB" />
            <stop offset="100%" stopColor="#6B7280" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
};

export default voguelyLogo;
