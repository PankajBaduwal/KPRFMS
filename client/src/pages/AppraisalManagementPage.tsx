import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuthStore } from '../stores/authStore';
import { appraisalService } from '../services/appraisal.service';
import { useAcademicYears } from '../hooks/useAcademicYears';
import type {
  IAppraisalCycle,
  IFacultyAppraisal,
  ICategorySubmission,
  IEvidenceDocument,
  IAppraisalStats,
  IReviewPayload,
} from '../types/appraisal';
import {
  PageHeader,
  Badge,
  AppraisalStatusBadge,
  AppraisalEvidenceModal,
  AppraisalEvaluationModal,
  AppraisalCycleConfigModal,
  AppraisalAuditModal,
  EmptyState,
  Skeleton,
  SkeletonCard,
  SkeletonStats,
  SkeletonTable,
} from '../components';
import { fileUrl } from '../utils/fileUrl';
import { AiAppraisalDraft } from '../components/AiAppraisalTools';

export const AppraisalManagementPage: React.FC = () => {
  const { user } = useAuthStore();
  const { currentYear } = useAcademicYears();

  // State
  const [activeTab, setActiveTab] = useState<'MY_APPRAISAL' | 'REVIEW_QUEUE' | 'ANALYTICS' | 'CYCLES'>('MY_APPRAISAL');
  const [activeCycle, setActiveCycle] = useState<IAppraisalCycle | null>(null);
  const [allCycles, setAllCycles] = useState<IAppraisalCycle[]>([]);
  const [myAppraisal, setMyAppraisal] = useState<IFacultyAppraisal | null>(null);
  const [categoriesData, setCategoriesData] = useState<ICategorySubmission[]>([]);
  const [reviewQueue, setReviewQueue] = useState<IFacultyAppraisal[]>([]);
  const [stats, setStats] = useState<IAppraisalStats | null>(null);
  const [loading, setLoading] = useState(true);
  // First responses: until each arrives its section shows skeletons, never empty states or zeros.
  const [myDataLoaded, setMyDataLoaded] = useState(false);
  const [queueLoading, setQueueLoading] = useState(false);
  const [queueLoaded, setQueueLoaded] = useState(false);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsLoaded, setStatsLoaded] = useState(false);
  const [cyclesLoading, setCyclesLoading] = useState(false);
  const [cyclesLoaded, setCyclesLoaded] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  // Which mutation is running, so only its button shows a spinner.
  const [pendingAction, setPendingAction] = useState<'SAVE_DRAFT' | 'SUBMIT' | 'REVIEW' | 'CYCLE' | null>(null);
  // Synchronous lock: save / submit / review / cycle-save can never overlap or double-fire.
  const actionLockRef = useRef(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Modals state
  const [evidenceModalCat, setEvidenceModalCat] = useState<{ key: string; name: string } | null>(null);
  const [evaluatingAppraisal, setEvaluatingAppraisal] = useState<IFacultyAppraisal | null>(null);
  const [auditAppraisal, setAuditAppraisal] = useState<IFacultyAppraisal | null>(null);
  const [editingCycle, setEditingCycle] = useState<IAppraisalCycle | null>(null);
  const [isCycleModalOpen, setIsCycleModalOpen] = useState(false);

  // Filters for review queue
  const [queueFilterStatus, setQueueFilterStatus] = useState<string>('');
  const [queueSearch, setQueueSearch] = useState<string>('');

  const isLeadership = user && ['ADMIN', 'PRINCIPAL', 'DEAN', 'HOD'].includes(user.role);
  const isAdminOrPrincipal = user && ['ADMIN', 'PRINCIPAL'].includes(user.role);

  // Load My Appraisal & Active Cycle
  const loadMyData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await appraisalService.getMyCurrentAppraisal();
      setActiveCycle(res.cycle);
      if (res.appraisal) {
        setMyAppraisal(res.appraisal);
        setCategoriesData(res.appraisal.categorySubmissions || []);
      } else if (res.template) {
        setCategoriesData(res.template);
      }
    } catch (err: any) {
      console.error('Failed to load my appraisal', err);
      setFeedbackMsg({ type: 'error', text: err.response?.data?.message || 'Failed to load appraisal data' });
    } finally {
      setMyDataLoaded(true);
      setLoading(false);
    }
  }, []);

  // Load Review Queue
  const loadReviewQueue = useCallback(async () => {
    if (!isLeadership) return;
    setQueueLoading(true);
    try {
      const res = await appraisalService.getReviewQueue({
        status: queueFilterStatus || undefined,
      });
      setReviewQueue(res.items);
    } catch (err) {
      console.error('Failed to load review queue', err);
    } finally {
      setQueueLoaded(true);
      setQueueLoading(false);
    }
  }, [isLeadership, queueFilterStatus]);

  // Load Analytics
  const loadAnalytics = useCallback(async () => {
    setStatsLoading(true);
    try {
      const res = await appraisalService.getAppraisalStats();
      setStats(res.stats);
    } catch (err) {
      console.error('Failed to load stats', err);
    } finally {
      setStatsLoaded(true);
      setStatsLoading(false);
    }
  }, []);

  // Load Cycles
  const loadCycles = useCallback(async () => {
    setCyclesLoading(true);
    try {
      const res = await appraisalService.getAllCycles();
      setAllCycles(res);
    } catch (err) {
      console.error('Failed to load cycles', err);
    } finally {
      setCyclesLoaded(true);
      setCyclesLoading(false);
    }
  }, []);

  /** Runs one mutation at a time; the lock and spinner are always released in finally. */
  const runAction = async (
    kind: 'SAVE_DRAFT' | 'SUBMIT' | 'REVIEW' | 'CYCLE',
    action: () => Promise<void>
  ) => {
    if (actionLockRef.current) return;
    actionLockRef.current = true;
    setPendingAction(kind);
    setActionLoading(true);
    try {
      await action();
    } finally {
      actionLockRef.current = false;
      setPendingAction(null);
      setActionLoading(false);
    }
  };

  useEffect(() => {
    loadMyData();
    if (isLeadership) {
      loadReviewQueue();
      loadAnalytics();
      loadCycles();
    }
  }, [loadMyData, isLeadership, loadReviewQueue, loadAnalytics, loadCycles]);

  // Handle score change for category in My Appraisal
  const handleSelfScoreChange = (catKey: string, score: number) => {
    const clamped = Math.min(100, Math.max(0, score));
    setCategoriesData((prev) =>
      prev.map((c) => (c.categoryKey === catKey ? { ...c, selfScore: clamped } : c))
    );
  };

  // Handle remarks change
  const handleRemarksChange = (catKey: string, remarks: string) => {
    setCategoriesData((prev) =>
      prev.map((c) => (c.categoryKey === catKey ? { ...c, facultyRemarks: remarks } : c))
    );
  };

  // Add evidence to category
  const handleAddEvidence = (doc: IEvidenceDocument) => {
    if (!evidenceModalCat) return;
    setCategoriesData((prev) =>
      prev.map((c) =>
        c.categoryKey === evidenceModalCat.key
          ? { ...c, evidenceDocuments: [...c.evidenceDocuments, doc] }
          : c
      )
    );
    setFeedbackMsg({ type: 'success', text: `Evidence attached to ${evidenceModalCat.name}` });
  };

  // Remove evidence from category
  const handleRemoveEvidence = (catKey: string, docIndex: number) => {
    setCategoriesData((prev) =>
      prev.map((c) => {
        if (c.categoryKey !== catKey) return c;
        const docs = [...c.evidenceDocuments];
        docs.splice(docIndex, 1);
        return { ...c, evidenceDocuments: docs };
      })
    );
  };

  // Save Draft
  const handleSaveDraft = async () => {
    if (!activeCycle || actionLockRef.current) return;
    await runAction('SAVE_DRAFT', async () => {
    setFeedbackMsg(null);
    try {
      const updated = await appraisalService.saveDraft({
        cycleId: activeCycle._id,
        categorySubmissions: categoriesData,
      });
      setMyAppraisal(updated);
      setCategoriesData(updated.categorySubmissions);
      setFeedbackMsg({ type: 'success', text: 'Appraisal draft saved successfully.' });
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err.response?.data?.message || 'Failed to save draft' });
    }
    });
  };

  // Submit Final Appraisal
  const handleSubmitAppraisal = async () => {
    if (!activeCycle || actionLockRef.current) return;
    const confirmSubmit = window.confirm(
      'Are you sure you want to submit your final appraisal dossier? Once submitted, it will be locked for review by HOD/Dean.'
    );
    if (!confirmSubmit) return;

    await runAction('SUBMIT', async () => {
    setFeedbackMsg(null);
    try {
      const submitted = await appraisalService.submitAppraisal({
        cycleId: activeCycle._id,
        categorySubmissions: categoriesData,
      });
      setMyAppraisal(submitted);
      setCategoriesData(submitted.categorySubmissions);
      setFeedbackMsg({
        type: 'success',
        text: `Appraisal submitted successfully! Stage: ${submitted.currentStage.replace(/_/g, ' ')}.`,
      });
    } catch (err: any) {
      setFeedbackMsg({ type: 'error', text: err.response?.data?.message || 'Failed to submit appraisal' });
    }
    });
  };

  // Review submission
  const handleSubmitReview = async (payload: IReviewPayload) => {
    if (!evaluatingAppraisal) return;
    await runAction('REVIEW', async () => {
    try {
      await appraisalService.reviewAppraisal(evaluatingAppraisal._id, payload);
      setFeedbackMsg({ type: 'success', text: `Evaluation submitted with decision: ${payload.action}` });
      loadReviewQueue();
      loadAnalytics();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to submit review');
    }
    });
  };

  // Save Cycle config
  const handleSaveCycle = async (data: Partial<IAppraisalCycle>) => {
    await runAction('CYCLE', async () => {
    try {
      if (editingCycle) {
        await appraisalService.updateCycle(editingCycle._id, data);
        setFeedbackMsg({ type: 'success', text: 'Cycle configuration updated.' });
      } else {
        await appraisalService.createCycle(data);
        setFeedbackMsg({ type: 'success', text: 'New appraisal cycle created.' });
      }
      loadCycles();
      loadMyData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to save cycle');
    }
    });
  };

  // Calculate live weighted self score
  const liveWeightedScore = categoriesData.reduce((acc, cat) => {
    const s = cat.selfScore || 0;
    const w = cat.weightage || 0;
    return acc + (s / 100) * w;
  }, 0);

  const canEdit =
    !myAppraisal ||
    myAppraisal.status === 'DRAFT' ||
    myAppraisal.status === 'REVISION_REQUESTED';

  // Filter queue
  const filteredQueue = reviewQueue.filter((item) => {
    if (queueSearch) {
      const matchName = item.facultyName?.toLowerCase().includes(queueSearch.toLowerCase());
      const matchEmp = item.facultyEmployeeId?.toLowerCase().includes(queueSearch.toLowerCase());
      const matchDept = item.departmentCode?.toLowerCase().includes(queueSearch.toLowerCase());
      if (!matchName && !matchEmp && !matchDept) return false;
    }
    return true;
  });

  return (
    <div className="page-container" style={{ padding: '1.5rem', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Standard Institutional Header */}
      <PageHeader
        title="Faculty Performance Appraisal"
        subtitle="Yearly self-appraisal and review."
        badge={<Badge variant="primary">PBAS / AICTE / NBA</Badge>}
        actions={
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
            {isAdminOrPrincipal && (
              <button
                className="btn btn-outline"
                onClick={() => {
                  setEditingCycle(null);
                  setIsCycleModalOpen(true);
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '0.55rem 1rem',
                  borderRadius: '8px',
                  border: '1px solid var(--color-border)',
                  background: 'var(--color-surface)',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <i className="bi bi-gear" />
                Configure Cycle
              </button>
            )}

            {activeTab === 'MY_APPRAISAL' && canEdit && (
              <>
                <button
                  className="btn btn-secondary"
                  disabled={actionLoading}
                  aria-busy={pendingAction === 'SAVE_DRAFT'}
                  onClick={handleSaveDraft}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '0.55rem 1rem',
                    borderRadius: '8px',
                    border: '1px solid var(--color-border)',
                    background: 'var(--color-surface)',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {pendingAction === 'SAVE_DRAFT' ? <span className="spinner spinner-sm" aria-hidden="true" /> : <i className="bi bi-save" />}
                  Save Draft
                </button>
                <button
                  className="btn btn-primary"
                  disabled={actionLoading}
                  aria-busy={pendingAction === 'SUBMIT'}
                  onClick={handleSubmitAppraisal}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '0.55rem 1.25rem',
                    borderRadius: '8px',
                    backgroundColor: 'var(--color-primary)',
                    color: '#fff',
                    border: 'none',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  {pendingAction === 'SUBMIT' ? <span className="spinner spinner-sm" aria-hidden="true" /> : <i className="bi bi-send-check" />}
                  Submit Appraisal
                </button>
              </>
            )}
          </div>
        }
      />

      {/* Feedback banner */}
      {feedbackMsg && (
        <div
          style={{
            marginBottom: '1.25rem',
            padding: '0.85rem 1.25rem',
            borderRadius: '10px',
            fontSize: '0.88rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: feedbackMsg.type === 'success' ? '#ecfdf5' : '#fef2f2',
            color: feedbackMsg.type === 'success' ? '#065f46' : '#991b1b',
            border: `1px solid ${feedbackMsg.type === 'success' ? '#a7f3d0' : '#fecaca'}`,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <i className={`bi ${feedbackMsg.type === 'success' ? 'bi-check-circle-fill' : 'bi-exclamation-triangle-fill'}`} />
            <span>{feedbackMsg.text}</span>
          </div>
          <button
            onClick={() => setFeedbackMsg(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}
          >
            <i className="bi bi-x" />
          </button>
        </div>
      )}

      {/* Cycle banner & Score summary card */}
      {!myDataLoaded ? (
        <div role="status" aria-busy="true" aria-label="Loading appraisal summary" style={{ marginBottom: '1.5rem' }}>
          <SkeletonStats count={isLeadership ? 4 : 3} />
        </div>
      ) : (
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '1rem',
          marginBottom: '1.5rem',
        }}
      >
        {/* Active Cycle Info */}
        <div
          style={{
            padding: '1.25rem',
            borderRadius: 'var(--radius-lg)',
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-secondary)', fontWeight: 600 }}>
                Active Appraisal Cycle
              </span>
              <span
                style={{
                  fontSize: '0.72rem',
                  padding: '2px 8px',
                  borderRadius: '9999px',
                  backgroundColor: 'var(--color-primary-50)',
                  color: 'var(--color-primary)',
                  fontWeight: 600,
                }}
              >
                {activeCycle?.academicYear || currentYear}
              </span>
            </div>
            <h3 style={{ margin: '6px 0 2px', fontSize: '1.1rem', fontWeight: 600, color: 'var(--color-text)' }}>
              {activeCycle?.name || 'Annual Faculty Appraisal'}
            </h3>
            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
              Submission Deadline:{' '}
              {activeCycle?.submissionDeadline
                ? new Date(activeCycle.submissionDeadline).toLocaleDateString()
                : 'June 30'}
            </p>
          </div>
          <div style={{ marginTop: '0.75rem', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
            Workflow: Faculty → HOD Review → Dean Review{' '}
            {activeCycle?.requirePrincipalApproval ? '→ Principal Approval' : ''}
          </div>
        </div>

        {/* My Status Card */}
        <div
          style={{
            padding: '1.25rem',
            borderRadius: '14px',
            background: 'var(--color-bg-primary, #ffffff)',
            border: '1px solid var(--color-border, #e2e8f0)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
              My Dossier Status
            </span>
            <div style={{ display: 'flex', gap: '6px' }}>
              <AppraisalStatusBadge status={myAppraisal ? myAppraisal.status : 'DRAFT'} />
              {myAppraisal?.finalGrade && <AppraisalStatusBadge grade={myAppraisal.finalGrade} />}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', margin: '0.5rem 0' }}>
            <span style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--color-text-primary, #0f172a)' }}>
              {Math.round(liveWeightedScore * 10) / 10}
            </span>
            <span style={{ fontSize: '0.9rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>/ 100</span>
            {myAppraisal?.finalScore !== undefined && (
              <span style={{ fontSize: '0.85rem', color: '#059669', fontWeight: 700, marginLeft: 'auto' }}>
                Evaluated: {myAppraisal.finalScore} / 100
              </span>
            )}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary, #64748b)' }}>
            Stage: <strong>{myAppraisal ? myAppraisal.currentStage.replace(/_/g, ' ') : 'FACULTY SUBMISSION'}</strong>
            {myAppraisal?.reviewHistory && myAppraisal.reviewHistory.length > 0 && (
              <button
                onClick={() => setAuditAppraisal(myAppraisal)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#1B345F',
                  textDecoration: 'underline',
                  cursor: 'pointer',
                  marginLeft: '8px',
                  fontWeight: 600,
                }}
              >
                View History ({myAppraisal.reviewHistory.length})
              </button>
            )}
          </div>
        </div>

        {/* Evidence KPI Card */}
        <div
          style={{
            padding: '1.25rem',
            borderRadius: '14px',
            background: 'var(--color-bg-primary, #ffffff)',
            border: '1px solid var(--color-border, #e2e8f0)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
          }}
        >
          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
            Supporting Evidence Files
          </span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', margin: '0.5rem 0' }}>
            <span style={{ fontSize: '2rem', fontWeight: 800, color: '#0284c7' }}>
              {categoriesData.reduce((acc, c) => acc + (c.evidenceDocuments?.length || 0), 0)}
            </span>
            <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>documents attached</span>
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary, #64748b)' }}>
            All 14 categories configured with accreditation criteria
          </div>
        </div>

        {/* Review Queue KPI for Leadership */}
        {isLeadership && (
          <div
            style={{
              padding: '1.25rem',
              borderRadius: '14px',
              background: 'var(--color-bg-primary, #ffffff)',
              border: '1px solid var(--color-border, #e2e8f0)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
            }}
          >
            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
              Pending Evaluations
            </span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', margin: '0.5rem 0' }}>
              <span style={{ fontSize: '2rem', fontWeight: 800, color: '#ea580c' }}>
                {queueLoaded ? reviewQueue.length : <Skeleton variant="text" width={40} height={28} />}
              </span>
              <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>awaiting your review</span>
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary, #64748b)' }}>
              Self-approval guard active (own appraisals excluded)
            </div>
          </div>
        )}
      </div>
      )}

      {/* Tabs navigation */}
      <div
        style={{
          display: 'flex',
          gap: '0.5rem',
          borderBottom: '1px solid var(--color-border, #e2e8f0)',
          marginBottom: '1.5rem',
        }}
      >
        <button
          onClick={() => setActiveTab('MY_APPRAISAL')}
          style={{
            padding: '0.75rem 1.25rem',
            border: 'none',
            background: 'none',
            borderBottom: activeTab === 'MY_APPRAISAL' ? '3px solid var(--color-primary, #1B345F)' : '3px solid transparent',
            color: activeTab === 'MY_APPRAISAL' ? 'var(--color-primary, #1B345F)' : 'var(--color-text-secondary, #64748b)',
            fontWeight: activeTab === 'MY_APPRAISAL' ? 700 : 500,
            fontSize: '0.9rem',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <i className="bi bi-file-earmark-person" />
          My Appraisal Dossier (14 Categories)
        </button>

        {isLeadership && (
          <button
            onClick={() => setActiveTab('REVIEW_QUEUE')}
            style={{
              padding: '0.75rem 1.25rem',
              border: 'none',
              background: 'none',
              borderBottom: activeTab === 'REVIEW_QUEUE' ? '3px solid var(--color-primary, #1B345F)' : '3px solid transparent',
              color: activeTab === 'REVIEW_QUEUE' ? 'var(--color-primary, #1B345F)' : 'var(--color-text-secondary, #64748b)',
              fontWeight: activeTab === 'REVIEW_QUEUE' ? 700 : 500,
              fontSize: '0.9rem',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <i className="bi bi-clipboard2-check" />
            Review Queue
            {reviewQueue.length > 0 && (
              <span
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  backgroundColor: '#ea580c',
                  color: '#fff',
                  borderRadius: '9999px',
                  padding: '1px 7px',
                }}
              >
                {reviewQueue.length}
              </span>
            )}
          </button>
        )}

        {isLeadership && (
          <button
            onClick={() => setActiveTab('ANALYTICS')}
            style={{
              padding: '0.75rem 1.25rem',
              border: 'none',
              background: 'none',
              borderBottom: activeTab === 'ANALYTICS' ? '3px solid var(--color-primary, #1B345F)' : '3px solid transparent',
              color: activeTab === 'ANALYTICS' ? 'var(--color-primary, #1B345F)' : 'var(--color-text-secondary, #64748b)',
              fontWeight: activeTab === 'ANALYTICS' ? 700 : 500,
              fontSize: '0.9rem',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <i className="bi bi-bar-chart-line" />
            Institutional Overview & Stats
          </button>
        )}

        {isAdminOrPrincipal && (
          <button
            onClick={() => setActiveTab('CYCLES')}
            style={{
              padding: '0.75rem 1.25rem',
              border: 'none',
              background: 'none',
              borderBottom: activeTab === 'CYCLES' ? '3px solid var(--color-primary, #1B345F)' : '3px solid transparent',
              color: activeTab === 'CYCLES' ? 'var(--color-primary, #1B345F)' : 'var(--color-text-secondary, #64748b)',
              fontWeight: activeTab === 'CYCLES' ? 700 : 500,
              fontSize: '0.9rem',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <i className="bi bi-sliders" />
            Cycle Management
          </button>
        )}
      </div>

      {/* TAB 1: MY APPRAISAL DOSSIER */}
      {activeTab === 'MY_APPRAISAL' && (
        <div>
          {/* Revision remarks alert if returned */}
          {myAppraisal?.status === 'REVISION_REQUESTED' && (
            <div
              style={{
                marginBottom: '1.25rem',
                padding: '1rem 1.25rem',
                borderRadius: '10px',
                backgroundColor: '#fff7ed',
                border: '1px solid #fed7aa',
                color: '#9a3412',
              }}
            >
              <h4 style={{ margin: '0 0 4px', fontSize: '0.95rem', fontWeight: 700 }}>
                <i className="bi bi-arrow-counterclockwise" style={{ marginRight: '6px' }} />
                Revision Requested by Reviewer
              </h4>
              <p style={{ margin: 0, fontSize: '0.85rem' }}>
                "{myAppraisal.revisionRemarks || 'Please update supporting evidence and self-score.'}"
              </p>
            </div>
          )}

          {/* Reload (e.g. after a cycle change): keep the dossier under an activity bar */}
          {loading && myDataLoaded && categoriesData.length > 0 && (
            <div className="loading-bar" role="progressbar" aria-label="Refreshing appraisal dossier" style={{ marginBottom: '1rem' }} />
          )}

          {!myDataLoaded || (loading && categoriesData.length === 0) ? (
            <div role="status" aria-busy="true" aria-label="Loading your appraisal dossier" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <SkeletonCard lines={3} />
              <SkeletonCard lines={3} />
              <SkeletonCard lines={3} />
            </div>
          ) : categoriesData.length === 0 ? (
            <div
              style={{
                background: 'var(--color-bg-primary, #ffffff)',
                border: '1px solid var(--color-border, #e2e8f0)',
                borderRadius: '12px',
              }}
            >
              <EmptyState
                icon="bi-clipboard2"
                title={`No appraisal open for ${activeCycle?.academicYear || currentYear}`}
                reason={
                  activeCycle
                    ? 'The active appraisal cycle has no evaluation categories configured yet.'
                    : 'No appraisal cycle is currently active, so there is no dossier to fill in.'
                }
                nextStep={
                  isAdminOrPrincipal
                    ? 'Create or activate an appraisal cycle from the Cycle Management tab.'
                    : 'Your appraisal dossier will appear here once the administration opens an appraisal cycle.'
                }
              />
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {canEdit && (
                <AiAppraisalDraft
                  appraisalId={myAppraisal?._id}
                  onDraft={(drafts) =>
                    setCategoriesData((prev) =>
                      prev.map((c) => {
                        const d = drafts.find((x) => x.categoryKey === c.categoryKey);
                        return d ? { ...c, facultyRemarks: d.remarks } : c;
                      })
                    )
                  }
                />
              )}
              {categoriesData.map((cat, idx) => (
                <div
                  key={cat.categoryKey}
                  style={{
                    background: 'var(--color-bg-primary, #ffffff)',
                    border: '1px solid var(--color-border, #e2e8f0)',
                    borderRadius: '12px',
                    padding: '1.25rem',
                    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
                  }}
                >
                  {/* Category Header */}
                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '0.75rem',
                      borderBottom: '1px solid var(--color-border, #f1f5f9)',
                      paddingBottom: '0.75rem',
                      marginBottom: '0.85rem',
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span
                          style={{
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: '4px',
                            background: 'var(--color-bg-secondary, #f1f5f9)',
                            color: 'var(--color-text-secondary, #475569)',
                          }}
                        >
                          Cat {idx + 1}
                        </span>
                        <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700 }}>
                          {cat.displayName}
                        </h3>
                        <span
                          style={{
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: '9999px',
                            background: 'rgba(30, 64, 175, 0.1)',
                            color: '#1B345F',
                          }}
                        >
                          Weightage: {cat.weightage}%
                        </span>
                      </div>
                    </div>

                    {/* Self score input & weighted contribution */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>
                          Weighted Contribution
                        </div>
                        <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#1B345F' }}>
                          {Math.round(((cat.selfScore || 0) / 100) * cat.weightage * 10) / 10} / {cat.weightage} pts
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
                          Self-Score:
                        </label>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          disabled={!canEdit}
                          value={cat.selfScore}
                          onChange={(e) => handleSelfScoreChange(cat.categoryKey, Number(e.target.value))}
                          style={{
                            width: '70px',
                            padding: '5px 8px',
                            borderRadius: '6px',
                            border: '1px solid var(--color-border, #cbd5e1)',
                            textAlign: 'center',
                            fontSize: '0.9rem',
                            fontWeight: 700,
                          }}
                        />
                        <span style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)' }}>/ 100</span>
                      </div>
                    </div>
                  </div>

                  {/* Remarks input */}
                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '4px' }}>
                      Faculty Self-Appraisal Remarks & Achievements Claim:
                    </label>
                    <textarea
                      rows={2}
                      disabled={!canEdit}
                      placeholder={`Enter your claims, metrics and milestones for ${cat.displayName}...`}
                      value={cat.facultyRemarks}
                      onChange={(e) => handleRemarksChange(cat.categoryKey, e.target.value)}
                      style={{
                        width: '100%',
                        padding: '0.6rem 0.75rem',
                        borderRadius: '8px',
                        border: '1px solid var(--color-border, #cbd5e1)',
                        fontSize: '0.85rem',
                      }}
                    />
                  </div>

                  {/* Evidence Section */}
                  <div>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: '6px',
                      }}
                    >
                      <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>
                        Supporting Evidence Documents ({cat.evidenceDocuments?.length || 0})
                      </span>
                      {canEdit && (
                        <button
                          type="button"
                          className="btn btn-outline btn-sm"
                          onClick={() => setEvidenceModalCat({ key: cat.categoryKey, name: cat.displayName })}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '3px 8px',
                            borderRadius: '6px',
                            border: '1px solid var(--color-border, #cbd5e1)',
                            background: '#fff',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            color: '#1B345F',
                          }}
                        >
                          <i className="bi bi-paperclip" />
                          Attach Evidence
                        </button>
                      )}
                    </div>

                    {(!cat.evidenceDocuments || cat.evidenceDocuments.length === 0) ? (
                      <EmptyState
                        icon="bi-paperclip"
                        title={`No evidence attached for ${cat.displayName || 'this category'}`}
                        reason="No supporting documents have been added to this category yet."
                        nextStep={
                          canEdit
                            ? "Use 'Attach Evidence' to upload course files, papers, sanction letters, etc."
                            : 'Evidence can no longer be added once the appraisal is submitted for review.'
                        }
                        compact
                      />
                    ) : (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                        {cat.evidenceDocuments.map((doc, docIdx) => (
                          <div
                            key={docIdx}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '8px',
                              padding: '5px 10px',
                              borderRadius: '8px',
                              background: 'var(--color-bg-secondary, #f8fafc)',
                              border: '1px solid var(--color-border, #cbd5e1)',
                              fontSize: '0.8rem',
                            }}
                          >
                            <i className="bi bi-file-earmark-check-fill" style={{ color: '#1B345F' }} />
                            <a
                              href={fileUrl(doc.documentUrl)}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ textDecoration: 'none', color: '#1B345F', fontWeight: 600 }}
                            >
                              {doc.title}
                            </a>
                            <span style={{ fontSize: '0.7rem', color: '#64748b' }}>({doc.documentType || 'DOC'})</span>
                            {canEdit && (
                              <button
                                type="button"
                                onClick={() => handleRemoveEvidence(cat.categoryKey, docIdx)}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  cursor: 'pointer',
                                  color: '#dc2626',
                                  padding: 0,
                                }}
                              >
                                <i className="bi bi-x-circle" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Stage Evaluation Feedback display if evaluated */}
                  {cat.hodEvaluation && (
                    <div
                      style={{
                        marginTop: '0.75rem',
                        padding: '6px 10px',
                        borderRadius: '6px',
                        background: 'rgba(245, 158, 11, 0.08)',
                        border: '1px solid rgba(245, 158, 11, 0.2)',
                        fontSize: '0.78rem',
                      }}
                    >
                      <strong>HOD Evaluation: </strong> Score: {cat.hodEvaluation.score} / 100 • Evaluated by {cat.hodEvaluation.evaluatedByName}
                      {cat.hodEvaluation.comments && ` • "${cat.hodEvaluation.comments}"`}
                    </div>
                  )}
                  {cat.deanEvaluation && (
                    <div
                      style={{
                        marginTop: '0.5rem',
                        padding: '6px 10px',
                        borderRadius: '6px',
                        background: 'rgba(147, 51, 234, 0.08)',
                        border: '1px solid rgba(147, 51, 234, 0.2)',
                        fontSize: '0.78rem',
                      }}
                    >
                      <strong>Dean Evaluation: </strong> Score: {cat.deanEvaluation.score} / 100 • Evaluated by {cat.deanEvaluation.evaluatedByName}
                      {cat.deanEvaluation.comments && ` • "${cat.deanEvaluation.comments}"`}
                    </div>
                  )}
                </div>
              ))}

              {/* Bottom Sticky Action Bar */}
              {canEdit && (
                <div
                  style={{
                    position: 'sticky',
                    bottom: '1rem',
                    background: 'var(--color-bg-primary, #ffffff)',
                    border: '1px solid var(--color-border, #cbd5e1)',
                    borderRadius: '12px',
                    padding: '1rem 1.5rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                    zIndex: 100,
                  }}
                >
                  <div>
                    <span style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
                      Total Weighted Self Score:{' '}
                    </span>
                    <strong style={{ fontSize: '1.25rem', color: 'var(--color-primary, #1B345F)' }}>
                      {Math.round(liveWeightedScore * 10) / 10} / 100
                    </strong>
                  </div>

                  <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      disabled={actionLoading}
                      aria-busy={pendingAction === 'SAVE_DRAFT'}
                      onClick={handleSaveDraft}
                      style={{
                        padding: '0.55rem 1.25rem',
                        borderRadius: '8px',
                        border: '1px solid var(--color-border, #cbd5e1)',
                        background: '#fff',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      {pendingAction === 'SAVE_DRAFT' && <span className="spinner spinner-sm" aria-hidden="true" />}
                      Save Draft
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={actionLoading}
                      aria-busy={pendingAction === 'SUBMIT'}
                      onClick={handleSubmitAppraisal}
                      style={{
                        padding: '0.55rem 1.5rem',
                        borderRadius: '8px',
                        backgroundColor: 'var(--color-primary, #1B345F)',
                        color: '#fff',
                        border: 'none',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      {pendingAction === 'SUBMIT' && <span className="spinner spinner-sm" aria-hidden="true" />}
                      Submit Final Appraisal Dossier
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: REVIEW QUEUE (Leadership) */}
      {activeTab === 'REVIEW_QUEUE' && isLeadership && (
        <div>
          {/* Controls row */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '1rem',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '1rem',
            }}
          >
            <div style={{ display: 'flex', gap: '0.75rem', flex: 1, maxWidth: '500px' }}>
              <input
                type="text"
                placeholder="Search faculty name, ID, or department..."
                value={queueSearch}
                onChange={(e) => setQueueSearch(e.target.value)}
                style={{
                  flex: 1,
                  padding: '0.55rem 0.85rem',
                  borderRadius: '8px',
                  border: '1px solid var(--color-border, #cbd5e1)',
                  fontSize: '0.85rem',
                }}
              />
              <select
                value={queueFilterStatus}
                onChange={(e) => setQueueFilterStatus(e.target.value)}
                style={{
                  padding: '0.55rem 0.85rem',
                  borderRadius: '8px',
                  border: '1px solid var(--color-border, #cbd5e1)',
                  fontSize: '0.85rem',
                }}
              >
                <option value="">All Statuses</option>
                <option value="HOD_REVIEW">HOD Review</option>
                <option value="DEAN_REVIEW">Dean Review</option>
                <option value="PRINCIPAL_REVIEW">Principal Review</option>
                <option value="APPROVED">Approved</option>
              </select>
            </div>

            <button
              onClick={loadReviewQueue}
              disabled={queueLoading}
              aria-busy={queueLoading}
              className="btn btn-outline"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '0.55rem 0.85rem',
                borderRadius: '8px',
                border: '1px solid var(--color-border, #cbd5e1)',
                background: '#fff',
                fontSize: '0.85rem',
                cursor: 'pointer',
              }}
            >
              {queueLoading ? <span className="spinner spinner-sm" aria-hidden="true" /> : <i className="bi bi-arrow-clockwise" />}
              Refresh
            </button>
          </div>

          {/* Refetch (status filter / refresh): keep the rows under an activity bar */}
          {queueLoading && filteredQueue.length > 0 && (
            <div className="loading-bar" role="progressbar" aria-label="Refreshing review queue" />
          )}

          {/* Queue Table */}
          {!queueLoaded || (queueLoading && filteredQueue.length === 0) ? (
            <div
              role="status"
              aria-busy="true"
              aria-label="Loading review queue"
              style={{ background: '#fff', border: '1px solid var(--color-border, #e2e8f0)', borderRadius: '12px', overflow: 'hidden' }}
            >
              <SkeletonTable rows={5} columns={7} />
            </div>
          ) : filteredQueue.length === 0 ? (
            <div
              style={{
                background: '#fff',
                border: '1px solid var(--color-border, #e2e8f0)',
                borderRadius: '12px',
              }}
            >
              {queueSearch || queueFilterStatus ? (
                <EmptyState
                  icon="bi-funnel"
                  title="No appraisals match your filters"
                  reason="No appraisals in your review queue match the current search or status filter."
                  secondaryAction={
                    <button
                      type="button"
                      onClick={() => {
                        setQueueSearch('');
                        setQueueFilterStatus('');
                      }}
                      style={{
                        padding: '0.45rem 0.85rem',
                        borderRadius: '8px',
                        border: '1px solid var(--color-border, #cbd5e1)',
                        background: '#fff',
                        fontSize: '0.85rem',
                        cursor: 'pointer',
                      }}
                    >
                      Clear filters
                    </button>
                  }
                />
              ) : (
                <EmptyState
                  icon="bi-clipboard2-check"
                  title={`No appraisals awaiting your review${activeCycle ? ` for ${activeCycle.academicYear}` : ''}`}
                  reason="No faculty appraisals are currently at your review stage. Your own appraisal is never routed to you."
                  nextStep="Appraisals submitted by faculty in your scope will appear here for evaluation."
                />
              )}
            </div>
          ) : (
            <div
              style={{
                background: '#fff',
                border: '1px solid var(--color-border, #e2e8f0)',
                borderRadius: '12px',
                overflow: 'hidden',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
              }}
            >
              <table
                className={queueLoading ? 'table-refreshing' : undefined}
                aria-busy={queueLoading}
                style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}
              >
                <thead>
                  <tr style={{ background: 'var(--color-bg-secondary, #f8fafc)', borderBottom: '1px solid var(--color-border, #e2e8f0)', textAlign: 'left' }}>
                    <th style={{ padding: '10px 14px' }}>Faculty</th>
                    <th style={{ padding: '10px 14px' }}>Dept</th>
                    <th style={{ padding: '10px 14px' }}>Stage</th>
                    <th style={{ padding: '10px 14px' }}>Self-Score</th>
                    <th style={{ padding: '10px 14px' }}>Status</th>
                    <th style={{ padding: '10px 14px' }}>Submission Date</th>
                    <th style={{ padding: '10px 14px', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredQueue.map((item) => (
                    <tr key={item._id} style={{ borderBottom: '1px solid var(--color-border, #f1f5f9)' }}>
                      <td style={{ padding: '10px 14px' }}>
                        <div style={{ fontWeight: 700 }}>{item.facultyName}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                          {item.facultyEmployeeId} • {item.designation}
                        </div>
                      </td>
                      <td style={{ padding: '10px 14px', fontWeight: 600 }}>
                        {item.departmentCode}
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <AppraisalStatusBadge stage={item.currentStage} />
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <span style={{ fontWeight: 700, color: '#1B345F' }}>
                          {item.totalSelfScore} / 100
                        </span>
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <AppraisalStatusBadge status={item.status} />
                      </td>
                      <td style={{ padding: '10px 14px', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                        {item.submissionDate ? new Date(item.submissionDate).toLocaleDateString() : 'N/A'}
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '6px' }}>
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            onClick={() => setEvaluatingAppraisal(item)}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '5px 10px',
                              borderRadius: '6px',
                              backgroundColor: 'var(--color-primary, #1B345F)',
                              color: '#fff',
                              border: 'none',
                              fontSize: '0.8rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                          >
                            <i className="bi bi-pencil-square" />
                            Evaluate & Score
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => setAuditAppraisal(item)}
                            style={{
                              padding: '5px 8px',
                              borderRadius: '6px',
                              border: '1px solid var(--color-border, #cbd5e1)',
                              background: '#fff',
                              fontSize: '0.8rem',
                              cursor: 'pointer',
                            }}
                          >
                            <i className="bi bi-clock-history" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: INSTITUTIONAL OVERVIEW & ANALYTICS */}
      {activeTab === 'ANALYTICS' && isLeadership && (
        <div>
          {!stats && (statsLoading || !statsLoaded) && (
            <div role="status" aria-busy="true" aria-label="Loading appraisal statistics">
              <SkeletonStats count={5} className="mb-4" />
              <SkeletonCard lines={3} />
            </div>
          )}
          {stats && statsLoading && (
            <div className="loading-bar" role="progressbar" aria-label="Refreshing appraisal statistics" style={{ marginBottom: '1rem' }} />
          )}
          {stats && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
              <div style={{ background: '#fff', padding: '1.25rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Total Dossiers</span>
                <h3 style={{ margin: '4px 0 0', fontSize: '1.75rem', fontWeight: 800 }}>{stats.total}</h3>
              </div>
              <div style={{ background: '#fff', padding: '1.25rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>In HOD Review</span>
                <h3 style={{ margin: '4px 0 0', fontSize: '1.75rem', fontWeight: 800, color: '#d97706' }}>{stats.hodReview}</h3>
              </div>
              <div style={{ background: '#fff', padding: '1.25rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>In Dean Review</span>
                <h3 style={{ margin: '4px 0 0', fontSize: '1.75rem', fontWeight: 800, color: '#9333ea' }}>{stats.deanReview}</h3>
              </div>
              <div style={{ background: '#fff', padding: '1.25rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Approved & Finalized</span>
                <h3 style={{ margin: '4px 0 0', fontSize: '1.75rem', fontWeight: 800, color: '#059669' }}>{stats.approved}</h3>
              </div>
              <div style={{ background: '#fff', padding: '1.25rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Average Score</span>
                <h3 style={{ margin: '4px 0 0', fontSize: '1.75rem', fontWeight: 800, color: '#1B345F' }}>{stats.averageScore} / 100</h3>
              </div>
            </div>
          )}

          {/* Grade Distribution */}
          {stats?.gradeDistribution && (
            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.5rem', marginBottom: '1.5rem' }}>
              <h4 style={{ margin: '0 0 1rem', fontSize: '1.05rem', fontWeight: 700 }}>
                Accredited Grade Distributions (Based on Final Evaluation)
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem' }}>
                <div style={{ padding: '1rem', borderRadius: '8px', background: 'rgba(99, 102, 241, 0.08)', border: '1px solid rgba(99, 102, 241, 0.2)' }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#4f46e5' }}>Outstanding (A++)</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#4f46e5', marginTop: '4px' }}>
                    {stats.gradeDistribution.outstanding}
                  </div>
                </div>
                <div style={{ padding: '1rem', borderRadius: '8px', background: 'rgba(14, 165, 233, 0.08)', border: '1px solid rgba(14, 165, 233, 0.2)' }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#0284c7' }}>Excellent (A+)</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0284c7', marginTop: '4px' }}>
                    {stats.gradeDistribution.excellent}
                  </div>
                </div>
                <div style={{ padding: '1rem', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#059669' }}>Very Good (A)</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#059669', marginTop: '4px' }}>
                    {stats.gradeDistribution.veryGood}
                  </div>
                </div>
                <div style={{ padding: '1rem', borderRadius: '8px', background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#d97706' }}>Good (B)</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#d97706', marginTop: '4px' }}>
                    {stats.gradeDistribution.good}
                  </div>
                </div>
                <div style={{ padding: '1rem', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#dc2626' }}>Needs Improvement (C)</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#dc2626', marginTop: '4px' }}>
                    {stats.gradeDistribution.needsImprovement}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: CYCLE MANAGEMENT (Admin / Leadership) */}
      {activeTab === 'CYCLES' && isAdminOrPrincipal && (
        <div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '1rem',
            }}
          >
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>
              Configured Academic Appraisal Cycles
            </h3>
            <button
              onClick={() => {
                setEditingCycle(null);
                setIsCycleModalOpen(true);
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '0.55rem 1rem',
                borderRadius: '8px',
                backgroundColor: 'var(--color-primary, #1B345F)',
                color: '#fff',
                border: 'none',
                fontWeight: 600,
                fontSize: '0.85rem',
                cursor: 'pointer',
              }}
            >
              <i className="bi bi-plus-lg" />
              Create Cycle
            </button>
          </div>

          <div
            style={{
              background: '#fff',
              border: '1px solid var(--color-border, #e2e8f0)',
              borderRadius: '12px',
              overflow: 'hidden',
            }}
          >
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ background: 'var(--color-bg-secondary, #f8fafc)', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
                  <th style={{ padding: '10px 14px' }}>Cycle Name</th>
                  <th style={{ padding: '10px 14px' }}>Academic Year</th>
                  <th style={{ padding: '10px 14px' }}>Submission Deadline</th>
                  <th style={{ padding: '10px 14px' }}>Principal Approval</th>
                  <th style={{ padding: '10px 14px' }}>Status</th>
                  <th style={{ padding: '10px 14px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {(!cyclesLoaded || cyclesLoading) && allCycles.length === 0 &&
                  Array.from({ length: 3 }).map((_, r) => (
                    <tr key={`cycle-skeleton-${r}`} aria-hidden="true" style={{ borderBottom: '1px solid #f1f5f9' }}>
                      {Array.from({ length: 6 }).map((__, c) => (
                        <td key={c} style={{ padding: '12px 14px' }}>
                          <Skeleton variant="text" width="70%" height={14} />
                        </td>
                      ))}
                    </tr>
                  ))}
                {cyclesLoaded && !cyclesLoading && allCycles.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ padding: 0 }}>
                      <EmptyState
                        icon="bi-calendar2-range"
                        title="No appraisal cycles configured"
                        reason="No appraisal cycle has been created for any academic year yet, so faculty cannot start their appraisals."
                        action={
                          <button
                            onClick={() => {
                              setEditingCycle(null);
                              setIsCycleModalOpen(true);
                            }}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              padding: '0.55rem 1rem',
                              borderRadius: '8px',
                              backgroundColor: 'var(--color-primary, #1B345F)',
                              color: '#fff',
                              border: 'none',
                              fontWeight: 600,
                              fontSize: '0.85rem',
                              cursor: 'pointer',
                            }}
                          >
                            <i className="bi bi-plus-lg" />
                            Create Cycle
                          </button>
                        }
                      />
                    </td>
                  </tr>
                )}
                {allCycles.map((c) => (
                  <tr key={c._id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '10px 14px', fontWeight: 700 }}>{c.name}</td>
                    <td style={{ padding: '10px 14px' }}>{c.academicYear}</td>
                    <td style={{ padding: '10px 14px' }}>
                      {c.submissionDeadline ? new Date(c.submissionDeadline).toLocaleDateString() : 'N/A'}
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      {c.requirePrincipalApproval ? (
                        <span style={{ color: '#059669', fontWeight: 600 }}>Enabled (Principal Tier)</span>
                      ) : (
                        <span style={{ color: '#64748b' }}>Disabled (Dean Final)</span>
                      )}
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <span
                        style={{
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          padding: '3px 8px',
                          borderRadius: '6px',
                          backgroundColor: c.status === 'ACTIVE' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(100, 116, 139, 0.15)',
                          color: c.status === 'ACTIVE' ? '#059669' : '#64748b',
                        }}
                      >
                        {c.status}
                      </span>
                    </td>
                    <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                      <button
                        onClick={() => {
                          setEditingCycle(c);
                          setIsCycleModalOpen(true);
                        }}
                        style={{
                          padding: '4px 10px',
                          borderRadius: '6px',
                          border: '1px solid #cbd5e1',
                          background: '#fff',
                          cursor: 'pointer',
                          fontSize: '0.8rem',
                          fontWeight: 600,
                        }}
                      >
                        <i className="bi bi-gear" style={{ marginRight: '4px' }} />
                        Configure
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Attach Evidence Modal */}
      {evidenceModalCat && (
        <AppraisalEvidenceModal
          isOpen={Boolean(evidenceModalCat)}
          categoryName={evidenceModalCat.name}
          onClose={() => setEvidenceModalCat(null)}
          onAdd={handleAddEvidence}
        />
      )}

      {/* Evaluation Modal */}
      {evaluatingAppraisal && (
        <AppraisalEvaluationModal
          isOpen={Boolean(evaluatingAppraisal)}
          appraisal={evaluatingAppraisal}
          cycle={activeCycle}
          onClose={() => setEvaluatingAppraisal(null)}
          onSubmitReview={handleSubmitReview}
          isLoading={actionLoading}
        />
      )}

      {/* Audit Modal */}
      {auditAppraisal && (
        <AppraisalAuditModal
          isOpen={Boolean(auditAppraisal)}
          appraisal={auditAppraisal}
          onClose={() => setAuditAppraisal(null)}
        />
      )}

      {/* Cycle Config Modal */}
      {isCycleModalOpen && (
        <AppraisalCycleConfigModal
          isOpen={isCycleModalOpen}
          cycle={editingCycle}
          onClose={() => {
            setIsCycleModalOpen(false);
            setEditingCycle(null);
          }}
          onSave={handleSaveCycle}
          isLoading={actionLoading}
        />
      )}
    </div>
  );
};
