import { Publication, PUBLICATION_TYPES, AUTHOR_POSITIONS, type PublicationType, type AuthorPosition } from '../models/Publication.js';
import { AppError } from '../utils/AppError.js';
import { PRODUCT_NAME } from '../config/brand.js';

/**
 * Fills publication details from public scholarly registries instead of typing them:
 *  - Crossref (by DOI) — title, venue, publisher, ISSN, date, volume/issue/pages, authors, citations
 *  - ORCID public API (by ORCID iD) — the researcher's list of works, each importable by DOI
 * Google Scholar has no public API (and forbids scraping), so it is not supported.
 */

const TIMEOUT_MS = 10_000;
const USER_AGENT = `${PRODUCT_NAME}/1.0 (Faculty Management System)`;

export interface DoiLookupResult {
  doi: string;
  title: string;
  publicationType: PublicationType;
  journalOrConference: string;
  publisher?: string;
  issn?: string;
  url?: string;
  publicationDate?: string;
  volume?: string;
  issue?: string;
  pages?: string;
  citationCount: number;
  authors: string[];
  numberOfAuthors: number;
  /** Best guess from the signed-in faculty member's name, if found in the author list */
  suggestedAuthorPosition?: AuthorPosition;
  coAuthors: string[];
}

export function normalizeDoi(input: string): string | null {
  const doi = decodeURIComponent(input.trim())
    .replace(/^(https?:\/\/)?(dx\.)?doi\.org\//i, '')
    .replace(/^doi:\s*/i, '')
    .trim();
  return /^10\.\d{4,9}\/\S+$/.test(doi) ? doi.toLowerCase() : null;
}

/** ORCID iD in 0000-0000-0000-000X form with a valid ISO 7064 11-2 check digit. */
export function normalizeOrcid(input: string): string | null {
  const raw = input.trim().replace(/^(https?:\/\/)?(www\.)?orcid\.org\//i, '').toUpperCase();
  if (!/^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/.test(raw)) return null;
  const digits = raw.replace(/-/g, '');
  let total = 0;
  for (const ch of digits.slice(0, 15)) total = (total + Number(ch)) * 2;
  const check = (12 - (total % 11)) % 11;
  const expected = check === 10 ? 'X' : String(check);
  return digits[15] === expected ? raw : null;
}

async function fetchJson(url: string, source: string, headers: Record<string, string> = {}): Promise<any> {
  let res: globalThis.Response;
  try {
    res = await fetch(url, { headers: { 'User-Agent': USER_AGENT, Accept: 'application/json', ...headers }, signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch {
    throw new AppError(`Could not reach ${source}. Check the internet connection and try again.`, 502, 'LOOKUP_UNAVAILABLE');
  }
  if (res.status === 404) return null;
  if (!res.ok) throw new AppError(`${source} returned an error (${res.status}). Try again later.`, 502, 'LOOKUP_UNAVAILABLE');
  return res.json();
}

function mapCrossrefType(type?: string): PublicationType {
  switch (type) {
    case 'journal-article':
      return PUBLICATION_TYPES.JOURNAL;
    case 'proceedings-article':
      return PUBLICATION_TYPES.CONFERENCE;
    case 'book-chapter':
      return PUBLICATION_TYPES.BOOK_CHAPTER;
    case 'edited-book':
      return PUBLICATION_TYPES.EDITED_BOOK;
    case 'book':
    case 'monograph':
    case 'reference-book':
      return PUBLICATION_TYPES.BOOK;
    case 'report':
      return PUBLICATION_TYPES.TECHNICAL_PAPER;
    default:
      return PUBLICATION_TYPES.OTHER;
  }
}

function crossrefDate(work: any): string | undefined {
  const parts: number[] | undefined = (work['published-print'] || work['published-online'] || work.published || work.issued)?.['date-parts']?.[0];
  if (!parts?.[0]) return undefined;
  const [y, m = 1, d = 1] = parts;
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

const nameTokens = (name: string) =>
  name
    .toLowerCase()
    .replace(/^(dr|prof|mr|ms|mrs)\.?\s+/g, '')
    .split(/[\s.]+/)
    .filter((t) => t.length > 1);

/** Maps a Crossref "work" record to the FMS publication form fields. */
export function mapCrossrefWork(work: any, facultyName?: string): DoiLookupResult {
  const authors: string[] = (work.author ?? [])
    .map((a: any) => [a.given, a.family].filter(Boolean).join(' ') || a.name)
    .filter(Boolean);

  let suggestedAuthorPosition: AuthorPosition | undefined;
  let selfIndex = -1;
  if (facultyName && authors.length) {
    const mine = nameTokens(facultyName);
    selfIndex = authors.findIndex((a) => {
      const theirs = nameTokens(a);
      return mine.filter((t) => theirs.includes(t)).length >= Math.min(2, mine.length);
    });
    if (selfIndex === 0) suggestedAuthorPosition = AUTHOR_POSITIONS.FIRST_AUTHOR;
    else if (selfIndex === 1) suggestedAuthorPosition = AUTHOR_POSITIONS.SECOND_AUTHOR;
    else if (selfIndex > 1) suggestedAuthorPosition = AUTHOR_POSITIONS.CO_AUTHOR;
  }

  const clean = (v?: string) => v?.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
  return {
    doi: String(work.DOI || '').toLowerCase(),
    title: clean(work.title?.[0]) || '',
    publicationType: mapCrossrefType(work.type),
    journalOrConference: clean(work['container-title']?.[0] || work.event?.name) || '',
    publisher: clean(work.publisher),
    issn: work.ISSN?.[0] || work.ISBN?.[0],
    url: work.URL,
    publicationDate: crossrefDate(work),
    volume: work.volume,
    issue: work.issue,
    pages: work.page,
    citationCount: Number(work['is-referenced-by-count'] || 0),
    authors,
    numberOfAuthors: Math.max(1, authors.length),
    suggestedAuthorPosition,
    coAuthors: authors.filter((_, i) => i !== selfIndex),
  };
}

export const publicationLookupService = {
  async byDoi(input: string, facultyName?: string): Promise<DoiLookupResult> {
    const doi = normalizeDoi(input);
    if (!doi) throw AppError.badRequest('Enter a DOI like 10.1109/ACCESS.2024.1234567 (or a https://doi.org/… link).');
    const data = await fetchJson(`https://api.crossref.org/works/${encodeURIComponent(doi)}`, 'Crossref');
    if (!data?.message) throw AppError.notFound('No publication found for this DOI. Check it, or fill the form manually.');
    return mapCrossrefWork(data.message, facultyName);
  },

  /** Lists works on a public ORCID record; flags those already in the faculty member's publications. */
  async byOrcid(input: string, userId: string) {
    const orcid = normalizeOrcid(input);
    if (!orcid) throw AppError.badRequest('Enter an ORCID iD like 0000-0002-1825-0097.');
    const data = await fetchJson(`https://pub.orcid.org/v3.0/${orcid}/works`, 'ORCID');
    if (!data) throw AppError.notFound('No public ORCID record found for this iD.');

    const works = (data.group ?? []).slice(0, 300).map((g: any) => {
      const summary = g['work-summary']?.[0] ?? {};
      const ids: any[] = summary['external-ids']?.['external-id'] ?? g['external-ids']?.['external-id'] ?? [];
      const doiId = ids.find((x) => String(x['external-id-type']).toLowerCase() === 'doi');
      return {
        title: summary.title?.title?.value || 'Untitled work',
        type: summary.type,
        year: summary['publication-date']?.year?.value,
        journal: summary['journal-title']?.value,
        doi: doiId ? normalizeDoi(String(doiId['external-id-value'])) : null,
      };
    });

    const dois = works.map((w: { doi: string | null }) => w.doi).filter(Boolean);
    const existing = await Publication.find({ userId, doi: { $in: dois } }).select('doi').lean();
    const have = new Set(existing.map((p) => String(p.doi).toLowerCase()));

    return {
      orcid,
      works: works.map((w: { doi: string | null }) => ({ ...w, alreadyAdded: Boolean(w.doi && have.has(w.doi)) })),
    };
  },
};
