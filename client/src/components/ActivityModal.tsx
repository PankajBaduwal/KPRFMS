import React, { useState, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Modal } from './Modal';
import { Button } from './Button';
import { Input } from './Input';
import { Select } from './Select';
import { Alert } from './Alert';
import { activityService } from '../services/activity.service';
import { useAcademicYears } from '../hooks/useAcademicYears';
import { useAsyncAction } from '../hooks/useAsyncAction';
import type {
  AcademicActivity,
  ActivityInput,
  ActivityType,
  ActivityMode,
} from '../types/activity';
import {
  ACTIVITY_TYPES,
  ACTIVITY_TYPE_LABELS,
  ACTIVITY_MODES,
} from '../types/activity';
import { aiService, type CertificateFields } from '../services/ai.service';
import { useAiEnabled } from '../hooks/useAiEnabled';

interface ActivityModalProps {
  isOpen: boolean;
  onClose: () => void;
  activity?: AcademicActivity | null;
  defaultType?: ActivityType;
  onSuccess: () => void;
}


// Programme-style activities: dates, duration, hours and mode
const isFdpLike = (t: ActivityType) => t === ACTIVITY_TYPES.FDP || t === ACTIVITY_TYPES.STTP;
const isProgramme = (t: ActivityType) => isFdpLike(t) || t === ACTIVITY_TYPES.WEBINAR || t === ACTIVITY_TYPES.TRAINING || t === ACTIVITY_TYPES.TECHNICAL_EVENT;

