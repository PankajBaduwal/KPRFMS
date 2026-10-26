import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { approvalQueueService } from '../../services/approval-queue.service';
import type { ApprovalActionPayload, ApprovalQueueItem } from '../../types/approval-queue';
import { ROUTES } from '../../constants/routes';
import { useToast } from '../Toast';
import { formatErrorMessage } from '../../utils/errorHandler';

type Action = ApprovalActionPayload['action'];

/** Chip label per record type, in display order. */
const TYPE_LABELS: Record<string, string> = {
  LEAVE: 'Leave',
  ATTENDANCE_CORRECTION: 'Attendance',
  PUBLICATION: 'Publications',
  PROJECT: 'Projects',
  ACADEMIC_ACTIVITY: 'Activities',
  PATENT: 'Patents',
  COPYRIGHT: 'Copyrights',
  CONSULTANCY: 'Consultancy',
  STUDENT_PROJECT: 'Student projects',
  APPRAISAL: 'Appraisals',
};

const ACTION_COPY: Record<Action, { verb: string; done: string; button: string; className: string }> = {
  APPROVE: { verb: 'Approve', done: 'Approved', button: 'Confirm approval', className: 'is-approve' },
  RETURN_FOR_CORRECTION: { verb: 'Return', done: 'Returned for correction', button: 'Return to faculty', className: 'is-return' },
  REJECT: { verb: 'Reject', done: 'Rejected', button: 'Confirm rejection', className: 'is-reject' },
};

const VISIBLE = 8;
const QUERY_KEY = ['hod-inline-approvals'];

/**
 * Pending approvals on the HOD dashboard with approve / return / reject right on each row.
 * Uses the same approval-queue API as the full queue page, so the department, self-approval
 * and "reason required" rules are enforced by the server exactly as there.
 */
