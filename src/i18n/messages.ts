import { getLocale } from './locale';

export type Widen<T> = T extends string
  ? string
  : T extends (...args: infer A) => infer R
    ? (...args: A) => Widen<R>
    : T extends readonly (infer U)[]
      ? Widen<U>[]
      : T extends object
        ? { [K in keyof T]: Widen<T[K]> }
        : T;

export interface Translations<T> {
  es: T;
  en: NoInfer<Widen<T>>;
}

export function messages<T>(translations: Translations<T>): () => Widen<T> {
  return () => translations[getLocale()] as Widen<T>;
}
