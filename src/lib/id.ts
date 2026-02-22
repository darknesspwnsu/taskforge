export function createUuid(): string {
  if (typeof globalThis.crypto !== 'undefined' && typeof globalThis.crypto.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }

  const hex = '0123456789abcdef';
  const chars = Array.from({ length: 36 }, (_, index) => {
    if ([8, 13, 18, 23].includes(index)) {
      return '-';
    }

    if (index === 14) {
      return '4';
    }

    if (index === 19) {
      return hex[(Math.random() * 4 + 8) | 0];
    }

    return hex[(Math.random() * 16) | 0];
  });

  return chars.join('');
}

export function createClientActionId(prefix: string): string {
  return `${prefix}-${createUuid()}`;
}
