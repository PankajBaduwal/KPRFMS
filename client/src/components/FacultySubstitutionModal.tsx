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
import type { TimetableSlot, ConflictCheckResult } from '../types/timetable';
import { STANDARD_PERIOD_TIMES } from '../types/timetable';
import type { FacultyProfile } from '../types/faculty';
import type { Subject } from '../types/subject';
import { CheckCircle2, AlertTriangle, ShieldCheck, RefreshCw } from 'lucide-react';

interface FacultySubstitutionModalProps {
  isOpen: boolean;
  onClose: () => void;
  slot?: TimetableSlot | null;
  defaultDate?: string;
  onSuccess: () => void;
}

export const FacultySubstitutionModal: React.FC<FacultySubstitutionModalProps> = ({
  isOpen,
  onClose,
  slot,
  defaultDate,
  onSuccess,
}) => {
  const [facultyList, setFacultyList] = useState<FacultyProfile[]>([]);
  const [subjectList, setSubjectList] = useState<Subject[]>([]);

  // Form State
  const [originalFacultyId, setOriginalFacultyId] = useState('');
  const [substituteFacultyId, setSubstituteFacultyId] = useState('');
  const [date, setDate] = useState(
    defaultDate || new Date().toISOString().split('T')[0]
  );
  const [period, setPeriod] = useState<number>(1);
  const [subjectId, setSubjectId] = useState('');
  const [section, setSection] = useState('A');
  const [room, setRoom] = useState('LH-101');
  const [semester, setSemester] = useState<number>(5);
  const { currentYear } = useAcademicYears();
  const [academicYear, setAcademicYear] = useState('');
  const [reason, setReason] = useState('');

  const [conflictResult, setConflictResult] = useState<ConflictCheckResult | null>(null);
  const [checkingConflict, setCheckingConflict] = useState(false);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    if (slot) {
      const origFId = typeof slot.facultyId === 'object' ? slot.facultyId._id : slot.facultyId;
      const sId = typeof slot.subjectId === 'object' ? slot.subjectId._id : slot.subjectId;

      setOriginalFacultyId(origFId || '');
      setPeriod(slot.period);
      setSubjectId(sId || '');
      setSection(slot.section);
      setRoom(slot.room);
      setSemester(slot.semester);
      setAcademicYear(slot.academicYear);
    } else {
      setOriginalFacultyId('');
      setPeriod(1);
      setSubjectId('');
      setSection('A');
      setRoom('LH-101');
      setSemester(5);
      setAcademicYear('');
    }
    setSubstituteFacultyId('');
    setReason('');
    setConflictResult(null);
    setError(null);
    if (defaultDate) setDate(defaultDate);
  }, [slot, defaultDate, isOpen]);

  // Default to the current academic year once it has loaded
  useEffect(() => {
    if (!slot && isOpen && currentYear) setAcademicYear((prev) => prev || currentYear);
  }, [slot, isOpen, currentYear]);

  const handleCheckSubstituteConflict = async () => {
    if (checkingConflict) return;
    if (!substituteFacultyId) {
      setError('Please select a substitute faculty member first.');
      return;
    }
    if (substituteFacultyId === originalFacultyId) {
      setError('Substitute faculty must be someone other than the original instructor.');
      return;
    }

    setCheckingConflict(true);
    setError(null);

    try {
      const result = await timetableService.checkSubstitutionConflicts({
        substituteFacultyId,
        date,
        period: Number(period),
        academicYear,
      });

      setConflictResult(result);
    } catch (err: any) {
      if (err.response?.status === 409) {
        setConflictResult({
          hasConflict: true,
          conflicts: [err.response?.data?.message || 'Substitute faculty conflict detected.'],
        });
      } else {
        setError(err.response?.data?.message || 'Substitution conflict check failed');
      }
    } finally {
      setCheckingConflict(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    if (!originalFacultyId) {
      setError('Original faculty must be selected.');
      return;
    }
    if (!substituteFacultyId) {
      setError('Please assign a substitute faculty member.');
      return;
    }
    if (originalFacultyId === substituteFacultyId) {
      setError('Substitute faculty must be different from original faculty member.');
      return;
    }
    if (!reason.trim()) {
      setError('Please enter a reason for class substitution.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await timetableService.createSubstitution({
        timetableSlotId: slot?._id,
        originalFacultyId,
        substituteFacultyId,
        date,
        period: Number(period),
        room: room.trim().toUpperCase(),
        subjectId,
        section: section.trim().toUpperCase(),
        semester: Number(semester),
        academicYear,
        reason: reason.trim(),
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to record faculty substitution.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={saving ? () => {} : onClose}
      title="Record Faculty Substitution"
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="bg-amber-50/70 border border-amber-200/80 rounded-lg p-3 text-xs text-amber-900 flex items-start gap-2">
          <RefreshCw className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
          <div>
            <span className="font-bold">Historical Timetable Preservation:</span>
            <p className="mt-0.5 text-amber-800">
              This substitution will not overwrite the base timetable. It creates an audited overlay record for the specified date, preserving all historical academic records.
            </p>
          </div>
        </div>

        {error && (
          <Alert variant="danger" onDismiss={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* Conflict verification feedback */}
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
                  <span>Substitute Faculty Conflict: Schedule Overlap</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Substitute is Free (No overlapping class or substitution)</span>
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

        {/* Date & Period */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Substitution Date"
            type="date"
            value={date}
            onChange={(e) => {
              setDate(e.target.value);
              setConflictResult(null);
            }}
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

        {/* Original Faculty & Substitute Faculty */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select
            label="Original Faculty (On Leave / Unavailable)"
            value={originalFacultyId}
            onChange={(e) => setOriginalFacultyId(e.target.value)}
            options={[
              { value: '', label: loadingOptions ? 'Loading faculty...' : '-- Select Original Faculty --' },
              ...facultyList.map((f) => ({
                value: f._id,
                label: `${f.name} (${f.designation})`,
              })),
            ]}
            disabled={loadingOptions}
            required
          />

          <Select
            label="Substitute Faculty (Covering Instructor)"
            value={substituteFacultyId}
            onChange={(e) => {
              setSubstituteFacultyId(e.target.value);
              setConflictResult(null);
            }}
            options={[
              { value: '', label: loadingOptions ? 'Loading faculty...' : '-- Select Substitute Faculty --' },
              ...facultyList
                .filter((f) => f._id !== originalFacultyId)
                .map((f) => ({
                  value: f._id,
                  label: `${f.name} (${f.designation})`,
                })),
            ]}
            disabled={loadingOptions}
            required
          />
        </div>

        {/* Subject Course & Section */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="sm:col-span-2">
            <Select
              label="Subject / Course"
              value={subjectId}
              onChange={(e) => setSubjectId(e.target.value)}
              options={[
                { value: '', label: loadingOptions ? 'Loading subjects...' : '-- Select Subject --' },
                ...subjectList.map((s) => ({
                  value: s._id,
                  label: `${s.subjectCode} - ${s.subjectName}`,
                })),
              ]}
              disabled={loadingOptions}
              required
            />
          </div>

          <Input
            label="Section"
            value={section}
            onChange={(e) => setSection(e.target.value)}
            placeholder="A"
            required
          />
        </div>

        {/* Room & Academic Year */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Classroom / Room"
            value={room}
            onChange={(e) => setRoom(e.target.value)}
            placeholder="LH-101"
            required
          />

          <Input
            label="Academic Year"
            value={academicYear}
            onChange={(e) => setAcademicYear(e.target.value)}
            placeholder="2024-2025"
            required
          />
        </div>

        {/* Reason for substitution */}
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">
            Reason for Substitution <span className="text-red-500">*</span>
          </label>
          <textarea
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. On-duty faculty leave for doctoral committee / conference attendance."
            className="w-full text-xs rounded-lg border border-gray-300 p-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
            required
          />
        </div>

        {/* Controls */}
        <div className="pt-3 border-t border-gray-200 flex flex-wrap items-center justify-between gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleCheckSubstituteConflict}
            loading={checkingConflict}
            disabled={saving || !substituteFacultyId}
            className="flex items-center gap-1.5 text-xs text-amber-700 border-amber-300 hover:bg-amber-50"
          >
            {!checkingConflict && <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />}
            <span>{checkingConflict ? 'Checking...' : 'Check Substitute Availability'}</span>
          </Button>

          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button
              type="submit"
              loading={saving}
              disabled={checkingConflict || conflictResult?.hasConflict === true}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              {saving ? 'Recording...' : 'Confirm Substitution'}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
};
