import React, { useState } from 'react';
import { Button } from './Button';
import { aiService, type AppraisalSummary } from '../services/ai.service';
import { useAiEnabled } from '../hooks/useAiEnabled';

/** Teacher: draft the remarks for every category from verified records (fills the text boxes, not saved). */
export const AiAppraisalDraft: React.FC<{
  appraisalId?: string;
  disabled?: boolean;
  onDraft: (remarks: { categoryKey: string; remarks: string }[]) => void;
}> = ({ appraisalId, disabled, onDraft }) => {
  const enabled = useAiEnabled();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  if (!enabled || !appraisalId) return null;

  const run = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const { categories } = await aiService.draftAppraisal(appraisalId);
      onDraft(categories);
      setMessage({ ok: true, text: `Drafted remarks for ${categories.length} categories from your verified records. Edit them, then save.` });
    } catch (err: any) {
      setMessage({ ok: false, text: err?.message || 'Could not draft the remarks.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="ai-box">
      <div className="ai-box-head">
        <span className="ai-box-title">
          <i className="bi bi-stars" aria-hidden="true" /> Draft my remarks with AI
        </span>
        <Button size="sm" variant="outline" loading={loading} disabled={disabled} onClick={run}>
          Draft remarks
        </Button>
      </div>
      <span className="ai-box-note">
        Uses only your verified publications, projects, patents, activities and mentoring for this year. Existing remarks are replaced in the boxes, not saved until you press Save.
      </span>
      {message && <span style={{ color: message.ok ? 'var(--color-success)' : '#b91c1c' }}>{message.text}</span>}
    </div>
  );
};

/** Reviewer: short summary of the appraisal compared with verified records. */
export const AiAppraisalSummary: React.FC<{ appraisalId: string }> = ({ appraisalId }) => {
  const enabled = useAiEnabled();
  const [summary, setSummary] = useState<AppraisalSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!enabled) return null;

  const run = async () => {
    setLoading(true);
    setError(null);
    try {
      setSummary(await aiService.summarizeAppraisal(appraisalId));
    } catch (err: any) {
      setError(err?.message || 'Could not summarise this appraisal.');
    } finally {
      setLoading(false);
    }
  };

  const list = (title: string, items: string[]) =>
    items.length > 0 && (
      <div>
        <strong>{title}</strong>
        <ul>
          {items.map((i) => (
            <li key={i}>{i}</li>
          ))}
        </ul>
      </div>
    );

  return (
    <div className="ai-box">
      <div className="ai-box-head">
        <span className="ai-box-title">
          <i className="bi bi-stars" aria-hidden="true" /> AI summary for the reviewer
        </span>
        <Button size="sm" variant="outline" loading={loading} onClick={run}>
          {summary ? 'Refresh' : 'Summarise'}
        </Button>
      </div>
      {error && <div className="ai-warning">{error}</div>}
      {summary ? (
        <>
          <p style={{ margin: 0 }}>{summary.summary}</p>
          {list('Strengths', summary.strengths)}
          {list('Check before scoring', summary.concerns)}
          {list('Questions you could ask', summary.questionsToAsk)}
          <span className="ai-box-note">Advisory only — the score is your decision.</span>
        </>
      ) : (
        !error && <span className="ai-box-note">Compares the self-scores and remarks with the teacher’s verified records.</span>
      )}
    </div>
  );
};