export const HodInlineApprovals: React.FC = () => {
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  const [type, setType] = useState<string>('ALL');
  const [open, setOpen] = useState<{ id: string; action: Action } | null>(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => approvalQueueService.getQueue({ status: 'PENDING', limit: 100, sortBy: 'submittedDate', sortOrder: 'asc' }),
    refetchInterval: 30_000,
  });

  const mutation = useMutation({
    mutationFn: (v: { item: ApprovalQueueItem; action: Action; reason: string }) =>
      approvalQueueService.executeAction(v.item.recordType, v.item.id, {
        action: v.action,
        reason: v.reason || undefined,
      }),
    onSuccess: (_res, v) => {
      addToast(`${ACTION_COPY[v.action].done}: ${v.item.title}`, v.action === 'APPROVE' ? 'success' : 'info');
      setOpen(null);
      setReason('');
      setError(null);
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      // The dashboard counts and the action banner reload on this event
      window.dispatchEvent(new CustomEvent('fms:records-updated'));
    },
    onError: (err) => setError(formatErrorMessage(err, 'The action could not be completed.')),
  });

  const pendingByType = data?.counts.pendingByType ?? {};
  const total = data?.counts.pending ?? 0;
  const items = useMemo(
    () => (data?.items ?? []).filter((i) => type === 'ALL' || i.recordType === type),
    [data, type]
  );
  const shown = items.slice(0, VISIBLE);
  const hidden = (type === 'ALL' ? total : pendingByType[type] ?? 0) - shown.length;
  const chips = Object.keys(TYPE_LABELS).filter((t) => pendingByType[t]);

  const start = (id: string, action: Action) => {
    setOpen({ id, action });
    setReason('');
    setError(null);
  };

  const submit = (item: ApprovalQueueItem) => {
    if (!open) return;
    const needsReason = open.action !== 'APPROVE';
    if (needsReason && reason.trim().length < 5) {
      setError('Please give a reason of at least 5 characters; the faculty member will see it.');
      return;
    }
    mutation.mutate({ item, action: open.action, reason: reason.trim() });
  };

  return (
    <section aria-label="Pending approvals" className="card-custom hia">
      <header className="hia-head">
        <div>
          <h3>
            <i className="bi bi-check2-circle" aria-hidden="true" />
            Pending approvals
            <span className={`hia-total ${total ? 'is-pending' : 'is-clear'}`}>{total} pending</span>
          </h3>
          <p>Approve, return or reject right here. Oldest requests are shown first.</p>
        </div>
        <Link to={`${ROUTES.APPROVALS}?status=PENDING`} className="btn-outline-primary btn-sm hia-queue-link">
          Open full queue <i className="bi bi-arrow-right" aria-hidden="true" />
        </Link>
      </header>

      {chips.length > 1 && (
        <div className="hia-chips" role="tablist" aria-label="Filter by type">
          <button type="button" role="tab" aria-selected={type === 'ALL'} className={type === 'ALL' ? 'is-active' : ''} onClick={() => setType('ALL')}>
            All ({total})
          </button>
          {chips.map((t) => (
            <button key={t} type="button" role="tab" aria-selected={type === t} className={type === t ? 'is-active' : ''} onClick={() => setType(t)}>
              {TYPE_LABELS[t]} ({pendingByType[t]})
            </button>
          ))}
        </div>
      )}

      {isLoading ? (
        <p className="hia-note">Loading pending requests…</p>
      ) : isError ? (
        <p className="hia-note">Pending requests could not be loaded. Open the full queue instead.</p>
      ) : shown.length === 0 ? (
        <div className="hia-empty">
          <i className="bi bi-patch-check" aria-hidden="true" />
          <strong>All caught up</strong>
          <span>Nothing is waiting for your approval.</span>
        </div>
      ) : (
        <ul className="hia-list">
          {shown.map((item) => {
            const isOpen = open?.id === item.id;
            const busy = mutation.isPending && mutation.variables?.item.id === item.id;
            return (
              <li key={`${item.recordType}-${item.id}`} className={`hia-row${isOpen ? ' is-open' : ''}`}>
                <div className="hia-main">
                  <div className="hia-info">
                    <span className="hia-type">{item.recordTypeLabel}</span>
                    <span className="hia-title">{item.title}</span>
                    <span className="hia-meta">
                      {item.faculty.name}
                      {item.faculty.designation ? ` · ${item.faculty.designation}` : ''} · submitted{' '}
                      {new Date(item.submittedDate).toLocaleDateString()}
                      {item.documentCount > 0 && (
                        <>
                          {' '}
                          · <i className="bi bi-paperclip" aria-hidden="true" /> {item.documentCount}
                        </>
                      )}
                    </span>
                    {item.summary && <span className="hia-summary">{item.summary}</span>}
                  </div>
                  <div className="hia-actions" aria-label={`Actions for ${item.title}`}>
                    <button type="button" className="hia-btn is-approve" disabled={busy} onClick={() => start(item.id, 'APPROVE')}>
                      <i className="bi bi-check-lg" aria-hidden="true" /> Approve
                    </button>
                    <button type="button" className="hia-btn is-return" disabled={busy} onClick={() => start(item.id, 'RETURN_FOR_CORRECTION')}>
                      <i className="bi bi-arrow-counterclockwise" aria-hidden="true" /> Return
                    </button>
                    <button type="button" className="hia-btn is-reject" disabled={busy} onClick={() => start(item.id, 'REJECT')}>
                      <i className="bi bi-x-lg" aria-hidden="true" /> Reject
                    </button>
                  </div>
                </div>

                {isOpen && open && (
                  <form
                    className={`hia-confirm ${ACTION_COPY[open.action].className}`}
                    onSubmit={(e) => {
                      e.preventDefault();
                      submit(item);
                    }}
                  >
                    <label htmlFor={`hia-reason-${item.id}`}>
                      {open.action === 'APPROVE'
                        ? 'Comment for the faculty member (optional)'
                        : `Reason for ${open.action === 'REJECT' ? 'rejecting' : 'returning'} (required)`}
                    </label>
                    <textarea
                      id={`hia-reason-${item.id}`}
                      className="form-control form-control-sm"
                      rows={2}
                      maxLength={500}
                      value={reason}
                      autoFocus
                      placeholder={open.action === 'APPROVE' ? 'e.g. Verified with the attached proof' : 'e.g. DOI is missing; please attach the acceptance letter'}
                      onChange={(e) => setReason(e.target.value)}
                    />
                    {error && (
                      <p className="hia-error" role="alert">
                        {error}
                      </p>
                    )}
                    <div className="hia-confirm-actions">
                      <button type="button" className="btn btn-sm btn-ghost" onClick={() => setOpen(null)} disabled={busy}>
                        Cancel
                      </button>
                      <button type="submit" className={`hia-btn is-solid ${ACTION_COPY[open.action].className}`} disabled={busy}>
                        {busy ? 'Saving…' : ACTION_COPY[open.action].button}
                      </button>
                    </div>
                  </form>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {hidden > 0 && (
        <Link to={`${ROUTES.APPROVALS}?status=PENDING`} className="hia-more">
          {hidden} more waiting in the full queue <i className="bi bi-arrow-right" aria-hidden="true" />
        </Link>
      )}
    </section>
  );
};
