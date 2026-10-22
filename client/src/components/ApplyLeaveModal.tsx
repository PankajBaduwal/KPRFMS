import React, { useState, useMemo, useEffect } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { Input } from './Input';
import { Select } from './Select';
import { Alert } from './Alert';
import { Badge } from './Badge';
import { FileUploader } from './FileUploader';
import { useToast } from './Toast';
import { leaveService } from '../services/leave.service';
import { documentService } from '../services/document.service';
import type { LeaveType, LeaveBalanceSummary } from '../types/leave';
import { LEAVE_TYPES, LEAVE_TYPE_LABELS } from '../types/leave';
import { DOCUMENT_TYPES, ACCESS_LEVELS } from '../types/document';
import { useAsyncAction } from '../hooks/useAsyncAction';

interface ApplyLeaveModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  balances: LeaveBalanceSummary | null;
  facultyId?: string;
  academicYear?: string;
}

export const ApplyLeaveModal: React.FC<ApplyLeaveModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  balances,
  facultyId,
  academicYear,
}) => {
  const { addToast } = useToast();
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  const [leaveType, setLeaveType] = useState<LeaveType>('CASUAL_LEAVE');
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  });
  const [isHalfDay, setIsHalfDay] = useState(false);
  const [reason, setReason] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadedDocName, setUploadedDocName] = useState<string | null>(null);
  const [supportingDocument, setSupportingDocument] = useState('');

  // Sync end date with start date
  useEffect(() => {
    if (startDate && (!endDate || endDate < startDate)) {
      setEndDate(startDate);
    }
  }, [startDate]);

  // Compute calculated days
  const calculatedDays = useMemo(() => {
    if (!startDate || !endDate) return 0;
    if (isHalfDay) return 0.5;

    const start = new Date(startDate);
    const end = new Date(endDate);
    if (start > end) return 0;

    let count = 0;
    const cur = new Date(start);
    while (cur <= end) {
      const dow = cur.getUTCDay();
      if (dow !== 0) count++; // Exclude Sunday
      cur.setUTCDate(cur.getUTCDate() + 1);
    }
    return count;
  }, [startDate, endDate, isHalfDay]);

  // Remaining balance for selected leave type
  const availableBalance = useMemo(() => {
    if (!balances || !balances.balances) return null;
    const b = balances.balances[leaveType];
    return b ? b.remaining : null;
  }, [balances, leaveType]);

  const hasInsufficientBalance = availableBalance !== null && calculatedDays > availableBalance;

  const handleFileUpload = async (files: File[]) => {
    const file = files[0];
    if (!file) return;

    if (uploadingDoc) return;
    setUploadingDoc(true);
    setUploadProgress(undefined);
    setError(null);
    try {
      const res = await documentService.uploadDocument(
        file,
        {
          title: `Leave Evidence - ${file.name}`,
          documentType: DOCUMENT_TYPES.APPRAISAL_EVIDENCE,
          accessLevel: ACCESS_LEVELS.DEPARTMENT,
        },
        (percent) => setUploadProgress(percent)
      );
      setSupportingDocument(res.storagePath || res._id || '');
      setUploadedDocName(file.name);
      addToast('Supporting document uploaded and verified.', 'success');
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to upload supporting document.');
    } finally {
      setUploadingDoc(false);
      setUploadProgress(undefined);
    }
  };

  // Ref-locked so the footer button and Enter in the form can never submit twice.
  const submitAction = useAsyncAction(async () => {
    try {
      await leaveService.applyLeave({
        facultyId,
        leaveType,
        startDate,
        endDate: isHalfDay ? startDate : endDate,
        numberOfDays: calculatedDays,
        reason: reason.trim(),
        supportingDocument: supportingDocument.trim() || undefined,
        academicYear,
      });

      addToast('Leave application submitted successfully.', 'success');
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to submit leave application.');
    }
  });
  const loading = submitAction.isPending;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (loading || uploadingDoc) return;
    setError(null);

    if (!reason || reason.trim().length < 5) {
      setError('Please provide a descriptive reason for leave (minimum 5 characters).');
      return;
    }
    if (calculatedDays <= 0) {
      setError('Invalid date range. Start date must be before or on end date.');
      return;
    }

    void submitAction.run();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={loading || uploadingDoc ? () => {} : onClose}
      title="Apply for Institutional Leave"
      size="lg"
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
          <Button variant="ghost" onClick={onClose} disabled={loading || uploadingDoc}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            loading={loading}
            disabled={uploadingDoc || hasInsufficientBalance}
          >
            Submit Application
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        {error && <Alert variant="danger">{error}</Alert>}

        {/* Section 1: Leave Classification & Entitlement */}
        <fieldset
          style={{
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            padding: 'var(--space-4)',
            margin: 0,
          }}
        >
          <legend
            style={{
              padding: '0 var(--space-2)',
              fontSize: 'var(--font-size-xs)',
              fontWeight: 700,
              color: 'var(--color-primary)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            1. Leave Classification & Entitlement
          </legend>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                Select official institutional leave category
              </span>
              {availableBalance !== null && (
                <Badge variant={hasInsufficientBalance ? 'danger' : 'success'} size="sm">
                  {availableBalance} days available
                </Badge>
              )}
            </div>

            <Select
              label="Leave Type"
              value={leaveType}
              onChange={(e) => setLeaveType(e.target.value as LeaveType)}
              required
              options={LEAVE_TYPES.map((lt) => ({
                value: lt,
                label: `${LEAVE_TYPE_LABELS[lt]} ${balances?.balances?.[lt] ? `(${balances.balances[lt].remaining} left)` : ''}`,
              }))}
              hint="Entitlement balance will be decremented upon HOD/Dean approval."
            />
          </div>
        </fieldset>

        {/* Section 2: Duration & Schedule */}
        <fieldset
          style={{
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            padding: 'var(--space-4)',
            margin: 0,
          }}
        >
          <legend
            style={{
              padding: '0 var(--space-2)',
              fontSize: 'var(--font-size-xs)',
              fontWeight: 700,
              color: 'var(--color-primary)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            2. Duration & Schedule
          </legend>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: isHalfDay ? '1fr' : '1fr 1fr', gap: 'var(--space-3)' }}>
              <Input
                label={isHalfDay ? 'Date *' : 'Start Date *'}
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
              />

              {!isHalfDay && (
                <Input
                  label="End Date *"
                  type="date"
                  value={endDate}
                  min={startDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  required
                />
              )}
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: 'var(--space-2) var(--space-3)',
                background: 'var(--color-surface-hover)',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--color-border)',
              }}
            >
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: 'var(--font-size-sm)', margin: 0 }}>
                <input
                  type="checkbox"
                  checked={isHalfDay}
                  onChange={(e) => setIsHalfDay(e.target.checked)}
                />
                <span>Half Day (FN or AN session — 0.5 day)</span>
              </label>

              <Badge variant="primary" size="md">
                Total: {calculatedDays} {calculatedDays === 1 ? 'day' : 'days'}
              </Badge>
            </div>

            {hasInsufficientBalance && (
              <Alert variant="danger">
                Requested duration ({calculatedDays} days) exceeds available balance ({availableBalance} days).
              </Alert>
            )}
          </div>
        </fieldset>

        {/* Section 3: Reason & Purpose */}
        <fieldset
          style={{
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            padding: 'var(--space-4)',
            margin: 0,
          }}
        >
          <legend
            style={{
              padding: '0 var(--space-2)',
              fontSize: 'var(--font-size-xs)',
              fontWeight: 700,
              color: 'var(--color-primary)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            3. Reason & Academic Engagement
          </legend>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            <label style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text)' }}>
              Reason for Absence *
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              required
              placeholder="State the academic, medical, or personal purpose (minimum 5 characters)..."
              style={{
                width: '100%',
                padding: 'var(--space-2) var(--space-3)',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text)',
                fontSize: 'var(--font-size-sm)',
                fontFamily: 'inherit',
                resize: 'vertical',
              }}
            />
            <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
              Will be presented to HOD and Academic Dean during approval workflow.
            </span>
          </div>
        </fieldset>

        {/* Section 4: Supporting Evidence / Document Upload */}
        <fieldset
          style={{
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            padding: 'var(--space-4)',
            margin: 0,
          }}
        >
          <legend
            style={{
              padding: '0 var(--space-2)',
              fontSize: 'var(--font-size-xs)',
              fontWeight: 700,
              color: 'var(--color-primary)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            4. Supporting Document (Medical / OD Letter)
          </legend>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            <FileUploader
              files={selectedFiles}
              onFilesChange={(files: File[]) => {
                setSelectedFiles(files);
                handleFileUpload(files);
              }}
              accept=".pdf,.png,.jpg,.jpeg"
              maxSizeBytes={10 * 1024 * 1024}
              disabled={loading}
              uploading={uploadingDoc}
              uploadProgress={uploadProgress}
              hint="Upload official medical certificate, OD invitation, or conference brochure (PDF or Image, max 10MB)"
            />

            {uploadedDocName && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: 'var(--space-2) var(--space-3)',
                  background: 'var(--color-surface-hover)',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--color-border)',
                  fontSize: 'var(--font-size-xs)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                  <i className="bi bi-file-earmark-check text-success" />
                  <span>{uploadedDocName}</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={loading}
                  onClick={() => {
                    setSupportingDocument('');
                    setUploadedDocName(null);
                  }}
                >
                  Remove
                </Button>
              </div>
            )}
          </div>
        </fieldset>
      </form>
    </Modal>
  );
};
