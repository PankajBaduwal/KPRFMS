import React, { useState, useEffect } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { Input } from './Input';
import { Select } from './Select';
import { Alert } from './Alert';
import { studentProjectService } from '../services/student-project.service';
import { useAcademicYears } from '../hooks/useAcademicYears';
import type {
  StudentProject,
  StudentProjectStatus,
  StudentProjectType,
} from '../types/student-project';
import {
  STUDENT_PROJECT_STATUS,
  STUDENT_PROJECT_TYPES,
  STUDENT_PROJECT_TYPE_LABELS,
} from '../types/student-project';

interface StudentProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  project?: StudentProject | null;
  onSuccess: () => void;
}

export const StudentProjectModal: React.FC<StudentProjectModalProps> = ({
  isOpen,
  onClose,
  project,
  onSuccess,
}) => {
  const { currentYear, years, options: yearOptions } = useAcademicYears();
  const [projectTitle, setProjectTitle] = useState('');
  const [projectType, setProjectType] = useState<StudentProjectType>(
    STUDENT_PROJECT_TYPES.CAPSTONE
  );
  const [department, setDepartment] = useState('Computer Science and Engineering');
  const [batch, setBatch] = useState('');
  const [section, setSection] = useState('A');
  const [academicYear, setAcademicYear] = useState('');
  const [teamMembersStr, setTeamMembersStr] = useState('');
  const [registerNumbersStr, setRegisterNumbersStr] = useState('');
  const [guide, setGuide] = useState('');
  const [coGuide, setCoGuide] = useState('');
  const [startDate, setStartDate] = useState('');
  const [submissionDate, setSubmissionDate] = useState('');
  const [status, setStatus] = useState<StudentProjectStatus>(
    STUDENT_PROJECT_STATUS.PROPOSED
  );
  const [publication, setPublication] = useState('');
  const [patent, setPatent] = useState('');
  const [industryCollaboration, setIndustryCollaboration] = useState('');
  const [documentUrl, setDocumentUrl] = useState('');
  const [remarks, setRemarks] = useState('');

  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (project) {
      setProjectTitle(project.projectTitle || '');
      setProjectType(project.projectType || STUDENT_PROJECT_TYPES.CAPSTONE);
      setDepartment(project.department || 'Computer Science and Engineering');
      setBatch(project.batch || '');
      setSection(project.section || 'A');
      setAcademicYear(project.academicYear || currentYear);
      setTeamMembersStr(project.teamMembers?.join(', ') || '');
      setRegisterNumbersStr(project.registerNumbers?.join(', ') || '');
      setGuide(project.guide || '');
      setCoGuide(project.coGuide || '');
      setStartDate(project.startDate ? project.startDate.split('T')[0] : '');
      setSubmissionDate(project.submissionDate ? project.submissionDate.split('T')[0] : '');
      setStatus(project.status || STUDENT_PROJECT_STATUS.PROPOSED);
      setPublication(project.publication || '');
      setPatent(project.patent || '');
      setIndustryCollaboration(project.industryCollaboration || '');
      setDocumentUrl(project.document || '');
      setRemarks(project.remarks || '');
    } else {
      setProjectTitle('');
      setProjectType(STUDENT_PROJECT_TYPES.CAPSTONE);
      setDepartment('Computer Science and Engineering');
      setBatch('');
      setSection('A');
      setAcademicYear('');
      setTeamMembersStr('');
      setRegisterNumbersStr('');
      setGuide('');
      setCoGuide('');
      setStartDate(new Date().toISOString().split('T')[0]);
      setSubmissionDate('');
      setStatus(STUDENT_PROJECT_STATUS.PROPOSED);
      setPublication('');
      setPatent('');
      setIndustryCollaboration('');
      setDocumentUrl('');
      setRemarks('');
    }
    setError(null);
  }, [project, isOpen]);

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
      const res = await studentProjectService.uploadDocument(file);
      setDocumentUrl(res.fileUrl);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to upload project document');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving || uploading) return;
    if (!projectTitle.trim() || !teamMembersStr.trim() || !registerNumbersStr.trim() || !startDate) {
      setError('Please provide project title, team members, register numbers, and start date.');
      return;
    }

    const teamMembers = teamMembersStr
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const registerNumbers = registerNumbersStr
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    if (teamMembers.length === 0 || registerNumbers.length === 0) {
      setError('At least one team member name and register number is required.');
      return;
    }

    setSaving(true);
    setError(null);

    const payload = {
      projectTitle: projectTitle.trim(),
      projectType,
      department: department.trim(),
      batch: batch.trim(),
      section: section.trim(),
      academicYear: academicYear.trim(),
      teamMembers,
      registerNumbers,
      guide: guide.trim() || 'Faculty Guide',
      coGuide: coGuide.trim() || undefined,
      startDate,
      submissionDate: submissionDate || undefined,
      status,
      publication: publication.trim() || undefined,
      patent: patent.trim() || undefined,
      industryCollaboration: industryCollaboration.trim() || undefined,
      document: documentUrl || undefined,
      remarks: remarks.trim() || undefined,
    };

    try {
      if (project) {
        await studentProjectService.updateProject(project._id, payload);
      } else {
        await studentProjectService.createProject(payload);
      }
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Error saving student project');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={saving ? () => {} : onClose}
      title={project ? 'Edit Student Project' : 'Register New Student Project'}
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

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <Input
            label="Project Title *"
            value={projectTitle}
            onChange={(e) => setProjectTitle(e.target.value)}
            placeholder="e.g. Decentralized Zero-Knowledge Identity Verification Architecture"
            required
          />

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-3)' }}>
            <Select
              label="Project Type *"
              value={projectType}
              onChange={(e) => setProjectType(e.target.value as StudentProjectType)}
              options={Object.entries(STUDENT_PROJECT_TYPE_LABELS).map(([val, label]) => ({
                value: val,
                label,
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
              label="Current Status *"
              value={status}
              onChange={(e) => setStatus(e.target.value as StudentProjectStatus)}
              options={[
                { value: STUDENT_PROJECT_STATUS.PROPOSED, label: 'Proposed' },
                { value: STUDENT_PROJECT_STATUS.APPROVED, label: 'Approved' },
                { value: STUDENT_PROJECT_STATUS.ONGOING, label: 'Ongoing' },
                { value: STUDENT_PROJECT_STATUS.SUBMITTED, label: 'Submitted' },
                { value: STUDENT_PROJECT_STATUS.UNDER_REVIEW, label: 'Under Review' },
                { value: STUDENT_PROJECT_STATUS.COMPLETED, label: 'Completed' },
              ]}
            />
          </div>

          {/* Team Members & Register Numbers */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 'var(--space-3)' }}>
            <div>
              <Input
                label="Team Members (Comma separated) *"
                value={teamMembersStr}
                onChange={(e) => setTeamMembersStr(e.target.value)}
                placeholder="e.g. Aditya S, Deepika R, Kavitha R"
                required
              />
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                Separate student names with commas
              </span>
            </div>

            <div>
              <Input
                label="Register Numbers (Comma separated) *"
                value={registerNumbersStr}
                onChange={(e) => setRegisterNumbersStr(e.target.value)}
                placeholder="e.g. 711321104003, 711321104028, 711321104045"
                required
              />
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                Matching roll/register numbers
              </span>
            </div>
          </div>

          {/* Guide & Co-Guide */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-3)' }}>
            <Input
              label="Faculty Guide *"
              value={guide}
              onChange={(e) => setGuide(e.target.value)}
              placeholder="e.g. Dr. A. Karthik"
              required
            />

            <Input
              label="Faculty Co-Guide (Optional)"
              value={coGuide}
              onChange={(e) => setCoGuide(e.target.value)}
              placeholder="e.g. Dr. V. Seetha / Industry Mentor"
            />

            <Input
              label="Start Date *"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
            />

            <Input
              label="Submission / Target Date"
              type="date"
              value={submissionDate}
              onChange={(e) => setSubmissionDate(e.target.value)}
            />
          </div>

          {/* Research & Industry Outcomes */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 'var(--space-3)' }}>
            <Input
              label="Publication Outcome (Paper title / Journal / Conference)"
              value={publication}
              onChange={(e) => setPublication(e.target.value)}
              placeholder="e.g. Published in IEEE ICRA 2024"
            />

            <Input
              label="Patent Application (Number / Title)"
              value={patent}
              onChange={(e) => setPatent(e.target.value)}
              placeholder="e.g. Provisional Patent IN202441019822 Filed"
            />

            <Input
              label="Industry Collaboration (Partner Organization)"
              value={industryCollaboration}
              onChange={(e) => setIndustryCollaboration(e.target.value)}
              placeholder="e.g. Roots Industries Ltd / TVS Motor Co"
            />
          </div>

          {/* Remarks & Document Upload */}
          <div>
            <label className="form-label" style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>
              Remarks / Evaluation Notes
            </label>
            <textarea
              className="form-control"
              rows={2}
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="e.g. Passed interim review 2 with Grade A+, hardware prototype validated..."
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
              Project Report / Synopsis Document (PDF / DOCX)
            </label>
            <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
              <input
                type="file"
                accept=".pdf,.docx,.doc,.zip,.ppt,.pptx"
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
              {documentUrl && (
                <a
                  href={documentUrl}
                  target="_blank"
                  rel="noreferrer"
                  style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-primary)', textDecoration: 'underline' }}
                >
                  View Attached Document
                </a>
              )}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-3)', marginTop: 'var(--space-5)' }}>
          <Button variant="outline" type="button" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" loading={saving} disabled={uploading}>
            {saving ? 'Saving...' : project ? 'Update Project' : 'Register Project'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
