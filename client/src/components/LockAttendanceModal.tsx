import React, { useState } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { Input } from './Input';
import { Select } from './Select';
import { useToast } from './Toast';
import { attendanceService } from '../services/attendance.service';
import { Lock, ShieldAlert } from 'lucide-react';

interface LockAttendanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  departments: Array<{ _id: string; name: string; code: string }>;
}

export const LockAttendanceModal: React.FC<LockAttendanceModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  departments,
}) => {
  const { addToast } = useToast();
  const [loading, setLoading] = useState(false);

  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(1); // Start of current month
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [departmentId, setDepartmentId] = useState('');

  const handleLock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    if (!startDate || !endDate) {
      addToast('Please select start and end dates', 'error');
      return;
    }
    if (new Date(startDate) > new Date(endDate)) {
      addToast('Start date cannot be after end date', 'error');
      return;
    }

    setLoading(true);
    try {
      const res = await attendanceService.lockAttendance({
        startDate,
        endDate,
        departmentId: departmentId || undefined,
      });

      addToast(`Successfully locked ${res.lockedCount} attendance records`, 'success');
      onSuccess();
      onClose();
    } catch (err: any) {
      addToast(err?.response?.data?.message || err?.message || 'Failed to lock records', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={loading ? () => {} : onClose} title="Lock Historical Attendance Records">
      <form onSubmit={handleLock} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div
          style={{
            padding: '12px',
            borderRadius: '8px',
            backgroundColor: 'rgba(239, 68, 68, 0.08)',
            border: '1px solid rgba(239, 68, 68, 0.25)',
            display: 'flex',
            gap: '10px',
            alignItems: 'flex-start',
            fontSize: '12px',
            color: 'var(--color-text)',
          }}
        >
          <ShieldAlert size={20} color="#ef4444" style={{ flexShrink: 0, marginTop: '2px' }} />
          <div>
            <strong>Historical Protection:</strong> Locking attendance records prevents any direct alterations.
            Once locked, records can only be corrected through the formal multi-level correction and audit approval workflow.
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
              Start Date
            </label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
              End Date
            </label>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              required
            />
          </div>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
            Target Department (Optional)
          </label>
          <Select
            value={departmentId}
            onChange={(e) => setDepartmentId(e.target.value)}
            options={[
              { value: '', label: 'All Departments (Institution-Wide)' },
              ...departments.map((d) => ({
                value: d._id,
                label: `${d.name} (${d.code})`,
              })),
            ]}
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
          <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="danger"
            loading={loading}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            {!loading && <Lock size={15} />}
            {loading ? 'Locking...' : 'Lock Records Now'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
