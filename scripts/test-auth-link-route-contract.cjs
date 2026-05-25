const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..');

const read = (relativePath) =>
  fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

function assertIncludes(source, expected, message) {
  assert.ok(
    source.includes(expected),
    `${message}\nExpected to find: ${expected}`,
  );
}

function main() {
  const appSource = read('src/App.tsx');
  const resetSource = read('src/pages/ResetPasswordPage.tsx');
  const verifySource = read('src/pages/EmailVerify.tsx');
  const changeEmailConfirmSource = read('src/pages/ChangeEmailConfirmPage.tsx');
  const forgotSource = read('src/pages/ForgotPasswordPage.tsx');
  const accountSecuritySource = read(
    'src/components/settings/tabs/AccountSecuritySettings.tsx',
  );
  const authApiSource = read('src/api/AuthApi.ts');
  const loginSource = read('src/pages/Login.tsx');
  const signupSource = read('src/pages/SignUp.tsx');
  const googleIdentitySource = read('src/auth/googleIdentity.ts');
  const googleButtonSource = read('src/components/auth/GoogleSignInButton.tsx');
  const socialIconsSource = read('src/components/auth/SocialAuthIcons.tsx');
  const envSource = read('.env.example');

  assertIncludes(appSource, "path: '/forgot-password'", 'Forgot-password route must be registered.');
  assertIncludes(appSource, "path: '/reset-password'", 'Reset-password route must be registered.');
  assertIncludes(appSource, "path: '/verify-email'", 'Verify-email route must be registered.');
  assertIncludes(appSource, "path: '/change-email/confirm'", 'Email-change confirmation route must be registered.');
  assertIncludes(appSource, "path: '/admin/reset-password'", 'Admin reset-password route must be registered.');
  assertIncludes(appSource, "path: '/brand/staff/invite'", 'Brand staff invite route must be registered.');

  const verifyRouteIndex = appSource.indexOf("path: '/verify-email'");
  const guestRouteIndex = appSource.indexOf('element: <GuestRoute />');
  const protectedRouteIndex = appSource.indexOf('element: <ProtectedRoute />');
  assert.ok(verifyRouteIndex >= 0, 'Verify-email route must be present.');
  assert.ok(
    verifyRouteIndex < guestRouteIndex,
    'Verify-email must remain outside the guest-only auth route group.',
  );
  assert.ok(
    protectedRouteIndex < 0 || verifyRouteIndex < protectedRouteIndex,
    'Verify-email must remain outside the protected route group.',
  );

  const changeEmailRouteIndex = appSource.indexOf("path: '/change-email/confirm'");
  assert.ok(changeEmailRouteIndex >= 0, 'Email-change confirmation route must be present.');
  assert.ok(
    changeEmailRouteIndex < guestRouteIndex,
    'Email-change confirmation must remain outside the guest-only route group.',
  );
  assert.ok(
    protectedRouteIndex < 0 || changeEmailRouteIndex < protectedRouteIndex,
    'Email-change confirmation must remain outside the protected route group.',
  );

  assert.match(
    resetSource,
    /searchParams\.get\('token'\)\?\.trim\(\)/,
    'Reset-password must trim the query token.',
  );
  assert.match(
    resetSource,
    /AuthApi\.confirmPasswordReset\(\{\s*token,\s*newPassword,/s,
    'Reset-password must submit the route token to AuthApi.confirmPasswordReset.',
  );
  assert.match(
    resetSource,
    /window\.history\.replaceState\(\{\},\s*document\.title,\s*'\/reset-password'\)/,
    'Reset-password success must remove the token from browser history.',
  );
  assert.match(
    resetSource,
    /to="\/login"/,
    'Reset-password success must route the user back to login.',
  );
  assert.doesNotMatch(
    resetSource,
    /\b(useAuth|signIn|login\s*\()/,
    'Reset-password must not automatically log the user in.',
  );

  assert.match(
    verifySource,
    /searchParams\.get\('token'\)\?\.trim\(\)/,
    'Verify-email must trim the query token.',
  );
  assert.match(
    verifySource,
    /apiClient\.get\('\/auth\/verify-email'/,
    'Verify-email must call the backend verification endpoint.',
  );
  assert.match(
    verifySource,
    /sanitizeNextPath/,
    'Verify-email must sanitize next-route handling.',
  );

  assert.match(
    changeEmailConfirmSource,
    /searchParams\.get\('token'\)\?\.trim\(\)/,
    'Email-change confirmation must trim the query token.',
  );
  assert.match(
    changeEmailConfirmSource,
    /AuthApi\.confirmEmailChange\(token\)/,
    'Email-change confirmation must call AuthApi.confirmEmailChange with the route token.',
  );
  assert.match(
    changeEmailConfirmSource,
    /window\.history\.replaceState\(\{\},\s*document\.title,\s*'\/change-email\/confirm'\)/,
    'Email-change confirmation must remove the token from browser history.',
  );
  assert.doesNotMatch(
    changeEmailConfirmSource,
    /console\.(log|warn|error).*token/,
    'Email-change confirmation must not log raw tokens.',
  );

  assert.match(
    forgotSource,
    /AuthApi\.requestPasswordReset/,
    'Forgot-password must call the password reset request API.',
  );
  assert.match(
    forgotSource,
    /setSubmitted\(true\)/,
    'Forgot-password must preserve a generic submitted state.',
  );

  assert.match(
    accountSecuritySource,
    /searchParams\.get\('emailChangeToken'\)/,
    'Account security must read emailChangeToken from the URL.',
  );
  assert.match(
    accountSecuritySource,
    /rawToken\?\.trim\(\)/,
    'Account security must trim emailChangeToken before submit.',
  );
  assert.match(
    accountSecuritySource,
    /next\.delete\('emailChangeToken'\)/,
    'Account security must remove emailChangeToken from URL history.',
  );
  assert.match(
    accountSecuritySource,
    /setSearchParams\(next,\s*\{\s*replace:\s*true\s*\}\)/,
    'Account security must replace URL history when removing emailChangeToken.',
  );

  assertIncludes(envSource, 'VITE_API_BASE_URL=', 'Frontend env example must document API base URL.');
  assertIncludes(envSource, 'VITE_APP_URL=', 'Frontend env example must document web app URL.');
  assertIncludes(
    envSource,
    'VITE_API_WITH_CREDENTIALS=',
    'Frontend env example must document credential mode.',
  );

  assertIncludes(
    envSource,
    'VITE_GOOGLE_CLIENT_ID=<google-web-client-id>',
    'Frontend env example must document the public Google web client ID placeholder.',
  );
  assertIncludes(
    authApiSource,
    "'/auth/google'",
    'AuthApi must expose the backend Google auth endpoint.',
  );
  assertIncludes(
    authApiSource,
    "'/auth/login-options'",
    'AuthApi must expose the progressive login-options endpoint.',
  );
  assertIncludes(
    authApiSource,
    "'/auth/email-login-code/request'",
    'AuthApi must expose password-setup email code request.',
  );
  assertIncludes(
    authApiSource,
    "'/auth/email-login-code/confirm'",
    'AuthApi must expose password-setup email code confirmation.',
  );
  assertIncludes(
    authApiSource,
    "'/auth/password/setup'",
    'AuthApi must expose Google-only password setup.',
  );
  assertIncludes(
    loginSource,
    'AuthApi.getLoginOptions',
    'Login must resolve sign-in methods through login-options.',
  );
  assertIncludes(
    loginSource,
    'requestPasswordSetupCode',
    'Login must include the Google-only password setup email-code path.',
  );
  assertIncludes(
    loginSource,
    'AuthApi.setupPassword',
    'Login must submit the first-password setup token to the backend.',
  );
  assertIncludes(
    loginSource,
    'requestGoogleIdToken',
    'Login must request a Google ID token before backend Google auth.',
  );
  assertIncludes(
    signupSource,
    'AuthApi.googleAuth',
    'Signup must send Google ID tokens to the backend Google auth endpoint.',
  );
  assertIncludes(
    signupSource,
    'signup-google-button',
    'Signup must render the Google signup action.',
  );
  assertIncludes(
    googleIdentitySource,
    'https://accounts.google.com/gsi/client',
    'Web Google auth must use Google Identity Services.',
  );
  assertIncludes(
    googleIdentitySource,
    'VITE_GOOGLE_CLIENT_ID matches the Google Console Web client',
    'Web Google auth must explain Google Console client ID mismatches.',
  );
  assertIncludes(
    googleIdentitySource,
    'window.location.origin',
    'Web Google diagnostics must log the current origin in development.',
  );
  assertIncludes(
    socialIconsSource,
    'export function GoogleLogoIcon',
    'Web auth social buttons must use a reusable Google SVG icon.',
  );
  assertIncludes(
    socialIconsSource,
    'export function AppleLogoIcon',
    'Web auth social buttons must use a reusable Apple SVG icon.',
  );
  assertIncludes(
    socialIconsSource,
    'fill="#4285F4"',
    'Web Google icon must use brand-color SVG paths.',
  );
  assertIncludes(
    googleButtonSource,
    '<GoogleLogoIcon />',
    'Web Google button must render the proper Google SVG icon.',
  );
  assertIncludes(
    loginSource,
    '<AppleLogoIcon />',
    'Web login Apple button must render an SVG icon, not emoji.',
  );
  assertIncludes(
    signupSource,
    '<AppleLogoIcon />',
    'Web signup Apple button must render an SVG icon, not emoji.',
  );
  assert.doesNotMatch(
    [loginSource, signupSource, googleButtonSource, socialIconsSource].join('\n'),
    /\u{1F34E}/u,
    'Web auth social buttons must not use the Apple emoji.',
  );
  assert.doesNotMatch(
    [
      envSource,
      authApiSource,
      loginSource,
      signupSource,
      googleIdentitySource,
      googleButtonSource,
      socialIconsSource,
    ].join('\n'),
    /GOOGLE_CLIENT_SECRET|google-client-secret|client_secret/i,
    'Frontend source and env example must not contain a Google client secret.',
  );
}

main();
