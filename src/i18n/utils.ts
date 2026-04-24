import { ui, defaultLang, type Lang, type UIKey } from './ui';

export function getLangFromUrl(url: URL): Lang {
  const [, maybeLang] = url.pathname.split('/');
  if (maybeLang === 'en') return 'en';
  return defaultLang;
}

export function useTranslations(lang: Lang) {
  return function t(key: UIKey): string {
    return (ui[lang] as any)[key] ?? (ui[defaultLang] as any)[key] ?? key;
  };
}

export function localePath(lang: Lang, path: string): string {
  const clean = path.startsWith('/') ? path : `/${path}`;
  if (lang === defaultLang) return clean === '/' ? '/' : clean;
  return `/en${clean === '/' ? '' : clean}`;
}

export function otherLang(lang: Lang): Lang {
  return lang === 'es' ? 'en' : 'es';
}

export function formatDate(d: Date, lang: Lang): string {
  return d.toLocaleDateString(lang === 'es' ? 'es-ES' : 'en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
}
