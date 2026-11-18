// Languages: the codes we store, their names, and the search behind "Add a language".
//
// A language is stored as a canonical code: a primary language subtag ("de", "en", "bs"), except
// where YouTube offers variants as separate subtitle languages (Chinese by script, European
// Portuguese). YouTube's own codes are mapped onto these by `canonical`, so "en-GB" captions count as
// English and YouTube's legacy "iw" is Hebrew.

/** YouTube's auto-translate targets (2026-11, hl=en), in canonical form, with English names. */
export const CATALOGUE: Readonly<Record<string, string>> = Object.fromEntries(
  (
    'ab=Abkhazian|aa=Afar|af=Afrikaans|ak=Akan|sq=Albanian|am=Amharic|ar=Arabic|hy=Armenian|as=Assamese|' +
    'ay=Aymara|az=Azerbaijani|bn=Bangla|ba=Bashkir|eu=Basque|be=Belarusian|bho=Bhojpuri|bs=Bosnian|' +
    'br=Breton|bg=Bulgarian|my=Burmese|ca=Catalan|ceb=Cebuano|zh-Hans=Chinese (Simplified)|' +
    'zh-Hant=Chinese (Traditional)|co=Corsican|hr=Croatian|cs=Czech|da=Danish|dv=Divehi|nl=Dutch|' +
    'dz=Dzongkha|en=English|eo=Esperanto|et=Estonian|ee=Ewe|fo=Faroese|fj=Fijian|fil=Filipino|' +
    'fi=Finnish|fr=French|gaa=Ga|gl=Galician|lg=Ganda|ka=Georgian|de=German|el=Greek|gn=Guarani|' +
    'gu=Gujarati|ht=Haitian Creole|ha=Hausa|haw=Hawaiian|he=Hebrew|hi=Hindi|hmn=Hmong|hu=Hungarian|' +
    'is=Icelandic|ig=Igbo|id=Indonesian|iu=Inuktitut|ga=Irish|it=Italian|ja=Japanese|jv=Javanese|' +
    'kl=Kalaallisut|kn=Kannada|kk=Kazakh|kha=Khasi|km=Khmer|rw=Kinyarwanda|ko=Korean|kri=Krio|' +
    'ku=Kurdish|ky=Kyrgyz|lo=Lao|la=Latin|lv=Latvian|ln=Lingala|lt=Lithuanian|lua=Luba-Lulua|luo=Luo|' +
    'lb=Luxembourgish|mk=Macedonian|mg=Malagasy|ms=Malay|ml=Malayalam|mt=Maltese|gv=Manx|mi=Māori|' +
    'mr=Marathi|mn=Mongolian|mfe=Morisyen|ne=Nepali|new=Newari|nso=Northern Sotho|no=Norwegian|' +
    'ny=Nyanja|oc=Occitan|or=Odia|om=Oromo|os=Ossetic|pam=Pampanga|ps=Pashto|fa=Persian|pl=Polish|' +
    'pt=Portuguese|pt-PT=Portuguese (Portugal)|pa=Punjabi|qu=Quechua|ro=Romanian|rn=Rundi|ru=Russian|' +
    'sm=Samoan|sg=Sango|sa=Sanskrit|gd=Scottish Gaelic|sr=Serbian|crs=Seselwa Creole French|sn=Shona|' +
    'sd=Sindhi|si=Sinhala|sk=Slovak|sl=Slovenian|so=Somali|st=Southern Sotho|es=Spanish|su=Sundanese|' +
    'sw=Swahili|ss=Swati|sv=Swedish|tg=Tajik|ta=Tamil|tt=Tatar|te=Telugu|th=Thai|bo=Tibetan|' +
    'ti=Tigrinya|to=Tongan|ts=Tsonga|tn=Tswana|tum=Tumbuka|tr=Turkish|tk=Turkmen|uk=Ukrainian|ur=Urdu|' +
    'ug=Uyghur|uz=Uzbek|ve=Venda|vi=Vietnamese|war=Waray|cy=Welsh|fy=Western Frisian|wo=Wolof|' +
    'xh=Xhosa|yi=Yiddish|yo=Yoruba|zu=Zulu'
  )
    .split('|')
    .map((pair) => pair.split('=') as [string, string]),
);

const LEGACY: Readonly<Record<string, string>> = {
  iw: 'he',
  in: 'id',
  ji: 'yi',
  jw: 'jv',
  mo: 'ro',
  tl: 'fil',
};
const TRADITIONAL = new Set(['hant', 'tw', 'hk', 'mo']);

