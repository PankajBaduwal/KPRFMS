import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { mentoringService } from '../services/mentoring.service';
import { useAuthStore } from '../stores/authStore';
import { useAcademicYears } from '../hooks/useAcademicYears';
import { ROLES } from '../constants/roles';
import {
  PageHeader,
  Button,
  Badge,
  Input,
  Select,
  Alert,
  Skeleton,
  SkeletonTable,
  LoadingState,
  EmptyState,
  ErrorState,
  MentoringRecordModal,
  InteractionModal,
  MentoringDetailModal,
} from '../components';
import type { StudentMentoring, MentoringStatus } from '../types/mentoring';
import {
  MENTORING_STATUS,
  MENTORING_STATUS_BADGES,
} from '../types/mentoring';

export const StudentMentoringPage: React.FC = () => {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();

  // Search & Filter States
  const [search, setSearch] = useState('');
  const [selectedYear, setSelectedYear] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [selectedBatch, setSelectedBatch] = useState<string>('ALL');

  // Batch filter options: 4-year batches derived from the current academic year (newest first)
  const { currentYear } = useAcademicYears();
  const currentStartYear = parseInt(currentYear.split('-')[0], 10);
  const batchOptions = Number.isNaN(currentStartYear)
    ? []
    : Array.from({ length: 5 }, (_, i) => {
        const start = currentStartYear - i;
        const batch = `${start}-${start + 4}`;
        return { value: batch, label: batch };
      });

  // Modal States
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<StudentMentoring | null>(null);

  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<StudentMentoring | null>(null);

  const [isInteractionModalOpen, setIsInteractionModalOpen] = useState(false);
  const [interactionTargetRecord, setInteractionTargetRecord] = useState<StudentMentoring | null>(null);

  const [alertMessage, setAlertMessage] = useState<string | null>(null);

  const isFaculty = user?.role === ROLES.FACULTY;
  const isHod = user?.role === ROLES.HOD;
  const canCreate = isFaculty || user?.role === ROLES.ADMIN;

  // 1. Fetch Metrics
  const { data: metrics, isLoading: metricsLoading } = useQuery({
    queryKey: ['mentoringMetrics', user?.id],
    queryFn: () => mentoringService.getMetrics(),
  });

  // 2. Fetch Records List
  const {
    data: listData,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['mentoringRecords', selectedYear, selectedStatus, selectedBatch, search],
    queryFn: () =>
      mentoringService.getRecords({
        academicYear: selectedYear !== 'ALL' ? selectedYear : undefined,
        status: selectedStatus !== 'ALL' ? (selectedStatus as MentoringStatus) : undefined,
        batch: selectedBatch !== 'ALL' ? selectedBatch : undefined,
        search: search.trim() || undefined,
        limit: 100,
      }),
    // Keep the current rows on screen while a filter/search refetch runs
    placeholderData: keepPreviousData,
  });

  // 3. Delete Record Mutation
  const deleteRecordMutation = useMutation({
    mutationFn: (id: string) => mentoringService.deleteRecord(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mentoringRecords'] });
      queryClient.invalidateQueries({ queryKey: ['mentoringMetrics'] });
      setAlertMessage('Student mentoring record deleted successfully.');
      if (selectedRecord) setIsDetailModalOpen(false);
    },
    onError: (err: any) => {
      setAlertMessage(err?.response?.data?.message || 'Failed to delete record');
    },
  });

  // 4. Delete Interaction Mutation
  const deleteInteractionMutation = useMutation({
    mutationFn: ({ recordId, interactionId }: { recordId: string; interactionId: string }) =>
      mentoringService.deleteInteraction(recordId, interactionId),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['mentoringRecords'] });
      queryClient.invalidateQueries({ queryKey: ['mentoringMetrics'] });
      setSelectedRecord(updated);
      setAlertMessage('Interaction session deleted.');
    },
    onError: (err: any) => {
      setAlertMessage(err?.response?.data?.message || 'Failed to delete interaction');
    },
  });

  const handleOpenDetail = (record: StudentMentoring) => {
    setSelectedRecord(record);
    setIsDetailModalOpen(true);
  };

  const handleOpenLogInteraction = (record: StudentMentoring) => {
    setInteractionTargetRecord(record);
    setIsInteractionModalOpen(true);
  };

  const handleEditRecord = (record: StudentMentoring) => {
    setEditingRecord(record);
    setIsRecordModalOpen(true);
  };

  const handleDeleteRecord = (record: StudentMentoring) => {
    if (deleteRecordMutation.isPending) return;
    if (window.confirm(`Are you sure you want to delete mentoring record for "${record.studentName}"?`)) {
      deleteRecordMutation.mutate(record._id);
    }
  };

  const records = listData?.records || [];
  const isRefetching = isFetching && !isLoading;

  const hasActiveFilters =
    search.trim() !== '' || selectedStatus !== 'ALL' || selectedBatch !== 'ALL' || selectedYear !== 'ALL';

  const handleResetFilters = () => {
    setSearch('');
    setSelectedYear('ALL');
    setSelectedStatus('ALL');
    setSelectedBatch('ALL');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {alertMessage && (
        <Alert variant="info" onDismiss={() => setAlertMessage(null)}>
          {alertMessage}
        </Alert>
      )}

      {/* Standard Institutional Header */}
      <PageHeader
        title="Faculty Student Mentoring"
        subtitle={
          isFaculty
            ? 'Maintain comprehensive student mentoring records, advisory sessions, and academic intervention histories.'
            : isHod
            ? 'Department-wide visibility and monitoring of student mentoring, remedial actions, and career guidance.'
            : 'Institutional review and analytics of faculty-student mentorship programs.'
        }
        badge={
          isHod ? (
            <Badge variant="warning">HOD Department View</Badge>
          ) : isFaculty ? (
            <Badge variant="primary">Faculty Mentorship</Badge>
          ) : (
            <Badge variant="success">Institutional View</Badge>
          )
        }
        actions={
          canCreate ? (
            <Button
              variant="primary"
              icon={<i className="bi bi-person-plus" />}
              onClick={() => {
                setEditingRecord(null);
                setIsRecordModalOpen(true);
              }}
            >
              Assign New Mentee
            </Button>
          ) : undefined
        }
      />

      {/* Metrics Row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 'var(--space-4)',
        }}
      >
        <div className="card-custom" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(59, 130, 246, 0.1)',
              color: '#3b82f6',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.5rem',
            }}
          >
            <i className="bi bi-people" />
          </div>
          <div>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
              Total Students Mentored
            </div>
            <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--color-text)' }}>
              {metricsLoading ? <Skeleton variant="text" width={56} height={28} /> : metrics?.totalStudentsMentored ?? '—'}
            </div>
          </div>
        </div>

        <div className="card-custom" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(16, 185, 129, 0.1)',
              color: '#10b981',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.5rem',
            }}
          >
            <i className="bi bi-person-check" />
          </div>
          <div>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
              Active Mentees
            </div>
            <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#10b981' }}>
              {metricsLoading ? <Skeleton variant="text" width={56} height={28} /> : metrics?.activeStudents ?? '—'}
            </div>
          </div>
        </div>

        <div className="card-custom" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(99, 102, 241, 0.1)',
              color: '#6366f1',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.5rem',
            }}
          >
            <i className="bi bi-mortarboard" />
          </div>
          <div>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
              Completed Mentoring
            </div>
            <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--color-text)' }}>
              {metricsLoading ? <Skeleton variant="text" width={56} height={28} /> : metrics?.completedMentoring ?? '—'}
            </div>
          </div>
        </div>

        <div className="card-custom" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(245, 158, 11, 0.1)',
              color: '#f59e0b',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.5rem',
            }}
          >
            <i className="bi bi-chat-square-text" />
          </div>
          <div>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
              Total Interactions Logged
            </div>
            <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--color-text)' }}>
              {metricsLoading ? <Skeleton variant="text" width={56} height={28} /> : metrics?.totalInteractions ?? '—'}
            </div>
          </div>
        </div>
      </div>

      {/* Academic Year Summary Pills */}
      {metrics?.studentsByAcademicYear && metrics.studentsByAcademicYear.length > 0 && (
        <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--color-text-muted)' }}>
            Filter by Year:
          </span>
          <button
            onClick={() => setSelectedYear('ALL')}
            style={{
              border: selectedYear === 'ALL' ? '1px solid var(--color-primary)' : '1px solid var(--color-border)',
              background: selectedYear === 'ALL' ? 'var(--color-primary-light)' : 'var(--color-bg-primary)',
              color: selectedYear === 'ALL' ? 'var(--color-primary)' : 'var(--color-text)',
              padding: '4px 12px',
              borderRadius: 'var(--radius-full)',
              fontSize: 'var(--font-size-xs)',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            All Academic Years
          </button>
          {metrics.studentsByAcademicYear.map((yr) => (
            <button
              key={yr.academicYear}
              onClick={() => setSelectedYear(yr.academicYear)}
              style={{
                border: selectedYear === yr.academicYear ? '1px solid var(--color-primary)' : '1px solid var(--color-border)',
                background: selectedYear === yr.academicYear ? 'var(--color-primary-light)' : 'var(--color-bg-primary)',
                color: selectedYear === yr.academicYear ? 'var(--color-primary)' : 'var(--color-text)',
                padding: '4px 12px',
                borderRadius: 'var(--radius-full)',
                fontSize: 'var(--font-size-xs)',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {yr.academicYear} ({yr.count} students)
            </button>
          ))}
        </div>
      )}

      {/* Search and Filters Toolbar */}
      <div
        className="card-custom"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 'var(--space-3)',
          alignItems: 'end',
        }}
      >
        <Input
          label="Search Students"
          placeholder="Name, Reg No, Batch, Topic..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {isRefetching && (
          <div style={{ alignSelf: 'center' }}>
            <LoadingState inline size="sm" message="Updating results..." />
          </div>
        )}

        <Select
          label="Status"
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value)}
          options={[
            { value: 'ALL', label: 'All Statuses' },
            { value: MENTORING_STATUS.ACTIVE, label: 'Active Mentees' },
            { value: MENTORING_STATUS.COMPLETED, label: 'Completed Mentoring' },
            { value: MENTORING_STATUS.INACTIVE, label: 'Inactive' },
          ]}
        />

        <Select
          label="Batch"
          value={selectedBatch}
          onChange={(e) => setSelectedBatch(e.target.value)}
          options={[
            { value: 'ALL', label: 'All Batches' },
            ...batchOptions,
          ]}
        />

        <div>
          <Button
            variant="outline"
            onClick={handleResetFilters}
            style={{ width: '100%' }}
          >
            Reset Filters
          </Button>
        </div>
      </div>

      {/* Records Table View */}
      {isLoading ? (
        <div className="card-custom" style={{ padding: 0 }} role="status" aria-busy="true" aria-label="Loading student mentoring records">
          <SkeletonTable rows={6} columns={8} />
        </div>
      ) : isError ? (
        <ErrorState
          title="Unable to load mentoring records"
          message={(error as any)?.response?.data?.message || 'Error loading mentoring records.'}
          onRetry={() => refetch()}
          retryText="Retry Loading"
        />
      ) : records.length === 0 ? (
        <EmptyState
          icon="bi-people"
          title={
            hasActiveFilters
              ? 'No mentoring records match your filters'
              : 'No student mentoring records yet'
          }
          reason={
            hasActiveFilters
              ? `No records match the current search or filters${selectedYear !== 'ALL' ? ` for ${selectedYear}` : ''}.`
              : isFaculty
              ? 'No mentees have been assigned to you yet.'
              : 'No mentees have been assigned or recorded yet.'
          }
          nextStep={
            !canCreate && !hasActiveFilters
              ? 'Mentoring records created by faculty will appear here for monitoring.'
              : undefined
          }
          action={
            canCreate ? (
              <Button
                variant="primary"
                icon={<i className="bi bi-person-plus" />}
                onClick={() => {
                  setEditingRecord(null);
                  setIsRecordModalOpen(true);
                }}
              >
                Assign New Mentee
              </Button>
            ) : undefined
          }
          secondaryAction={
            hasActiveFilters ? (
              <Button variant="outline" onClick={handleResetFilters}>
                Clear filters
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="card-custom" style={{ padding: 0, overflow: 'hidden' }} aria-busy={isRefetching}>
          {isRefetching && <div className="loading-bar" role="progressbar" aria-label="Updating records" />}
          <div style={{ overflowX: 'auto', opacity: isRefetching ? 0.6 : 1, transition: 'opacity var(--transition-fast)' }}>
            <table className="table-custom" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--font-size-sm)' }}>
              <thead>
                <tr style={{ background: 'var(--color-bg-secondary)', borderBottom: '1px solid var(--color-border)', textAlign: 'left' }}>
                  <th style={{ padding: 'var(--space-3) var(--space-4)' }}>Student Name & Reg No</th>
                  <th style={{ padding: 'var(--space-3) var(--space-4)' }}>Batch & Section</th>
                  <th style={{ padding: 'var(--space-3) var(--space-4)' }}>Mentor Role</th>
                  <th style={{ padding: 'var(--space-3) var(--space-4)' }}>Year</th>
                  <th style={{ padding: 'var(--space-3) var(--space-4)' }}>Status</th>
                  <th style={{ padding: 'var(--space-3) var(--space-4)' }}>Interactions</th>
                  <th style={{ padding: 'var(--space-3) var(--space-4)' }}>Evidence</th>
                  <th style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {records.map((rec) => {
                  const interactionCount = rec.interactionRecords?.length || 0;
                  return (
                    <tr
                      key={rec._id}
                      style={{
                        borderBottom: '1px solid var(--color-border)',
                        transition: 'background var(--transition-fast)',
                      }}
                    >
                      <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                        <div style={{ fontWeight: 600, color: 'var(--color-text)' }}>
                          {rec.studentName}
                        </div>
                        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                          {rec.registerNumber}
                        </div>
                      </td>

                      <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                        <div>{rec.batch}</div>
                        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                          Sec {rec.section} &bull; {rec.department}
                        </div>
                      </td>

                      <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                        <span style={{ fontWeight: 500 }}>{rec.mentorRole}</span>
                      </td>

                      <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                        <Badge variant="neutral">{rec.academicYear}</Badge>
                      </td>

                      <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                        <Badge variant={MENTORING_STATUS_BADGES[rec.status] || 'neutral'}>
                          {rec.status}
                        </Badge>
                      </td>

                      <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                        <button
                          type="button"
                          onClick={() => handleOpenDetail(rec)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            background: interactionCount > 0 ? 'var(--color-primary-light)' : 'transparent',
                            color: interactionCount > 0 ? 'var(--color-primary)' : 'var(--color-text-muted)',
                            border: '1px solid',
                            borderColor: interactionCount > 0 ? 'var(--color-primary)' : 'var(--color-border)',
                            borderRadius: 'var(--radius-full)',
                            padding: '2px 8px',
                            fontSize: 'var(--font-size-xs)',
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          <i className="bi bi-chat-dots" />
                          {interactionCount} Session{interactionCount !== 1 ? 's' : ''}
                        </button>
                      </td>

                      <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                        {rec.evidence ? (
                          <a
                            href={rec.evidence}
                            target="_blank"
                            rel="noreferrer"
                            style={{
                              color: 'var(--color-primary)',
                              fontSize: 'var(--font-size-xs)',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              textDecoration: 'none',
                              fontWeight: 500,
                            }}
                          >
                            <i className="bi bi-file-earmark-pdf" />
                            Form
                          </a>
                        ) : (
                          <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-xs)' }}>—</span>
                        )}
                      </td>

                      <td style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: 'var(--space-1)' }}>
                          <button
                            type="button"
                            onClick={() => handleOpenDetail(rec)}
                            title="View History & Record"
                            style={{
                              border: 'none',
                              background: 'transparent',
                              color: 'var(--color-primary)',
                              padding: '6px 8px',
                              cursor: 'pointer',
                              borderRadius: 'var(--radius-sm)',
                            }}
                          >
                            <i className="bi bi-eye" />
                          </button>

                          {canCreate && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleOpenLogInteraction(rec)}
                                title="Log Session"
                                style={{
                                  border: 'none',
                                  background: 'transparent',
                                  color: 'var(--color-success)',
                                  padding: '6px 8px',
                                  cursor: 'pointer',
                                  borderRadius: 'var(--radius-sm)',
                                }}
                              >
                                <i className="bi bi-chat-plus" />
                              </button>

                              <button
                                type="button"
                                onClick={() => handleEditRecord(rec)}
                                title="Edit Mentee Record"
                                style={{
                                  border: 'none',
                                  background: 'transparent',
                                  color: 'var(--color-text-secondary)',
                                  padding: '6px 8px',
                                  cursor: 'pointer',
                                  borderRadius: 'var(--radius-sm)',
                                }}
                              >
                                <i className="bi bi-pencil" />
                              </button>

                              <button
                                type="button"
                                onClick={() => handleDeleteRecord(rec)}
                                disabled={deleteRecordMutation.isPending}
                                aria-busy={deleteRecordMutation.isPending && deleteRecordMutation.variables === rec._id}
                                title="Delete Mentee Record"
                                style={{
                                  border: 'none',
                                  background: 'transparent',
                                  color: 'var(--color-danger)',
                                  padding: '6px 8px',
                                  cursor: deleteRecordMutation.isPending ? 'not-allowed' : 'pointer',
                                  borderRadius: 'var(--radius-sm)',
                                }}
                              >
                                {deleteRecordMutation.isPending && deleteRecordMutation.variables === rec._id ? (
                                  <span className="spinner spinner-sm" aria-hidden="true" />
                                ) : (
                                  <i className="bi bi-trash" />
                                )}
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Detail & History Modal */}
      {isDetailModalOpen && (
        <MentoringDetailModal
          isOpen={isDetailModalOpen}
          onClose={() => setIsDetailModalOpen(false)}
          record={selectedRecord}
          onLogInteraction={(rec) => {
            setIsDetailModalOpen(false);
            handleOpenLogInteraction(rec);
          }}
          onDeleteInteraction={(recId, intId) => {
            if (deleteInteractionMutation.isPending) return;
            deleteInteractionMutation.mutate({ recordId: recId, interactionId: intId });
          }}
          deletingInteractionId={
            deleteInteractionMutation.isPending ? deleteInteractionMutation.variables?.interactionId ?? null : null
          }
          canEdit={canCreate}
        />
      )}

      {/* Add / Edit Record Modal */}
      {isRecordModalOpen && (
        <MentoringRecordModal
          isOpen={isRecordModalOpen}
          onClose={() => {
            setIsRecordModalOpen(false);
            setEditingRecord(null);
          }}
          record={editingRecord}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['mentoringRecords'] });
            queryClient.invalidateQueries({ queryKey: ['mentoringMetrics'] });
            setAlertMessage(editingRecord ? 'Record updated.' : 'New mentee assigned successfully.');
          }}
        />
      )}

      {/* Log Interaction Modal */}
      {isInteractionModalOpen && interactionTargetRecord && (
        <InteractionModal
          isOpen={isInteractionModalOpen}
          onClose={() => {
            setIsInteractionModalOpen(false);
            setInteractionTargetRecord(null);
          }}
          record={interactionTargetRecord}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['mentoringRecords'] });
            queryClient.invalidateQueries({ queryKey: ['mentoringMetrics'] });
            setAlertMessage('Mentoring session logged successfully.');
          }}
        />
      )}
    </div>
  );
};
