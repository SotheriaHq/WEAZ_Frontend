const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const headersPath = path.join(root, 'public', '_headers');
const vercelPath = path.join(root, 'vercel.json');

const requiredHeaders = [
  'Content-Security-Policy',
  'X-Frame-Options',
  'Referrer-Policy',
  'Permissions-Policy',
  'X-Content-Type-Options',
];

const requiredCspTokens = [
  "default-src 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  'https://js.paystack.co',
  'https://checkout.paystack.com',
  'https://standard.paystack.co',
  'https://api.paystack.co',
];

function fail(message) {
  console.error(message);
  process.exitCode = 1;
}

function verify(label, text) {
  for (const header of requiredHeaders) {
    if (!text.includes(header)) fail(`${label} is missing ${header}`);
  }
  for (const token of requiredCspTokens) {
    if (!text.includes(token)) fail(`${label} CSP is missing ${token}`);
  }
  if (/script-src[^;\n]*\*/.test(text) || /connect-src[^;\n]*\*/.test(text)) {
    fail(`${label} CSP contains a broad wildcard in script-src or connect-src`);
  }
}

if (!fs.existsSync(headersPath)) fail('public/_headers is missing');
else verify('public/_headers', fs.readFileSync(headersPath, 'utf8'));

if (!fs.existsSync(vercelPath)) fail('vercel.json is missing');
else verify('vercel.json', JSON.stringify(JSON.parse(fs.readFileSync(vercelPath, 'utf8'))));

if (!process.exitCode) console.log('Security header configuration verified.');
