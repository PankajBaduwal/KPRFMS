// Extracted from AdminPage.tsx — the "settings" tab.
import { MASTER_CATEGORIES } from '../../types/admin';
import React from 'react';
import { type TabType } from './shared';
import type { IAdminInstitutionSettings } from '../../types/admin';
import { BrandingSettings } from './BrandingSettings';

export interface SettingsTabProps {
  handleSaveSettings: (e: React.FormEvent<Element>) => Promise<void>;
  setActiveTab: React.Dispatch<React.SetStateAction<TabType>>;
  setMasterCategory: React.Dispatch<React.SetStateAction<string>>;
  setSettingsForm: React.Dispatch<React.SetStateAction<Partial<IAdminInstitutionSettings>>>;
  setSettingsSubTab: React.Dispatch<React.SetStateAction<"appraisal" | "all" | "general" | "security">>;
  settingsForm: Partial<IAdminInstitutionSettings>;
  settingsSaving: boolean;
  settingsSubTab: "appraisal" | "all" | "general" | "security";
}

const DEFAULT_WEIGHTS = { publications: 3, projects: 4, patents: 5, activities: 1 };
const LEADERBOARD_WEIGHT_FIELDS = [
  ['publications', 'Per verified publication'],
  ['projects', 'Per funded project'],
  ['patents', 'Per verified patent'],
  ['activities', 'Per verified FDP / activity'],
] as const;

