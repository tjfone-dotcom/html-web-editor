import { useEditorStore } from '../store/editorStore';
import { translations } from './translations';

type EnTranslations = typeof translations['en'];

export function useT() {
  const locale = useEditorStore((s) => s.locale);
  // Cast to 'en' shape — all locales share identical keys
  const dict = translations[locale] as EnTranslations;

  return function t<K extends keyof EnTranslations>(
    key: K,
    ...args: EnTranslations[K] extends (...a: infer A) => string ? A : []
  ): string {
    const val = dict[key];
    if (typeof val === 'function') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (val as (...a: any[]) => string)(...args);
    }
    return val as string;
  };
}
