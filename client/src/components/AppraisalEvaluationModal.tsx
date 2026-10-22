import React, { useState, useRef } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import type { IFacultyAppraisal, IReviewPayload, IAppraisalCycle } from '../types/appraisal';
import { AppraisalStatusBadge } from './AppraisalStatusBadge';
import { useAuthStore } from '../stores/authStore';

interface Props {
  isOpen: boolean;
  appraisal: IFacultyAppraisal | null;
  cycle?: IAppraisalCycle | null;
  onClose: () => void;
  onSubmitReview: (payload: IReviewPayload) => Promise<void>;
  isLoading?: boolean;
}

export const AppraisalEvaluationModal: React.FC<Props> = ({
  isOpen,
  appraisal,
  cycle,
  onClose,
  onSubmitReview,
  isLoading = false,
}) => {
  const { user } = useAuthStore();
  const [comments, setComments] = useState('');
  const [categoryScores, setCategoryScores] = useState<Record<string, number>>({});
  const [categoryNotes, setCategoryNotes] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState<'EVALUATION' | 'HISTORY'>('EVALUATION');
  const [submittingAction, setSubmittingAction] = useState<string | null>(null);
  // Synchronous lock: the decision buttons can never send two reviews at once.
  const decisionLockRef = useRef(false);

  if (!isOpen || !appraisal) return null;

  // Every decision button and both close controls are disabled while any decision runs.
  const busy = isLoading || submittingAction !== null;

  const applicantUserId =
    typeof appraisal.userId === 'object' && appraisal.userId !== null
      ? (appraisal.userId as any)._id
      : appraisal.userId;

  const isSelf = Boolean(user && user.id && applicantUserId && String(applicantUserId) === String(user.id));

  const handleScoreChange = (catKey: string, val: number) => {
    const clamped = Math.min(100, Math.max(0, val));
    setCategoryScores((prev) => ({ ...prev, [catKey]: clamped }));
  };

  const handleNoteChange = (catKey: string, text: string) => {
    setCategoryNotes((prev) => ({ ...prev, [catKey]: text }));
  };

  const handleDecision = async (action: 'RECOMMEND' | 'REQUEST_REVISION' | 'APPROVE' | 'REJECT') => {
    if (decisionLockRef.current) return;
    if (!comments.trim()) {
      alert('Please provide evaluation comments before submitting.');
      return;
    }

    const evaluations = appraisal.categorySubmissions.map((cat) => ({
      categoryKey: cat.categoryKey,
      score: categoryScores[cat.categoryKey] !== undefined ? categoryScores[cat.categoryKey] : cat.selfScore,
      comments: categoryNotes[cat.categoryKey] || '',
    }));

    decisionLockRef.current = true;
    setSubmittingAction(action);
    try {
      await onSubmitReview({
        action,
        comments: comments.trim(),
        categoryEvaluations: evaluations,
      });
      onClose();
    } finally {
      decisionLockRef.current = false;
      setSubmittingAction(null);
    }
  };

  const stage = appraisal.currentStage;
  const requirePrincipal = cycle ? cycle.requirePrincipalApproval : true;

  return (
    <Modal
      isOpen={isOpen}
      onClose={busy ? () => {} : onClose}
      title="Faculty Performance Appraisal Evaluation"
      size="xl"
      footer={
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Close
          </Button>

          {!isSelf && activeTab === 'EVALUATION' && (
            <div style={{ display: 'flex', gap: '8px' }}>
              <Button
                variant="danger"
                disabled={busy}
                onClick={() => handleDecision('REJECT')}
                loading={submittingAction === 'REJECT'}
                icon={<i className="bi bi-x-circle" />}
              >
                Reject
              </Button>

              <Button
                variant="warning"
                disabled={busy}
                onClick={() => handleDecision('REQUEST_REVISION')}
                loading={submittingAction === 'REQUEST_REVISION'}
                icon={<i className="bi bi-arrow-counterclockwise" />}
              >
                Request Revision
              </Button>

              {stage === 'HOD_REVIEW' && (
                <Button
                  variant="primary"
                  disabled={busy}
                  onClick={() => handleDecision('RECOMMEND')}
                  loading={submittingAction === 'RECOMMEND'}
                  icon={<i className="bi bi-arrow-right-circle-fill" />}
                >
                  Recommend to Dean
                </Button>
              )}

              {stage === 'DEAN_REVIEW' && (
                <Button
                  variant="primary"
                  disabled={busy}
                  onClick={() => handleDecision(requirePrincipal ? 'RECOMMEND' : 'APPROVE')}
                  loading={submittingAction === (requirePrincipal ? 'RECOMMEND' : 'APPROVE')}
                  icon={<i className="bi bi-check-circle-fill" />}
                >
                  {requirePrincipal ? 'Recommend to Principal' : 'Approve Appraisal'}
                </Button>
              )}

              {stage === 'PRINCIPAL_APPROVAL' && (
                <Button
                  variant="success"
                  disabled={busy}
                  onClick={() => handleDecision('APPROVE')}
                  loading={submittingAction === 'APPROVE'}
                  icon={<i className="bi bi-award-fill" />}
                >
                  Grant Final Approval
                </Button>
              )}
            </div>
          )}
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        {/* Appraisal Metadata Sub-Header */}
        <div
          style={{
            padding: '12px 16px',
            backgroundColor: 'var(--color-surface-hover)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '8px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)', color: 'var(--color-text)' }}>
              {appraisal.facultyName} ({appraisal.facultyEmployeeId})
            </span>
            <span style={{ color: 'var(--color-text-muted)' }}>&bull;</span>
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
              {appraisal.designation}
            </span>
            <span style={{ color: 'var(--color-text-muted)' }}>&bull;</span>
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
              Dept: {appraisal.departmentCode}
            </span>
            <span style={{ color: 'var(--color-text-muted)' }}>&bull;</span>
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-primary)', fontWeight: 600 }}>
              Self-Score: {appraisal.totalSelfScore} / 100
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <AppraisalStatusBadge status={appraisal.status} />
            <AppraisalStatusBadge stage={appraisal.currentStage} />
          </div>
        </div>

        {/* Self-approval protection banner */}
        {isSelf && (
          <div
            style={{
              backgroundColor: '#fee2e2',
              color: '#b91c1c',
              padding: '0.75rem 1.75rem',
              fontSize: '0.85rem',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              borderBottom: '1px solid #fca5a5',
            }}
          >
            <i className="bi bi-shield-slash-fill" style={{ fontSize: '1.1rem' }} />
            <span>
              MANDATORY SECURITY ENFORCEMENT: A user must never approve their own appraisal. As the applicant, review decisions are disabled for your account.
            </span>
          </div>
        )}

        {/* Modal Tabs */}
        <div
          style={{
            display: 'flex',
            padding: '0 1.75rem',
            borderBottom: '1px solid var(--color-border, #e2e8f0)',
            background: 'var(--color-bg-secondary, #f8fafc)',
            gap: '1rem',
          }}
        >
          <button
            onClick={() => setActiveTab('EVALUATION')}
            style={{
              padding: '0.75rem 0.5rem',
              border: 'none',
              background: 'none',
              borderBottom: activeTab === 'EVALUATION' ? '2px solid var(--color-primary, #1B345F)' : '2px solid transparent',
              color: activeTab === 'EVALUATION' ? 'var(--color-primary, #1B345F)' : 'var(--color-text-muted)',
              fontWeight: activeTab === 'EVALUATION' ? 700 : 500,
              fontSize: '0.875rem',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <i className="bi bi-clipboard2-check" />
            Category Dossier & Scores (14 Categories)
          </button>
          <button
            onClick={() => setActiveTab('HISTORY')}
            style={{
              padding: '0.75rem 0.5rem',
              border: 'none',
              background: 'none',
              borderBottom: activeTab === 'HISTORY' ? '2px solid var(--color-primary, #1B345F)' : '2px solid transparent',
              color: activeTab === 'HISTORY' ? 'var(--color-primary, #1B345F)' : 'var(--color-text-muted)',
              fontWeight: activeTab === 'HISTORY' ? 700 : 500,
              fontSize: '0.875rem',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <i className="bi bi-clock-history" />
            Review History & Audit Trail ({appraisal.reviewHistory.length})
          </button>
        </div>

        {/* Content Area */}
        <div style={{ padding: '1.5rem 1.75rem', overflowY: 'auto', flex: 1 }}>
          {activeTab === 'EVALUATION' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div
                style={{
                  backgroundColor: 'rgba(59, 130, 246, 0.05)',
                  border: '1px solid rgba(59, 130, 246, 0.2)',
                  borderRadius: '10px',
                  padding: '0.75rem 1rem',
                  fontSize: '0.82rem',
                  color: '#1B345F',
                }}
              >
                <i className="bi bi-info-circle-fill" style={{ marginRight: '6px' }} />
                Review each of the 14 accredited categories below. Verify submitted evidence documents and set your evaluated score out of 100.
              </div>

              {appraisal.categorySubmissions.map((cat, idx) => {
                const currentEvalScore =
                  categoryScores[cat.categoryKey] !== undefined ? categoryScores[cat.categoryKey] : cat.selfScore;

                return (
                  <div
                    key={cat.categoryKey}
                    style={{
                      border: '1px solid var(--color-border, #e2e8f0)',
                      borderRadius: '12px',
                      padding: '1rem',
                      background: 'var(--color-bg-primary, #ffffff)',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        borderBottom: '1px solid var(--color-border, #f1f5f9)',
                        paddingBottom: '0.6rem',
                        marginBottom: '0.75rem',
                      }}
                    >
                      <div>
                        <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>
                          Category {idx + 1}
                        </span>
                        <h4 style={{ margin: '2px 0 0', fontSize: '0.95rem', fontWeight: 700 }}>
                          {cat.displayName}
                        </h4>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span
                          style={{
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            padding: '2px 8px',
                            borderRadius: '4px',
                            background: 'rgba(30, 64, 175, 0.1)',
                            color: '#1B345F',
                          }}
                        >
                          Weight: {cat.weightage}%
                        </span>
                        <span
                          style={{
                            fontSize: '0.82rem',
                            fontWeight: 600,
                            padding: '2px 8px',
                            borderRadius: '4px',
                            background: 'rgba(16, 185, 129, 0.1)',
                            color: '#059669',
                          }}
                        >
                          Self: {cat.selfScore} / 100
                        </span>
                      </div>
                    </div>

                    {/* Faculty remarks & evidence */}
                    <div style={{ marginBottom: '0.75rem', fontSize: '0.82rem' }}>
                      <strong style={{ color: 'var(--color-text-secondary, #475569)' }}>Faculty Remarks: </strong>
                      <span style={{ color: 'var(--color-text-primary, #1e293b)' }}>
                        {cat.facultyRemarks || 'No remarks entered by faculty.'}
                      </span>
                    </div>

                    {/* Evidence Documents */}
                    <div style={{ marginBottom: '0.75rem' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
                        Submitted Evidence ({cat.evidenceDocuments.length})
                      </span>
                      {cat.evidenceDocuments.length === 0 ? (
                        <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                          No document attached.
                        </p>
                      ) : (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px' }}>
                          {cat.evidenceDocuments.map((doc, docIdx) => (
                            <a
                              key={docIdx}
                              href={doc.documentUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '4px 10px',
                                borderRadius: '6px',
                                background: 'var(--color-bg-secondary, #f1f5f9)',
                                border: '1px solid var(--color-border, #cbd5e1)',
                                color: '#1d4ed8',
                                fontSize: '0.78rem',
                                textDecoration: 'none',
                                fontWeight: 500,
                              }}
                            >
                              <i className="bi bi-file-earmark-check" />
                              <span>{doc.title}</span>
                              <span style={{ fontSize: '0.68rem', color: '#64748b' }}>({doc.documentType || 'DOC'})</span>
                              <i className="bi bi-box-arrow-up-right" style={{ fontSize: '0.7rem' }} />
                            </a>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Reviewer evaluation row */}
                    {!isSelf && (
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '160px 1fr',
                          gap: '12px',
                          marginTop: '0.75rem',
                          paddingTop: '0.75rem',
                          borderTop: '1px dashed var(--color-border, #e2e8f0)',
                          background: 'rgba(248, 250, 252, 0.6)',
                          padding: '8px',
                          borderRadius: '8px',
                        }}
                      >
                        <div>
                          <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#334155', marginBottom: '2px' }}>
                            Evaluated Score (0-100)
                          </label>
                          <input
                            type="number"
                            min={0}
                            max={100}
                            value={currentEvalScore}
                            onChange={(e) => handleScoreChange(cat.categoryKey, Number(e.target.value))}
                            style={{
                              width: '100%',
                              padding: '4px 8px',
                              borderRadius: '6px',
                              border: '1px solid var(--color-border, #cbd5e1)',
                              fontSize: '0.85rem',
                              fontWeight: 600,
                            }}
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#334155', marginBottom: '2px' }}>
                            Reviewer Feedback Notes
                          </label>
                          <input
                            type="text"
                            placeholder="Optional criterion specific feedback"
                            value={categoryNotes[cat.categoryKey] || ''}
                            onChange={(e) => handleNoteChange(cat.categoryKey, e.target.value)}
                            style={{
                              width: '100%',
                              padding: '4px 8px',
                              borderRadius: '6px',
                              border: '1px solid var(--color-border, #cbd5e1)',
                              fontSize: '0.85rem',
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Overall Comments */}
              {!isSelf && (
                <div style={{ marginTop: '0.5rem' }}>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 700, marginBottom: '6px' }}>
                    Overall Reviewer Comments & Recommendations *
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Provide detailed feedback, strengths, and areas of improvement..."
                    value={comments}
                    onChange={(e) => setComments(e.target.value)}
                    required
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      borderRadius: '8px',
                      border: '1px solid var(--color-border, #cbd5e1)',
                      fontSize: '0.875rem',
                    }}
                  />
                </div>
              )}
            </div>
          ) : (
            /* Review History Tab */
            <div>
              <h4 style={{ margin: '0 0 1rem', fontSize: '1rem', fontWeight: 700 }}>
                Immutable Appraisal Audit Trail
              </h4>
              {appraisal.reviewHistory.length === 0 ? (
                <p style={{ color: 'var(--color-text-muted)', fontStyle: 'italic', fontSize: '0.85rem' }}>
                  No prior reviews recorded.
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {appraisal.reviewHistory.map((item, idx) => (
                    <div
                      key={idx}
                      style={{
                        padding: '1rem',
                        borderRadius: '10px',
                        border: '1px solid var(--color-border, #e2e8f0)',
                        background: 'var(--color-bg-secondary, #f8fafc)',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          marginBottom: '4px',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontWeight: 700, fontSize: '0.88rem' }}>{item.reviewerName}</span>
                          <span
                            style={{
                              fontSize: '0.7rem',
                              fontWeight: 600,
                              padding: '2px 6px',
                              borderRadius: '4px',
                              background: '#e0e7ff',
                              color: '#3730a3',
                            }}
                          >
                            {item.reviewerRole}
                          </span>
                        </div>
                        <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                          {new Date(item.reviewDate).toLocaleString()}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.82rem', color: 'var(--color-text-secondary)', marginBottom: '6px' }}>
                        <strong>Decision: </strong> {item.decision}
                        {item.overallScore !== undefined && (
                          <span style={{ marginLeft: '12px', fontWeight: 600, color: '#059669' }}>
                            Score: {item.overallScore} / 100
                          </span>
                        )}
                      </div>
                      {item.comments && (
                        <div
                          style={{
                            fontSize: '0.82rem',
                            padding: '6px 10px',
                            borderRadius: '6px',
                            background: '#ffffff',
                            border: '1px solid #e2e8f0',
                            fontStyle: 'italic',
                          }}
                        >
                          "{item.comments}"
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

      </div>
    </Modal>
  );
};
