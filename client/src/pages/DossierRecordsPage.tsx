import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { apiClient } from '../api/client';
import { documentService } from '../services/document.service';
import { useAuthStore } from '../stores/authStore';
import { useAcademicYears } from '../hooks/useAcademicYears';
import { useOpenFromQuery } from '../hooks/useOpenFromQuery';
import { formatErrorMessage } from '../utils/errorHandler';
import { DocumentPreviewModal, Modal } from '../components';
import type { DocumentItem } from '../types/document';
import '../styles/funding.css';
import '../styles/dossier.css';

/**
 * Courses & certifications and achievements: the owner keeps the records and submits them with
 * evidence; the HOD (or Dean / Principal) verifies, returns or rejects. One page serves both.
 */

type Kind = 'courses' | 'achievements';
interface Options {
  courseKinds: string[];
  courseCategories: string[];
  courseModes: string[];
  achievementCategories: string[];
  achievementLevels: string[];
  evidenceRequiredAchievements: string[];
}
interface Rec {
  _id: string;
  status: string;
  title: string;
  academicYear: string;
  facultyName: string;
  reviewComment?: string;
  documentIds: string[];
  // course
  kind?: string;
  category?: string;
  provider?: string;
  platform?: string;
  startDate?: string;
  completionDate?: string;
  durationHours?: number;
  mode?: string;
  skills?: string[];
  certificateId?: string;
  credentialUrl?: string;
  result?: string;
  description?: string;
  // achievement
  body?: string;
  date?: string;
  endDate?: string;
  role?: string;
  level?: string;
}
interface Detail extends Rec {
  documents: Array<{ _id: string; title: string; originalFilename: string; mimeType: string; fileSize: number; createdAt: string }>;
  canReview: boolean;
  history: Array<{ action: string; byName?: string; at: string; comment?: string; to?: string }>;
}
interface Stats {
  academicYear: string;
  recorded: { courses: number; certifications: number; hours: number };
  verified: { courses: number; certifications: number; hours: number };
  thisYear: { recorded: number; verified: number };
  awaitingVerification: number;
  needsCorrection: number;
}

const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Draft',
  SUBMITTED: 'Awaiting verification',
  UNDER_REVIEW: 'Under review',
  RETURNED_FOR_CORRECTION: 'Returned for correction',
  VERIFIED: 'Verified',
  REJECTED: 'Not accepted',
};
const human = (s?: string) => (s ? s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, ' ') : '');
const day = (d?: string) => (d ? new Date(d).toLocaleDateString() : '—');
const toInput = (d?: string) => (d ? new Date(d).toISOString().slice(0, 10) : '');
const EDITABLE = ['DRAFT', 'RETURNED_FOR_CORRECTION', 'VERIFIED'];

