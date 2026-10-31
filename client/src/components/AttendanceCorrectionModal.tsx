import React, { useState } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { Input } from './Input';
import { Select } from './Select';
import { useToast } from './Toast';
import { attendanceService } from '../services/attendance.service';
import type { AttendanceStatus, FacultyAttendanceRecord } from '../types/attendance';
import { ATTENDANCE_STATUSES } from '../types/attendance';
import { AttendanceStatusBadge } from './AttendanceStatusBadge';

interface AttendanceCorrectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  record: FacultyAttendanceRecord | null;
}

export const AttendanceCorrectionModal: React.FC<AttendanceCorrectionModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  record,
}) => {
  const { addToast } = useToast();
  const [loading, setLoading] = useState(false);

  const [requestedStatus, setRequestedStatus] = useState<AttendanceStatus>('PRESENT');
  const [requestedCheckIn, setRequestedCheckIn] = useState('08:30');
  const [requestedCheckOut, setRequestedCheckOut] = useState('16:30');
  const [reason, setReason] = useState('');
  const [supportingDocumentUrl, setSupportingDocumentUrl] = useState('');

  if (!record) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    if (!reason || reason.trim().length < 5) {
      addToast('Please provide a valid reason (at least 5 characters)', 'error');
      return;
    }

    setLoading(true);
    try {
      const recordDate = new Date(record.date).toISOString().split('T')[0];
      const requiresTimes = ['PRESENT', 'HALF_DAY', 'LATE', 'WORK_FROM_HOME'].includes(requestedStatus);

      await attendanceService.submitCorrectionRequest({
        attendanceId: record._id,
        requestedStatus,
        requestedCheckIn: requiresTimes && requestedCheckIn ? `${recordDate}T${requestedCheckIn}:00.000Z` : undefined,
        requestedCheckOut: requiresTimes && requestedCheckOut ? `${recordDate}T${requestedCheckOut}:00.000Z` : undefined,
        reason: reason.trim(),
        supportingDocumentUrl: supportingDocumentUrl.trim() || undefined,
      });

      addToast('Correction request submitted for HOD/Admin review', 'success');
      onSuccess();
      onClose();
    } catch (err: any) {
      addToast(err?.response?.data?.message || err?.message || 'Failed to submit correction request', 'error');
    } finally {
      setLoading(false);
    }
  };

  const formattedDate = new Date(record.date).toLocaleDateString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  const requiresTimes = ['PRESENT', 'HALF_DAY', 'LATE', 'WORK_FROM_HOME'].includes(requestedStatus);

  return (
    <Modal isOpen={isOpen} onClose={loading ? () => {} : onClose} title="Request Attendance Correction">
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Record Overview */}
        <div
          style={{
            padding: '12px 14px',
            borderRadius: '8px',
            backgroundColor: 'var(--color-bg-secondary, rgba(255,255,255,0.03))',
            border: '1px solid var(--color-border)',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            fontSize: '13px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: 'var(--color-text-muted)' }}>Date:</span>
            <span style={{ fontWeight: 600 }}>{formattedDate}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: 'var(--color-text-muted)' }}>Current Status:</span>
            <AttendanceStatusBadge status={record.status} />
          </div>
          {(record.checkIn || record.checkOut) && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--color-text-muted)' }}>Current Timings:</span>
              <span style={{ fontSize: '12px', fontFamily: 'monospace' }}>
                {record.checkIn ? new Date(record.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--'} -{' '}
                {record.checkOut ? new Date(record.checkOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--'}
              </span>
            </div>
          )}
        </div>

        {/* Requested Status */}
        <div>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
            Requested Attendance Status
          </label>
          <Select
            value={requestedStatus}
            onChange={(e) => setRequestedStatus(e.target.value as AttendanceStatus)}
            required
            options={ATTENDANCE_STATUSES.map((st) => ({
              value: st,
              label: st.replace(/_/g, ' '),
            }))}
          />
        </div>

        {/* Requested Times */}
        {requiresTimes && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                Requested Check-in
              </label>
              <Input
                type="time"
                value={requestedCheckIn}
                onChange={(e) => setRequestedCheckIn(e.target.value)}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                Requested Check-out
              </label>
              <Input
                type="time"
                value={requestedCheckOut}
                onChange={(e) => setRequestedCheckOut(e.target.value)}
              />
            </div>
          </div>
        )}

        {/* Reason for Correction */}
        <div>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
            Reason for Correction <span style={{ color: '#D14343' }}>*</span>
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            required
            placeholder="Explain why this attendance record requires correction (e.g. On-duty at symposium, technical issue with punch-in, etc.)"
            style={{
              width: '100%',
              padding: '8px 12px',
              borderRadius: '6px',
              backgroundColor: 'var(--color-bg)',
              border: '1px solid var(--color-border)',
              color: 'var(--color-text)',
              fontSize: '13px',
              fontFamily: 'inherit',
              resize: 'vertical',
            }}
          />
          <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '4px' }}>
            Minimum 5 characters required. This will be recorded in the permanent audit trail.
          </div>
        </div>

        {/* Supporting Document URL */}
        <div>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
            Supporting Document Link (Optional)
          </label>
          <Input
            type="url"
            value={supportingDocumentUrl}
            onChange={(e) => setSupportingDocumentUrl(e.target.value)}
            placeholder="https://drive.google.com/..."
          />
        </div>

        {/* Modal Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
          <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={loading}>
            {loading ? 'Submitting...' : 'Submit Request'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
