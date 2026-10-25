import React, { useState, useEffect, useRef } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { Input } from './Input';
import { Select } from './Select';
import { Alert } from './Alert';
import { FileUploader } from './FileUploader';
import { projectService } from '../services/project.service';
import { useAcademicYears } from '../hooks/useAcademicYears';
import type {
  Project,
  ProjectStatus,
  FundingType,
  UtilizationStatus,
  ProjectDocument,
} from '../types/project';
import {
  FUNDING_TYPE_OPTIONS,
  UTILIZATION_STATUS_OPTIONS,
} from '../types/project';
import { fileUrl } from '../utils/fileUrl';

interface ProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  project?: Project | null;
  onSuccess: (savedProj: Project) => void;
}

const STATUS_OPTIONS = [
  { value: 'IDEA', label: 'Idea / Concept' },
  { value: 'DRAFT', label: 'Draft Proposal' },
  { value: 'SUBMITTED', label: 'Submitted to Agency' },
  { value: 'UNDER_REVIEW', label: 'Under Review' },
  { value: 'SANCTIONED', label: 'Sanctioned' },
  { value: 'ONGOING', label: 'Ongoing Execution' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'REJECTED', label: 'Rejected' },
];

export const ProjectModal: React.FC<ProjectModalProps> = ({
  isOpen,
  onClose,
  project,
  onSuccess,
}) => {
  const { currentYear, years, options: yearOptions } = useAcademicYears();
  const [formData, setFormData] = useState({
    title: '',
    fundingAgency: '',
    fundingType: 'Government' as FundingType,
    projectNumber: '',
    grantNumber: '',
    sanctionNumber: '',
    proposalNumber: '',
    requestedAmount: '',
    sanctionedAmount: '',
    receivedAmount: '',
    startDate: '',
    endDate: '',
    durationMonths: '36',
    academicYear: '',
    status: 'DRAFT' as ProjectStatus,
    utilizationStatus: 'Not Started' as UtilizationStatus,
    coInvestigatorsText: '',
    remarks: '',
  });

  const [documents, setDocuments] = useState<ProjectDocument[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [docTitle, setDocTitle] = useState('');
  const [docType, setDocType] = useState<ProjectDocument['documentType']>('SANCTION_ORDER');
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Which footer action is running, so only that button shows the spinner
  const [pendingAction, setPendingAction] = useState<'draft' | 'submit' | null>(null);
  // Synchronous lock so a double-click cannot send two requests
  const submittingRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isOpen) {
      if (project) {
        setFormData({
          title: project.title || '',
          fundingAgency: project.fundingAgency || '',
          fundingType: project.fundingType || 'Government',
          projectNumber: project.projectNumber || '',
          grantNumber: project.grantNumber || '',
          sanctionNumber: project.sanctionNumber || '',
          proposalNumber: project.proposalNumber || '',
          requestedAmount: project.requestedAmount !== undefined ? String(project.requestedAmount) : '',
          sanctionedAmount: project.sanctionedAmount !== undefined ? String(project.sanctionedAmount) : '',
          receivedAmount: project.receivedAmount !== undefined ? String(project.receivedAmount) : '',
          startDate: project.startDate ? new Date(project.startDate).toISOString().split('T')[0] : '',
          endDate: project.endDate ? new Date(project.endDate).toISOString().split('T')[0] : '',
          durationMonths: project.durationMonths !== undefined ? String(project.durationMonths) : '36',
          academicYear: project.academicYear || currentYear,
          status: project.status || 'DRAFT',
          utilizationStatus: (project.utilizationStatus as UtilizationStatus) || 'Not Started',
          coInvestigatorsText: (project.coInvestigators || []).map((c) => c.name).join(', '),
          remarks: project.remarks || '',
        });
        setDocuments(project.documents || []);
      } else {
        setFormData({
          title: '',
          fundingAgency: '',
          fundingType: 'Government',
          projectNumber: '',
          grantNumber: '',
          sanctionNumber: '',
          proposalNumber: '',
          requestedAmount: '',
          sanctionedAmount: '0',
          receivedAmount: '0',
          startDate: '',
          endDate: '',
          durationMonths: '36',
          academicYear: '',
          status: 'DRAFT',
          utilizationStatus: 'Not Started',
          coInvestigatorsText: '',
          remarks: '',
        });
        setDocuments([]);
      }
      setDocTitle('');
      setDocType('SANCTION_ORDER');
      setError(null);
      setFieldErrors({});
    }
  }, [isOpen, project]);

  // Default to the current academic year once it has loaded
  useEffect(() => {
    if (isOpen && currentYear) {
      setFormData((prev) => (prev.academicYear ? prev : { ...prev, academicYear: currentYear }));
    }
  }, [isOpen, currentYear]);

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (fieldErrors[field]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const handleFileUpload = async (files: File[]) => {
    const file = files[0];
    if (!file) return;

    if (file.size > 25 * 1024 * 1024) {
      setError('File size must not exceed 25MB.');
      return;
    }

    setUploadingDoc(true);
    setError(null);
    try {
      const res = await projectService.uploadDocument(file);
      const newDoc: ProjectDocument = {
        title: docTitle.trim() || file.name,
        documentType: docType,
        fileUrl: res.fileUrl,
        fileName: res.fileName || file.name,
        uploadedAt: new Date().toISOString(),
      };
      setDocuments((prev) => [...prev, newDoc]);
      setDocTitle('');
    } catch (err: any) {
      setError(err.message || 'Failed to upload project document.');
    } finally {
      setUploadingDoc(false);
    }
  };

  const handleRemoveDoc = (index: number) => {
    setDocuments((prev) => prev.filter((_, i) => i !== index));
  };

  const validate = (): boolean => {
    const errors: Record<string, string> = {};
    if (!formData.title.trim()) {
      errors.title = 'Project title is required.';
    }
    if (!formData.fundingAgency.trim()) {
      errors.fundingAgency = 'Funding agency name is required.';
    }
    if (!formData.requestedAmount || Number(formData.requestedAmount) < 0) {
      errors.requestedAmount = 'Valid requested amount is required (greater than or equal to 0).';
    }
    if (!formData.academicYear.trim()) {
      errors.academicYear = 'Academic year is required.';
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSave = async (targetStatus?: ProjectStatus) => {
    if (submittingRef.current || uploadingDoc) return;
    setError(null);
    if (!validate()) {
      setError('Please resolve all validation errors before proceeding.');
      return;
    }

    const coInvestigators = formData.coInvestigatorsText
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((name) => ({
        name,
        institution: 'KPR Institute of Engineering and Technology',
        role: 'Co-Investigator',
      }));

    const statusToSave = targetStatus || formData.status;

    const payload: Partial<Project> = {
      title: formData.title.trim(),
      fundingAgency: formData.fundingAgency.trim(),
      fundingType: formData.fundingType,
      projectNumber: formData.projectNumber.trim() || undefined,
      grantNumber: formData.grantNumber.trim() || undefined,
      sanctionNumber: formData.sanctionNumber.trim() || undefined,
      proposalNumber: formData.proposalNumber.trim() || undefined,
      requestedAmount: Number(formData.requestedAmount) || 0,
      sanctionedAmount: Number(formData.sanctionedAmount) || 0,
      receivedAmount: Number(formData.receivedAmount) || 0,
      startDate: formData.startDate || undefined,
      endDate: formData.endDate || undefined,
      durationMonths: formData.durationMonths ? Number(formData.durationMonths) : undefined,
      academicYear: formData.academicYear.trim(),
      status: statusToSave,
      utilizationStatus: formData.utilizationStatus,
      coInvestigators,
      documents,
      remarks: formData.remarks.trim() || undefined,
    };

    submittingRef.current = true;
    setIsSubmitting(true);
    setPendingAction(targetStatus === 'DRAFT' ? 'draft' : 'submit');
    try {
      let saved: Project;
      if (project?._id) {
        saved = await projectService.updateProject(project._id, payload);
      } else {
        saved = await projectService.createProject(payload);
      }
      onSuccess(saved);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save project record.');
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
      setPendingAction(null);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={isSubmitting || uploadingDoc ? () => {} : onClose}
      closeOnEscape={!isSubmitting && !uploadingDoc}
      closeOnBackdrop={!isSubmitting && !uploadingDoc}
      title={project ? 'Edit Research Project / Grant' : 'Add New Research Project / Proposal'}
      size="xl"
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
          <Button variant="ghost" onClick={onClose} disabled={isSubmitting || uploadingDoc}>
            Cancel
          </Button>
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <Button
              variant="outline"
              onClick={() => handleSave('DRAFT')}
              loading={pendingAction === 'draft'}
              disabled={uploadingDoc || isSubmitting}
            >
              Save as Draft
            </Button>
            <Button
              variant="primary"
              onClick={() => handleSave(project ? undefined : 'SUBMITTED')}
              loading={pendingAction === 'submit'}
              disabled={uploadingDoc || isSubmitting}
            >
              {project ? 'Save Project Changes' : 'Save & Submit'}
            </Button>
          </div>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
        {error && <Alert variant="danger">{error}</Alert>}

        {/* Section 1: Title & Agency */}
        <fieldset
          style={{
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            padding: 'var(--space-4)',
            margin: 0,
          }}
        >
          <legend
            style={{
              padding: '0 var(--space-2)',
              fontSize: 'var(--font-size-xs)',
              fontWeight: 700,
              color: 'var(--color-primary)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            1. Title & Agency Details
          </legend>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <Input
              label="Project Title"
              placeholder="e.g. AI-Driven Smart Grid Fault Detection and Autonomous Self-Healing"
              value={formData.title}
              onChange={(e) => handleChange('title', e.target.value)}
              required
              error={fieldErrors.title}
              hint="Official title of the research proposal as registered with the funding agency."
            />

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'var(--space-3)' }}>
              <Input
                label="Funding Agency"
                placeholder="e.g. DST-SERB, AICTE, DRDO, ISRO, TCS"
                value={formData.fundingAgency}
                onChange={(e) => handleChange('fundingAgency', e.target.value)}
                required
                error={fieldErrors.fundingAgency}
                hint="Government ministry, statutory council, or industry partner."
              />
              <Select
                label="Funding Category"
                options={FUNDING_TYPE_OPTIONS}
                value={formData.fundingType}
                onChange={(e) => handleChange('fundingType', e.target.value)}
                required
              />
              <Select
                label="Academic Year"
                options={
                  formData.academicYear && !years.includes(formData.academicYear)
                    ? [{ value: formData.academicYear, label: formData.academicYear }, ...yearOptions]
                    : yearOptions
                }
                value={formData.academicYear}
                onChange={(e) => handleChange('academicYear', e.target.value)}
                required
                error={fieldErrors.academicYear}
              />
            </div>
          </div>
        </fieldset>

        {/* Section 2: Grant Numbers & Financial Details */}
        <fieldset
          style={{
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            padding: 'var(--space-4)',
            margin: 0,
          }}
        >
          <legend
            style={{
              padding: '0 var(--space-2)',
              fontSize: 'var(--font-size-xs)',
              fontWeight: 700,
              color: 'var(--color-primary)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            2. Grant Numbers & Financial Details (INR ₹)
          </legend>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 'var(--space-3)' }}>
              <Input
                label="Requested Amount (₹)"
                type="number"
                placeholder="3500000"
                value={formData.requestedAmount}
                onChange={(e) => handleChange('requestedAmount', e.target.value)}
                required
                error={fieldErrors.requestedAmount}
                hint="Total budget requested in proposal"
              />
              <Input
                label="Sanctioned Amount (₹)"
                type="number"
                placeholder="3500000"
                value={formData.sanctionedAmount}
                onChange={(e) => handleChange('sanctionedAmount', e.target.value)}
                hint="Approved grant amount by agency"
              />
              <Input
                label="Received / Released (₹)"
                type="number"
                placeholder="1800000"
                value={formData.receivedAmount}
                onChange={(e) => handleChange('receivedAmount', e.target.value)}
                hint="First installment received in bank"
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 'var(--space-3)' }}>
              <Input
                label="Proposal Number"
                placeholder="e.g. DST/EE/2023/8921"
                value={formData.proposalNumber}
                onChange={(e) => handleChange('proposalNumber', e.target.value)}
                hint="Portal submission ID"
              />
              <Input
                label="Sanction Number"
                placeholder="e.g. SERB/CRG/2024/001429"
                value={formData.sanctionNumber}
                onChange={(e) => handleChange('sanctionNumber', e.target.value)}
                hint="Official order reference number"
              />
              <Input
                label="Project / File Number"
                placeholder="e.g. KPR/R&D/2023/EE-01"
                value={formData.projectNumber}
                onChange={(e) => handleChange('projectNumber', e.target.value)}
                hint="Internal institutional file code"
              />
              <Input
                label="Grant Number"
                placeholder="e.g. G-88910"
                value={formData.grantNumber}
                onChange={(e) => handleChange('grantNumber', e.target.value)}
              />
            </div>
          </div>
        </fieldset>

        {/* Section 3: Timeline & Status */}
        <fieldset
          style={{
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            padding: 'var(--space-4)',
            margin: 0,
          }}
        >
          <legend
            style={{
              padding: '0 var(--space-2)',
              fontSize: 'var(--font-size-xs)',
              fontWeight: 700,
              color: 'var(--color-primary)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            3. Project Lifecycle & Timeline
          </legend>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 'var(--space-3)' }}>
              <Select
                label="Project Status"
                options={STATUS_OPTIONS}
                value={formData.status}
                onChange={(e) => handleChange('status', e.target.value)}
                required
              />
              <Select
                label="Utilization Status"
                options={UTILIZATION_STATUS_OPTIONS}
                value={formData.utilizationStatus}
                onChange={(e) => handleChange('utilizationStatus', e.target.value)}
              />
              <Input
                label="Duration (Months)"
                type="number"
                placeholder="36"
                value={formData.durationMonths}
                onChange={(e) => handleChange('durationMonths', e.target.value)}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-3)' }}>
              <Input
                label="Sanctioned / Start Date"
                type="date"
                value={formData.startDate}
                onChange={(e) => handleChange('startDate', e.target.value)}
              />
              <Input
                label="Target Completion Date"
                type="date"
                value={formData.endDate}
                onChange={(e) => handleChange('endDate', e.target.value)}
              />
            </div>
          </div>
        </fieldset>

        {/* Section 4: Team & Remarks */}
        <fieldset
          style={{
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            padding: 'var(--space-4)',
            margin: 0,
          }}
        >
          <legend
            style={{
              padding: '0 var(--space-2)',
              fontSize: 'var(--font-size-xs)',
              fontWeight: 700,
              color: 'var(--color-primary)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            4. Team & Remarks
          </legend>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <Input
              label="Co-Investigators (comma-separated names)"
              placeholder="e.g. Dr. V. Seetha, Dr. S. Ramkumar"
              value={formData.coInvestigatorsText}
              onChange={(e) => handleChange('coInvestigatorsText', e.target.value)}
              hint="Faculty members collaborating as Co-PIs"
            />
            <Input
              label="Remarks / Notes"
              placeholder="Notes on milestones, equipment procurement, or agency feedback..."
              value={formData.remarks}
              onChange={(e) => handleChange('remarks', e.target.value)}
            />
          </div>
        </fieldset>

        {/* Section 5: Supporting Documents Upload */}
        <fieldset
          style={{
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            padding: 'var(--space-4)',
            margin: 0,
          }}
        >
          <legend
            style={{
              padding: '0 var(--space-2)',
              fontSize: 'var(--font-size-xs)',
              fontWeight: 700,
              color: 'var(--color-primary)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            5. Document Uploads (Sanction Orders, Proposals, UC)
          </legend>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 220px', gap: 'var(--space-3)' }}>
              <Input
                label="Document Title"
                placeholder="e.g. Sanction Order PDF"
                value={docTitle}
                onChange={(e) => setDocTitle(e.target.value)}
              />
              <Select
                label="Document Type"
                options={[
                  { value: 'SANCTION_ORDER', label: 'Sanction Order' },
                  { value: 'PROPOSAL', label: 'Submitted Proposal' },
                  { value: 'UTILIZATION_CERTIFICATE', label: 'Utilization Certificate (UC)' },
                  { value: 'PROGRESS_REPORT', label: 'Progress Report' },
                  { value: 'COMPLETION_REPORT', label: 'Completion Report' },
                  { value: 'OTHER', label: 'Other Document' },
                ]}
                value={docType}
                onChange={(e) => setDocType(e.target.value as any)}
              />
            </div>

            <FileUploader
              files={selectedFiles}
              onFilesChange={(files: File[]) => {
                setSelectedFiles(files);
                handleFileUpload(files);
              }}
              accept=".pdf,.png,.jpg,.jpeg"
              maxSizeBytes={25 * 1024 * 1024}
              disabled={isSubmitting}
              uploading={uploadingDoc}
              hint="Upload official sanction letter or grant order (PDF/Images up to 25MB)"
            />

            {documents.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
                {documents.map((doc, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: 'var(--space-2) var(--space-3)',
                      background: 'var(--color-surface)',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--color-border)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                      <i className="bi bi-file-earmark-pdf text-danger" style={{ fontSize: '1.25rem' }} />
                      <div>
                        <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>{doc.title}</div>
                        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                          {doc.documentType.replace('_', ' ')} &bull; {doc.fileName}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                      <a
                        href={fileUrl(doc.fileUrl)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-outline btn-xs"
                        style={{ textDecoration: 'none' }}
                      >
                        <i className="bi bi-box-arrow-up-right" /> View
                      </a>
                      <button
                        type="button"
                        className="btn btn-ghost btn-xs text-danger"
                        onClick={() => handleRemoveDoc(idx)}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </fieldset>
      </div>
    </Modal>
  );
};
