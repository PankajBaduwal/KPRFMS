import React, { useState, useEffect, useRef } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { Input } from './Input';
import { Alert } from './Alert';
import { facultyService } from '../services/faculty.service';
import type { Qualification } from '../types/faculty';
import { fileUrl } from '../utils/fileUrl';

interface QualificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialData?: Qualification | null;
  onSave: (data: Partial<Qualification>) => Promise<void>;
}

export const QualificationModal: React.FC<QualificationModalProps> = ({
  isOpen,
  onClose,
  initialData,
  onSave,
}) => {
  const isEditing = Boolean(initialData && initialData._id);

  const [degree, setDegree] = useState('');
  const [specialization, setSpecialization] = useState('');
  const [institution, setInstitution] = useState('');
  const [university, setUniversity] = useState('');
  const [location, setLocation] = useState('');
  const [startYear, setStartYear] = useState<string>('');
  const [completionYear, setCompletionYear] = useState<string>(new Date().getFullYear().toString());
  const [percentage, setPercentage] = useState<string>('');
  const [cgpa, setCgpa] = useState<string>('');
  const [percentageOrCgpa, setPercentageOrCgpa] = useState('');
  const [classOrGrade, setClassOrGrade] = useState('');
  const [certificateUrl, setCertificateUrl] = useState('');
  const [certificateFileName, setCertificateFileName] = useState('');

  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  // Synchronous lock so a double-click / repeated Enter cannot send two requests
  const savingRef = useRef(false);

  useEffect(() => {
    if (initialData) {
      setDegree(initialData.degree || '');
      setSpecialization(initialData.specialization || '');
      setInstitution(initialData.institution || '');
      setUniversity(initialData.university || '');
      setLocation(initialData.location || '');
      setStartYear(initialData.startYear ? initialData.startYear.toString() : '');
      setCompletionYear(initialData.completionYear ? initialData.completionYear.toString() : new Date().getFullYear().toString());
      setPercentage(initialData.percentage !== undefined ? initialData.percentage.toString() : '');
      setCgpa(initialData.cgpa !== undefined ? initialData.cgpa.toString() : '');
      setPercentageOrCgpa(initialData.percentageOrCgpa || '');
      setClassOrGrade(initialData.classOrGrade || '');
      setCertificateUrl(initialData.certificateUrl || '');
      setCertificateFileName(initialData.certificateFileName || '');
    } else {
      setDegree('');
      setSpecialization('');
      setInstitution('');
      setUniversity('');
      setLocation('');
      setStartYear('');
      setCompletionYear(new Date().getFullYear().toString());
      setPercentage('');
      setCgpa('');
      setPercentageOrCgpa('');
      setClassOrGrade('');
      setCertificateUrl('');
      setCertificateFileName('');
    }
    setValidationError(null);
    setUploadError(null);
  }, [initialData, isOpen]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check size limit: 10MB
    if (file.size > 10 * 1024 * 1024) {
      setUploadError('File size exceeds 10MB limit.');
      return;
    }

    setIsUploading(true);
    setUploadError(null);

    try {
      const res = await facultyService.uploadDocument(file);
      setCertificateUrl(res.fileUrl);
      setCertificateFileName(res.fileName);
    } catch (err: any) {
      setUploadError(err.message || 'Failed to upload document.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (savingRef.current || isUploading) return;
    setValidationError(null);

    if (!degree.trim()) {
      setValidationError('Degree is required (e.g. Ph.D., M.E., B.Tech).');
      return;
    }
    if (!specialization.trim()) {
      setValidationError('Specialization is required.');
      return;
    }
    if (!institution.trim()) {
      setValidationError('Institution name is required.');
      return;
    }
    if (!university.trim()) {
      setValidationError('Affiliated University is required.');
      return;
    }
    if (!completionYear.trim()) {
      setValidationError('Completion Year is required.');
      return;
    }

    const sYear = startYear ? parseInt(startYear, 10) : undefined;
    const cYear = parseInt(completionYear, 10);

    if (sYear && isNaN(sYear)) {
      setValidationError('Invalid start year.');
      return;
    }
    if (isNaN(cYear)) {
      setValidationError('Invalid completion year.');
      return;
    }
    if (sYear && sYear > cYear) {
      setValidationError('Start year cannot be greater than completion year.');
      return;
    }

    const payload: Partial<Qualification> = {
      degree: degree.trim(),
      specialization: specialization.trim(),
      institution: institution.trim(),
      university: university.trim(),
      location: location.trim() || undefined,
      startYear: sYear,
      completionYear: cYear,
      percentage: percentage ? parseFloat(percentage) : undefined,
      cgpa: cgpa ? parseFloat(cgpa) : undefined,
      percentageOrCgpa: percentageOrCgpa.trim() || (cgpa ? `${cgpa} CGPA` : percentage ? `${percentage}%` : undefined),
      classOrGrade: classOrGrade.trim() || undefined,
      certificateUrl: certificateUrl || undefined,
      certificateFileName: certificateFileName || undefined,
    };

    savingRef.current = true;
    setIsSaving(true);
    try {
      await onSave(payload);
      onClose();
    } catch (err: any) {
      setValidationError(err.message || 'Failed to save qualification record.');
    } finally {
      savingRef.current = false;
      setIsSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={isSaving || isUploading ? () => {} : onClose}
      closeOnEscape={!isSaving && !isUploading}
      closeOnBackdrop={!isSaving && !isUploading}
      title={isEditing ? 'Edit Academic Qualification' : 'Add Academic Qualification'}
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={isSaving || isUploading}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit} loading={isSaving} disabled={isUploading}>
            {isEditing ? 'Save Changes' : 'Add Qualification'}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit}>
        {validationError && (
          <div style={{ marginBottom: 'var(--space-4)' }}>
            <Alert variant="danger" onDismiss={() => setValidationError(null)}>
              {validationError}
            </Alert>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
          <Input
            label="Degree Title *"
            value={degree}
            onChange={(e) => setDegree(e.target.value)}
            placeholder="e.g. Ph.D., M.E., M.Tech, B.E."
            required
          />
          <Input
            label="Specialization / Branch *"
            value={specialization}
            onChange={(e) => setSpecialization(e.target.value)}
            placeholder="e.g. Computer Science, AI, VLSI"
            required
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
          <Input
            label="Institution / College *"
            value={institution}
            onChange={(e) => setInstitution(e.target.value)}
            placeholder="e.g. College of Engineering, Guindy"
            required
          />
          <Input
            label="Affiliated University *"
            value={university}
            onChange={(e) => setUniversity(e.target.value)}
            placeholder="e.g. Anna University, Chennai"
            required
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--space-3)' }}>
          <Input
            label="Location"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="e.g. Chennai, Tamil Nadu"
          />
          <Input
            label="Start Year"
            type="number"
            min="1960"
            max="2050"
            value={startYear}
            onChange={(e) => setStartYear(e.target.value)}
            placeholder="e.g. 2017"
          />
          <Input
            label="Completion Year *"
            type="number"
            min="1960"
            max="2050"
            value={completionYear}
            onChange={(e) => setCompletionYear(e.target.value)}
            placeholder="e.g. 2021"
            required
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--space-3)' }}>
          <Input
            label="CGPA (out of 10)"
            type="number"
            step="0.01"
            min="0"
            max="10"
            value={cgpa}
            onChange={(e) => setCgpa(e.target.value)}
            placeholder="e.g. 9.25"
          />
          <Input
            label="Percentage (%)"
            type="number"
            step="0.1"
            min="0"
            max="100"
            value={percentage}
            onChange={(e) => setPercentage(e.target.value)}
            placeholder="e.g. 88.5"
          />
          <Input
            label="Class / Distinction"
            value={classOrGrade}
            onChange={(e) => setClassOrGrade(e.target.value)}
            placeholder="e.g. First Class with Distinction"
          />
        </div>

        {/* Certificate Upload */}
        <div style={{ marginTop: 'var(--space-3)', padding: 'var(--space-3)', backgroundColor: 'var(--color-bg-secondary)', borderRadius: 'var(--radius-md)' }}>
          <label className="form-label-custom" style={{ display: 'block', marginBottom: 'var(--space-2)' }}>
            Supporting Degree / Provisional Certificate (PDF or Image, max 10MB)
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <input
              type="file"
              accept=".pdf,image/png,image/jpeg"
              onChange={handleFileUpload}
              disabled={isUploading || isSaving}
              style={{ fontSize: 'var(--font-size-sm)' }}
            />
            {isUploading && (
              <span style={{ fontSize: '0.8125rem', color: 'var(--color-primary)' }}>
                <i className="bi bi-arrow-repeat spin me-1" /> Uploading document...
              </span>
            )}
          </div>

          {uploadError && (
            <div style={{ marginTop: 'var(--space-2)' }}>
              <Alert variant="danger" onDismiss={() => setUploadError(null)}>
                {uploadError}
              </Alert>
            </div>
          )}

          {certificateUrl && (
            <div style={{ marginTop: 'var(--space-2)', fontSize: '0.8125rem', color: 'var(--color-success)' }}>
              <i className="bi bi-file-earmark-check-fill me-1" />
              Attached document:{' '}
              <a
                href={fileUrl(certificateUrl)}
                target="_blank"
                rel="noreferrer"
                style={{ fontWeight: 600, color: 'var(--color-primary)', textDecoration: 'underline' }}
              >
                {certificateFileName || 'View Uploaded Certificate'}
              </a>
            </div>
          )}
        </div>
      </form>
    </Modal>
  );
};
