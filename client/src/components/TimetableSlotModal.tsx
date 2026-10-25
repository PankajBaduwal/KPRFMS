import '../styles/legacy-utilities.css';
import React, { useState, useEffect } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { Input } from './Input';
import { Select } from './Select';
import { Alert } from './Alert';
import { timetableService } from '../services/timetable.service';
import { facultyService } from '../services/faculty.service';
import { subjectService } from '../services/subject.service';
import { useAcademicYears } from '../hooks/useAcademicYears';
import type {
  TimetableSlot,
  DayOfWeek,
  ConflictCheckResult,
} from '../types/timetable';
import { DAYS_OF_WEEK, STANDARD_PERIOD_TIMES } from '../types/timetable';
import type { FacultyProfile } from '../types/faculty';
import type { Subject } from '../types/subject';
import { CheckCircle2, AlertTriangle, ShieldCheck } from 'lucide-react';

interface TimetableSlotModalProps {
  isOpen: boolean;
  onClose: () => void;
  slot?: TimetableSlot | null;
  defaultDay?: DayOfWeek;
  defaultPeriod?: number;
  departmentId?: string;
  onSuccess: () => void;
}

export const TimetableSlotModal: React.FC<TimetableSlotModalProps> = ({
  isOpen,
  onClose,
  slot,
  defaultDay = 'MONDAY',
  defaultPeriod = 1,
  departmentId: propDepartmentId,
  onSuccess,
}) => {
  const [facultyList, setFacultyList] = useState<FacultyProfile[]>([]);
  const [subjectList, setSubjectList] = useState<Subject[]>([]);

  const [day, setDay] = useState<DayOfWeek>(defaultDay);
  const [period, setPeriod] = useState<number>(defaultPeriod);
  const [room, setRoom] = useState('LH-101');
  const [section, setSection] = useState('A');
  const [semester, setSemester] = useState<number>(5);
  const { currentYear } = useAcademicYears();
  const [academicYear, setAcademicYear] = useState('');
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [selectedFacultyId, setSelectedFacultyId] = useState('');
  const [remarks, setRemarks] = useState('');

  const [departmentId, setDepartmentId] = useState(propDepartmentId || '');
  const [conflictResult, setConflictResult] = useState<ConflictCheckResult | null>(null);
  const [checkingConflict, setCheckingConflict] = useState(false);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load faculty & subjects
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

  // Sync initial values
  useEffect(() => {
    if (slot) {
      setDay(slot.day);
      setPeriod(slot.period);
      setRoom(slot.room);
      setSection(slot.section);
      setSemester(slot.semester);
      setAcademicYear(slot.academicYear);
      setRemarks(slot.remarks || '');

      const sId = typeof slot.subjectId === 'object' ? slot.subjectId._id : slot.subjectId;
      const fId = typeof slot.facultyId === 'object' ? slot.facultyId._id : slot.facultyId;
      const dId = typeof slot.departmentId === 'object' ? slot.departmentId._id : slot.departmentId;

      setSelectedSubjectId(sId || '');
      setSelectedFacultyId(fId || '');
      if (dId) setDepartmentId(dId);
    } else {
      setDay(defaultDay);
      setPeriod(defaultPeriod);
      setRoom('LH-101');
      setSection('A');
      setSemester(5);
      setAcademicYear('');
      setRemarks('');
      setSelectedSubjectId('');
      setSelectedFacultyId('');
      if (propDepartmentId) setDepartmentId(propDepartmentId);
    }
    setConflictResult(null);
    setError(null);
  }, [slot, defaultDay, defaultPeriod, propDepartmentId, isOpen]);

  // Default to the current academic year once it has loaded
  useEffect(() => {
    if (!slot && isOpen && currentYear) setAcademicYear((prev) => prev || currentYear);
  }, [slot, isOpen, currentYear]);

  // When subject selected, auto-populate departmentId & semester if empty
  const handleSubjectChange = (subId: string) => {
    setSelectedSubjectId(subId);
    const sub = subjectList.find((s) => s._id === subId);
    if (sub) {
      setSemester(sub.semester);
      setAcademicYear(sub.academicYear);
      const dId = typeof sub.departmentId === 'object' ? (sub.departmentId as any)._id : sub.departmentId;
      if (dId) setDepartmentId(dId);
    }
  };

  // Perform live conflict check
  const handleCheckConflict = async () => {
    if (checkingConflict) return;
    if (!selectedFacultyId || !selectedSubjectId || !room.trim() || !section.trim()) {
      setError('Please select faculty, subject, section, and room to check conflicts.');
      return;
    }

    setCheckingConflict(true);
    setError(null);

    const sub = subjectList.find((s) => s._id === selectedSubjectId);
    const resolvedDeptId = departmentId || (sub && typeof sub.departmentId === 'object' ? (sub.departmentId as any)._id : sub?.departmentId);

    try {
      const result = await timetableService.checkConflicts({
        academicYear,
        day,
        period: Number(period),
        room: room.trim().toUpperCase(),
        section: section.trim().toUpperCase(),
        semester: Number(semester),
        departmentId: resolvedDeptId || '',
        facultyId: selectedFacultyId,
        excludeSlotId: slot?._id,
      });

      setConflictResult(result);
    } catch (err: any) {
      if (err.response?.status === 409) {
        setConflictResult({
          hasConflict: true,
          conflicts: [err.response?.data?.message || 'Schedule conflict detected.'],
        });
      } else {
        setError(err.response?.data?.message || 'Conflict check failed');
      }
    } finally {
      setCheckingConflict(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    if (!selectedFacultyId) {
      setError('Please select an instructor faculty member.');
      return;
    }
    if (!selectedSubjectId) {
      setError('Please select a subject course.');
      return;
    }
    if (!room.trim()) {
      setError('Please specify a classroom / laboratory.');
      return;
    }

    const sub = subjectList.find((s) => s._id === selectedSubjectId);
    const resolvedDeptId = departmentId || (sub && typeof sub.departmentId === 'object' ? (sub.departmentId as any)._id : sub?.departmentId);

    if (!resolvedDeptId) {
      setError('Department could not be identified for this subject.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      if (slot) {
        await timetableService.updateSlot(slot._id, {
          academicYear,
          semester: Number(semester),
          departmentId: resolvedDeptId,
          day,
          period: Number(period),
          room: room.trim().toUpperCase(),
          subjectId: selectedSubjectId,
          section: section.trim().toUpperCase(),
          facultyId: selectedFacultyId,
          remarks: remarks.trim() || undefined,
        });
      } else {
        await timetableService.createSlot({
          academicYear,
          semester: Number(semester),
          departmentId: resolvedDeptId,
          day,
          period: Number(period),
          room: room.trim().toUpperCase(),
          subjectId: selectedSubjectId,
          section: section.trim().toUpperCase(),
          facultyId: selectedFacultyId,
          remarks: remarks.trim() || undefined,
        });
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save timetable slot.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      className="tw-legacy"
      isOpen={isOpen}
      onClose={saving ? () => {} : onClose}
      title={slot ? 'Edit Timetable Slot' : 'Add Timetable Class Slot'}
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <Alert variant="danger" onDismiss={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* Conflict verification banner */}
        {conflictResult && (
          <div
            className={`p-3 rounded-lg border text-xs ${
              conflictResult.hasConflict
                ? 'bg-rose-50 border-rose-200 text-rose-800'
                : 'bg-emerald-50 border-emerald-200 text-emerald-800'
            }`}
          >
            <div className="flex items-center gap-2 font-bold mb-1">
              {conflictResult.hasConflict ? (
                <>
                  <AlertTriangle className="w-4 h-4 text-rose-600" />
                  <span>Conflict Warning: Slot Collision Detected</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>No Conflicts Detected (Faculty, Room, and Section are free)</span>
                </>
              )}
            </div>
            {conflictResult.hasConflict && (
              <ul className="list-disc pl-5 space-y-0.5 mt-1 font-medium">
                {conflictResult.conflicts.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Day & Period row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select
            label="Day of Week"
            value={day}
            onChange={(e) => {
              setDay(e.target.value as DayOfWeek);
              setConflictResult(null);
            }}
            options={DAYS_OF_WEEK.map((d) => ({ value: d, label: d }))}
            required
          />

          <Select
            label="Period (Timing)"
            value={String(period)}
            onChange={(e) => {
              setPeriod(Number(e.target.value));
              setConflictResult(null);
            }}
            options={[1, 2, 3, 4, 5, 6, 7, 8].map((p) => ({
              value: String(p),
              label: `Period ${p} (${STANDARD_PERIOD_TIMES[p]})`,
            }))}
            required
          />
        </div>

        {/* Subject Course & Faculty */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select
            label="Subject / Course"
            value={selectedSubjectId}
            onChange={(e) => {
              handleSubjectChange(e.target.value);
              setConflictResult(null);
            }}
            options={[
              { value: '', label: loadingOptions ? 'Loading subjects...' : '-- Select Subject --' },
              ...subjectList.map((s) => ({
                value: s._id,
                label: `${s.subjectCode} - ${s.subjectName} (Sem ${s.semester})`,
              })),
            ]}
            disabled={loadingOptions}
            required
          />

          <Select
            label="Instructor / Faculty"
            value={selectedFacultyId}
            onChange={(e) => {
              setSelectedFacultyId(e.target.value);
              setConflictResult(null);
            }}
            options={[
              { value: '', label: loadingOptions ? 'Loading faculty...' : '-- Select Faculty --' },
              ...facultyList.map((f) => ({
                value: f._id,
                label: `${f.name} (${f.designation})`,
              })),
            ]}
            disabled={loadingOptions}
            required
          />
        </div>

        {/* Room, Section & Semester */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Input
            label="Room / Hall / Lab"
            value={room}
            onChange={(e) => {
              setRoom(e.target.value);
              setConflictResult(null);
            }}
            placeholder="e.g. LH-101, CS-LAB-2"
            required
          />

          <Input
            label="Section"
            value={section}
            onChange={(e) => {
              setSection(e.target.value);
              setConflictResult(null);
            }}
            placeholder="e.g. A, B, C"
            required
          />

          <Input
            label="Semester"
            type="number"
            min={1}
            max={8}
            value={semester}
            onChange={(e) => setSemester(Number(e.target.value))}
            required
          />
        </div>

        {/* Academic Year & Remarks */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Academic Year"
            value={academicYear}
            onChange={(e) => setAcademicYear(e.target.value)}
            placeholder="2024-2025"
            required
          />

          <Input
            label="Remarks (Optional)"
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            placeholder="e.g. Smart Board Room, Elective Slot"
          />
        </div>

        {/* Action Controls */}
        <div className="pt-3 border-t border-gray-200 flex flex-wrap items-center justify-between gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleCheckConflict}
            loading={checkingConflict}
            disabled={saving}
            className="flex items-center gap-1.5 text-xs text-blue-700 border-blue-300 hover:bg-blue-50"
          >
            {!checkingConflict && <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />}
            <span>{checkingConflict ? 'Checking Conflicts...' : 'Validate Conflicts'}</span>
          </Button>

          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button
              type="submit"
              loading={saving}
              disabled={checkingConflict || conflictResult?.hasConflict === true}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {saving ? 'Saving...' : slot ? 'Update Slot' : 'Create Slot'}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
};
