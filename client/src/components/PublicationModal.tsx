import React, { useState, useEffect, useRef } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { Input } from './Input';
import { Select } from './Select';
import { DatePicker } from './DatePicker';
import { FileUploader } from './FileUploader';
import { Alert } from './Alert';
import { publicationService } from '../services/publication.service';
import { useAcademicYears } from '../hooks/useAcademicYears';
import type {
  Publication,
  PublicationType,
  PublicationLifecycleStatus,
  IndexingType,
  Quartile,
  AuthorPosition,
} from '../types/publication';
import { fileUrl } from '../utils/fileUrl';

interface PublicationModalProps {
  isOpen: boolean;
  onClose: () => void;
  publication?: Publication | null;
  onSuccess: (savedPub: Publication) => void;
  /** Look this DOI up and pre-fill the form when the modal opens (ORCID import). */
  prefillDoi?: string;
}

/** "2024-03-10" -> "2023-2024" (academic year runs June to May). */
function academicYearOf(date: string): string {
  const d = new Date(date);
  const y = d.getFullYear();
  return d.getMonth() >= 5 ? `${y}-${y + 1}` : `${y - 1}-${y}`;
}

const PUBLICATION_TYPE_OPTIONS = [
  { value: 'JOURNAL', label: 'Journal Article' },
  { value: 'CONFERENCE', label: 'Conference Proceeding' },
  { value: 'BOOK', label: 'Book' },
  { value: 'BOOK_CHAPTER', label: 'Book Chapter' },
  { value: 'EDITED_BOOK', label: 'Edited Book' },
  { value: 'REVIEW_PAPER', label: 'Review Paper' },
  { value: 'TECHNICAL_PAPER', label: 'Technical Paper' },
  { value: 'OTHER', label: 'Other' },
];

const INDEXING_OPTIONS = [
  { value: 'SCOPUS', label: 'Scopus' },
  { value: 'SCI', label: 'Science Citation Index (SCI)' },
  { value: 'SCIE', label: 'SCIE' },
  { value: 'WEB_OF_SCIENCE', label: 'Web of Science (WoS)' },
  { value: 'UGC_CARE', label: 'UGC-CARE' },
  { value: 'IEEE_XPLORE', label: 'IEEE Xplore' },
  { value: 'PUBMED', label: 'PubMed' },
  { value: 'OTHER', label: 'Other Indexing' },
  { value: 'NONE', label: 'None' },
];

const QUARTILE_OPTIONS = [
  { value: 'Q1', label: 'Q1 (Top 25%)' },
  { value: 'Q2', label: 'Q2 (25% - 50%)' },
  { value: 'Q3', label: 'Q3 (50% - 75%)' },
  { value: 'Q4', label: 'Q4 (Bottom 25%)' },
  { value: 'NA', label: 'Not Applicable (NA)' },
];

const AUTHOR_POSITION_OPTIONS = [
  { value: 'FIRST_AUTHOR', label: 'First Author' },
  { value: 'SECOND_AUTHOR', label: 'Second Author' },
  { value: 'CORRESPONDING_AUTHOR', label: 'Corresponding Author' },
  { value: 'CO_AUTHOR', label: 'Co-Author' },
];

const PUBLICATION_STATUS_OPTIONS = [
  { value: 'DRAFT', label: 'Draft' },
  { value: 'SUBMITTED', label: 'Submitted' },
  { value: 'ACCEPTED', label: 'Accepted' },
  { value: 'PUBLISHED', label: 'Published' },
];

