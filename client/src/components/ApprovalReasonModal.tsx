import React, { useState } from 'react';
import { useAsyncAction } from '../hooks/useAsyncAction';
import { formatErrorMessage } from '../utils/errorHandler';

interface ApprovalReasonModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: string, comments?: string) => Promise<void>;
  action: 'APPROVE' | 'REJECT' | 'RETURN_FOR_CORRECTION';
  recordTitle: string;
  recordType: string;
  isSubmitting?: boolean;
}

const PRESET_REASONS: Record<string, string[]> = {
  RETURN_FOR_CORRECTION: [
    'Uploaded certificate or document is unclear/illegible. Please re-upload high-resolution PDF.',
    'Indexing proof (Scopus/SCI screenshot or link) is missing or invalid.',
    'Submitted dates or working hours conflict with official departmental records.',
    'Sanction letter or proposal number does not match funding agency documentation.',
    'Incomplete author or team member information provided. Please update all co-authors.',
    'Evidence requirements not fully satisfied. Please attach official supporting endorsement.',
  ],
  REJECT: [
    'Does not comply with departmental academic publication/activity guidelines.',
    'Duplicate submission. An identical record has already been verified and processed.',
    'Ineligible submission. Activity was conducted outside the recognized academic tenure.',
    'Funding agency or publication venue is not recognized by institutional policy.',
    'Insufficient documentation provided after review.',
  ],
  APPROVE: [
    'Verified and recommended in compliance with institutional guidelines.',
    'All supporting documents and indexing criteria verified successfully.',
    'Approved per department policy.',
  ],
};

