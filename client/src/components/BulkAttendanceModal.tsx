import React, { useState, useEffect } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { Input } from './Input';
import { useToast } from './Toast';
import { attendanceService } from '../services/attendance.service';
import type { AttendanceStatus, RecordAttendanceInput } from '../types/attendance';
import { ATTENDANCE_STATUSES } from '../types/attendance';
import type { FacultyProfile } from '../types/faculty';

interface BulkAttendanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  departmentId: string;
  departmentName?: string;
  facultyList: FacultyProfile[];
  initialDate?: string;
}

interface FacultyRowState {
  facultyId: string;
  name: string;
  employeeId: string;
  status: AttendanceStatus;
  checkIn: string;
  checkOut: string;
  remarks: string;
}

export const BulkAttendanceModal: React.FC<BulkAttendanceModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  departmentId,
  departmentName,
  facultyList,
  initialDate,
}) => {
  const { addToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [date, setDate] = useState(initialDate || new Date().toISOString().split('T')[0]);
  const [rows, setRows] = useState<FacultyRowState[]>([]);

  // Filter department faculty
  useEffect(() => {
    const deptFacs = facultyList.filter((f) => {
      const dId = typeof f.departmentId === 'object' ? (f.departmentId as any)._id : f.departmentId;
      return !departmentId || dId === departmentId;
    });

    setRows(
      deptFacs.map((f) => ({
        facultyId: f._id,
        name: f.name,
        employeeId: f.employeeId || '',
        status: 'PRESENT',
        checkIn: '08:30',
        checkOut: '16:30',
        remarks: '',
      }))
    );
  }, [departmentId, facultyList, isOpen]);

  const updateRow = (index: number, updates: Partial<FacultyRowState>) => {
    setRows((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], ...updates };
      return copy;
    });
  };

  const handleMarkAll = (status: AttendanceStatus) => {
    setRows((prev) =>
      prev.map((r) => ({
        ...r,
        status,
        checkIn: ['PRESENT', 'HALF_DAY', 'LATE', 'WORK_FROM_HOME'].includes(status) ? r.checkIn || '08:30' : '',
        checkOut: ['PRESENT', 'HALF_DAY', 'LATE', 'WORK_FROM_HOME'].includes(status) ? r.checkOut || '16:30' : '',
      }))
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    if (rows.length === 0) {
      addToast('No faculty available in this department', 'error');
      return;
    }

    setLoading(true);
    try {
      const records: RecordAttendanceInput[] = rows.map((r) => {
        const statusRequiresTimes = ['PRESENT', 'HALF_DAY', 'LATE', 'WORK_FROM_HOME'].includes(r.status);
        return {
          facultyId: r.facultyId,
          date,
          status: r.status,
          source: 'MANUAL',
          checkIn: statusRequiresTimes && r.checkIn ? `${date}T${r.checkIn}:00.000Z` : undefined,
          checkOut: statusRequiresTimes && r.checkOut ? `${date}T${r.checkOut}:00.000Z` : undefined,
          remarks: r.remarks || undefined,
        };
      });

      const res = await attendanceService.bulkRecordAttendance({ records });
      addToast(
        `Bulk recording complete: ${res.recorded} saved successfully${res.errorCount ? `, ${res.errorCount} errors` : ''}`,
        res.errorCount ? 'warning' : 'success'
      );
      onSuccess();
      onClose();
    } catch (err: any) {
      addToast(err?.response?.data?.message || err?.message || 'Failed to submit bulk attendance', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={loading ? () => {} : onClose}
      title={`Bulk Attendance Recording — ${departmentName || 'Department'}`}
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Controls row */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            padding: '12px',
            backgroundColor: 'var(--color-bg-secondary, rgba(255,255,255,0.03))',
            borderRadius: '8px',
            border: '1px solid var(--color-border)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '13px', fontWeight: 600 }}>Date:</span>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              max={new Date().toISOString().split('T')[0]}
              required
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>Quick set:</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={loading}
              onClick={() => handleMarkAll('PRESENT')}
            >
              All Present
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={loading}
              onClick={() => handleMarkAll('WEEK_OFF')}
            >
              All Week Off
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={loading}
              onClick={() => handleMarkAll('HOLIDAY')}
            >
              All Holiday
            </Button>
          </div>
        </div>

        {/* Faculty Rows */}
        <div style={{ maxHeight: '420px', overflowY: 'auto', border: '1px solid var(--color-border)', borderRadius: '6px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--color-bg-secondary)', borderBottom: '1px solid var(--color-border)' }}>
                <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600 }}>Faculty</th>
                <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, width: '150px' }}>Status</th>
                <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, width: '100px' }}>In</th>
                <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, width: '100px' }}>Out</th>
                <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600 }}>Remarks</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => {
                const requiresTimes = ['PRESENT', 'HALF_DAY', 'LATE', 'WORK_FROM_HOME'].includes(row.status);
                return (
                  <tr key={row.facultyId} style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <td style={{ padding: '8px 12px' }}>
                      <div style={{ fontWeight: 600 }}>{row.name}</div>
                      <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>{row.employeeId}</div>
                    </td>
                    <td style={{ padding: '8px 12px' }}>
                      <select
                        value={row.status}
                        onChange={(e) => updateRow(idx, { status: e.target.value as AttendanceStatus })}
                        style={{
                          width: '100%',
                          padding: '6px 8px',
                          borderRadius: '4px',
                          backgroundColor: 'var(--color-bg)',
                          border: '1px solid var(--color-border)',
                          color: 'var(--color-text)',
                          fontSize: '12px',
                        }}
                      >
                        {ATTENDANCE_STATUSES.map((st) => (
                          <option key={st} value={st}>
                            {st.replace(/_/g, ' ')}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td style={{ padding: '8px 12px' }}>
                      <input
                        type="time"
                        value={row.checkIn}
                        disabled={!requiresTimes}
                        onChange={(e) => updateRow(idx, { checkIn: e.target.value })}
                        style={{
                          width: '100%',
                          padding: '4px 6px',
                          borderRadius: '4px',
                          backgroundColor: requiresTimes ? 'var(--color-bg)' : 'transparent',
                          border: '1px solid var(--color-border)',
                          color: 'var(--color-text)',
                          fontSize: '12px',
                        }}
                      />
                    </td>
                    <td style={{ padding: '8px 12px' }}>
                      <input
                        type="time"
                        value={row.checkOut}
                        disabled={!requiresTimes}
                        onChange={(e) => updateRow(idx, { checkOut: e.target.value })}
                        style={{
                          width: '100%',
                          padding: '4px 6px',
                          borderRadius: '4px',
                          backgroundColor: requiresTimes ? 'var(--color-bg)' : 'transparent',
                          border: '1px solid var(--color-border)',
                          color: 'var(--color-text)',
                          fontSize: '12px',
                        }}
                      />
                    </td>
                    <td style={{ padding: '8px 12px' }}>
                      <input
                        type="text"
                        placeholder="Optional remarks"
                        value={row.remarks}
                        onChange={(e) => updateRow(idx, { remarks: e.target.value })}
                        style={{
                          width: '100%',
                          padding: '4px 8px',
                          borderRadius: '4px',
                          backgroundColor: 'var(--color-bg)',
                          border: '1px solid var(--color-border)',
                          color: 'var(--color-text)',
                          fontSize: '12px',
                        }}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Modal Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={loading}>
            {loading ? 'Recording...' : `Record All (${rows.length})`}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
