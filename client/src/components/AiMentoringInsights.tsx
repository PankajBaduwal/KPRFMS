import React, { useState } from 'react';
import { Button } from './Button';
import { aiService, type MentoringInsights } from '../services/ai.service';
import { useAiEnabled } from '../hooks/useAiEnabled';

const RISK = {
  HIGH: { label: 'Needs help now', cls: 'is-bad' },
  MEDIUM: { label: 'Watch closely', cls: 'is-check' },
  LOW: { label: 'Doing fine', cls: 'is-ok' },
} as const;

/** Summarises mentoring notes and flags students who may need help (mentor: own mentees; HOD: department). */
export const AiMentoringInsights: React.FC<{ academicYear?: string }> = ({ academicYear }) => {
  const enabled = useAiEnabled();
  const [result, setResult] = useState<MentoringInsights | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!enabled) return null;

  const run = async () => {
    setLoading(true);
    setError(null);
    try {
      setResult(await aiService.mentoringInsights(academicYear));
    } catch (err: any) {
      setError(err?.message || 'Could not analyse the mentoring notes.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="ai-box">
      <div className="ai-box-head">
        <span className="ai-box-title">
          <i className="bi bi-stars" aria-hidden="true" /> Students who may need help
        </span>
        <Button size="sm" variant="outline" loading={loading} onClick={run}>
          {result ? 'Analyse again' : 'Analyse mentoring notes'}
        </Button>
      </div>
      {!result && !error && (
        <span className="ai-box-note">
          AI reads the recent meeting notes and concerns of active mentees{academicYear ? ` (${academicYear})` : ''} and points out who needs attention.
        </span>
      )}
      {error && <div className="ai-warning">{error}</div>}
      {result && (
        <>
          <p style={{ margin: 0 }}>{result.overview}</p>
          {result.students.length > 0 && (
            <table className="ai-table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Status</th>
                  <th>Why</th>
                  <th>Suggested next step</th>
                </tr>
              </thead>
              <tbody>
                {result.students.map((s) => (
                  <tr key={s.registerNumber}>
                    <td>
                      <strong>{s.studentName}</strong>
                      <div className="ai-box-note">{s.registerNumber}</div>
                    </td>
                    <td>
                      <span className={`ai-verdict ${RISK[s.risk]?.cls ?? 'is-none'}`}>{RISK[s.risk]?.label ?? s.risk}</span>
                    </td>
                    <td>{s.reasons.join('; ')}</td>
                    <td>{s.suggestedAction}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <span className="ai-box-note">
            {result.analysed} mentee record(s) analysed. AI suggestions — use your own judgement about each student.
          </span>
        </>
      )}
    </div>
  );
};
