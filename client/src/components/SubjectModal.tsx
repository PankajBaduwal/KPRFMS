import React, { useState, useEffect } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { Input } from './Input';
import { Select } from './Select';
import { Alert } from './Alert';
import { subjectService } from '../services/subject.service';
import { useAcademicYears } from '../hooks/useAcademicYears';
import type { Subject, CreateSubjectInput } from '../types/subject';

interface SubjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  subject?: Subject | null;
  onSuccess: () => void;
  defaultDepartment?: string;
  defaultAcademicYear?: string;
}

export const SubjectModal: React.FC<SubjectModalProps> = ({
  isOpen,
  onClose,
  subject,
  onSuccess,
  defaultDepartment = 'Computer Science and Engineering',
  defaultAcademicYear,
}) => {
  const { currentYear, years, options: yearOptions } = useAcademicYears();
  const [subjectCode, setSubjectCode] = useState('');
  const [subjectName, setSubjectName] = useState('');
  const [department, setDepartment] = useState(defaultDepartment);
  const [program, setProgram] = useState('B.E. Computer Science and Engineering');
  const [semester, setSemester] = useState<number>(5);
  const [academicYear, setAcademicYear] = useState(defaultAcademicYear || '');
  const [credits, setCredits] = useState<number>(3);
  const [lectureHours, setLectureHours] = useState<number>(3);
  const [tutorialHours, setTutorialHours] = useState<number>(0);
  const [practicalHours, setPracticalHours] = useState<number>(0);
  const [section, setSection] = useState('A');
  const [batch, setBatch] = useState('');
  const [description, setDescription] = useState('');
  const [syllabusUrl, setSyllabusUrl] = useState('');
  const [status, setStatus] = useState<'ACTIVE' | 'ARCHIVED'>('ACTIVE');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (subject) {
      setSubjectCode(subject.subjectCode || '');
      setSubjectName(subject.subjectName || '');
      setDepartment(subject.department || defaultDepartment);
      setProgram(subject.program || 'B.E. Computer Science and Engineering');
      setSemester(subject.semester || 5);
      setAcademicYear(subject.academicYear || defaultAcademicYear || currentYear);
      setCredits(subject.credits ?? 3);
      setLectureHours(subject.lectureHours ?? 3);
      setTutorialHours(subject.tutorialHours ?? 0);
      setPracticalHours(subject.practicalHours ?? 0);
      setSection(subject.section || 'A');
      setBatch(subject.batch || '');
      setDescription(subject.description || '');
      setSyllabusUrl(subject.syllabusUrl || '');
      setStatus(subject.status || 'ACTIVE');
    } else {
      setSubjectCode('');
      setSubjectName('');
      setDepartment(defaultDepartment);
      setProgram('B.E. Computer Science and Engineering');
      setSemester(5);
      setAcademicYear(defaultAcademicYear || '');
      setCredits(3);
      setLectureHours(3);
      setTutorialHours(0);
      setPracticalHours(0);
      setSection('A');
      setBatch('');
      setDescription('');
      setSyllabusUrl('');
      setStatus('ACTIVE');
    }
    setError(null);
  }, [subject, isOpen, defaultDepartment, defaultAcademicYear]);

  // Default to the current academic year once it has loaded
  useEffect(() => {
    if (isOpen && currentYear) setAcademicYear((prev) => prev || currentYear);
  }, [isOpen, currentYear]);

  const totalContactHours = Number(lectureHours || 0) + Number(tutorialHours || 0) + Number(practicalHours || 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    if (!subjectCode.trim() || !subjectName.trim() || !department.trim() || !program.trim() || !batch.trim()) {
      setError('Please fill in all mandatory subject fields.');
      return;
    }

    setSaving(true);
    setError(null);

    const payload: CreateSubjectInput = {
      subjectCode: subjectCode.trim().toUpperCase(),
      subjectName: subjectName.trim(),
      department: department.trim(),
      program: program.trim(),
      semester: Number(semester),
      academicYear: academicYear.trim(),
      credits: Number(credits),
      lectureHours: Number(lectureHours),
      tutorialHours: Number(tutorialHours),
      practicalHours: Number(practicalHours),
      section: section.trim() || 'A',
      batch: batch.trim(),
      description: description.trim() || undefined,
      syllabusUrl: syllabusUrl.trim() || undefined,
      status,
    };

    try {
      if (subject) {
        await subjectService.updateSubject(subject._id, payload);
      } else {
        await subjectService.createSubject(payload);
      }
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message || 'Failed to save subject.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={saving ? () => {} : onClose}
      title={subject ? 'Edit Academic Subject Master' : 'Register New Academic Subject'}
      size="lg"
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        {error && <Alert variant="danger">{error}</Alert>}

        {/* Basic Identification */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-3)' }}>
          <Input
            label="Subject Code *"
            value={subjectCode}
            onChange={(e) => setSubjectCode(e.target.value.toUpperCase())}
            placeholder="e.g. CS8792"
            required
          />

          <Input
            label="Subject Name *"
            value={subjectName}
            onChange={(e) => setSubjectName(e.target.value)}
            placeholder="e.g. Cryptography and Network Security"
            required
          />
        </div>

        {/* Academic Program & Department */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-3)' }}>
          <Input
            label="Department *"
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            required
          />

          <Input
            label="Degree Program *"
            value={program}
            onChange={(e) => setProgram(e.target.value)}
            placeholder="e.g. B.E. Computer Science and Engineering"
            required
          />
        </div>

        {/* Semester, Academic Year, Batch & Section */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 'var(--space-3)' }}>
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

          <Input
            label="Batch *"
            value={batch}
            onChange={(e) => setBatch(e.target.value)}
            placeholder="e.g. 2022-2026"
            required
          />

          <Input
            label="Target Section *"
            value={section}
            onChange={(e) => setSection(e.target.value.toUpperCase())}
            placeholder="e.g. A"
            required
          />
        </div>

        {/* L-T-P-C Curriculum Structure Card */}
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
              Curricular Structure (L - T - P - C)
            </span>
            <span className="badge badge-primary" style={{ fontSize: '11px' }}>
              Total Contact: {totalContactHours} hrs/week
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-3)' }}>
            <Input
              label="Lecture (L)"
              type="number"
              min={0}
              max={20}
              value={String(lectureHours)}
              onChange={(e) => setLectureHours(Number(e.target.value))}
              required
            />
            <Input
              label="Tutorial (T)"
              type="number"
              min={0}
              max={20}
              value={String(tutorialHours)}
              onChange={(e) => setTutorialHours(Number(e.target.value))}
              required
            />
            <Input
              label="Practical (P)"
              type="number"
              min={0}
              max={20}
              value={String(practicalHours)}
              onChange={(e) => setPracticalHours(Number(e.target.value))}
              required
            />
            <Input
              label="Credits (C) *"
              type="number"
              min={0}
              max={20}
              value={String(credits)}
              onChange={(e) => setCredits(Number(e.target.value))}
              required
            />
          </div>
        </div>

        {/* Description & Syllabus */}
        <div>
          <label className="form-label" style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>
            Subject Scope & Key Modules
          </label>
          <textarea
            className="form-control"
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. Unit 1: Foundations of Cryptography; Unit 2: Block Ciphers & DES/AES; Unit 3: Key Distribution..."
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

        <Input
          label="Syllabus Document Link / Web Reference (Optional)"
          value={syllabusUrl}
          onChange={(e) => setSyllabusUrl(e.target.value)}
          placeholder="https://annauniv.edu/curriculum/cse/cs8792.pdf"
        />

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)', marginTop: 'var(--space-4)' }}>
          <Button variant="outline" type="button" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" loading={saving}>
            {saving ? 'Saving...' : subject ? 'Update Subject' : 'Register Subject'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
