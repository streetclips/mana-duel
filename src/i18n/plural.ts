export function plural<T extends string>(amount: number, one: T, many: T): T {
  return amount === 1 ? one : many;
}

export function count(amount: number, one: string, many: string): string {
  return `${amount} ${plural(amount, one, many)}`;
}