const RecordForm: React.FC<{ kind: Kind; options: Options; record: Rec | null; defaultCategory?: string; onClose: () => void; onSaved: () => void }> = ({ kind, options, record, defaultCategory, onClose, onSaved }) => {
  const isCourse = kind === 'courses';
  const [f, setF] = useState<Record<string, string>>((): Record<string, string> => {
    const r = record ?? ({} as Rec);
    return isCourse
      ? {
          kind: r.kind ?? 'COURSE',
          title: r.title ?? '',
          category: r.category ?? 'TECHNICAL',
          provider: r.provider ?? '',
          platform: r.platform ?? '',
          startDate: toInput(r.startDate),
          completionDate: toInput(r.completionDate),
          durationHours: r.durationHours != null ? String(r.durationHours) : '',
          mode: r.mode ?? 'ONLINE',
          skills: (r.skills ?? []).join(', '),
          certificateId: r.certificateId ?? '',
          credentialUrl: r.credentialUrl ?? '',
          result: r.result ?? '',
          description: r.description ?? '',
        }
      : {
          category: r.category ?? (defaultCategory && options.achievementCategories.includes(defaultCategory) ? defaultCategory : 'AWARD'),
          title: r.title ?? '',
          body: r.body ?? '',
          date: toInput(r.date),
          endDate: toInput(r.endDate),
          role: r.role ?? '',
          level: r.level ?? '',
          description: r.description ?? '',
        };
  });
  const [docIds, setDocIds] = useState<string[]>(record?.documentIds?.map(String) ?? []);
  const [docNames, setDocNames] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const set = (k: string, v: string) => setF((x) => ({ ...x, [k]: v }));
  const evidenceNeeded = isCourse || options.evidenceRequiredAchievements.includes(f.category);

  const upload = async (file: File) => {
    setError(null);
    setUploading(1);
    try {
      const doc = await documentService.uploadDocument(
        file,
        { title: `${isCourse ? 'Certificate' : 'Evidence'}: ${f.title || file.name}`.slice(0, 280), documentType: 'CERTIFICATE' as any, relatedEntityType: isCourse ? 'FACULTY_COURSE' : 'FACULTY_ACHIEVEMENT', relatedEntityId: record?._id },
        (p) => setUploading(Math.max(p, 1))
      );
      setDocIds((x) => [...x, String(doc._id)]);
      setDocNames((x) => ({ ...x, [String(doc._id)]: file.name }));
    } catch (e) {
      setError(formatErrorMessage(e, 'The file could not be uploaded.'));
    } finally {
      setUploading(0);
    }
  };

  const save = useMutation({
    mutationFn: async (submit: boolean) => {
      const body: Record<string, unknown> = { ...f, documentIds: docIds };
      for (const k of Object.keys(body)) if (body[k] === '') delete body[k];
      if (isCourse) {
        body.skills = f.skills ? f.skills.split(',').map((s) => s.trim()).filter(Boolean) : [];
        if (f.durationHours) body.durationHours = Number(f.durationHours);
      }
      if (record) {
        await apiClient.patch(`/dossier/${kind}/${record._id}`, body);
        if (submit) await apiClient.post(`/dossier/${kind}/${record._id}/submit`);
      } else {
        await apiClient.post(`/dossier/${kind}`, { ...body, submit });
      }
    },
    onSuccess: () => {
      onSaved();
      onClose();
    },
    onError: (e) => setError(formatErrorMessage(e, 'The record could not be saved.')),
  });

  const input = (k: string, label: string, type = 'text', required = false) => (
    <label key={k}>
      <span>
        {label}
        {required && <span className="ds-req"> *</span>}
      </span>
      <input type={type} value={f[k] ?? ''} onChange={(e) => set(k, e.target.value)} required={required} />
    </label>
  );
  const select = (k: string, label: string, values: string[], blank?: string) => (
    <label key={k}>
      {label}
      <select value={f[k] ?? ''} onChange={(e) => set(k, e.target.value)}>
        {blank !== undefined && <option value="">{blank}</option>}
        {values.map((v) => (
          <option key={v} value={v}>
            {human(v)}
          </option>
        ))}
      </select>
    </label>
  );
  const canSave = Boolean(f.title?.trim()) && (isCourse ? Boolean(f.provider?.trim() && f.completionDate) : Boolean(f.body?.trim() && f.date));
  const reverify = record?.status === 'VERIFIED';

  return (
    <Modal isOpen onClose={onClose} title={`${record ? 'Edit' : 'Add'} ${isCourse ? 'course or certification' : 'achievement'}`} size="lg">
      <div className="fd-dialog">
        {reverify && <p className="ds-note">This record is verified. Saving a change sends it back to your HOD; the verified version stays on file until the change is approved.</p>}
        {record?.status === 'RETURNED_FOR_CORRECTION' && record.reviewComment && (
          <p className="ds-note is-warn">
            <strong>Reviewer’s comment:</strong> {record.reviewComment}
          </p>
        )}
        <div className="ds-grid">
          {isCourse
            ? [
                select('kind', 'Type', options.courseKinds),
                input('title', 'Title', 'text', true),
                select('category', 'Category', options.courseCategories),
                input('provider', 'Provider / issuing body', 'text', true),
                input('platform', 'Platform (e.g. NPTEL, Coursera)'),
                select('mode', 'Mode', options.courseModes),
                input('startDate', 'Start date', 'date'),
                input('completionDate', 'Completion date', 'date', true),
                input('durationHours', 'Duration (hours)', 'number'),
                input('result', 'Result / grade'),
                input('certificateId', 'Certificate ID'),
                input('credentialUrl', 'Credential URL', 'url'),
              ]
            : [
                select('category', 'Category', options.achievementCategories),
                input('title', 'Title', 'text', true),
                input('body', f.category === 'MEMBERSHIP' ? 'Professional body' : 'Awarding / organising body', 'text', true),
                select('level', 'Level', options.achievementLevels, 'Not specified'),
                input('date', f.category === 'MEMBERSHIP' || f.category === 'EDITORIAL_ROLE' || f.category === 'RESPONSIBILITY' ? 'From' : 'Date', 'date', true),
                input('endDate', 'Until (if it ended)', 'date'),
                input('role', 'Role (e.g. keynote speaker, member, editor)'),
              ]}
        </div>
        {isCourse && input('skills', 'Skills learned (comma separated)')}
        <label>
          Description
          <textarea rows={3} value={f.description ?? ''} onChange={(e) => set('description', e.target.value)} maxLength={3000} />
        </label>

        <div className="ds-evidence">
          <strong>Evidence</strong>
          <span className="fd-muted">{evidenceNeeded ? 'A certificate or letter is required before you can submit this for verification.' : 'Optional for this category.'} Files go to your secure document vault; only you and your reviewers can open them.</span>
          {docIds.length > 0 && (
            <ul>
              {docIds.map((id) => (
                <li key={id}>
                  <i className="bi bi-file-earmark-check" aria-hidden /> {docNames[id] ?? 'Attached file'}
                  <button type="button" className="ds-link" onClick={() => setDocIds((x) => x.filter((y) => y !== id))}>
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
          <label className="fd-btn ds-upload">
            {uploading ? `Uploading… ${uploading}%` : 'Upload file'}
            <input type="file" accept=".pdf,.png,.jpg,.jpeg" hidden disabled={uploading > 0} onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
          </label>
        </div>

        {error && (
          <p className="fd-error" role="alert">
            {error}
          </p>
        )}
        <div className="fd-actions">
          <button type="button" className="fd-btn" onClick={onClose}>
            Cancel
          </button>
          {!reverify && (
            <button type="button" className="fd-btn" disabled={!canSave || save.isPending || uploading > 0} onClick={() => save.mutate(false)}>
              Save draft
            </button>
          )}
          <button type="button" className="fd-btn fd-primary" disabled={!canSave || save.isPending || uploading > 0 || (evidenceNeeded && docIds.length === 0)} onClick={() => save.mutate(!reverify)}>
            {save.isPending ? 'Saving…' : reverify ? 'Save and send for re-verification' : 'Submit for verification'}
          </button>
        </div>
      </div>
    </Modal>
  );
};

const RecordDetail: React.FC<{ kind: Kind; id: string; onClose: () => void; onChanged: () => void; onEdit: (r: Rec) => void }> = ({ kind, id, onClose, onChanged, onEdit }) => {
  const me = useAuthStore((s) => s.user?.id);
  const q = useQuery({ queryKey: ['dossier-record', kind, id], queryFn: async () => (await apiClient.get(`/dossier/${kind}/${id}`)).data.data as Detail });
  const [comment, setComment] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<DocumentItem | null>(null);
  const decide = useMutation({
    mutationFn: async (action: 'VERIFY' | 'RETURN' | 'REJECT') => apiClient.post(`/dossier/${kind}/${id}/review`, { action, comment: comment || undefined }),
    onSuccess: () => {
      onChanged();
      onClose();
    },
    onError: (e) => setError(formatErrorMessage(e, 'The decision could not be saved.')),
  });
  const act = useMutation({
    mutationFn: async (what: 'submit' | 'delete') => (what === 'submit' ? apiClient.post(`/dossier/${kind}/${id}/submit`) : apiClient.delete(`/dossier/${kind}/${id}`)),
    onSuccess: () => {
      onChanged();
      onClose();
    },
    onError: (e) => setError(formatErrorMessage(e, 'That could not be done.')),
  });
  const r = q.data;
  const own = r && String((r as any).userId) === me;
  const rows: Array<[string, React.ReactNode]> = r
    ? kind === 'courses'
      ? [
          ['Type', human(r.kind)],
          ['Category', human(r.category)],
          ['Provider', [r.provider, r.platform].filter(Boolean).join(' · ')],
          ['Mode', human(r.mode)],
          ['Dates', `${r.startDate ? `${day(r.startDate)} – ` : ''}${day(r.completionDate)}`],
          ['Duration', r.durationHours ? `${r.durationHours} hours` : '—'],
          ['Result', r.result || '—'],
          ['Certificate ID', r.certificateId || '—'],
          ['Credential', r.credentialUrl ? <a key="url" href={r.credentialUrl} target="_blank" rel="noreferrer noopener">{r.credentialUrl}</a> : '—'],
          ['Skills', r.skills?.length ? r.skills.join(', ') : '—'],
        ]
      : [
          ['Category', human(r.category)],
          ['Body', r.body],
          ['Level', human(r.level) || '—'],
          ['Date', `${day(r.date)}${r.endDate ? ` – ${day(r.endDate)}` : ''}`],
          ['Role', r.role || '—'],
        ]
    : [];
  return (
    <Modal isOpen onClose={onClose} title={r?.title ?? 'Record'} size="lg">
      {q.isLoading && <p className="fd-muted">Loading…</p>}
      {q.isError && <p className="fd-error">{formatErrorMessage(q.error, 'The record could not be loaded.')}</p>}
      {r && (
        <div className="fd-dialog">
          <p className="fd-muted">
            {r.facultyName} · {r.academicYear} · <span className={`ds-status st-${r.status.toLowerCase()}`}>{STATUS_LABEL[r.status] ?? r.status}</span>
          </p>
          <dl className="ds-dl">
            {rows.map(([k, v]) => (
              <React.Fragment key={k}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </React.Fragment>
            ))}
          </dl>
          {r.description && <p className="ds-desc">{r.description}</p>}
          <div className="ds-evidence">
            <strong>Evidence</strong>
            {r.documents.length === 0 ? (
              <span className="fd-muted">No file attached.</span>
            ) : (
              <ul>
                {r.documents.map((d) => (
                  <li key={d._id}>
                    <i className="bi bi-file-earmark-text" aria-hidden /> {d.originalFilename}
                    <button type="button" className="ds-link" onClick={() => setPreview({ ...(d as any), _id: d._id, id: d._id } as DocumentItem)}>
                      Open
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {r.reviewComment && (
            <p className={`ds-note ${r.status === 'VERIFIED' ? '' : 'is-warn'}`}>
              <strong>Reviewer:</strong> {r.reviewComment}
            </p>
          )}
          {r.history?.length > 0 && (
            <details className="ds-history">
              <summary>History ({r.history.length})</summary>
              <ol>
                {r.history.map((h, i) => (
                  <li key={i}>
                    {new Date(h.at).toLocaleString()} — {human(h.action)}
                    {h.byName ? ` by ${h.byName}` : ''}
                    {h.comment ? `: “${h.comment}”` : ''}
                  </li>
                ))}
              </ol>
            </details>
          )}
          {r.canReview && (
            <div className="ds-review">
              <label>
                Comment <span className="fd-muted">(required to return or reject)</span>
                <textarea rows={2} value={comment} onChange={(e) => setComment(e.target.value)} maxLength={1000} />
              </label>
              <div className="fd-actions">
                <button type="button" className="fd-btn" disabled={decide.isPending || comment.trim().length < 5} onClick={() => decide.mutate('REJECT')}>
                  Reject
                </button>
                <button type="button" className="fd-btn" disabled={decide.isPending || comment.trim().length < 5} onClick={() => decide.mutate('RETURN')}>
                  Return for correction
                </button>
                <button type="button" className="fd-btn fd-primary" disabled={decide.isPending} onClick={() => decide.mutate('VERIFY')}>
                  Verify
                </button>
              </div>
            </div>
          )}
          {error && (
            <p className="fd-error" role="alert">
              {error}
            </p>
          )}
          {own && (
            <div className="fd-actions">
              {['DRAFT', 'RETURNED_FOR_CORRECTION', 'REJECTED'].includes(r.status) && (
                <button type="button" className="fd-btn" disabled={act.isPending} onClick={() => window.confirm('Delete this record?') && act.mutate('delete')}>
                  Delete
                </button>
              )}
              {EDITABLE.includes(r.status) && (
                <button type="button" className="fd-btn" onClick={() => onEdit(r)}>
                  Edit
                </button>
              )}
              {['DRAFT', 'RETURNED_FOR_CORRECTION'].includes(r.status) && (
                <button type="button" className="fd-btn fd-primary" disabled={act.isPending} onClick={() => act.mutate('submit')}>
                  Submit for verification
                </button>
              )}
            </div>
          )}
        </div>
      )}
      <DocumentPreviewModal isOpen={Boolean(preview)} document={preview} onClose={() => setPreview(null)} onDownload={(d) => documentService.downloadDocument(d._id, (d as any).originalFilename ?? 'evidence')} />
    </Modal>
  );
};

export const DossierRecordsPage: React.FC<{ kind: Kind }> = ({ kind }) => {
  const isCourse = kind === 'courses';
  const role = useAuthStore((s) => s.user?.role);
  const { years } = useAcademicYears();
  const queryClient = useQueryClient();
  const [params, setParams] = useSearchParams();
  const facultyId = params.get('facultyId') ?? '';
  const category = params.get('category') ?? '';
  const [status, setStatus] = useState('');
  const [academicYear, setAcademicYear] = useState('');
  const [type, setType] = useState('');
  const [editing, setEditing] = useState<Rec | null | undefined>(undefined);
  const [viewing, setViewing] = useState<string | null>(null);
  const isFaculty = role === 'FACULTY' || role === 'HOD' || role === 'DEAN';
  useOpenFromQuery({ course: () => setEditing(null), certification: () => setEditing(null), achievement: () => setEditing(null), award: () => setEditing(null) });

  const options = useQuery({ queryKey: ['dossier-options'], queryFn: async () => (await apiClient.get('/dossier/options')).data.data as Options, staleTime: Infinity });
  const list = useQuery({
    queryKey: ['dossier', kind, facultyId, status, academicYear, category, type],
    queryFn: async () =>
      (await apiClient.get(`/dossier/${kind}`, { params: { facultyId: facultyId || undefined, status: status || undefined, academicYear: academicYear || undefined, category: category || undefined, kind: type || undefined } })).data.data as Rec[],
  });
  const stats = useQuery({
    queryKey: ['dossier-course-stats', facultyId],
    queryFn: async () => (await apiClient.get('/dossier/courses/stats', { params: { facultyId: facultyId || undefined } })).data.data as Stats,
    enabled: isCourse,
  });
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['dossier'] });
    queryClient.invalidateQueries({ queryKey: ['dossier-course-stats'] });
    queryClient.invalidateQueries({ queryKey: ['dossier-record'] });
    queryClient.invalidateQueries({ queryKey: ['dossier-summary'] });
  };
  const setCategory = (v: string) => {
    const next = new URLSearchParams(params);
    if (v) next.set('category', v);
    else next.delete('category');
    setParams(next, { replace: true });
  };
  const s = stats.data;
  const items = list.data ?? [];
  const title = isCourse ? 'Courses & Certifications' : category === 'INVITED_TALK' ? 'Invited Talks' : category === 'AWARD' ? 'Awards & Honours' : 'Achievements & Recognition';

  return (
    <div className="fd">
      <header className="fd-head">
        <div>
          <h1>{title}</h1>
          <p className="fd-muted">
            {facultyId
              ? `Records of ${items[0]?.facultyName ?? 'this faculty member'}. Only verified records count in reports and rankings.`
              : isCourse
                ? 'Online courses, training programmes and professional certifications you have completed. Attach the certificate and submit; your HOD verifies it.'
                : 'Awards, honours, memberships, editorial roles, invited talks and responsibilities. Submit each with its evidence for verification.'}
          </p>
        </div>
        <div className="fd-filters">
          {facultyId && (
            <Link className="fd-btn" to={`/portal/dossier?facultyId=${facultyId}`}>
              Open dossier
            </Link>
          )}
          {!facultyId && isFaculty && options.data && (
            <button type="button" className="fd-btn fd-primary" onClick={() => setEditing(null)}>
              <i className="bi bi-plus-lg" aria-hidden /> Add {isCourse ? 'course' : 'achievement'}
            </button>
          )}
        </div>
      </header>

      {isCourse && s && (
        <section className="fd-tiles" aria-label="Course statistics">
          <div className="fd-tile">
            <span>Courses (verified / recorded)</span>
            <strong>
              {s.verified.courses} / {s.recorded.courses}
            </strong>
          </div>
          <div className="fd-tile">
            <span>Certifications (verified / recorded)</span>
            <strong>
              {s.verified.certifications} / {s.recorded.certifications}
            </strong>
          </div>
          <div className="fd-tile">
            <span>Learning hours (verified)</span>
            <strong>{s.verified.hours}</strong>
            <small>{s.recorded.hours} recorded</small>
          </div>
          <div className="fd-tile">
            <span>This year ({s.academicYear})</span>
            <strong>{s.thisYear.recorded}</strong>
            <small>{s.thisYear.verified} verified</small>
          </div>
          <div className={`fd-tile ${s.awaitingVerification ? 'is-warn' : ''}`}>
            <span>Awaiting verification</span>
            <strong>{s.awaitingVerification}</strong>
          </div>
          <div className={`fd-tile ${s.needsCorrection ? 'is-warn' : ''}`}>
            <span>Returned for correction</span>
            <strong>{s.needsCorrection}</strong>
          </div>
        </section>
      )}

      <section className="fd-card">
        <div className="ds-filters">
          <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
            <option value="">All statuses</option>
            {Object.entries(STATUS_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          <select value={academicYear} onChange={(e) => setAcademicYear(e.target.value)} aria-label="Academic year">
            <option value="">All years</option>
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
          {isCourse ? (
            <>
              <select value={type} onChange={(e) => setType(e.target.value)} aria-label="Type">
                <option value="">Courses and certifications</option>
                {(options.data?.courseKinds ?? []).map((k) => (
                  <option key={k} value={k}>
                    {human(k)}
                  </option>
                ))}
              </select>
              <select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Category">
                <option value="">All categories</option>
                {(options.data?.courseCategories ?? []).map((k) => (
                  <option key={k} value={k}>
                    {human(k)}
                  </option>
                ))}
              </select>
            </>
          ) : (
            <select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Category">
              <option value="">All categories</option>
              {(options.data?.achievementCategories ?? []).map((k) => (
                <option key={k} value={k}>
                  {human(k)}
                </option>
              ))}
            </select>
          )}
        </div>
        <div className="fd-table-wrap">
          <table className="fd-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>{isCourse ? 'Provider' : 'Body'}</th>
                <th>{isCourse ? 'Type' : 'Category'}</th>
                <th>Date</th>
                {isCourse && <th className="num">Hours</th>}
                <th>Evidence</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {list.isLoading && (
                <tr>
                  <td colSpan={7} className="fd-muted">
                    Loading…
                  </td>
                </tr>
              )}
              {list.isError && (
                <tr>
                  <td colSpan={7} className="fd-error">
                    {formatErrorMessage(list.error, 'Records could not be loaded.')}
                  </td>
                </tr>
              )}
              {list.data && items.length === 0 && (
                <tr>
                  <td colSpan={7} className="fd-muted">
                    Nothing recorded yet{status || academicYear || category || type ? ' for these filters' : ''}.
                  </td>
                </tr>
              )}
              {items.map((r) => (
                <tr key={r._id} className="ds-row" onClick={() => setViewing(r._id)}>
                  <td>
                    <button type="button" className="ds-title" onClick={() => setViewing(r._id)}>
                      {r.title}
                    </button>
                    <div className="fd-muted">{isCourse ? human(r.category) : r.role || human(r.level)}</div>
                  </td>
                  <td>{isCourse ? [r.provider, r.platform].filter(Boolean).join(' · ') : r.body}</td>
                  <td>{human(isCourse ? r.kind : r.category)}</td>
                  <td className="fd-dates">{day(isCourse ? r.completionDate : r.date)}</td>
                  {isCourse && <td className="num">{r.durationHours ?? '—'}</td>}
                  <td>{r.documentIds?.length ? <i className="bi bi-paperclip" aria-label="Evidence attached" /> : <span className="fd-muted">—</span>}</td>
                  <td>
                    <span className={`ds-status st-${r.status.toLowerCase()}`}>{STATUS_LABEL[r.status] ?? r.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {editing !== undefined && options.data && <RecordForm kind={kind} options={options.data} record={editing} defaultCategory={isCourse ? undefined : category} onClose={() => setEditing(undefined)} onSaved={refresh} />}
      {viewing && (
        <RecordDetail
          kind={kind}
          id={viewing}
          onClose={() => setViewing(null)}
          onChanged={refresh}
          onEdit={(r) => {
            setViewing(null);
            setEditing(r);
          }}
        />
      )}
    </div>
  );
};

export const CoursesPage: React.FC = () => <DossierRecordsPage kind="courses" />;
export const AchievementsPage: React.FC = () => <DossierRecordsPage kind="achievements" />;