export const ActivityModal: React.FC<ActivityModalProps> = ({
  isOpen,
  onClose,
  activity,
  defaultType = ACTIVITY_TYPES.CONFERENCE,
  onSuccess,
}) => {
  const isEditing = Boolean(activity);
  const { currentYear } = useAcademicYears();

  const [activityType, setActivityType] = useState<ActivityType>(defaultType);
  const [title, setTitle] = useState('');
  const [organizer, setOrganizer] = useState('');
  const [academicYear, setAcademicYear] = useState('');

  // Dates & Duration
  const [date, setDate] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [duration, setDuration] = useState('');
  const [hours, setHours] = useState('');

  // Location & Country
  const [location, setLocation] = useState('');
  const [country, setCountry] = useState('India');

  // Participation & Role
  const [participationType, setParticipationType] = useState('Attended');
  const [role, setRole] = useState('Participant');

  // Conference specific
  const [paperPresented, setPaperPresented] = useState(false);
  const [presentationTitle, setPresentationTitle] = useState('');
  const [associatedPublication, setAssociatedPublication] = useState('');

  // Seminar specific
  const [topic, setTopic] = useState('');

  // FDP / STTP specific
  const [mode, setMode] = useState<ActivityMode>(ACTIVITY_MODES.OFFLINE);

  // Certificate / Document
  const [certificateUrl, setCertificateUrl] = useState('');
  const [certificateFileName, setCertificateFileName] = useState('');
  const [remarks, setRemarks] = useState('');

  const [formError, setFormError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const aiEnabled = useAiEnabled();
  const [aiReading, setAiReading] = useState(false);
  const [aiResult, setAiResult] = useState<{ filled: string[]; warnings: string[]; notes?: string | null } | null>(null);

  useEffect(() => {
    if (activity) {
      setActivityType(activity.activityType);
      setTitle(activity.title);
      setOrganizer(activity.organizer);
      setAcademicYear(activity.academicYear);

      setDate(activity.date ? activity.date.substring(0, 10) : '');
      setStartDate(activity.startDate ? activity.startDate.substring(0, 10) : '');
      setEndDate(activity.endDate ? activity.endDate.substring(0, 10) : '');
      setDuration(activity.duration || '');
      setHours(activity.hours != null ? String(activity.hours) : '');

      setLocation(activity.location || '');
      setCountry(activity.country || 'India');

      setParticipationType(activity.participationType || 'Attended');
      setRole(activity.role || 'Participant');

      setPaperPresented(Boolean(activity.paperPresented));
      setPresentationTitle(activity.presentationTitle || '');
      setAssociatedPublication(activity.associatedPublication || '');

      setTopic(activity.topic || '');
      setMode(activity.mode || ACTIVITY_MODES.OFFLINE);

      setCertificateUrl(activity.certificateUrl || '');
      setCertificateFileName(activity.certificateFileName || '');
      setRemarks(activity.remarks || '');
    } else {
      setActivityType(defaultType);
      setTitle('');
      setOrganizer('');
      setAcademicYear('');

      setDate('');
      setStartDate('');
      setEndDate('');
      setDuration('');

      setLocation('');
      setCountry('India');

      setParticipationType('Attended');
      setRole('Participant');

      setPaperPresented(false);
      setPresentationTitle('');
      setAssociatedPublication('');

      setTopic('');
      setMode(ACTIVITY_MODES.OFFLINE);

      setCertificateUrl('');
      setCertificateFileName('');
      setRemarks('');
    }
    setFormError(null);
    setAiResult(null);
  }, [activity, defaultType, isOpen]);

  // Default a new record to the current academic year once it has loaded
  useEffect(() => {
    if (!activity && isOpen && currentYear) setAcademicYear((prev) => prev || currentYear);
  }, [activity, isOpen, currentYear]);

  /** Fills empty (or, for a new record, all) form fields from what the AI read on the certificate. */
  const applyCertificate = (f: CertificateFields) => {
    const filled: string[] = [];
    const set = (label: string, value: string | null | undefined, setter: (v: string) => void, current: string) => {
      if (!value) return;
      if (activity && current.trim()) return; // never overwrite what the teacher already typed on an existing record
      setter(value);
      filled.push(label);
    };
    if (f.activityType && !activity && Object.values(ACTIVITY_TYPES).includes(f.activityType as ActivityType)) {
      setActivityType(f.activityType as ActivityType);
      filled.push('Type');
    }
    set('Title', f.title, setTitle, title);
    set('Organizer', f.organizer, setOrganizer, organizer);
    set('Start date', f.startDate, setStartDate, startDate);
    set('End date', f.endDate ?? f.startDate, setEndDate, endDate);
    set('Date', f.startDate, setDate, date);
    set('Duration', f.duration, setDuration, duration);
    set('Location', f.location, setLocation, location);
    set('Country', f.country, setCountry, activity ? country : '');
    set('Participation', f.participationType, setParticipationType, activity ? participationType : '');
    set('Topic', f.topic, setTopic, topic);
    if (f.presentationTitle) {
      setPaperPresented(true);
      set('Presentation title', f.presentationTitle, setPresentationTitle, presentationTitle);
    }
    if (f.mode && Object.values(ACTIVITY_MODES).includes(f.mode as ActivityMode)) {
      setMode(f.mode as ActivityMode);
      filled.push('Mode');
    }
    return filled;
  };

  const readCertificateWithAi = async (file: File) => {
    setAiReading(true);
    setAiResult(null);
    try {
      const { fields, warnings } = await aiService.readCertificate(file);
      const filled = applyCertificate(fields);
      setAiResult({ filled, warnings, notes: fields.notes });
    } catch (err: any) {
      setAiResult({ filled: [], warnings: [err?.message || 'The AI could not read this certificate. Fill the form manually.'] });
    } finally {
      setAiReading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, withAi = false) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (withAi) void readCertificateWithAi(file);

    if (file.size > 10 * 1024 * 1024) {
      setFormError('Certificate file must be under 10MB.');
      return;
    }

    try {
      setUploading(true);
      setFormError(null);
      const res = await activityService.uploadCertificate(file);
      setCertificateUrl(res.fileUrl);
      setCertificateFileName(res.fileName);
    } catch (err: any) {
      setFormError(err.response?.data?.message || 'Failed to upload certificate file.');
    } finally {
      setUploading(false);
    }
  };

  const mutation = useMutation({
    mutationFn: async () => {
      if (!title.trim()) throw new Error('Title / Program Name is required.');
      if (!organizer.trim()) throw new Error('Organizer name is required.');
      if (!academicYear.trim()) throw new Error('Academic Year is required.');

      const payload: ActivityInput = {
        activityType,
        title: title.trim(),
        organizer: organizer.trim(),
        academicYear: academicYear.trim(),
        remarks: remarks.trim() || null,
        certificateUrl: certificateUrl || null,
        certificateFileName: certificateFileName || null,
      };

      if (activityType === ACTIVITY_TYPES.CONFERENCE) {
        payload.date = date || null;
        payload.location = location.trim() || null;
        payload.country = country.trim() || 'India';
        payload.participationType = participationType || 'Attended';
        payload.paperPresented = paperPresented;
        payload.presentationTitle = presentationTitle.trim() || null;
        payload.associatedPublication = associatedPublication.trim() || null;
        payload.duration = duration.trim() || null;
      } else if (activityType === ACTIVITY_TYPES.WORKSHOP) {
        payload.date = date || null;
        payload.duration = duration.trim() || null;
        payload.location = location.trim() || null;
        payload.participationType = participationType || 'Attended';
      } else if (activityType === ACTIVITY_TYPES.SEMINAR) {
        payload.date = date || null;
        payload.role = role || 'Participant';
        payload.topic = topic.trim() || null;
        payload.location = location.trim() || null;
      } else if (isProgramme(activityType)) {
        payload.duration = duration.trim() || null;
        payload.hours = hours ? Number(hours) : null;
        if (!isFdpLike(activityType)) payload.role = role || 'Participant';
        payload.startDate = startDate || null;
        payload.endDate = endDate || null;
        payload.mode = mode;
        payload.location = location.trim() || null;
      }

      if (isEditing && activity) {
        return activityService.updateActivity(activity._id, payload);
      } else {
        return activityService.createActivity(payload);
      }
    },
    onSuccess: () => {
      onSuccess();
      onClose();
    },
    onError: (err: any) => {
      setFormError(err.response?.data?.message || err.message || 'Operation failed.');
    },
  });

  // Ref-locked wrapper so a double-click cannot fire the mutation twice
  const save = useAsyncAction(async () => {
    try {
      await mutation.mutateAsync();
    } catch {
      // Error already surfaced through onError
    }
  });
  const saving = save.isPending || mutation.isPending;

  return (
    <Modal
      isOpen={isOpen}
      onClose={saving || uploading ? () => {} : onClose}
      closeOnEscape={!saving && !uploading}
      closeOnBackdrop={!saving && !uploading}
      title={
        isEditing
          ? `Edit Academic Activity (${ACTIVITY_TYPE_LABELS[activityType]})`
          : `Add New Academic Activity`
      }
      size="lg"
      footer={
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)' }}>
          <Button variant="outline" onClick={onClose} disabled={saving || uploading}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              if (uploading) return;
              void save.run();
            }}
            loading={saving}
            disabled={uploading}
          >
            {isEditing ? 'Save Changes' : 'Record Activity'}
          </Button>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        {aiEnabled && (
          <div className="ai-box">
            <div className="ai-box-head">
              <span className="ai-box-title">
                <i className="bi bi-stars" aria-hidden="true" /> Fill this form from your certificate
              </span>
              <label className="btn-secondary-custom btn-sm" style={{ cursor: aiReading || uploading || saving ? 'wait' : 'pointer', margin: 0 }}>
                <input
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg"
                  hidden
                  disabled={aiReading || uploading || saving}
                  onChange={(e) => {
                    void handleFileUpload(e, true);
                    e.target.value = '';
                  }}
                />
                {aiReading ? (
                  <>
                    <span className="spinner spinner-sm" aria-hidden="true" /> Reading certificate…
                  </>
                ) : (
                  <>
                    <i className="bi bi-upload" aria-hidden="true" /> Upload certificate
                  </>
                )}
              </label>
            </div>
            <span className="ai-box-note">
              The certificate is attached and AI fills in the title, organizer, dates and duration. Check every field before saving.
            </span>
            {aiResult && aiResult.filled.length > 0 && (
              <span style={{ color: 'var(--color-success)' }}>
                <i className="bi bi-check-circle-fill me-1" aria-hidden="true" />
                Filled: {aiResult.filled.join(', ')}
              </span>
            )}
            {aiResult?.warnings.map((w) => (
              <div key={w} className="ai-warning">
                <i className="bi bi-exclamation-triangle me-1" aria-hidden="true" />
                {w}
              </div>
            ))}
            {aiResult?.notes && <span className="ai-box-note">AI note: {aiResult.notes}</span>}
          </div>
        )}

        {formError && <Alert variant="danger">{formError}</Alert>}

        {/* Activity Type Selection */}
        <div className="grid grid-2" style={{ gap: 'var(--space-3)' }}>
          <Select
            label="Activity Classification"
            value={activityType}
            onChange={(e) => setActivityType(e.target.value as ActivityType)}
            disabled={isEditing}
            options={[
              { value: ACTIVITY_TYPES.CONFERENCE, label: 'Conference' },
              { value: ACTIVITY_TYPES.WORKSHOP, label: 'Workshop' },
              { value: ACTIVITY_TYPES.SEMINAR, label: 'Seminar' },
              { value: ACTIVITY_TYPES.FDP, label: 'Faculty Development Program (FDP)' },
              { value: ACTIVITY_TYPES.STTP, label: 'Short Term Training Program (STTP)' },
              { value: ACTIVITY_TYPES.WEBINAR, label: 'Webinar' },
              { value: ACTIVITY_TYPES.TRAINING, label: 'Training Programme' },
              { value: ACTIVITY_TYPES.TECHNICAL_EVENT, label: 'Technical Event (hackathon, symposium, expo)' },
            ]}
          />

          <Input
            label="Academic Year"
            value={academicYear}
            onChange={(e) => setAcademicYear(e.target.value)}
            placeholder="e.g. 2024-2025"
            required
          />
        </div>

        {/* Title & Organizer */}
        <Input
          label={
            isProgramme(activityType)
              ? 'Program Name / Course Title *'
              : 'Activity Title / Conference Name *'
          }
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={
            activityType === ACTIVITY_TYPES.CONFERENCE
              ? 'e.g. IEEE International Conference on Smart Grid Resiliency'
              : activityType === ACTIVITY_TYPES.WORKSHOP
              ? 'e.g. Hands-on Generative AI and LLM Workshop'
              : activityType === ACTIVITY_TYPES.SEMINAR
              ? 'e.g. National Seminar on Clean Energy Grid Integration'
              : 'e.g. AICTE-ATAL FDP on Quantum Computing & Cyber Security'
          }
          required
        />

        <Input
          label="Organizing Body / Institution *"
          value={organizer}
          onChange={(e) => setOrganizer(e.target.value)}
          placeholder="e.g. IIT Madras, IEEE PES, NIT Trichy, Anna University"
          required
        />

        {/* CONDITIONAL: Conference Fields */}
        {activityType === ACTIVITY_TYPES.CONFERENCE && (
          <>
            <div className="grid grid-3" style={{ gap: 'var(--space-3)' }}>
              <Input
                label="Conference Date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
              <Input
                label="Venue / City"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Bangalore"
              />
              <Input
                label="Country"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                placeholder="e.g. India"
              />
            </div>

            <div className="grid grid-2" style={{ gap: 'var(--space-3)' }}>
              <Select
                label="Participation Type"
                value={participationType}
                onChange={(e) => setParticipationType(e.target.value)}
                options={[
                  { value: 'Presented Paper', label: 'Presented Paper' },
                  { value: 'Attended', label: 'Attended (Participant)' },
                  { value: 'Session Chair', label: 'Session Chair' },
                  { value: 'Keynote Speaker', label: 'Keynote Speaker' },
                  { value: 'Organizer / Committee Member', label: 'Organizer / Committee Member' },
                  { value: 'Reviewer', label: 'Reviewer' },
                ]}
              />
              <Input
                label="Duration (optional)"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                placeholder="e.g. 3 Days"
              />
            </div>

            <div
              style={{
                background: 'var(--color-bg-secondary)',
                padding: 'var(--space-3)',
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--space-2)',
              }}
            >
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={paperPresented}
                  onChange={(e) => setPaperPresented(e.target.checked)}
                  style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                />
                <span style={{ fontWeight: 600, fontSize: 'var(--font-sm)' }}>
                  A research paper was presented at this conference
                </span>
              </label>

              {paperPresented && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', marginTop: '4px' }}>
                  <Input
                    label="Presentation / Paper Title"
                    value={presentationTitle}
                    onChange={(e) => setPresentationTitle(e.target.value)}
                    placeholder="e.g. Deep Reinforcement Learning in Microgrid Frequency Stabilization"
                  />
                  <Input
                    label="Associated Publication / DOI / Proceedings Link"
                    value={associatedPublication}
                    onChange={(e) => setAssociatedPublication(e.target.value)}
                    placeholder="e.g. 10.1109/ICSGR54210.2024.104821 or IEEE Xplore link"
                  />
                </div>
              )}
            </div>
          </>
        )}

        {/* CONDITIONAL: Workshop Fields */}
        {activityType === ACTIVITY_TYPES.WORKSHOP && (
          <>
            <div className="grid grid-3" style={{ gap: 'var(--space-3)' }}>
              <Input
                label="Date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
              <Input
                label="Duration"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                placeholder="e.g. 2 Days (16 Hours)"
              />
              <Input
                label="Location / Venue"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. IIT Madras Research Park"
              />
            </div>
            <Select
              label="Participation Type"
              value={participationType}
              onChange={(e) => setParticipationType(e.target.value)}
              options={[
                { value: 'Attended', label: 'Attended (Participant)' },
                { value: 'Resource Person', label: 'Resource Person / Instructor' },
                { value: 'Coordinator', label: 'Coordinator / Convener' },
                { value: 'Organizer', label: 'Organizer' },
              ]}
            />
          </>
        )}

        {/* CONDITIONAL: Seminar Fields */}
        {activityType === ACTIVITY_TYPES.SEMINAR && (
          <>
            <div className="grid grid-3" style={{ gap: 'var(--space-3)' }}>
              <Input
                label="Date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
              <Select
                label="Role"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                options={[
                  { value: 'Participant', label: 'Participant / Attendee' },
                  { value: 'Resource Person', label: 'Resource Person / Invited Speaker' },
                  { value: 'Keynote Speaker', label: 'Keynote Speaker' },
                  { value: 'Session Chair', label: 'Session Chair' },
                  { value: 'Organizer', label: 'Organizer / Convener' },
                ]}
              />
              <Input
                label="Venue / Location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. New Delhi"
              />
            </div>
            <Input
              label="Topic Delivered / Deliberated"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. Grid Integration of Solar Photovoltaics: Challenges and Protection Mechanisms"
            />
          </>
        )}

        {/* CONDITIONAL: FDP, STTP, webinar, training and technical event fields */}
        {isProgramme(activityType) && (
          <>
            {!isFdpLike(activityType) && (
              <div className="grid grid-2" style={{ gap: 'var(--space-3)' }}>
                <Select
                  label="Your role"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  options={[
                    { value: 'Participant', label: 'Participant / Attendee' },
                    { value: 'Resource Person', label: 'Resource Person / Speaker' },
                    { value: 'Coordinator', label: 'Coordinator / Convener' },
                    { value: 'Organizer', label: 'Organizer' },
                    { value: 'Judge', label: 'Judge / Evaluator' },
                  ]}
                />
                <Input label="Contact hours" type="number" value={hours} onChange={(e) => setHours(e.target.value)} placeholder="e.g. 6" />
              </div>
            )}
            {isFdpLike(activityType) && (
              <Input label="Contact hours" type="number" value={hours} onChange={(e) => setHours(e.target.value)} placeholder="e.g. 40" />
            )}
            <div className="grid grid-4" style={{ gap: 'var(--space-3)' }}>
              <Input
                label="Start Date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
              <Input
                label="End Date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
              <Input
                label="Duration"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                placeholder="e.g. 1 Week (40 Hours)"
              />
              <Select
                label="Delivery Mode"
                value={mode}
                onChange={(e) => setMode(e.target.value as ActivityMode)}
                options={[
                  { value: ACTIVITY_MODES.OFFLINE, label: 'Offline (In-Person)' },
                  { value: ACTIVITY_MODES.ONLINE, label: 'Online' },
                  { value: ACTIVITY_MODES.HYBRID, label: 'Hybrid' },
                ]}
              />
            </div>
            <Input
              label="Host Location / Venue"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. NIT Tiruchirappalli, Tamil Nadu"
            />
          </>
        )}

        {/* Certificate Upload */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={{ fontSize: 'var(--font-sm)', fontWeight: 500, color: 'var(--color-text-secondary)' }}>
            Certificate Document (PDF / Image)
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <input
              type="file"
              accept=".pdf,.png,.jpg,.jpeg"
              onChange={handleFileUpload}
              disabled={uploading || saving}
              style={{ fontSize: 'var(--font-sm)' }}
            />
            {uploading && <span style={{ fontSize: 'var(--font-xs)', color: 'var(--color-primary)' }}>Uploading...</span>}
          </div>
          {certificateFileName && (
            <div style={{ fontSize: 'var(--font-xs)', color: 'var(--color-success)', marginTop: '2px' }}>
              <i className="bi bi-check-circle-fill me-1" aria-hidden="true" />Attached: {certificateFileName}
            </div>
          )}
        </div>

        {/* Remarks / Outcomes */}
        <Input
          label="Remarks / Outcomes / Key Learnings (Optional)"
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
          placeholder="e.g. Scored Grade A in ATAL assessment; Presented paper in Session 3..."
        />
      </div>
    </Modal>
  );
};
