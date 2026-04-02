export function createId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-5)}`;
}