export const SettingsTab: React.FC<SettingsTabProps> = ({ handleSaveSettings, setActiveTab, setMasterCategory, setSettingsForm, setSettingsSubTab, settingsForm, settingsSaving, settingsSubTab }) => {
  const weights = { ...DEFAULT_WEIGHTS, ...settingsForm.leaderboardWeights };
  const appraisal = { incrementBenchmark: 75, casThreshold: 150, includeFeedback: true, ...settingsForm.appraisal };
  const setAppraisal = (patch: Partial<typeof appraisal>) => setSettingsForm({ ...settingsForm, appraisal: { ...appraisal, ...patch } });
  const dateValue = (d?: string | null) => (d ? String(d).slice(0, 10) : '');
  return (
    <form onSubmit={handleSaveSettings} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Sub Navigation */}
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => setSettingsSubTab('all')}
                className={`btn btn-sm ${settingsSubTab === 'all' ? 'btn-primary' : 'btn-outline-secondary'}`}
              >
                <i className="bi bi-grid-fill me-1" /> All Settings
              </button>
              <button
                type="button"
                onClick={() => setSettingsSubTab('general')}
                className={`btn btn-sm ${settingsSubTab === 'general' ? 'btn-primary' : 'btn-outline-secondary'}`}
              >
                <i className="bi bi-building me-1" /> Institution Profile & Campus
              </button>
              <button
                type="button"
                onClick={() => setSettingsSubTab('appraisal')}
                className={`btn btn-sm ${settingsSubTab === 'appraisal' ? 'btn-primary' : 'btn-outline-secondary'}`}
              >
                <i className="bi bi-graph-up-arrow me-1" /> Appraisal Configuration (PBAS)
              </button>
              <button
                type="button"
                onClick={() => setSettingsSubTab('security')}
                className={`btn btn-sm ${settingsSubTab === 'security' ? 'btn-primary' : 'btn-outline-secondary'}`}
              >
                <i className="bi bi-shield-check me-1" /> Security & Platform Policies
              </button>
            </div>
  
            {/* Group 1: General Institutional Identity */}
            {(settingsSubTab === 'general' || settingsSubTab === 'all') && (
              <div
                style={{
                  backgroundColor: '#fff',
                  padding: '1.5rem',
                  borderRadius: '10px',
                  border: '1px solid #e2e8f0',
                }}
              >
                <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '1.25rem', color: '#0f172a' }}>
                  <i className="bi bi-building me-2 text-primary" />
                  Institutional Identity & Governance
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
                  <div>
                    <label className="form-label font-semibold text-sm">Institution Legal Name</label>
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      value={settingsForm.name || ''}
                      onChange={(e) => setSettingsForm({ ...settingsForm, name: e.target.value })}
                      required
                    />
                  </div>
  
                  <div>
                    <label className="form-label font-semibold text-sm">Short Code / Acronym</label>
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      value={settingsForm.shortCode || ''}
                      onChange={(e) => setSettingsForm({ ...settingsForm, shortCode: e.target.value })}
                      required
                    />
                  </div>
  
                  <div>
                    <label className="form-label font-semibold text-sm">Motto / Tagline</label>
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      value={settingsForm.tagline || ''}
                      onChange={(e) => setSettingsForm({ ...settingsForm, tagline: e.target.value })}
                    />
                  </div>
  
                  <div>
                    <label className="form-label font-semibold text-sm">Affiliating University</label>
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      value={settingsForm.affiliation || ''}
                      onChange={(e) => setSettingsForm({ ...settingsForm, affiliation: e.target.value })}
                    />
                  </div>
  
                  <div>
                    <label className="form-label font-semibold text-sm">Regulatory Approval</label>
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      value={settingsForm.approval || ''}
                      onChange={(e) => setSettingsForm({ ...settingsForm, approval: e.target.value })}
                    />
                  </div>
  
                  <div>
                    <label className="form-label font-semibold text-sm">Official Website</label>
                    <input
                      type="url"
                      className="form-control form-control-sm"
                      value={settingsForm.websiteUrl || ''}
                      onChange={(e) => setSettingsForm({ ...settingsForm, websiteUrl: e.target.value })}
                    />
                  </div>
                </div>
              </div>
            )}
  
            {/* Group 2: Campus & Contact Details */}
            {(settingsSubTab === 'general' || settingsSubTab === 'all') && (
              <div
                style={{
                  backgroundColor: '#fff',
                  padding: '1.5rem',
                  borderRadius: '10px',
                  border: '1px solid #e2e8f0',
                }}
              >
                <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '1.25rem', color: '#0f172a' }}>
                  <i className="bi bi-geo-alt-fill me-2 text-danger" />
                  Contact & Campus Location
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
                  <div>
                    <label className="form-label font-semibold text-sm">Official Contact Email</label>
                    <input
                      type="email"
                      className="form-control form-control-sm"
                      value={settingsForm.contactEmail || ''}
                      onChange={(e) => setSettingsForm({ ...settingsForm, contactEmail: e.target.value })}
                      required
                    />
                  </div>
  
                  <div>
                    <label className="form-label font-semibold text-sm">Helpline / Phone</label>
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      value={settingsForm.contactPhone || ''}
                      onChange={(e) => setSettingsForm({ ...settingsForm, contactPhone: e.target.value })}
                    />
                  </div>
  
                  <div>
                    <label className="form-label font-semibold text-sm">Campus Address</label>
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      value={settingsForm.address || ''}
                      onChange={(e) => setSettingsForm({ ...settingsForm, address: e.target.value })}
                    />
                  </div>
  
                  <div>
                    <label className="form-label font-semibold text-sm">City & State</label>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        placeholder="City"
                        value={settingsForm.city || ''}
                        onChange={(e) => setSettingsForm({ ...settingsForm, city: e.target.value })}
                      />
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        placeholder="State"
                        value={settingsForm.state || ''}
                        onChange={(e) => setSettingsForm({ ...settingsForm, state: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
  
            {(settingsSubTab === 'general' || settingsSubTab === 'all') && <BrandingSettings settingsForm={settingsForm} setSettingsForm={setSettingsForm} />}

            {/* Group 3: Performance Appraisal Configuration (PBAS) */}
            {(settingsSubTab === 'appraisal' || settingsSubTab === 'all') && (
              <div
                style={{
                  backgroundColor: '#fff',
                  padding: '1.5rem',
                  borderRadius: '10px',
                  border: '1px solid #e2e8f0',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 600, margin: 0, color: '#0f172a' }}>
                      <i className="bi bi-graph-up-arrow me-2 text-success" />
                      Performance Appraisal System (PBAS / CAS) Configuration
                    </h3>
                    <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>
                      Operational parameters governing annual appraisal cycles, benchmark cutoffs, and evaluation windows.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="btn btn-outline-primary btn-sm"
                    onClick={() => {
                      setActiveTab('masters');
                      setMasterCategory(MASTER_CATEGORIES.APPRAISAL_CRITERIA);
                    }}
                  >
                    <i className="bi bi-sliders me-1" /> Configure Scoring Rubrics &rarr;
                  </button>
                </div>
  
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
                  <div>
                    <label className="form-label font-semibold text-sm">Active Academic Appraisal Cycle</label>
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      value={settingsForm.currentAcademicYear || ''}
                      onChange={(e) => setSettingsForm({ ...settingsForm, currentAcademicYear: e.target.value })}
                      placeholder="e.g. 2025-2026"
                    />
                    <small className="text-muted" style={{ fontSize: '0.72rem' }}>Appraisal data and PBAS submissions will be grouped under this cycle.</small>
                  </div>
  
                  <div>
                    <label className="form-label font-semibold text-sm">Self-Appraisal Submission Deadline</label>
                    <input
                      type="date"
                      className="form-control form-control-sm"
                      value={dateValue(appraisal.selfAppraisalDeadline)}
                      onChange={(e) => setAppraisal({ selfAppraisalDeadline: e.target.value || null })}
                    />
                    <small className="text-muted" style={{ fontSize: '0.72rem' }}>Faculty members cannot modify self-appraisal submissions after this date.</small>
                  </div>
  
                  <div>
                    <label className="form-label font-semibold text-sm">HOD Assessment & Verification Deadline</label>
                    <input
                      type="date"
                      className="form-control form-control-sm"
                      value={dateValue(appraisal.hodReviewDeadline)}
                      onChange={(e) => setAppraisal({ hodReviewDeadline: e.target.value || null })}
                    />
                    <small className="text-muted" style={{ fontSize: '0.72rem' }}>Department heads must complete verification before Principal review window.</small>
                  </div>
  
                  <div>
                    <label className="form-label font-semibold text-sm">Annual Increment Benchmark (API Points)</label>
                    <input
                      type="number"
                      className="form-control form-control-sm"
                      value={appraisal.incrementBenchmark}
                      onChange={(e) => setAppraisal({ incrementBenchmark: Math.max(0, Math.min(300, Number(e.target.value) || 0)) })}
                      min={0}
                      max={300}
                    />
                    <small className="text-muted" style={{ fontSize: '0.72rem' }}>Minimum PBAS composite score required to qualify for annual increment.</small>
                  </div>
  
                  <div>
                    <label className="form-label font-semibold text-sm">CAS Promotion Threshold (Points)</label>
                    <input
                      type="number"
                      className="form-control form-control-sm"
                      value={appraisal.casThreshold}
                      onChange={(e) => setAppraisal({ casThreshold: Math.max(0, Math.min(500, Number(e.target.value) || 0)) })}
                      min={0}
                      max={500}
                    />
                    <small className="text-muted" style={{ fontSize: '0.72rem' }}>Minimum cumulative points required for Career Advancement Scheme (CAS).</small>
                  </div>
  
                  <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <div className="form-check form-switch mt-2">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        id="peerFeedbackSwitch"
                        checked={appraisal.includeFeedback}
                        onChange={(e) => setAppraisal({ includeFeedback: e.target.checked })}
                      />
                      <label className="form-check-label font-semibold text-sm" htmlFor="peerFeedbackSwitch">
                        Factor Student & Peer Feedback into Score
                      </label>
                    </div>
                    <small className="text-muted" style={{ fontSize: '0.72rem', marginTop: '0.2rem' }}>Includes student feedback metrics in category 1 teaching evaluation.</small>
                  </div>
                </div>
              </div>
            )}
  
            {/* Group 3b: Leaderboard weights ("department of the year") */}
            {(settingsSubTab === 'appraisal' || settingsSubTab === 'all') && (
              <div
                style={{
                  backgroundColor: '#fff',
                  padding: '1.5rem',
                  borderRadius: '10px',
                  border: '1px solid #e2e8f0',
                }}
              >
                <h3 style={{ fontSize: '1.1rem', fontWeight: 600, margin: 0, color: '#0f172a' }}>
                  <i className="bi bi-trophy me-2 text-warning" />
                  Department of the Year — Score Weights
                </h3>
                <p style={{ margin: '0 0 1.25rem', fontSize: '0.8rem', color: '#64748b' }}>
                  Points each verified record earns on the Principal and Dean rankings. Only verified publications,
                  patents and activities, and funded projects the HOD has verified, are counted. Changing these saves a
                  new ranking-configuration version; funding and FDP weights, effective dates and the full history are
                  under “How these rankings are calculated” on the rankings.
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
                  {LEADERBOARD_WEIGHT_FIELDS.map(([key, label]) => (
                    <div key={key}>
                      <label className="form-label font-semibold text-sm" htmlFor={`weight-${key}`}>{label}</label>
                      <input
                        id={`weight-${key}`}
                        type="number"
                        className="form-control form-control-sm"
                        min={0}
                        max={20}
                        step={1}
                        value={weights[key]}
                        onChange={(e) =>
                          setSettingsForm({
                            ...settingsForm,
                            leaderboardWeights: { ...weights, [key]: Math.max(0, Math.min(20, Number(e.target.value) || 0)) },
                          })
                        }
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Group 4: Security & System Policies */}
            {(settingsSubTab === 'security' || settingsSubTab === 'all') && (
              <div
                style={{
                  backgroundColor: '#fff',
                  padding: '1.5rem',
                  borderRadius: '10px',
                  border: '1px solid #e2e8f0',
                }}
              >
                <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '1.25rem', color: '#0f172a' }}>
                  <i className="bi bi-shield-check me-2 text-warning" />
                  Security, Platform Quotas & Governance
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
                  <div>
                    <label className="form-label font-semibold text-sm">Session Inactivity Timeout (Minutes)</label>
                    <input
                      type="number"
                      min="5"
                      max="1440"
                      className="form-control form-control-sm"
                      value={settingsForm.sessionTimeoutMinutes ?? 120}
                      onChange={(e) => setSettingsForm({ ...settingsForm, sessionTimeoutMinutes: Number(e.target.value) })}
                    />
                  </div>
  
                  <div>
                    <label className="form-label font-semibold text-sm">Max Document Upload Limit (MB)</label>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      className="form-control form-control-sm"
                      value={settingsForm.maxUploadSizeMb ?? 10}
                      onChange={(e) => setSettingsForm({ ...settingsForm, maxUploadSizeMb: Number(e.target.value) })}
                    />
                  </div>
  
                  <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <div className="form-check form-switch mt-2">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        id="maintenanceSwitch"
                        checked={settingsForm.maintenanceMode || false}
                        onChange={(e) => setSettingsForm({ ...settingsForm, maintenanceMode: e.target.checked })}
                      />
                      <label className="form-check-label font-semibold text-sm" htmlFor="maintenanceSwitch">
                        Maintenance Mode (Restrict non-admin access)
                      </label>
                    </div>
                    <div className="form-check form-switch mt-2">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        id="selfRegistrationSwitch"
                        checked={settingsForm.allowSelfRegistration || false}
                        onChange={(e) => setSettingsForm({ ...settingsForm, allowSelfRegistration: e.target.checked })}
                      />
                      <label className="form-check-label font-semibold text-sm" htmlFor="selfRegistrationSwitch">
                        Allow faculty self-registration (college email, admin approval required)
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            )}
  
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button type="submit" className="btn btn-primary" disabled={settingsSaving}>
                {settingsSaving ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" /> Saving Parameters...
                  </>
                ) : (
                  <>
                    <i className="bi bi-save me-1" /> Save All Configuration
                  </>
                )}
              </button>
            </div>
          </form>
  );
};