/** YouTube's (or the browser's) code for a language → the code we store. */
export function canonical(code: string): string {
  const parts = code.trim().replace(/_/g, '-').split('-');
  const first = (parts[0] ?? '').toLowerCase();
  const primary = LEGACY[first] ?? first;
  const rest = parts.slice(1).map((p) => p.toLowerCase());
  if (primary === 'zh') return rest.some((p) => TRADITIONAL.has(p)) ? 'zh-Hant' : 'zh-Hans';
  if (primary === 'pt' && rest.includes('pt')) return 'pt-PT';
  return primary;
}

/** The language without its variant: "zh-Hant" → "zh", "pt-PT" → "pt". */
export const primaryOf = (code: string) => canonical(code).split('-')[0] ?? code;

const capitalize = (text: string, locale: string) => {
  try {
    return text.charAt(0).toLocaleUpperCase(locale) + text.slice(1);
  } catch {
    return text.charAt(0).toUpperCase() + text.slice(1);
  }
};

function displayName(code: string, locale: string): string | undefined {
  try {
    const name = new Intl.DisplayNames([locale], { type: 'language', fallback: 'none' }).of(code);
    return name ? capitalize(name, locale) : undefined;
  } catch {
    return undefined;
  }
}

export interface LanguageNames {
  /** The language's name for itself ("Deutsch", "Hrvatski"), or the best we know. */
  native: string;
  /** Its name in the reader's language ("German" for an English reader), when that differs. */
  local?: string;
  /** English name, for search. */
  english: string;
}

/** Script to name a language in, where its speakers mostly write another than Intl's default. */
const NATIVE_LOCALE: Readonly<Record<string, string>> = { sr: 'sr-Latn' };

const namesCache = new Map<string, LanguageNames>();

export function namesOf(code: string, uiLocale: string, fallbackName?: string): LanguageNames {
  const key = `${code}|${uiLocale}`;
  const cached = namesCache.get(key);
  if (cached) return cached;
  const english = CATALOGUE[code] ?? displayName(code, 'en') ?? fallbackName ?? code;
  const native = displayName(code, NATIVE_LOCALE[code] ?? code) ?? displayName(code, uiLocale) ?? english;
  const inUi = displayName(code, uiLocale) ?? english;
  const names: LanguageNames = {
    native,
    local: inUi.toLocaleLowerCase() === native.toLocaleLowerCase() ? undefined : inUi,
    english,
  };
  namesCache.set(key, names);
  return names;
}

/** Lowercase, accents and other marks removed, so "nemacki" finds "Nemački". */
export const fold = (text: string) =>
  text.normalize('NFKD').replace(/\p{M}/gu, '').toLocaleLowerCase().trim();

/**
 * Languages matching `query` by any of their names or their code, best matches first: a name that
 * starts with the query, then a word in a name that does, then the code, then anywhere in a name.
 * `order` breaks ties (e.g. languages on the current video first).
 */
export function searchLanguages(
  query: string,
  codes: readonly string[],
  names: (code: string) => LanguageNames,
): string[] {
  const q = fold(query);
  if (!q) return [...codes];
  const scored: [code: string, score: number, index: number][] = [];
  codes.forEach((code, index) => {
    const n = names(code);
    const texts = [n.native, n.local, n.english].filter((t): t is string => !!t).map(fold);
    let score = 0;
    if (texts.some((t) => t.startsWith(q))) score = 4;
    else if (texts.some((t) => t.split(/[\s(),-]+/).some((w) => w.startsWith(q)))) score = 3;
    else if (fold(code) === q || fold(code).startsWith(`${q}-`)) score = 2;
    else if (texts.some((t) => t.includes(q))) score = 1;
    if (score) scored.push([code, score, index]);
  });
  return scored.sort((a, b) => b[1] - a[1] || a[2] - b[2]).map(([code]) => code);
}

/** First-run choice: the browser's own languages (at most four), or English. */
export function defaultLanguages(browserLanguages: readonly string[]): string[] {
  const picked: string[] = [];
  for (const tag of browserLanguages) {
    const code = canonical(tag);
    if (!(code in CATALOGUE) || picked.includes(code)) continue;
    picked.push(code);
    if (picked.length === 4) break;
  }
  return picked.length ? picked : ['en'];
}
