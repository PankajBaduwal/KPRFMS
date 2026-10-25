import React, { useState } from 'react';
import { Button } from './Button';
import { aiService, type VerifyResult } from '../services/ai.service';
import { useAiEnabled } from '../hooks/useAiEnabled';

const VERDICT: Record<VerifyResult['overall'], { label: string; cls: string; icon: string }> = {
  LOOKS_CORRECT: { label: 'Matches the proof', cls: 'is-ok', icon: 'bi-check-circle-fill' },
  CHECK_DETAILS: { label: 'Check some details', cls: 'is-check', icon: 'bi-exclamation-circle-fill' },
  MISMATCH: { label: 'Does not match the proof', cls: 'is-bad', icon: 'bi-x-octagon-fill' },
  NO_PROOF: { label: 'No readable proof', cls: 'is-none', icon: 'bi-file-earmark-x' },
};

const fieldLabel = (f: string) => f.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());

/**
 * Reviewer aid: AI compares what the teacher entered with the uploaded certificate / paper and
 * lists possible duplicates. Advisory only — the reviewer still decides.
 */
export const AiVerifyPanel: React.FC<{ type: 'activity' | 'publication'; recordId: string }> = ({ type, recordId }) => {
  const enabled = useAiEnabled();
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!enabled) return null;

  const run = async () => {
    setLoading(true);
    setError(null);
    try {
      setResult(await aiService.verifyRecord(type, recordId));
    } catch (err: any) {
      setError(err?.message || 'The AI check failed. Please review manually.');
    } finally {
      setLoading(false);
    }
  };

  const verdict = result ? VERDICT[result.overall] : null;
  const problems = result?.fields.filter((f) => f.status !== 'MATCH') ?? [];

  return (
    <div className="ai-box">
      <div className="ai-box-head">
        <span className="ai-box-title">
          <i className="bi bi-stars" aria-hidden="true" /> AI check against the proof
        </span>
        <Button size="sm" variant="outline" loading={loading} onClick={run}>
          {result ? 'Check again' : 'Run check'}
        </Button>
      </div>
      {!result && !error && (
        <span className="ai-box-note">
          Compares the entered details with the uploaded {type === 'activity' ? 'certificate' : 'paper'} and looks for duplicates. Takes about 10–30 seconds.
        </span>
      )}
      {error && <div className="ai-warning">{error}</div>}
      {result && verdict && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span className={`ai-verdict ${verdict.cls}`}>
              <i className={`bi ${verdict.icon}`} aria-hidden="true" /> {verdict.label}
            </span>
            <span>{result.summary}</span>
          </div>
          {problems.length > 0 && (
            <table className="ai-table">
              <thead>
                <tr>
                  <th>Field</th>
                  <th>Entered</th>
                  <th>On the proof</th>
                </tr>
              </thead>
              <tbody>
                {problems.map((f) => (
                  <tr key={f.field} className={f.status === 'MISMATCH' ? 'is-mismatch' : 'is-missing'}>
                    <td>{fieldLabel(f.field)}</td>
                    <td>{f.entered || '—'}</td>
                    <td>
                      {f.status === 'NOT_IN_DOCUMENT' ? 'Not shown' : f.inDocument || '—'}
                      {f.note ? <div className="ai-box-note">{f.note}</div> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {result.fields.length > 0 && problems.length === 0 && (
            <span className="ai-box-note">All {result.fields.length} checked fields match.</span>
          )}
          {result.duplicates.length > 0 && (
            <div className="ai-warning">
              <strong>Possible duplicate{result.duplicates.length > 1 ? 's' : ''}:</strong>
              <ul>
                {result.duplicates.map((d) => (
                  <li key={d.id}>
                    “{d.title}” — {d.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <span className="ai-box-note">AI suggestions can be wrong. Open the proof to confirm before deciding.</span>
        </>
      )}
    </div>
  );
};
