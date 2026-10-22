import React, { useState, useEffect } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { Input } from './Input';
import { Select } from './Select';
import { Alert } from './Alert';
import { mentoringService } from '../services/mentoring.service';
import { useAcademicYears } from '../hooks/useAcademicYears';
import type { StudentMentoring, MentoringStatus } from '../types/mentoring';
import { MENTORING_STATUS, MENTOR_ROLES } from '../types/mentoring';

interface MentoringRecordModalProps {
  isOpen: boolean;
  onClose: () => void;
  record?: StudentMentoring | null;
  onSuccess: () => void;
}

export const MentoringRecordModal: React.FC<MentoringRecordModalProps> = ({
  isOpen,
  onClose,
  record,
  onSuccess,
}) => {
  const { currentYear, years, options: yearOptions } = useAcademicYears();
  const [academicYear, setAcademicYear] = useState('');
  const [studentName, setStudentName] = useState('');
  const [registerNumber, setRegisterNumber] = useState('');
  const [department, setDepartment] = useState('Computer Science and Engineering');
  const [batch, setBatch] = useState('');
  const [section, setSection] = useState('A');
  const [mentorRole, setMentorRole] = useState<string>(MENTOR_ROLES.FACULTY_MENTOR);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [status, setStatus] = useState<MentoringStatus>(MENTORING_STATUS.ACTIVE);
  const [academicConcerns, setAcademicConcerns] = useState('');
  const [careerGuidance, setCareerGuidance] = useState('');
  const [attendanceIntervention, setAttendanceIntervention] = useState('');
  const [projectGuidance, setProjectGuidance] = useState('');
  const [remarks, setRemarks] = useState('');
  const [evidence, setEvidence] = useState('');

  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (record) {
      setAcademicYear(record.academicYear || currentYear);
      setStudentName(record.studentName || '');
      setRegisterNumber(record.registerNumber || '');
      setDepartment(record.department || 'Computer Science and Engineering');
      setBatch(record.batch || '');
      setSection(record.section || 'A');
      setMentorRole(record.mentorRole || MENTOR_ROLES.FACULTY_MENTOR);
      setStartDate(record.startDate ? record.startDate.split('T')[0] : '');
      setEndDate(record.endDate ? record.endDate.split('T')[0] : '');
      setStatus(record.status || MENTORING_STATUS.ACTIVE);
      setAcademicConcerns(record.academicConcerns || '');
      setCareerGuidance(record.careerGuidance || '');
      setAttendanceIntervention(record.attendanceIntervention || '');
      setProjectGuidance(record.projectGuidance || '');
      setRemarks(record.remarks || '');
      setEvidence(record.evidence || '');
    } else {
      setAcademicYear('');
      setStudentName('');
      setRegisterNumber('');
      setDepartment('Computer Science and Engineering');
      setBatch('');
      setSection('A');
      setMentorRole(MENTOR_ROLES.FACULTY_MENTOR);
      setStartDate(new Date().toISOString().split('T')[0]);
      setEndDate('');
      setStatus(MENTORING_STATUS.ACTIVE);
      setAcademicConcerns('');
      setCareerGuidance('');
      setAttendanceIntervention('');
      setProjectGuidance('');
      setRemarks('');
      setEvidence('');
    }
    setError(null);
  }, [record, isOpen]);

  // Default to the current academic year once it has loaded
  useEffect(() => {
    if (isOpen && currentYear) setAcademicYear((prev) => prev || currentYear);
  }, [isOpen, currentYear]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || uploading) return;

    setUploading(true);
    setError(null);
    try {
      const res = await mentoringService.uploadEvidence(file);
      setEvidence(res.fileUrl);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to upload evidence document');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving || uploading) return;
    if (!studentName.trim() || !registerNumber.trim() || !startDate) {
      setError('Please fill in student name, register number, and start date.');
      return;
    }

    setSaving(true);
    setError(null);

    const payload = {
      academicYear,
      studentName: studentName.trim(),
      registerNumber: registerNumber.trim(),
      department: department.trim(),
      batch: batch.trim(),
      section: section.trim(),
      mentorRole: mentorRole.trim(),
      startDate,
      endDate: endDate || undefined,
      status,
      academicConcerns: academicConcerns.trim() || undefined,
      careerGuidance: careerGuidance.trim() || undefined,
      attendanceIntervention: attendanceIntervention.trim() || undefined,
      projectGuidance: projectGuidance.trim() || undefined,
      remarks: remarks.trim() || undefined,
      evidence: evidence || undefined,
    };

    try {
      if (record) {
        await mentoringService.updateRecord(record._id, payload);
      } else {
        await mentoringService.createRecord(payload);
      }
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Error saving mentoring record');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={saving ? () => {} : onClose}
      title={record ? 'Edit Student Mentoring Record' : 'Assign New Student Mentee'}
      size="lg"
    >
      <form onSubmit={handleSubmit}>
        {error && (
          <div style={{ marginBottom: 'var(--space-4)' }}>
            <Alert variant="danger" onDismiss={() => setError(null)}>
              {error}
            </Alert>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 'var(--space-4)' }}>
          <Input
            label="Student Full Name *"
            value={studentName}
            onChange={(e) => setStudentName(e.target.value)}
            placeholder="e.g. Arun Kumar S"
            required
          />

          <Input
            label="Register / Roll Number *"
            value={registerNumber}
            onChange={(e) => setRegisterNumber(e.target.value)}
            placeholder="e.g. 711321104001"
            required
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

          <Input
            label="Department *"
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            required
          />

          <Input
            label="Batch *"
            value={batch}
            onChange={(e) => setBatch(e.target.value)}
            placeholder="e.g. 2021-2025"
            required
          />

          <Input
            label="Section *"
            value={section}
            onChange={(e) => setSection(e.target.value)}
            placeholder="e.g. A"
            required
          />

          <Select
            label="Mentor Role *"
            value={mentorRole}
            onChange={(e) => setMentorRole(e.target.value)}
            options={[
              { value: MENTOR_ROLES.FACULTY_MENTOR, label: 'Faculty Mentor' },
              { value: MENTOR_ROLES.CLASS_ADVISOR, label: 'Class Advisor' },
              { value: MENTOR_ROLES.ACADEMIC_COUNSELOR, label: 'Academic Counselor' },
              { value: MENTOR_ROLES.PROJECT_GUIDE, label: 'Project Guide' },
              { value: MENTOR_ROLES.CAREER_MENTOR, label: 'Career Mentor' },
            ]}
          />

          <Select
            label="Mentoring Status *"
            value={status}
            onChange={(e) => setStatus(e.target.value as MentoringStatus)}
            options={[
              { value: MENTORING_STATUS.ACTIVE, label: 'Active (Ongoing Mentoring)' },
              { value: MENTORING_STATUS.COMPLETED, label: 'Completed (Graduated / Term End)' },
              { value: MENTORING_STATUS.INACTIVE, label: 'Inactive' },
            ]}
          />

          <Input
            label="Start Date *"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            required
          />

          <Input
            label="End Date (Optional)"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>

        {/* Advisory & Guidance Sections */}
        <div style={{ marginTop: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <div>
            <label className="form-label" style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>
              Academic Concerns & Subject Difficulties
            </label>
            <textarea
              className="form-control"
              rows={2}
              value={academicConcerns}
              onChange={(e) => setAcademicConcerns(e.target.value)}
              placeholder="e.g. Remedial guidance in Data Structures, internal assessment performance..."
              style={{
                width: '100%',
                padding: 'var(--space-2) var(--space-3)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border)',
                background: 'var(--color-bg-primary)',
                color: 'var(--color-text)',
              }}
            />
          </div>

          <div>
            <label className="form-label" style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>
              Career Guidance & Higher Studies Aspirations
            </label>
            <textarea
              className="form-control"
              rows={2}
              value={careerGuidance}
              onChange={(e) => setCareerGuidance(e.target.value)}
              placeholder="e.g. Placement training, GATE prep, product company target, foreign university..."
              style={{
                width: '100%',
                padding: 'var(--space-2) var(--space-3)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border)',
                background: 'var(--color-bg-primary)',
                color: 'var(--color-text)',
              }}
            />
          </div>

          <div>
            <label className="form-label" style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>
              Attendance Intervention & Counseling
            </label>
            <textarea
              className="form-control"
              rows={2}
              value={attendanceIntervention}
              onChange={(e) => setAttendanceIntervention(e.target.value)}
              placeholder="e.g. Medical leave compensation, parent counseling, tracking percentage..."
              style={{
                width: '100%',
                padding: 'var(--space-2) var(--space-3)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border)',
                background: 'var(--color-bg-primary)',
                color: 'var(--color-text)',
              }}
            />
          </div>

          <div>
            <label className="form-label" style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>
              Project Guidance & Technical Competitions
            </label>
            <textarea
              className="form-control"
              rows={2}
              value={projectGuidance}
              onChange={(e) => setProjectGuidance(e.target.value)}
              placeholder="e.g. Capstone project title, Smart India Hackathon mentoring, research paper..."
              style={{
                width: '100%',
                padding: 'var(--space-2) var(--space-3)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border)',
                background: 'var(--color-bg-primary)',
                color: 'var(--color-text)',
              }}
            />
          </div>

          <div>
            <label className="form-label" style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>
              General Remarks / Faculty Observations
            </label>
            <textarea
              className="form-control"
              rows={2}
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="e.g. Highly disciplined, consistent academic progress..."
              style={{
                width: '100%',
                padding: 'var(--space-2) var(--space-3)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border)',
                background: 'var(--color-bg-primary)',
                color: 'var(--color-text)',
              }}
            />
          </div>

          {/* Evidence Upload */}
          <div>
            <label className="form-label" style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>
              Supporting Evidence / Mentoring Form (PDF / Scanned Form)
            </label>
            <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
              <input
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                onChange={handleFileUpload}
                disabled={uploading || saving}
                style={{ fontSize: 'var(--font-size-sm)' }}
              />
              {uploading && (
                <span role="status" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: 'var(--font-size-xs)', color: 'var(--color-primary)' }}>
                  <span className="spinner spinner-sm" aria-hidden="true" />
                  Uploading...
                </span>
              )}
              {evidence && (
                <a
                  href={evidence}
                  target="_blank"
                  rel="noreferrer"
                  style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-primary)', textDecoration: 'underline' }}
                >
                  View Uploaded Document
                </a>
              )}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)', marginTop: 'var(--space-6)' }}>
          <Button variant="outline" type="button" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" loading={saving} disabled={uploading}>
            {saving ? 'Saving...' : record ? 'Update Record' : 'Assign Mentee'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
