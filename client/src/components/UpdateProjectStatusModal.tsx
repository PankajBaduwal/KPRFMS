import React, { useState, useEffect, useRef } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { Input } from './Input';
import { Select } from './Select';
import { Alert } from './Alert';
import type { Project, ProjectStatus } from '../types/project';
import { UTILIZATION_STATUS_OPTIONS } from '../types/project';

interface UpdateProjectStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: Project | null;
  onUpdate: (data: {
    status: ProjectStatus;
    sanctionNumber?: string;
    sanctionedAmount?: number;
    receivedAmount?: number;
    approvalDate?: string;
    completionDate?: string;
    utilizationStatus?: string;
    remarks?: string;
  }) => Promise<void>;
}

export const UpdateProjectStatusModal: React.FC<UpdateProjectStatusModalProps> = ({
  isOpen,
  onClose,
  project,
  onUpdate,
}) => {
  const [status, setStatus] = useState<ProjectStatus>('SANCTIONED');
  const [sanctionNumber, setSanctionNumber] = useState('');
  const [sanctionedAmount, setSanctionedAmount] = useState('');
  const [receivedAmount, setReceivedAmount] = useState('');
  const [approvalDate, setApprovalDate] = useState('');
  const [completionDate, setCompletionDate] = useState('');
  const [utilizationStatus, setUtilizationStatus] = useState('Not Started');
  const [remarks, setRemarks] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Synchronous lock so a double-click / repeated Enter cannot send two requests
  const submittingRef = useRef(false);

  useEffect(() => {
    if (isOpen && project) {
      setStatus(project.status || 'SANCTIONED');
      setSanctionNumber(project.sanctionNumber || '');
      setSanctionedAmount(
        project.sanctionedAmount ? String(project.sanctionedAmount) : String(project.requestedAmount || '')
      );
      setReceivedAmount(project.receivedAmount ? String(project.receivedAmount) : '0');
      setApprovalDate(
        project.approvalDate
          ? new Date(project.approvalDate).toISOString().split('T')[0]
          : new Date().toISOString().split('T')[0]
      );
      setCompletionDate(
        project.completionDate ? new Date(project.completionDate).toISOString().split('T')[0] : ''
      );
      setUtilizationStatus((project.utilizationStatus as string) || 'Not Started');
      setRemarks('');
      setError(null);
    }
  }, [isOpen, project]);

  if (!project) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingRef.current) return;
    setError(null);

    if (status === 'SANCTIONED' && !sanctionNumber.trim()) {
      setError('Sanction order number is required when sanctioning a research grant.');
      return;
    }

    if (status === 'SANCTIONED' && (!sanctionedAmount || Number(sanctionedAmount) <= 0)) {
      setError('Please provide a valid sanctioned amount in INR.');
      return;
    }

    if (status === 'REJECTED' && !remarks.trim()) {
      setError('Please provide remarks explaining the reason for project rejection.');
      return;
    }

    submittingRef.current = true;
    setIsSubmitting(true);
    try {
      await onUpdate({
        status,
        sanctionNumber: sanctionNumber.trim() || undefined,
        sanctionedAmount: sanctionedAmount ? Number(sanctionedAmount) : undefined,
        receivedAmount: receivedAmount ? Number(receivedAmount) : undefined,
        approvalDate: approvalDate || undefined,
        completionDate: completionDate || undefined,
        utilizationStatus: utilizationStatus || undefined,
        remarks: remarks.trim() || undefined,
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to update project status.');
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={isSubmitting ? () => {} : onClose}
      closeOnEscape={!isSubmitting}
      closeOnBackdrop={!isSubmitting}
      title="Update Project Status & Sanction Order"
      size="md"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit} loading={isSubmitting}>
            Confirm Status Update
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        {error && <Alert variant="danger">{error}</Alert>}

        <div style={{ background: 'var(--color-surface)', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
          <div style={{ fontSize: 'var(--font-size-xs)', textTransform: 'uppercase', color: 'var(--color-text-muted)', fontWeight: 600 }}>
            Project Proposal
          </div>
          <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--color-text)', marginTop: '2px' }}>
            {project.title}
          </div>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
            PI: <strong>{project.piName}</strong> &bull; Agency: <em>{project.fundingAgency}</em> &bull; Requested: ₹{project.requestedAmount.toLocaleString()}
          </div>
        </div>

        <Select
          label="Target Project Status *"
          options={[
            { value: 'UNDER_REVIEW', label: 'Under Review by Agency / Committee' },
            { value: 'SANCTIONED', label: 'Sanctioned — Grant Approved' },
            { value: 'ONGOING', label: 'Ongoing — Active Execution' },
            { value: 'COMPLETED', label: 'Completed — All Deliverables Submitted' },
            { value: 'REJECTED', label: 'Rejected by Funding Agency' },
          ]}
          value={status}
          onChange={(e) => setStatus(e.target.value as ProjectStatus)}
          required
        />

        {(status === 'SANCTIONED' || status === 'ONGOING' || status === 'COMPLETED') && (
          <>
            <Input
              label="Sanction Order Number *"
              placeholder="e.g. SERB/CRG/2024/001429"
              value={sanctionNumber}
              onChange={(e) => setSanctionNumber(e.target.value)}
              required={status === 'SANCTIONED'}
            />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
              <Input
                label="Sanctioned Amount (₹) *"
                type="number"
                value={sanctionedAmount}
                onChange={(e) => setSanctionedAmount(e.target.value)}
                required={status === 'SANCTIONED'}
              />
              <Input
                label="Received / Credited (₹)"
                type="number"
                value={receivedAmount}
                onChange={(e) => setReceivedAmount(e.target.value)}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
              <Input
                label="Approval / Sanction Date"
                type="date"
                value={approvalDate}
                onChange={(e) => setApprovalDate(e.target.value)}
              />
              <Select
                label="Utilization Status"
                options={UTILIZATION_STATUS_OPTIONS}
                value={utilizationStatus}
                onChange={(e) => setUtilizationStatus(e.target.value)}
              />
            </div>
          </>
        )}

        {status === 'COMPLETED' && (
          <Input
            label="Completion Date"
            type="date"
            value={completionDate}
            onChange={(e) => setCompletionDate(e.target.value)}
          />
        )}

        <div className="input-group">
          <label htmlFor="proj-status-remarks" className="input-label">
            Official Remarks / Review Notes {status === 'REJECTED' && <span className="text-danger">*</span>}
          </label>
          <textarea
            id="proj-status-remarks"
            className="input-field"
            rows={3}
            placeholder={
              status === 'SANCTIONED'
                ? 'Details on grant disbursement, first installment, or requirements...'
                : status === 'REJECTED'
                ? 'Specify reasons for rejection or technical shortcomings...'
                : 'Optional notes regarding project status transition...'
            }
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
          />
        </div>
      </form>
    </Modal>
  );
};
