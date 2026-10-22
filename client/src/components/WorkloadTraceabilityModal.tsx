import React from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { EmptyState } from './EmptyState';
import { WorkloadStatusBadge } from './WorkloadStatusBadge';
import type { CalculatedFacultyWorkload } from '../types/workload';

interface WorkloadTraceabilityModalProps {
  isOpen: boolean;
  onClose: () => void;
  workload: CalculatedFacultyWorkload | null;
}

export const WorkloadTraceabilityModal: React.FC<WorkloadTraceabilityModalProps> = ({
  isOpen,
  onClose,
  workload,
}) => {
  if (!workload) return null;

  const { faculty, metrics, status, activeThreshold, traceability } = workload;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Workload Traceability — ${faculty.name}`}
      size="xl"
    >
      <div className="space-y-5">
        {/* Header Overview Banner */}
        <div className="card p-4 bg-surface-muted/30 border border-border">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-base text-text-primary flex items-center gap-2">
                {faculty.name}
                <WorkloadStatusBadge status={status} hours={metrics.weeklyHours} />
              </h3>
              <p className="text-xs text-text-muted mt-0.5">
                {faculty.facultyId} • {faculty.cadre} • {faculty.department}
              </p>
            </div>

            <div className="flex items-center gap-3 text-right">
              <div className="px-3 py-1.5 rounded-lg bg-surface border border-border">
                <span className="text-[10px] uppercase text-text-muted font-semibold block">Total Contact</span>
                <span className="text-xl font-bold text-primary-600 dark:text-primary-400">
                  {metrics.weeklyHours} <span className="text-xs font-normal text-text-muted">hrs/wk</span>
                </span>
              </div>
              <div className="px-3 py-1.5 rounded-lg bg-surface border border-border">
                <span className="text-[10px] uppercase text-text-muted font-semibold block">Total Credits</span>
                <span className="text-xl font-bold text-text-primary">
                  {metrics.totalCredits} <span className="text-xs font-normal text-text-muted">C</span>
                </span>
              </div>
            </div>
          </div>

          {/* Active Threshold Indicator */}
          <div className="mt-3 pt-3 border-t border-border flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="text-text-secondary">
              <strong>Active Policy:</strong> {activeThreshold.cadre} Rules
            </span>
            <div className="flex items-center gap-3 text-[11px] font-mono">
              <span className="text-slate-600 dark:text-slate-400">Underload: &lt;{activeThreshold.underloadMax}h</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Normal: {activeThreshold.normalMin}-{activeThreshold.normalMax}h</span>
              <span className="text-amber-600 dark:text-amber-400">High: {activeThreshold.highMin}-{activeThreshold.highMax}h</span>
              <span className="text-rose-600 dark:text-rose-400">Overload: &ge;{activeThreshold.overloadMin}h</span>
            </div>
          </div>
        </div>

        {/* Traceability Table */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-text-secondary">
              Allocated Academic Subjects ({traceability.length})
            </h4>
            <span className="text-xs text-text-muted">
              L: {metrics.lectureHours}h • T: {metrics.tutorialHours}h • P/Lab: {metrics.practicalHours}h
            </span>
          </div>

          {traceability.length === 0 ? (
            <div className="card border border-border">
              <EmptyState
                compact
                icon="bi-journal-x"
                title={`No subject allocations for ${faculty.name}`}
                reason="No subjects have been allocated to this faculty member for the selected period, so there are no hours to trace."
                nextStep="Allocations made on the Subjects page will be listed here with their L-T-P hours."
              />
            </div>
          ) : (
            <div className="card overflow-hidden border border-border">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="border-b border-border bg-surface-muted/50 text-[11px] font-semibold text-text-secondary uppercase">
                    <th className="py-2.5 px-3">Subject</th>
                    <th className="py-2.5 px-2 text-center">Sem & Sec</th>
                    <th className="py-2.5 px-2 text-center">Year</th>
                    <th className="py-2.5 px-2 text-center">Credits</th>
                    <th className="py-2.5 px-2 text-center">Hours (L-T-P)</th>
                    <th className="py-2.5 px-2 text-center">Weekly Load</th>
                    <th className="py-2.5 px-3 text-right">Responsibilities</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border text-xs">
                  {traceability.map((item) => (
                    <tr key={item.allocationId} className="hover:bg-surface-muted/20">
                      <td className="py-2.5 px-3">
                        <div className="font-semibold text-text-primary">{item.subjectCode}</div>
                        <div className="text-[11px] text-text-muted line-clamp-1">{item.subjectName}</div>
                      </td>
                      <td className="py-2.5 px-2 text-center font-medium">
                        Sem {item.semester} • Sec {item.section}
                      </td>
                      <td className="py-2.5 px-2 text-center text-text-secondary font-mono">
                        {item.academicYear}
                      </td>
                      <td className="py-2.5 px-2 text-center">
                        <span className="px-1.5 py-0.5 rounded bg-primary-50 dark:bg-primary-950/40 text-primary-700 dark:text-primary-300 font-bold">
                          {item.credits} C
                        </span>
                      </td>
                      <td className="py-2.5 px-2 text-center font-mono">
                        {item.lectureHours}L + {item.tutorialHours}T + {item.practicalHours}P
                      </td>
                      <td className="py-2.5 px-2 text-center">
                        <span className="font-bold text-text-primary px-2 py-0.5 rounded bg-surface-muted">
                          {item.totalHours} hrs/wk
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <div className="flex flex-wrap items-center justify-end gap-1">
                          {item.coordinatorResponsibility && (
                            <span className="badge badge-warning text-[10px]" title={item.coordinatorRole || 'Coordinator'}>
                              <i className="bi bi-star-fill text-[9px] mr-1" />
                              {item.coordinatorRole || 'Coordinator'}
                            </span>
                          )}
                          {item.labResponsibility && (
                            <span className="badge badge-info text-[10px]" title={item.labBatch ? `Batch: ${item.labBatch}` : 'Lab In-Charge'}>
                              <i className="bi bi-cpu text-[9px] mr-1" />
                              Lab {item.labBatch ? `(${item.labBatch})` : ''}
                            </span>
                          )}
                          {!item.coordinatorResponsibility && !item.labResponsibility && (
                            <span className="text-text-muted text-[11px]">Theory Faculty</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Additional Responsibilities Section */}
        {metrics.additionalResponsibilities.totalResponsibilitiesCount > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-text-secondary">
              Academic & Institutional Responsibilities ({metrics.additionalResponsibilities.totalResponsibilitiesCount})
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
              {metrics.additionalResponsibilities.coordinators.map((c, i) => (
                <div key={`coord-${i}`} className="card p-2.5 text-xs border border-border flex items-start gap-2">
                  <i className="bi bi-star-fill text-amber-500 mt-0.5 text-xs" />
                  <div>
                    <span className="font-semibold block text-text-primary">{c.role}</span>
                    <span className="text-text-muted text-[11px]">{c.subjectCode} • Section {c.section}</span>
                  </div>
                </div>
              ))}
              {metrics.additionalResponsibilities.labIncharges.map((l, i) => (
                <div key={`lab-${i}`} className="card p-2.5 text-xs border border-border flex items-start gap-2">
                  <i className="bi bi-cpu text-cyan-500 mt-0.5 text-xs" />
                  <div>
                    <span className="font-semibold block text-text-primary">Laboratory In-Charge</span>
                    <span className="text-text-muted text-[11px]">{l.subjectCode} • {l.batch || 'Main Lab'}</span>
                  </div>
                </div>
              ))}
              {metrics.additionalResponsibilities.institutional.map((inst, i) => (
                <div key={`inst-${i}`} className="card p-2.5 text-xs border border-border flex items-start gap-2">
                  <i className="bi bi-award text-primary-500 mt-0.5 text-xs" />
                  <div>
                    <span className="font-semibold block text-text-primary">{inst.responsibility}</span>
                    <span className="text-text-muted text-[11px]">{inst.level} Level ({inst.academicYear})</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex justify-end pt-2 border-t border-border">
          <Button variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
};
