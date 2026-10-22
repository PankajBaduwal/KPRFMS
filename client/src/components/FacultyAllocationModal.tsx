import React, { useState, useEffect } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { Input } from './Input';
import { Select } from './Select';
import { Alert } from './Alert';
import { subjectService } from '../services/subject.service';
import { facultyService } from '../services/faculty.service';
import { useAcademicYears } from '../hooks/useAcademicYears';
import type {
  Subject,
  FacultyAllocation,
  CreateAllocationInput,
  ConflictCheckResult,
} from '../types/subject';
import type { FacultyProfile } from '../types/faculty';

interface FacultyAllocationModalProps {
  isOpen: boolean;
  onClose: () => void;
  allocation?: FacultyAllocation | null;
  preselectedSubject?: Subject | null;
  presetSubject?: Subject | null;
  onSuccess: () => void;
}

export const FacultyAllocationModal: React.FC<FacultyAllocationModalProps> = ({
  isOpen,
  onClose,
  allocation,
  preselectedSubject,
  presetSubject,
  onSuccess,
}) => {
  const activePreset = presetSubject || preselectedSubject;
  const [facultyList, setFacultyList] = useState<FacultyProfile[]>([]);
  const [subjectList, setSubjectList] = useState<Subject[]>([]);

  const [selectedFacultyId, setSelectedFacultyId] = useState('');
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [section, setSection] = useState('A');
  const [semester, setSemester] = useState<number>(5);
  const { currentYear, years, options: yearOptions } = useAcademicYears();
  const [academicYear, setAcademicYear] = useState('');
  const [lectureHours, setLectureHours] = useState<number>(3);
  const [tutorialHours, setTutorialHours] = useState<number>(0);
  const [practicalHours, setPracticalHours] = useState<number>(0);
  const [labResponsibility, setLabResponsibility] = useState(false);
  const [labBatch, setLabBatch] = useState('Batch 1');
  const [coordinatorResponsibility, setCoordinatorResponsibility] = useState(false);
  const [coordinatorRole, setCoordinatorRole] = useState('Course Coordinator');
  const [remarks, setRemarks] = useState('');

  const [conflictResult, setConflictResult] = useState<ConflictCheckResult | null>(null);
  const [checkingConflict, setCheckingConflict] = useState(false);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load faculty directory and subject catalog
  useEffect(() => {
    if (isOpen) {
      setLoadingOptions(true);
      Promise.all([facultyService.getDirectory(), subjectService.getSubjects()])
        .then(([faculties, subRes]) => {
          setFacultyList(faculties || []);
          setSubjectList(subRes.subjects || []);
        })
        .catch(() => {})
        .finally(() => setLoadingOptions(false));
    }
  }, [isOpen]);

  useEffect(() => {
    if (allocation) {
      const fId = typeof allocation.facultyId === 'object' ? allocation.facultyId._id : allocation.facultyId;
      const sId = typeof allocation.subjectId === 'object' ? allocation.subjectId._id : allocation.subjectId;
      setSelectedFacultyId(fId || '');
      setSelectedSubjectId(sId || '');
      setSection(allocation.section || 'A');
      setSemester(allocation.semester || 5);
      setAcademicYear(allocation.academicYear || currentYear);
      setLectureHours(allocation.lectureHours ?? 0);
      setTutorialHours(allocation.tutorialHours ?? 0);
      setPracticalHours(allocation.practicalHours ?? 0);
      setLabResponsibility(allocation.labResponsibility ?? false);
      setLabBatch(allocation.labBatch || 'Batch 1');
      setCoordinatorResponsibility(allocation.coordinatorResponsibility ?? false);
      setCoordinatorRole(allocation.coordinatorRole || 'Course Coordinator');
      setRemarks(allocation.remarks || '');
    } else {
      if (activePreset) {
        setSelectedSubjectId(activePreset._id);
        setSemester(activePreset.semester);
        setAcademicYear(activePreset.academicYear);
        setSection(activePreset.section || 'A');
        setLectureHours(activePreset.lectureHours ?? 3);
        setTutorialHours(activePreset.tutorialHours ?? 0);
        setPracticalHours(activePreset.practicalHours ?? 0);
        if ((activePreset.practicalHours || 0) > 0) {
          setLabResponsibility(true);
        } else {
          setLabResponsibility(false);
        }
      } else {
        setSelectedSubjectId('');
        setSemester(5);
        setAcademicYear('');
        setSection('A');
        setLectureHours(3);
        setTutorialHours(0);
        setPracticalHours(0);
        setLabResponsibility(false);
      }
      setSelectedFacultyId('');
      setLabBatch('Batch 1');
      setCoordinatorResponsibility(false);
      setCoordinatorRole('Course Coordinator');
      setRemarks('');
    }
    setConflictResult(null);
    setError(null);
  }, [allocation, preselectedSubject, isOpen]);

  // Default to the current academic year once it has loaded
  useEffect(() => {
    if (isOpen && currentYear) setAcademicYear((prev) => prev || currentYear);
  }, [isOpen, currentYear]);

  // When subject changes, populate default hours & semester if new allocation
  const handleSubjectChange = (subId: string) => {
    setSelectedSubjectId(subId);
    const sub = subjectList.find((s) => s._id === subId);
    if (sub && !allocation) {
      setSemester(sub.semester);
      setAcademicYear(sub.academicYear);
      setSection(sub.section || 'A');
      setLectureHours(sub.lectureHours);
      setTutorialHours(sub.tutorialHours);
      setPracticalHours(sub.practicalHours);
      if (sub.practicalHours > 0) {
        setLabResponsibility(true);
      }
    }
  };

  const handleCheckConflict = async () => {
    if (checkingConflict) return;
    if (!selectedFacultyId || !selectedSubjectId || !section.trim()) {
      setError('Select a faculty member, subject, and section to run conflict analysis.');
      return;
    }
    setCheckingConflict(true);
    setError(null);
    try {
      const res = await subjectService.checkConflict({
        facultyId: selectedFacultyId,
        subjectId: selectedSubjectId,
        section: section.trim().toUpperCase(),
        semester: Number(semester),
        academicYear,
        lectureHours: Number(lectureHours),
        tutorialHours: Number(tutorialHours),
        practicalHours: Number(practicalHours),
        labResponsibility,
        labBatch: labResponsibility ? labBatch : undefined,
        coordinatorResponsibility,
        excludeAllocationId: allocation?._id,
      });
      setConflictResult(res);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to check conflict.');
    } finally {
      setCheckingConflict(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    if (!selectedFacultyId || !selectedSubjectId || !section.trim()) {
      setError('Please select both faculty member and subject with section.');
      return;
    }

    if (Number(lectureHours) + Number(tutorialHours) + Number(practicalHours) <= 0) {
      setError('At least one teaching hour (Lecture, Tutorial, or Practical) must be allocated.');
      return;
    }

    setSaving(true);
    setError(null);

    const payload: CreateAllocationInput = {
      facultyId: selectedFacultyId,
      subjectId: selectedSubjectId,
      section: section.trim().toUpperCase(),
      semester: Number(semester),
      academicYear,
      lectureHours: Number(lectureHours),
      tutorialHours: Number(tutorialHours),
      practicalHours: Number(practicalHours),
      labResponsibility,
      labBatch: labResponsibility ? labBatch.trim() : undefined,
      coordinatorResponsibility,
      coordinatorRole: coordinatorResponsibility ? coordinatorRole : undefined,
      remarks: remarks.trim() || undefined,
    };

    try {
      if (allocation) {
        await subjectService.updateAllocation(allocation._id, payload);
      } else {
        await subjectService.createAllocation(payload);
      }
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message || 'Error saving faculty allocation.');
    } finally {
      setSaving(false);
    }
  };

  const totalAllocatedHours = Number(lectureHours || 0) + Number(tutorialHours || 0) + Number(practicalHours || 0);

  return (
    <Modal
      isOpen={isOpen}
      onClose={saving ? () => {} : onClose}
      title={allocation ? 'Modify Faculty Subject Allocation' : 'Allocate Subject to Faculty'}
      size="lg"
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        {error && <Alert variant="danger">{error}</Alert>}

        {/* Live Conflict & Warning Notification */}
        {conflictResult && (
          <div>
            {conflictResult.hasConflict && (
              <Alert variant="danger">
                <strong>Schedule / Section Conflict Detected:</strong>
                <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
                  {conflictResult.conflicts.map((c, i) => (
                    <li key={i}>{c}</li>
                  ))}
                </ul>
              </Alert>
            )}

            {!conflictResult.hasConflict && conflictResult.warnings.length > 0 && (
              <Alert variant="warning">
                <strong>Workload & Coordination Advisories:</strong>
                <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
                  {conflictResult.warnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </Alert>
            )}

            {!conflictResult.hasConflict && conflictResult.warnings.length === 0 && (
              <Alert variant="success">
                <i className="bi bi-check-circle-fill me-1" aria-hidden="true" />No schedule or section conflicts found! Projected load: {conflictResult.projectedFacultyHours} hrs/week.
              </Alert>
            )}
          </div>
        )}

        {/* Faculty and Subject Selectors */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 'var(--space-3)' }}>
          <Select
            label="Faculty Member *"
            value={selectedFacultyId}
            onChange={(e) => setSelectedFacultyId(e.target.value)}
            options={[
              { value: '', label: loadingOptions ? 'Loading faculty directory...' : '-- Select Teaching Faculty --' },
              ...facultyList.map((f: any) => ({
                value: f._id,
                label: `${f.userId?.name || f.name || 'Faculty'} (${f.facultyId || f.employment?.biometricId || f.userId?.email || 'ID'}) — ${f.employment?.cadre || f.designation || 'Staff'}`,
              })),
            ]}
            disabled={loadingOptions}
            required
          />

          <Select
            label="Academic Subject *"
            value={selectedSubjectId}
            onChange={(e) => handleSubjectChange(e.target.value)}
            options={[
              { value: '', label: loadingOptions ? 'Loading subjects...' : '-- Select Academic Subject --' },
              ...subjectList.map((s) => ({
                value: s._id,
                label: `${s.subjectCode} — ${s.subjectName} (Sem ${s.semester}, ${s.credits}C)`,
              })),
            ]}
            disabled={loadingOptions}
            required
          />
        </div>

        {/* Section, Semester & Academic Year */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 'var(--space-3)' }}>
          <Input
            label="Section *"
            value={section}
            onChange={(e) => setSection(e.target.value.toUpperCase())}
            placeholder="e.g. A"
            required
          />

          <Select
            label="Semester *"
            value={String(semester)}
            onChange={(e) => setSemester(Number(e.target.value))}
            options={[1, 2, 3, 4, 5, 6, 7, 8].map((s) => ({
              value: String(s),
              label: `Semester ${s}`,
            }))}
          />

          <Select
            label="Academic Year *"
            value={academicYear}
            onChange={(e) => setAcademicYear(e.target.value)}
            options={
              academicYear && !years.includes(academicYear)
                ? [{ value: academicYear, label: academicYear }, ...yearOptions]
                : yearOptions
            }
          />
        </div>

        {/* Teaching Hours Allocation */}
        <div
          style={{
            padding: 'var(--space-3)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-border)',
            background: 'var(--color-surface)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, textTransform: 'uppercase', color: 'var(--color-text-secondary)' }}>
              Weekly Teaching Load Distribution
            </span>
            <span className="badge badge-primary">
              Allocated Load: {totalAllocatedHours} hrs/week
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-3)' }}>
            <Input
              label="Lecture Hours (L)"
              type="number"
              min={0}
              max={20}
              value={String(lectureHours)}
              onChange={(e) => setLectureHours(Number(e.target.value))}
            />
            <Input
              label="Tutorial Hours (T)"
              type="number"
              min={0}
              max={20}
              value={String(tutorialHours)}
              onChange={(e) => setTutorialHours(Number(e.target.value))}
            />
            <Input
              label="Practical Hours (P)"
              type="number"
              min={0}
              max={20}
              value={String(practicalHours)}
              onChange={(e) => setPracticalHours(Number(e.target.value))}
            />
          </div>
        </div>

        {/* Special Responsibilities (Lab & Coordinator) */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 'var(--space-3)' }}>
          {/* Lab In-Charge */}
          <div style={{ padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'var(--color-bg-primary)' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 600, fontSize: 'var(--font-size-sm)' }}>
              <input
                type="checkbox"
                checked={labResponsibility}
                onChange={(e) => setLabResponsibility(e.target.checked)}
              />
              Laboratory Session Responsibility
            </label>
            {labResponsibility && (
              <div style={{ marginTop: '8px' }}>
                <Input
                  label="Lab Batch (Optional)"
                  value={labBatch}
                  onChange={(e) => setLabBatch(e.target.value)}
                  placeholder="e.g. Batch 1 / Full Section"
                />
              </div>
            )}
          </div>

          {/* Course Coordinator */}
          <div style={{ padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', background: 'var(--color-bg-primary)' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 600, fontSize: 'var(--font-size-sm)' }}>
              <input
                type="checkbox"
                checked={coordinatorResponsibility}
                onChange={(e) => setCoordinatorResponsibility(e.target.checked)}
              />
              Course Coordinator Responsibility
            </label>
            {coordinatorResponsibility && (
              <div style={{ marginTop: '8px' }}>
                <Select
                  label="Coordination Role"
                  value={coordinatorRole}
                  onChange={(e) => setCoordinatorRole(e.target.value)}
                  options={[
                    { value: 'Course Coordinator', label: 'Primary Course Coordinator' },
                    { value: 'Module Coordinator', label: 'Module Coordinator' },
                    { value: 'Lab In-Charge', label: 'Laboratory In-Charge' },
                  ]}
                />
              </div>
            )}
          </div>
        </div>

        {/* Remarks */}
        <Input
          label="Official Allocation Remarks (Optional)"
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
          placeholder="e.g. Approved in Department Academic Council meeting on Aug 2024..."
        />

        {/* Conflict Check & Actions */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'var(--space-3)', paddingTop: 'var(--space-3)', borderTop: '1px solid var(--color-border)' }}>
          <Button
            variant="outline"
            type="button"
            onClick={handleCheckConflict}
            loading={checkingConflict}
            disabled={saving || !selectedFacultyId || !selectedSubjectId}
          >
            {!checkingConflict && <i className="bi bi-shield-check" style={{ marginRight: '6px' }} />}
            {checkingConflict ? 'Verifying...' : 'Check Conflict'}
          </Button>

          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <Button variant="outline" type="button" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" loading={saving} disabled={checkingConflict}>
              {saving ? 'Allocating...' : allocation ? 'Update Allocation' : 'Assign Faculty'}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
};
