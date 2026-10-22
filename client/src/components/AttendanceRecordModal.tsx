import React, { useState, useEffect } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { Input } from './Input';
import { Select } from './Select';
import { useToast } from './Toast';
import { attendanceService } from '../services/attendance.service';
import type { AttendanceStatus, AttendanceSource, FacultyAttendanceRecord } from '../types/attendance';
import { ATTENDANCE_STATUSES } from '../types/attendance';
import type { FacultyProfile } from '../types/faculty';

interface AttendanceRecordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  facultyList: FacultyProfile[];
  initialFacultyId?: string;
  initialDate?: string;
  existingRecord?: FacultyAttendanceRecord | null;
  isSelfReport?: boolean;
}

export const AttendanceRecordModal: React.FC<AttendanceRecordModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  facultyList,
  initialFacultyId,
  initialDate,
  existingRecord,
  isSelfReport = false,
}) => {
  const { addToast } = useToast();
  const [loading, setLoading] = useState(false);

  const [facultyId, setFacultyId] = useState(initialFacultyId || '');
  const [date, setDate] = useState(initialDate || new Date().toISOString().split('T')[0]);
  const [status, setStatus] = useState<AttendanceStatus>('PRESENT');
  const [checkInTime, setCheckInTime] = useState('08:30');
  const [checkOutTime, setCheckOutTime] = useState('16:30');
  const [remarks, setRemarks] = useState('');
  const [source, setSource] = useState<AttendanceSource>(isSelfReport ? 'SELF_REPORT' : 'MANUAL');

  useEffect(() => {
    if (existingRecord) {
      const fId = typeof existingRecord.facultyId === 'object' ? existingRecord.facultyId._id : existingRecord.facultyId;
      setFacultyId(fId);
      setDate(new Date(existingRecord.date).toISOString().split('T')[0]);
      setStatus(existingRecord.status);
      setSource(existingRecord.source);
      setRemarks(existingRecord.remarks || '');

      if (existingRecord.checkIn) {
        const d = new Date(existingRecord.checkIn);
        setCheckInTime(d.toTimeString().slice(0, 5));
      } else {
        setCheckInTime('');
      }

      if (existingRecord.checkOut) {
        const d = new Date(existingRecord.checkOut);
        setCheckOutTime(d.toTimeString().slice(0, 5));
      } else {
        setCheckOutTime('');
      }
    } else {
      if (initialFacultyId) setFacultyId(initialFacultyId);
      if (initialDate) setDate(initialDate);
      setStatus('PRESENT');
      setCheckInTime('08:30');
      setCheckOutTime('16:30');
      setRemarks('');
      setSource(isSelfReport ? 'SELF_REPORT' : 'MANUAL');
    }
  }, [existingRecord, initialFacultyId, initialDate, isOpen, isSelfReport]);

  // Compute calculated working hours
  const calculatedHours = React.useMemo(() => {
    if (!checkInTime || !checkOutTime) return null;
    const [inH, inM] = checkInTime.split(':').map(Number);
    const [outH, outM] = checkOutTime.split(':').map(Number);
    if (isNaN(inH) || isNaN(inM) || isNaN(outH) || isNaN(outM)) return null;

    const inTotal = inH * 60 + inM;
    const outTotal = outH * 60 + outM;
    if (outTotal <= inTotal) return null;

    const diffMinutes = outTotal - inTotal;
    return (diffMinutes / 60).toFixed(2);
  }, [checkInTime, checkOutTime]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    if (!facultyId) {
      addToast('Please select a faculty member', 'error');
      return;
    }
    if (!date) {
      addToast('Please select a date', 'error');
      return;
    }

    setLoading(true);
    try {
      // Build ISO checkIn & checkOut strings
      let checkInIso: string | undefined;
      let checkOutIso: string | undefined;

      if (['PRESENT', 'HALF_DAY', 'LATE', 'WORK_FROM_HOME'].includes(status)) {
        if (checkInTime) {
          checkInIso = `${date}T${checkInTime}:00.000Z`;
        }
        if (checkOutTime) {
          checkOutIso = `${date}T${checkOutTime}:00.000Z`;
        }
      }

      if (existingRecord && !existingRecord.isLocked) {
        // Update
        await attendanceService.updateAttendance(existingRecord._id, {
          status,
          checkIn: checkInIso,
          checkOut: checkOutIso,
          remarks,
        });
        addToast('Attendance updated successfully', 'success');
      } else {
        // Record new
        await attendanceService.recordAttendance({
          facultyId,
          date,
          status,
          source,
          checkIn: checkInIso,
          checkOut: checkOutIso,
          remarks,
        });
        addToast('Attendance recorded successfully', 'success');
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      addToast(err?.response?.data?.message || err?.message || 'Failed to save attendance', 'error');
    } finally {
      setLoading(false);
    }
  };

  const statusRequiresTimes = ['PRESENT', 'HALF_DAY', 'LATE', 'WORK_FROM_HOME'].includes(status);

  return (
    <Modal
      isOpen={isOpen}
      onClose={loading ? () => {} : onClose}
      title={existingRecord ? 'Edit Attendance Record' : isSelfReport ? 'Self-Report Attendance' : 'Mark Faculty Attendance'}
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Faculty selection */}
        <div>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
            Faculty Member
          </label>
          {isSelfReport || existingRecord ? (
            <input
              type="text"
              readOnly
              disabled
              value={
                facultyList.find((f) => f._id === facultyId)?.name ||
                (typeof existingRecord?.facultyId === 'object' ? (existingRecord.facultyId as any).name : facultyId)
              }
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: '6px',
                backgroundColor: 'var(--color-bg-secondary, rgba(255,255,255,0.05))',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text-muted)',
              }}
            />
          ) : (
            <Select
              value={facultyId}
              onChange={(e) => setFacultyId(e.target.value)}
              required
              options={[
                { value: '', label: '-- Select Faculty --' },
                ...facultyList.map((f) => ({
                  value: f._id,
                  label: `${f.name} (${f.employeeId || 'ID'}) - ${f.designation || 'Faculty'}`,
                })),
              ]}
            />
          )}
        </div>

        {/* Date */}
        <div>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
            Attendance Date
          </label>
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            max={new Date().toISOString().split('T')[0]}
            disabled={!!existingRecord}
            required
          />
        </div>

        {/* Status */}
        <div>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
            Attendance Status
          </label>
          <Select
            value={status}
            onChange={(e) => setStatus(e.target.value as AttendanceStatus)}
            required
            options={ATTENDANCE_STATUSES.map((st) => ({
              value: st,
              label: st.replace(/_/g, ' '),
            }))}
          />
        </div>

        {/* Times if status has active attendance */}
        {statusRequiresTimes && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                Check-in Time
              </label>
              <Input
                type="time"
                value={checkInTime}
                onChange={(e) => setCheckInTime(e.target.value)}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>
                Check-out Time
              </label>
              <Input
                type="time"
                value={checkOutTime}
                onChange={(e) => setCheckOutTime(e.target.value)}
              />
            </div>
          </div>
        )}

        {/* Working hours computation display */}
        {statusRequiresTimes && calculatedHours && (
          <div
            style={{
              padding: '8px 12px',
              borderRadius: '6px',
              backgroundColor: 'rgba(59, 130, 246, 0.1)',
              border: '1px solid rgba(59, 130, 246, 0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '13px',
            }}
          >
            <span style={{ color: 'var(--color-text-muted)' }}>Estimated Working Hours:</span>
            <span style={{ fontWeight: 700, color: '#3b82f6' }}>{calculatedHours} hrs</span>
          </div>
        )}

        {/* Remarks */}
        <div>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
            Remarks / Reason (Optional)
          </label>
          <textarea
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            rows={2}
            placeholder="e.g. Approved OD for conference, late due to train delay, etc."
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
        </div>

        {/* Modal Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
          <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={loading}>
            {loading ? 'Saving...' : existingRecord ? 'Update Record' : 'Record Attendance'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
