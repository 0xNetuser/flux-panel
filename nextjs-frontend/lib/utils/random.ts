/**
 * Random utility functions matching 3x-ui RandomUtil style.
 */

/** Generate a random sequence of characters */
export function randomSeq(count: number, options?: {
  type?: 'hex';
  hasNumbers?: boolean;
  hasLowercase?: boolean;
  hasUppercase?: boolean;
}): string {
  if (options?.type === 'hex') {
    const arr = new Uint8Array(Math.ceil(count / 2));
    crypto.getRandomValues(arr);
    return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('').slice(0, count);
  }

  let chars = '';
  if (options?.hasNumbers !== false) chars += '0123456789';
  if (options?.hasLowercase !== false) chars += 'abcdefghijklmnopqrstuvwxyz';
  if (options?.hasUppercase) chars += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

  if (!chars) chars = '0123456789abcdefghijklmnopqrstuvwxyz';

  const arr = new Uint8Array(count);
  crypto.getRandomValues(arr);
  return Array.from(arr).map(b => chars[b % chars.length]).join('');
}

/** Generate 8 short IDs of different lengths (2,4,6,8,10,12,14,16), comma-separated — matching 3x-ui */
export function randomShortIds(): string {
  const lengths = [2, 4, 6, 8, 10, 12, 14, 16];
  // Shuffle lengths
  for (let i = lengths.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [lengths[i], lengths[j]] = [lengths[j], lengths[i]];
  }
  return lengths.map(len => randomSeq(len, { type: 'hex' })).join(',');
}

/** Generate a random lowercase + number string */
export function randomLowerAndNum(len: number): string {
  return randomSeq(len, { hasNumbers: true, hasLowercase: true, hasUppercase: false });
}

/** Generate a random UUID */
export function randomUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/** Generate Shadowsocks 2022 password — base64 of random bytes (16 or 32 depending on method) */
export function randomShadowsocksPassword(method?: string): string {
  let byteLength = 32; // default for aes-256-gcm, chacha20
  if (method?.includes('aes-128')) {
    byteLength = 16;
  }
  const arr = new Uint8Array(byteLength);
  crypto.getRandomValues(arr);
  // Convert to base64
  const binary = String.fromCharCode(...arr);
  return btoa(binary);
}

/** Generate a random integer in [min, max] (inclusive) */
export function randomInteger(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** Generate a random hex string of specified length */
export function randomHex(len: number): string {
  return randomSeq(len, { type: 'hex' });
}

/** Predefined Reality target domains for random selection */
const REALITY_TARGETS = [
  'www.microsoft.com',
  'www.apple.com',
  'www.amazon.com',
  'www.google.com',
  'www.samsung.com',
  'www.nvidia.com',
  'www.amd.com',
  'www.intel.com',
  'www.cisco.com',
  'www.oracle.com',
  'www.mozilla.org',
  'www.cloudflare.com',
  'www.digitalocean.com',
  'www.linode.com',
  'www.github.com',
  'www.docker.com',
];

/** Pick a random Reality target and server name */
export function randomRealityTarget(): { dest: string; serverNames: string } {
  const idx = Math.floor(Math.random() * REALITY_TARGETS.length);
  const domain = REALITY_TARGETS[idx];
  return {
    dest: `${domain}:443`,
    serverNames: domain,
  };
}
