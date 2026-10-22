import React, { useState, useEffect, useRef } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import type { IAppraisalCycle, ICategoryConfig, CycleStatus } from '../types/appraisal';

interface Props {
  isOpen: boolean;
  cycle: IAppraisalCycle | null;
  onClose: () => void;
  onSave: (data: Partial<IAppraisalCycle>) => Promise<void>;
  isLoading?: boolean;
}

export const AppraisalCycleConfigModal: React.FC<Props> = ({
  isOpen,
  cycle,
  onClose,
  onSave,
  isLoading = false,
}) => {
  const [name, setName] = useState('');
  const [academicYear, setAcademicYear] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [submissionDeadline, setSubmissionDeadline] = useState('');
  const [reviewDeadline, setReviewDeadline] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<CycleStatus>('ACTIVE');
  const [requirePrincipalApproval, setRequirePrincipalApproval] = useState(true);
  const [categories, setCategories] = useState<ICategoryConfig[]>([]);
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  // Synchronous lock so the save button and Enter in the form can never save twice.
  const saveLockRef = useRef(false);

  useEffect(() => {
    if (cycle) {
      setName(cycle.name);
      setAcademicYear(cycle.academicYear);
      setStartDate(cycle.startDate ? cycle.startDate.split('T')[0] : '');
      setEndDate(cycle.endDate ? cycle.endDate.split('T')[0] : '');
      setSubmissionDeadline(cycle.submissionDeadline ? cycle.submissionDeadline.split('T')[0] : '');
      setReviewDeadline(cycle.reviewDeadline ? cycle.reviewDeadline.split('T')[0] : '');
      setDescription(cycle.description || '');
      setStatus(cycle.status);
      setRequirePrincipalApproval(cycle.requirePrincipalApproval);
      setCategories(cycle.categories || []);
    } else {
      const currentYear = new Date().getFullYear();
      setName(`Annual Faculty Performance Appraisal ${currentYear - 1}-${currentYear}`);
      setAcademicYear(`${currentYear - 1}-${currentYear}`);
      setStartDate(`${currentYear - 1}-06-01`);
      setEndDate(`${currentYear}-05-31`);
      setSubmissionDeadline(`${currentYear}-06-30`);
      setReviewDeadline(`${currentYear}-07-31`);
      setDescription('Configurable appraisal cycle encompassing all 14 NBA / NAAC accredited categories.');
      setStatus('ACTIVE');
      setRequirePrincipalApproval(true);
    }
  }, [cycle, isOpen]);

  if (!isOpen) return null;

  const busy = isLoading || isSaving;

  const totalWeight = categories.reduce((sum, c) => sum + (Number(c.weightage) || 0), 0);

  const handleCategoryWeightChange = (index: number, weight: number) => {
    const updated = [...categories];
    updated[index] = { ...updated[index], weightage: weight };
    setCategories(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saveLockRef.current || busy) return;
    if (!name.trim()) {
      setError('Cycle name is required');
      return;
    }
    if (!/^\d{4}-\d{4}$/.test(academicYear)) {
      setError('Academic year must be formatted as YYYY-YYYY (e.g. 2024-2025)');
      return;
    }

    if (categories.length > 0 && totalWeight !== 100) {
      setError(`Category weightages must sum to exactly 100%. Current sum: ${totalWeight}%`);
      return;
    }

    setError('');
    saveLockRef.current = true;
    setIsSaving(true);
    try {
      await onSave({
        name: name.trim(),
        academicYear: academicYear.trim(),
        startDate,
        endDate,
        submissionDeadline,
        reviewDeadline,
        description: description.trim(),
        status,
        requirePrincipalApproval,
        ...(categories.length > 0 ? { categories } : {}),
      });
      onClose();
    } finally {
      saveLockRef.current = false;
      setIsSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={busy ? () => {} : onClose}
      title={cycle ? 'Configure Appraisal Cycle & Weightages' : 'Create New Appraisal Cycle'}
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            loading={busy}
            disabled={busy || (categories.length > 0 && totalWeight !== 100)}
          >
            {cycle ? 'Update Cycle Configuration' : 'Create Appraisal Cycle'}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        <div>
            {error && (
              <div
                style={{
                  marginBottom: '1rem',
                  padding: '0.75rem 1rem',
                  backgroundColor: '#fee2e2',
                  color: '#b91c1c',
                  borderRadius: '8px',
                  fontSize: '0.85rem',
                }}
              >
                <i className="bi bi-exclamation-octagon-fill" style={{ marginRight: '6px' }} />
                {error}
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '4px' }}>
                  Cycle Title *
                </label>
                <input
                  type="text"
                  className="form-control"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '0.55rem 0.75rem',
                    borderRadius: '8px',
                    border: '1px solid var(--color-border, #cbd5e1)',
                    fontSize: '0.875rem',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '4px' }}>
                  Academic Year (YYYY-YYYY) *
                </label>
                <input
                  type="text"
                  className="form-control"
                  value={academicYear}
                  onChange={(e) => setAcademicYear(e.target.value)}
                  placeholder="2024-2025"
                  required
                  style={{
                    width: '100%',
                    padding: '0.55rem 0.75rem',
                    borderRadius: '8px',
                    border: '1px solid var(--color-border, #cbd5e1)',
                    fontSize: '0.875rem',
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '4px' }}>
                  Cycle Start Date *
                </label>
                <input
                  type="date"
                  className="form-control"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    borderRadius: '8px',
                    border: '1px solid var(--color-border, #cbd5e1)',
                    fontSize: '0.82rem',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '4px' }}>
                  Cycle End Date *
                </label>
                <input
                  type="date"
                  className="form-control"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    borderRadius: '8px',
                    border: '1px solid var(--color-border, #cbd5e1)',
                    fontSize: '0.82rem',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '4px' }}>
                  Faculty Submission Deadline *
                </label>
                <input
                  type="date"
                  className="form-control"
                  value={submissionDeadline}
                  onChange={(e) => setSubmissionDeadline(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    borderRadius: '8px',
                    border: '1px solid var(--color-border, #cbd5e1)',
                    fontSize: '0.82rem',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '4px' }}>
                  Review Deadline *
                </label>
                <input
                  type="date"
                  className="form-control"
                  value={reviewDeadline}
                  onChange={(e) => setReviewDeadline(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    borderRadius: '8px',
                    border: '1px solid var(--color-border, #cbd5e1)',
                    fontSize: '0.82rem',
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '4px' }}>
                  Cycle Status
                </label>
                <select
                  className="form-control"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as CycleStatus)}
                  style={{
                    width: '100%',
                    padding: '0.55rem 0.75rem',
                    borderRadius: '8px',
                    border: '1px solid var(--color-border, #cbd5e1)',
                    fontSize: '0.875rem',
                  }}
                >
                  <option value="DRAFT">DRAFT (Under Configuration)</option>
                  <option value="ACTIVE">ACTIVE (Accepting Submissions)</option>
                  <option value="SUBMISSION_CLOSED">SUBMISSION CLOSED (Reviews in Progress)</option>
                  <option value="COMPLETED">COMPLETED (All Appraisals Finalized)</option>
                  <option value="ARCHIVED">ARCHIVED</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '4px' }}>
                  Approval Workflow Hierarchy
                </label>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '0.65rem 0.75rem',
                    background: 'var(--color-bg-secondary, #f8fafc)',
                    borderRadius: '8px',
                    border: '1px solid var(--color-border, #cbd5e1)',
                  }}
                >
                  <input
                    type="checkbox"
                    id="requirePrincipal"
                    checked={requirePrincipalApproval}
                    onChange={(e) => setRequirePrincipalApproval(e.target.checked)}
                    style={{ width: '18px', height: '18px' }}
                  />
                  <label htmlFor="requirePrincipal" style={{ fontSize: '0.82rem', cursor: 'pointer', margin: 0 }}>
                    Require Final Principal Approval (Faculty → HOD → Dean → Principal)
                  </label>
                </div>
              </div>
            </div>

            {/* 14 Categories Weightage Table */}
            {categories.length > 0 && (
              <div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '8px',
                  }}
                >
                  <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700 }}>
                    14 Mandated Category Weightages (Total: {totalWeight}%)
                  </h4>
                  <span
                    style={{
                      fontSize: '0.82rem',
                      fontWeight: 700,
                      color: totalWeight === 100 ? '#059669' : '#dc2626',
                      padding: '2px 8px',
                      borderRadius: '6px',
                      backgroundColor: totalWeight === 100 ? '#ecfdf5' : '#fef2f2',
                    }}
                  >
                    {totalWeight === 100 ? 'Balanced (100%)' : `Must equal 100% (Difference: ${100 - totalWeight}%)`}
                  </span>
                </div>

                <div
                  style={{
                    border: '1px solid var(--color-border, #e2e8f0)',
                    borderRadius: '8px',
                    overflow: 'hidden',
                  }}
                >
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                    <thead>
                      <tr style={{ background: 'var(--color-bg-secondary, #f8fafc)', textAlign: 'left', borderBottom: '1px solid var(--color-border, #e2e8f0)' }}>
                        <th style={{ padding: '8px 12px' }}>Category</th>
                        <th style={{ padding: '8px 12px' }}>Reviewer Role</th>
                        <th style={{ padding: '8px 12px' }}>Criteria Count</th>
                        <th style={{ padding: '8px 12px', width: '120px' }}>Weightage (%)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {categories.map((cat, idx) => (
                        <tr key={cat.categoryKey} style={{ borderBottom: '1px solid var(--color-border, #f1f5f9)' }}>
                          <td style={{ padding: '6px 12px', fontWeight: 600 }}>
                            {idx + 1}. {cat.displayName}
                          </td>
                          <td style={{ padding: '6px 12px', color: 'var(--color-text-secondary)' }}>
                            {cat.reviewerRole}
                          </td>
                          <td style={{ padding: '6px 12px', color: 'var(--color-text-secondary)' }}>
                            {cat.criteria ? cat.criteria.length : 0} criteria
                          </td>
                          <td style={{ padding: '6px 12px' }}>
                            <input
                              type="number"
                              min={1}
                              max={100}
                              value={cat.weightage}
                              onChange={(e) => handleCategoryWeightChange(idx, Number(e.target.value))}
                              style={{
                                width: '70px',
                                padding: '3px 6px',
                                borderRadius: '4px',
                                border: '1px solid var(--color-border, #cbd5e1)',
                                textAlign: 'center',
                                fontWeight: 700,
                              }}
                            />
                            <span style={{ marginLeft: '4px' }}>%</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </form>
    </Modal>
  );
};