export const ApprovalReasonModal: React.FC<ApprovalReasonModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  action,
  recordTitle,
  recordType,
  isSubmitting: isSubmittingProp = false,
}) => {
  const [reason, setReason] = useState('');
  const [comments, setComments] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Ref-locked so a double click or repeated Enter never sends the decision twice.
  const submitAction = useAsyncAction(async (decisionReason: string, decisionComments?: string) => {
    try {
      await onConfirm(decisionReason, decisionComments);
      setReason('');
      setComments('');
      setError(null);
      onClose();
    } catch (err: unknown) {
      setError(formatErrorMessage(err, 'Failed to submit decision. Please try again.'));
    }
  });
  // Busy while this modal's own request runs, or while the parent reports one in flight.
  const isSubmitting = isSubmittingProp || submitAction.isPending;

  if (!isOpen) return null;

  const isMandatory = action === 'REJECT' || action === 'RETURN_FOR_CORRECTION';
  const presets = PRESET_REASONS[action] || [];

  const handleSelectPreset = (presetText: string) => {
    setReason(presetText);
    setError(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (isMandatory && reason.trim().length < 5) {
      setError('A specific reason with at least 5 characters is strictly required.');
      return;
    }
    void submitAction.run(reason.trim(), comments.trim() || undefined);
  };

  const getActionColor = () => {
    if (action === 'APPROVE') return '#16a34a';
    if (action === 'RETURN_FOR_CORRECTION') return '#d97706';
    return '#dc2626';
  };

  const getActionTitle = () => {
    if (action === 'APPROVE') return 'Approve Record';
    if (action === 'RETURN_FOR_CORRECTION') return 'Return for Correction';
    return 'Reject Record';
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '1rem',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) onClose();
      }}
    >
      <div
        style={{
          backgroundColor: '#fff',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '540px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          animation: 'fadeIn 0.2s ease-out',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#f8fafc',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                background: `${getActionColor()}15`,
                color: getActionColor(),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.2rem',
              }}
            >
              <i
                className={
                  action === 'APPROVE'
                    ? 'bi bi-check-circle-fill'
                    : action === 'RETURN_FOR_CORRECTION'
                    ? 'bi bi-arrow-counterclockwise'
                    : 'bi bi-x-circle-fill'
                }
              />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#172B45' }}>
                {getActionTitle()}
              </h3>
              <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
                {recordType.replace(/_/g, ' ')} Verification Decision
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: '#94a3b8',
              fontSize: '1.25rem',
            }}
          >
            <i className="bi bi-x-lg" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Target Record Info Card */}
          <div
            style={{
              background: '#f1f5f9',
              borderRadius: '8px',
              padding: '0.85rem 1rem',
              fontSize: '0.85rem',
              color: '#334155',
              border: '1px solid #e2e8f0',
            }}
          >
            <span style={{ fontWeight: 600, color: '#475569', display: 'block', fontSize: '0.75rem', textTransform: 'uppercase', marginBottom: '2px' }}>
              Target Record
            </span>
            <span style={{ fontWeight: 700, color: '#172B45' }}>{recordTitle}</span>
          </div>

          {/* Preset reasons dropdown */}
          {presets.length > 0 && (
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                Select Institutional Reason Template
              </label>
              <select
                onChange={(e) => {
                  if (e.target.value) handleSelectPreset(e.target.value);
                }}
                defaultValue=""
                disabled={isSubmitting}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.85rem',
                  backgroundColor: '#fff',
                  color: '#334155',
                }}
              >
                <option value="">-- Choose from preset standard reasons --</option>
                {presets.map((p, idx) => (
                  <option key={idx} value={p}>
                    {p.length > 70 ? p.substring(0, 67) + '...' : p}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Mandatory Reason Input */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#172B45' }}>
                {isMandatory ? 'Official Reason / Review Remarks' : 'Remarks / Recommendation Note'}
                {isMandatory && <span style={{ color: '#B42318', marginLeft: '4px' }}>* (Mandatory)</span>}
              </label>
              {isMandatory && (
                <span style={{ fontSize: '0.75rem', color: reason.trim().length >= 5 ? '#16a34a' : '#94a3b8' }}>
                  {reason.trim().length}/5 chars min
                </span>
              )}
            </div>
            <textarea
              required={isMandatory}
              rows={4}
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                if (error) setError(null);
              }}
              placeholder={
                isMandatory
                  ? 'Specify precise institutional reason explaining why this record is being returned for correction or rejected...'
                  : 'Add optional verification remarks or recommendations for records...'
              }
              disabled={isSubmitting}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '8px',
                border: error ? '1.5px solid #dc2626' : '1px solid #cbd5e1',
                fontSize: '0.88rem',
                fontFamily: 'inherit',
                resize: 'vertical',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
            {error && (
              <p style={{ margin: '4px 0 0', fontSize: '0.78rem', color: '#B42318', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <i className="bi bi-exclamation-circle-fill" /> {error}
              </p>
            )}
          </div>

          {/* Optional Internal Comments */}
          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
              Additional Administrative Comments (Optional)
            </label>
            <input
              type="text"
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              placeholder="Internal file notes, reference numbers, or guidance..."
              disabled={isSubmitting}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '0.85rem',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Footer Actions */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: '10px',
              marginTop: '0.75rem',
              paddingTop: '1rem',
              borderTop: '1px solid #e2e8f0',
            }}
          >
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                background: '#fff',
                color: '#475569',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || (isMandatory && reason.trim().length < 5)}
              style={{
                padding: '8px 20px',
                borderRadius: '8px',
                border: 'none',
                background: getActionColor(),
                color: '#fff',
                fontSize: '0.88rem',
                fontWeight: 700,
                cursor: isSubmitting || (isMandatory && reason.trim().length < 5) ? 'not-allowed' : 'pointer',
                opacity: isSubmitting || (isMandatory && reason.trim().length < 5) ? 0.6 : 1,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              {isSubmitting ? (
                <>
                  <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
                  Processing...
                </>
              ) : (
                <>
                  <i
                    className={
                      action === 'APPROVE'
                        ? 'bi bi-check-lg'
                        : action === 'RETURN_FOR_CORRECTION'
                        ? 'bi bi-arrow-counterclockwise'
                        : 'bi bi-x-lg'
                    }
                  />
                  Confirm {getActionTitle()}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