export const PublicationModal: React.FC<PublicationModalProps> = ({
  isOpen,
  onClose,
  publication,
  onSuccess,
  prefillDoi,
}) => {
  const { currentYear, years, options: yearOptions } = useAcademicYears();
  const [formData, setFormData] = useState({
    title: '',
    publicationType: 'JOURNAL' as PublicationType,
    journalOrConference: '',
    publisher: '',
    issn: '',
    doi: '',
    url: '',
    publicationDate: new Date().toISOString().split('T')[0],
    academicYear: '',
    volume: '',
    issue: '',
    pages: '',
    indexing: 'SCOPUS' as IndexingType,
    quartile: 'NA' as Quartile,
    impactFactor: '',
    citationCount: '0',
    authorPosition: 'FIRST_AUTHOR' as AuthorPosition,
    numberOfAuthors: '1',
    coAuthorsText: '',
    affiliation: 'KPR Institute of Engineering and Technology',
    correspondingAuthor: false,
    publicationStatus: 'PUBLISHED' as PublicationLifecycleStatus,
    pdfUrl: '',
    pdfFileName: '',
  });

  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Which footer action is running, so only that button shows the spinner
  const [pendingAction, setPendingAction] = useState<'draft' | 'submit' | null>(null);
  // Synchronous lock so a double-click / repeated Enter cannot send two requests
  const submittingRef = useRef(false);

  useEffect(() => {
    if (publication) {
      setFormData({
        title: publication.title || '',
        publicationType: publication.publicationType || 'JOURNAL',
        journalOrConference: publication.journalOrConference || '',
        publisher: publication.publisher || '',
        issn: publication.issn || '',
        doi: publication.doi || '',
        url: publication.url || '',
        publicationDate: publication.publicationDate
          ? new Date(publication.publicationDate).toISOString().split('T')[0]
          : new Date().toISOString().split('T')[0],
        academicYear: publication.academicYear || currentYear,
        volume: publication.volume || '',
        issue: publication.issue || '',
        pages: publication.pages || '',
        indexing: publication.indexing || 'SCOPUS',
        quartile: publication.quartile || 'NA',
        impactFactor: publication.impactFactor !== undefined ? String(publication.impactFactor) : '',
        citationCount: String(publication.citationCount ?? 0),
        authorPosition: publication.authorPosition || 'FIRST_AUTHOR',
        numberOfAuthors: String(publication.numberOfAuthors || 1),
        coAuthorsText: (publication.coAuthors || []).join(', '),
        affiliation: publication.affiliation || 'KPR Institute of Engineering and Technology',
        correspondingAuthor: publication.correspondingAuthor ?? false,
        publicationStatus: publication.publicationStatus || 'PUBLISHED',
        pdfUrl: publication.pdfUrl || '',
        pdfFileName: publication.pdfFileName || '',
      });
    } else {
      setFormData({
        title: '',
        publicationType: 'JOURNAL',
        journalOrConference: '',
        publisher: '',
        issn: '',
        doi: '',
        url: '',
        publicationDate: new Date().toISOString().split('T')[0],
        academicYear: '',
        volume: '',
        issue: '',
        pages: '',
        indexing: 'SCOPUS',
        quartile: 'NA',
        impactFactor: '',
        citationCount: '0',
        authorPosition: 'FIRST_AUTHOR',
        numberOfAuthors: '1',
        coAuthorsText: '',
        affiliation: 'KPR Institute of Engineering and Technology',
        correspondingAuthor: false,
        publicationStatus: 'PUBLISHED',
        pdfUrl: '',
        pdfFileName: '',
      });
    }
    setUploadedFiles([]);
    setError(null);
    setValidationErrors({});
  }, [publication, isOpen]);

  // --- Auto-fill from a DOI (Crossref) ----------------------------------------------
  const [doiInput, setDoiInput] = useState('');
  const [doiLoading, setDoiLoading] = useState(false);
  const [doiMessage, setDoiMessage] = useState<{ variant: 'success' | 'danger'; text: string } | null>(null);

  const fillFromDoi = async (raw: string) => {
    const doi = raw.trim();
    if (!doi) return;
    setDoiLoading(true);
    setDoiMessage(null);
    try {
      const found = await publicationService.lookupDoi(doi);
      const year = found.publicationDate ? academicYearOf(found.publicationDate) : '';
      setFormData((prev) => ({
        ...prev,
        title: found.title || prev.title,
        publicationType: (found.publicationType as PublicationType) || prev.publicationType,
        journalOrConference: found.journalOrConference || prev.journalOrConference,
        publisher: found.publisher || prev.publisher,
        issn: found.issn || prev.issn,
        doi: found.doi || prev.doi,
        url: found.url || prev.url,
        publicationDate: found.publicationDate || prev.publicationDate,
        academicYear: year && years.includes(year) ? year : prev.academicYear,
        volume: found.volume || prev.volume,
        issue: found.issue || prev.issue,
        pages: found.pages || prev.pages,
        citationCount: String(found.citationCount ?? prev.citationCount),
        numberOfAuthors: String(found.numberOfAuthors || prev.numberOfAuthors),
        authorPosition: (found.suggestedAuthorPosition as AuthorPosition) || prev.authorPosition,
        coAuthorsText: found.coAuthors.length ? found.coAuthors.join(', ') : prev.coAuthorsText,
        publicationStatus: 'PUBLISHED',
      }));
      setValidationErrors({});
      setDoiMessage({
        variant: 'success',
        text: `Filled from Crossref${found.authors.length ? ` (${found.authors.length} authors)` : ''}. Check indexing, quartile and your author position before saving.`,
      });
    } catch (err: any) {
      setDoiMessage({ variant: 'danger', text: err?.message || 'Could not look up this DOI.' });
    } finally {
      setDoiLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    setDoiMessage(null);
    setDoiInput(prefillDoi || '');
    if (prefillDoi && !publication) void fillFromDoi(prefillDoi);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, prefillDoi]);

  // Default to the current academic year once it has loaded
  useEffect(() => {
    if (isOpen && currentYear) {
      setFormData((prev) => (prev.academicYear ? prev : { ...prev, academicYear: currentYear }));
    }
  }, [isOpen, currentYear]);

  const handleChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (validationErrors[field]) {
      setValidationErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!formData.title.trim()) {
      errs.title = 'Title is required';
    } else if (formData.title.trim().length < 5) {
      errs.title = 'Title must be at least 5 characters';
    }

    if (!formData.journalOrConference.trim()) {
      errs.journalOrConference = 'Journal or Conference venue is required';
    }

    if (!formData.publicationDate) {
      errs.publicationDate = 'Publication date is required';
    }

    if (!formData.academicYear) {
      errs.academicYear = 'Academic year is required';
    }

    setValidationErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = async (submitForVerification = false) => {
    if (submittingRef.current) return;
    if (!validate()) {
      setError('Please review required fields with validation errors.');
      return;
    }

    setError(null);
    submittingRef.current = true;
    setIsSubmitting(true);
    setPendingAction(submitForVerification ? 'submit' : 'draft');

    const coAuthors = formData.coAuthorsText
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    const payload = {
      title: formData.title.trim(),
      publicationType: formData.publicationType,
      journalOrConference: formData.journalOrConference.trim(),
      publisher: formData.publisher.trim() || undefined,
      publicationDate: formData.publicationDate,
      academicYear: formData.academicYear.trim(),
      indexing: formData.indexing,
      quartile: formData.quartile,
      impactFactor: formData.impactFactor !== '' ? Number(formData.impactFactor) : undefined,
      citationCount: Number(formData.citationCount) || 0,
      authorPosition: formData.authorPosition,
      numberOfAuthors: Math.max(1, Number(formData.numberOfAuthors) || 1),
      coAuthors,
      affiliation: formData.affiliation.trim() || 'KPR Institute of Engineering and Technology',
      correspondingAuthor: formData.correspondingAuthor,
      publicationStatus: formData.publicationStatus,
      volume: formData.volume.trim() || undefined,
      issue: formData.issue.trim() || undefined,
      pages: formData.pages.trim() || undefined,
      issn: formData.issn.trim() || undefined,
      doi: formData.doi.trim() || undefined,
      url: formData.url.trim() || undefined,
      pdfUrl: formData.pdfUrl || (uploadedFiles.length > 0 ? uploadedFiles[0].name : undefined),
      pdfFileName: formData.pdfFileName || (uploadedFiles.length > 0 ? uploadedFiles[0].name : undefined),
    };

    try {
      let saved: Publication;
      if (publication?._id) {
        saved = await publicationService.updatePublication(publication._id, payload);
      } else {
        saved = await publicationService.createPublication(payload);
      }

      if (submitForVerification && saved._id) {
        saved = await publicationService.submitPublication(saved._id);
      }

      onSuccess(saved);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save publication record.');
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
      setPendingAction(null);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={isSubmitting ? () => {} : onClose}
      closeOnEscape={!isSubmitting}
      closeOnBackdrop={!isSubmitting}
      title={publication ? 'Edit Publication Record' : 'Register New Publication'}
      size="xl"
      footer={
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
            * Required fields
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <Button variant="outline" size="sm" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handleSave(false)}
              loading={pendingAction === 'draft'}
              disabled={isSubmitting}
            >
              Save as Draft
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => handleSave(true)}
              loading={pendingAction === 'submit'}
              disabled={isSubmitting}
            >
              Save & Submit
            </Button>
          </div>
        </div>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSave(false);
        }}
        style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}
      >
        {error && <Alert variant="danger">{error}</Alert>}

        {/* Quick fill from DOI */}
        <div className="publication-doi-fill">
          <div className="publication-doi-fill-label">
            <i className="bi bi-magic" aria-hidden="true" />
            <span>
              <strong>Have a DOI?</strong> Fill the details automatically.
            </span>
          </div>
          <div className="publication-doi-fill-row">
            <Input
              aria-label="DOI"
              placeholder="10.1109/ACCESS.2024.1234567 or https://doi.org/…"
              value={doiInput}
              onChange={(e) => setDoiInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void fillFromDoi(doiInput);
                }
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              loading={doiLoading}
              disabled={!doiInput.trim()}
              onClick={() => void fillFromDoi(doiInput)}
            >
              Fill from DOI
            </Button>
          </div>
          {doiMessage && (
            <div className={`publication-doi-fill-msg is-${doiMessage.variant}`}>{doiMessage.text}</div>
          )}
        </div>

        {/* SECTION 1: Publication Title & Venue */}
        <fieldset
          style={{
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            padding: 'var(--space-4)',
            backgroundColor: 'var(--color-surface)',
          }}
        >
          <legend
            style={{
              fontSize: 'var(--font-size-sm)',
              fontWeight: 600,
              color: 'var(--color-primary)',
              padding: '0 8px',
              width: 'auto',
              marginBottom: 0,
            }}
          >
            1. Title & Venue Details
          </legend>

          <div className="mt-2">
            <Input
              label="Publication Title"
              required
              placeholder="e.g. Deep Learning Approaches for Edge Computing in Smart Grids"
              value={formData.title}
              onChange={(e) => handleChange('title', e.target.value)}
              error={validationErrors.title}
              hint="Enter full formal manuscript title"
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-3)' }}>
            <Select
              label="Publication Type"
              required
              options={PUBLICATION_TYPE_OPTIONS}
              value={formData.publicationType}
              onChange={(e) => handleChange('publicationType', e.target.value)}
            />
            <Input
              label="Journal / Conference Venue"
              required
              placeholder="e.g. IEEE Transactions on Smart Grid"
              value={formData.journalOrConference}
              onChange={(e) => handleChange('journalOrConference', e.target.value)}
              error={validationErrors.journalOrConference}
            />
            <Input
              label="Publisher"
              placeholder="e.g. IEEE, Springer, Elsevier"
              value={formData.publisher}
              onChange={(e) => handleChange('publisher', e.target.value)}
            />
          </div>
        </fieldset>

        {/* SECTION 2: Indexing, Quartiles & Metrics */}
        <fieldset
          style={{
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            padding: 'var(--space-4)',
            backgroundColor: 'var(--color-surface)',
          }}
        >
          <legend
            style={{
              fontSize: 'var(--font-size-sm)',
              fontWeight: 600,
              color: 'var(--color-primary)',
              padding: '0 8px',
              width: 'auto',
              marginBottom: 0,
            }}
          >
            2. Indexing, Quartile & Timeline
          </legend>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-3)' }} className="mt-2">
            <Select
              label="Indexing Category"
              required
              options={INDEXING_OPTIONS}
              value={formData.indexing}
              onChange={(e) => handleChange('indexing', e.target.value)}
            />
            <Select
              label="Journal Quartile"
              options={QUARTILE_OPTIONS}
              value={formData.quartile}
              onChange={(e) => handleChange('quartile', e.target.value)}
            />
            <DatePicker
              label="Publication Date"
              required
              value={formData.publicationDate}
              onChange={(date) => handleChange('publicationDate', date)}
              error={validationErrors.publicationDate}
            />
            <Select
              label="Academic Year"
              required
              options={
                formData.academicYear && !years.includes(formData.academicYear)
                  ? [{ value: formData.academicYear, label: formData.academicYear }, ...yearOptions]
                  : yearOptions
              }
              value={formData.academicYear}
              onChange={(e) => handleChange('academicYear', e.target.value)}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-3)' }} className="mt-2">
            <Input
              label="Impact Factor"
              type="number"
              step="0.01"
              placeholder="e.g. 5.24"
              value={formData.impactFactor}
              onChange={(e) => handleChange('impactFactor', e.target.value)}
              hint="Journal IF (Clarivate / JCR)"
            />
            <Input
              label="Citation Count"
              type="number"
              min="0"
              value={formData.citationCount}
              onChange={(e) => handleChange('citationCount', e.target.value)}
              hint="Verified Scopus / WoS citations"
            />
            <Select
              label="Lifecycle Status"
              options={PUBLICATION_STATUS_OPTIONS}
              value={formData.publicationStatus}
              onChange={(e) => handleChange('publicationStatus', e.target.value)}
            />
          </div>
        </fieldset>

        {/* SECTION 3: Authorship & Institutional Affiliation */}
        <fieldset
          style={{
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            padding: 'var(--space-4)',
            backgroundColor: 'var(--color-surface)',
          }}
        >
          <legend
            style={{
              fontSize: 'var(--font-size-sm)',
              fontWeight: 600,
              color: 'var(--color-primary)',
              padding: '0 8px',
              width: 'auto',
              marginBottom: 0,
            }}
          >
            3. Authorship & Affiliation
          </legend>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-3)' }} className="mt-2">
            <Select
              label="Your Author Position"
              options={AUTHOR_POSITION_OPTIONS}
              value={formData.authorPosition}
              onChange={(e) => handleChange('authorPosition', e.target.value)}
            />
            <Input
              label="Total Number of Authors"
              type="number"
              min="1"
              value={formData.numberOfAuthors}
              onChange={(e) => handleChange('numberOfAuthors', e.target.value)}
            />
            <Input
              label="Institutional Affiliation"
              value={formData.affiliation}
              onChange={(e) => handleChange('affiliation', e.target.value)}
              hint="Defaults to KPR Institute of Engineering and Technology"
            />
          </div>

          <div className="mt-2">
            <Input
              label="Co-Authors"
              placeholder="Comma-separated names (e.g. Dr. A. Kumar, Prof. R. Sharma)"
              value={formData.coAuthorsText}
              onChange={(e) => handleChange('coAuthorsText', e.target.value)}
              hint="List all co-authors appearing on manuscript"
            />
          </div>

          <div className="mt-2" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input
              type="checkbox"
              id="corr-author-chk"
              checked={formData.correspondingAuthor}
              onChange={(e) => handleChange('correspondingAuthor', e.target.checked)}
              style={{ accentColor: 'var(--color-primary)', cursor: 'pointer' }}
            />
            <label htmlFor="corr-author-chk" style={{ fontSize: 'var(--font-size-sm)', cursor: 'pointer', margin: 0 }}>
              You are the <strong>Corresponding Author</strong> for this paper
            </label>
          </div>
        </fieldset>

        {/* SECTION 4: Citations, Volume & Identifiers */}
        <fieldset
          style={{
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            padding: 'var(--space-4)',
            backgroundColor: 'var(--color-surface)',
          }}
        >
          <legend
            style={{
              fontSize: 'var(--font-size-sm)',
              fontWeight: 600,
              color: 'var(--color-primary)',
              padding: '0 8px',
              width: 'auto',
              marginBottom: 0,
            }}
          >
            4. Volume, Identifiers & Digital Access
          </legend>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 'var(--space-3)' }} className="mt-2">
            <Input
              label="Volume"
              placeholder="e.g. 14"
              value={formData.volume}
              onChange={(e) => handleChange('volume', e.target.value)}
            />
            <Input
              label="Issue"
              placeholder="e.g. 3"
              value={formData.issue}
              onChange={(e) => handleChange('issue', e.target.value)}
            />
            <Input
              label="Page Numbers"
              placeholder="e.g. 112-124"
              value={formData.pages}
              onChange={(e) => handleChange('pages', e.target.value)}
            />
            <Input
              label="ISSN / ISBN"
              placeholder="e.g. 1949-3053"
              value={formData.issn}
              onChange={(e) => handleChange('issn', e.target.value)}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 'var(--space-3)' }} className="mt-2">
            <Input
              label="DOI"
              placeholder="e.g. 10.1109/TSG.2023.123456"
              value={formData.doi}
              onChange={(e) => handleChange('doi', e.target.value)}
              hint="Digital Object Identifier"
            />
            <Input
              label="External URL"
              placeholder="https://doi.org/..."
              value={formData.url}
              onChange={(e) => handleChange('url', e.target.value)}
              hint="Publisher / Direct article repository link"
            />
          </div>
        </fieldset>

        {/* SECTION 5: Evidence & Document Upload */}
        <fieldset
          style={{
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            padding: 'var(--space-4)',
            backgroundColor: 'var(--color-surface)',
          }}
        >
          <legend
            style={{
              fontSize: 'var(--font-size-sm)',
              fontWeight: 600,
              color: 'var(--color-primary)',
              padding: '0 8px',
              width: 'auto',
              marginBottom: 0,
            }}
          >
            5. Document Proof (Evidence Upload)
          </legend>

          <div className="mt-2">
            <FileUploader
              label="Attach Manuscript or Acceptance Proof (PDF)"
              accept=".pdf"
              files={uploadedFiles}
              onFilesChange={setUploadedFiles}
              disabled={isSubmitting}
              hint="Upload signed acceptance letter or final preprint (Max 15MB PDF)"
            />

            {formData.pdfUrl && uploadedFiles.length === 0 && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: 'var(--space-2) var(--space-3)',
                  backgroundColor: 'var(--color-surface)',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--color-border)',
                  marginTop: 'var(--space-2)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                  <i className="bi bi-file-earmark-pdf text-danger" style={{ fontSize: '1.25rem' }} />
                  <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 500 }}>
                    {formData.pdfFileName || 'Current Attached Publication Proof'}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                  <a
                    href={fileUrl(formData.pdfUrl)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-outline btn-xs"
                    style={{ textDecoration: 'none' }}
                  >
                    View
                  </a>
                  <button
                    type="button"
                    className="btn btn-ghost btn-xs text-danger"
                    onClick={() => setFormData((prev) => ({ ...prev, pdfUrl: '', pdfFileName: '' }))}
                  >
                    Remove
                  </button>
                </div>
              </div>
            )}
          </div>
        </fieldset>
      </form>
    </Modal>
  );
};
