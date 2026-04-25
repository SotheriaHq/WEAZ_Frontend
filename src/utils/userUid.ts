const FNV_OFFSET_BASIS = 2166136261;
const FNV_PRIME = 16777619;

function hashSeed(input: string): number {
  let hash = FNV_OFFSET_BASIS;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, FNV_PRIME);
  }
  return hash >>> 0;
}

function nextDigit(state: number): [number, number] {
  const next = (Math.imul(state, 1664525) + 1013904223) >>> 0;
  return [next % 10, next];
}

export function generateUserUid(userId: string, firstName?: string | null): string {
  const initialRaw = (firstName ?? '').trim().charAt(0).toUpperCase();
  const initial = /^[A-Z]$/.test(initialRaw) ? initialRaw : 'X';

  let state = hashSeed(`${userId}:${firstName ?? ''}`);
  let digits = '';
  for (let i = 0; i < 11; i += 1) {
    const [digit, nextState] = nextDigit(state);
    digits += String(digit);
    state = nextState;
  }

  return `VGL${initial}${digits}`;
}
