import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Alert, Button, PageHeader, Select, useToast } from '../components';
import { aiService, type AccreditationDraft, type AskResult } from '../services/ai.service';
import { useAiEnabled } from '../hooks/useAiEnabled';
import { useAcademicYears } from '../hooks/useAcademicYears';
import { useAuthStore } from '../stores/authStore';
import '../styles/ai-assistant.css';

const EXAMPLES = [
  'How many Q1 papers did ECE publish this year?',
  'Which department has the most verified Scopus publications in 2025-2026?',
  'Total sanctioned amount of funded projects by department',
  'How many patents were granted this year, and from which departments?',
  'How many FDPs did faculty attend this year compared with last year?',
];

interface Turn {
  question: string;
  result?: AskResult;
  error?: string;
}

const AskTab: React.FC = () => {
  const [question, setQuestion] = useState('');
  const [turns, setTurns] = useState<Turn[]>([]);
  const [loading, setLoading] = useState(false);

  const ask = async (q: string) => {
    const text = q.trim();
    if (text.length < 5 || loading) return;
    setLoading(true);
    setQuestion('');
    setTurns((t) => [{ question: text }, ...t]);
    try {
      const result = await aiService.ask(text);
      setTurns((t) => t.map((turn, i) => (i === 0 ? { ...turn, result } : turn)));
    } catch (err: any) {
      setTurns((t) => t.map((turn, i) => (i === 0 ? { ...turn, error: err?.message || 'Could not answer.' } : turn)));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="ai-assistant-panel">
      <form
        className="ai-ask-form"
        onSubmit={(e) => {
          e.preventDefault();
          void ask(question);
        }}
      >
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask a question about publications, projects, patents, activities, faculty or leave…"
          maxLength={500}
          aria-label="Question"
          disabled={loading}
        />
        <Button type="submit" loading={loading} disabled={question.trim().length < 5}>
          Ask
        </Button>
      </form>
      <div className="ai-examples">
        {EXAMPLES.map((e) => (
          <button key={e} type="button" onClick={() => void ask(e)} disabled={loading}>
            {e}
          </button>
        ))}
      </div>

      {turns.map((turn, i) => (
        <article key={`${turn.question}-${turns.length - i}`} className="ai-answer">
          <div className="ai-answer-q">
            <i className="bi bi-person-circle" aria-hidden="true" /> {turn.question}
          </div>
          {!turn.result && !turn.error && (
            <div className="ai-box-note">
              <span className="spinner spinner-sm" aria-hidden="true" /> Looking at the data…
            </div>
          )}
          {turn.error && <div className="ai-warning">{turn.error}</div>}
          {turn.result && (
            <>
              <p className={turn.result.canAnswer ? '' : 'ai-answer-cannot'}>{turn.result.answer}</p>
              {turn.result.table && turn.result.table.columns.length > 0 && (
                <table className="ai-table">
                  <thead>
                    <tr>
                      {turn.result.table.columns.map((c) => (
                        <th key={c}>{c}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {turn.result.table.rows.map((row, r) => (
                      <tr key={r}>
                        {row.map((cell, c) => (
                          <td key={c}>{cell}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <div className="ai-box-note">
                Based on: {turn.result.basis} · {turn.result.scope}
              </div>
            </>
          )}
        </article>
      ))}
    </div>
  );
};

const NaacTab: React.FC = () => {
  const { user } = useAuthStore();
  const { currentYear, options } = useAcademicYears();
  const { addToast } = useToast();
  const [year, setYear] = useState('');
  const [draft, setDraft] = useState<AccreditationDraft | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const academicYear = year || currentYear;

  const run = async () => {
    setLoading(true);
    setError(null);
    try {
      setDraft(await aiService.draftCriterion3(academicYear));
    } catch (err: any) {
      setError(err?.message || 'Could not draft the narrative.');
    } finally {
      setLoading(false);
    }
  };

  const asText = (d: AccreditationDraft) =>
    `NAAC Criterion III — Research, Innovations and Extension\n${d.scope}, ${d.academicYear}\n\n` +
    d.sections.map((s) => `${s.heading}\n\n${s.text}`).join('\n\n');

  return (
    <div className="ai-assistant-panel">
      <div className="ai-naac-controls">
        <div style={{ minWidth: 200 }}>
          <Select label="Academic year" options={options} value={academicYear} onChange={(e) => setYear(e.target.value)} />
        </div>
        <Button loading={loading} disabled={!academicYear} onClick={run} icon={<i className="bi bi-stars" />}>
          {draft ? 'Draft again' : 'Draft Criterion III'}
        </Button>
        <span className="ai-box-note">
          {user?.role === 'HOD' ? 'Covers your department.' : 'Covers the whole institution.'} Takes up to a minute.
        </span>
      </div>
      {error && <Alert variant="danger">{error}</Alert>}
      {draft && (
        <article className="ai-naac-draft">
          <div className="ai-box-head">
            <strong>
              Criterion III draft · {draft.scope} · {draft.academicYear}
            </strong>
            <div style={{ display: 'flex', gap: 8 }}>
              <Button
                size="sm"
                variant="outline"
                icon={<i className="bi bi-clipboard" />}
                onClick={() => {
                  void navigator.clipboard?.writeText(asText(draft));
                  addToast('Draft copied', 'success');
                }}
              >
                Copy
              </Button>
              <Button
                size="sm"
                variant="outline"
                icon={<i className="bi bi-download" />}
                onClick={() => {
                  const url = URL.createObjectURL(new Blob([asText(draft)], { type: 'text/plain' }));
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `NAAC-Criterion-III-${draft.academicYear}.txt`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
              >
                Download
              </Button>
            </div>
          </div>
          {draft.sections.map((s) => (
            <section key={s.heading}>
              <h3>{s.heading}</h3>
              {s.text.split(/\n+/).map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </section>
          ))}
          {draft.dataGaps.length > 0 && (
            <div className="ai-warning">
              <strong>Missing data to add before submission:</strong>
              <ul>
                {draft.dataGaps.map((g) => (
                  <li key={g}>{g}</li>
                ))}
              </ul>
            </div>
          )}
          <span className="ai-box-note">
            AI draft based on records in FMS. The IQAC should check every figure and fill the [bracketed] parts before using it in the SSR.
          </span>
        </article>
      )}
    </div>
  );
};

export const AiAssistantPage: React.FC = () => {
  const enabled = useAiEnabled();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'naac' ? 'naac' : 'ask';

  return (
    <div className="ai-assistant-page">
      <PageHeader
        title="AI Assistant"
        subtitle="Ask questions about the institution's data in plain English, and draft accreditation text from it."
      />
      {!enabled ? (
        <Alert variant="info" title="AI is not set up">
          Add a Gemini API key (GEMINI_API_KEY) in server/.env and restart the API to use these features.
        </Alert>
      ) : (
        <>
          <div className="ai-tabs" role="tablist">
            <button type="button" role="tab" aria-selected={tab === 'ask'} className={tab === 'ask' ? 'is-active' : ''} onClick={() => setParams({ tab: 'ask' })}>
              <i className="bi bi-chat-square-text" /> Ask the data
            </button>
            <button type="button" role="tab" aria-selected={tab === 'naac'} className={tab === 'naac' ? 'is-active' : ''} onClick={() => setParams({ tab: 'naac' })}>
              <i className="bi bi-file-earmark-richtext" /> NAAC Criterion III draft
            </button>
          </div>
          {tab === 'ask' ? <AskTab /> : <NaacTab />}
        </>
      )}
    </div>
  );
};
