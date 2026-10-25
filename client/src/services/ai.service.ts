import { apiClient, apiGet } from '../api/client';

// AI answers can take up to a minute (reports longer), far beyond the default 15 s timeout
const AI_TIMEOUT_MS = 180_000;
async function aiPost<T>(url: string, body?: unknown): Promise<T> {
  const res = await apiClient.post(url, body, { timeout: AI_TIMEOUT_MS });
  return res.data.data as T;
}

export interface CertificateFields {
  isCertificate: boolean;
  activityType?: string | null;
  title?: string | null;
  organizer?: string | null;
  participantName?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  duration?: string | null;
  mode?: string | null;
  location?: string | null;
  country?: string | null;
  participationType?: string | null;
  presentationTitle?: string | null;
  topic?: string | null;
  notes?: string | null;
}

export interface VerifyResult {
  overall: 'LOOKS_CORRECT' | 'CHECK_DETAILS' | 'MISMATCH' | 'NO_PROOF';
  summary: string;
  fields: { field: string; entered?: string | null; inDocument?: string | null; status: 'MATCH' | 'MISMATCH' | 'NOT_IN_DOCUMENT'; note?: string | null }[];
  duplicates: { id: string; title: string; reason: string }[];
}

export interface AppraisalSummary {
  summary: string;
  strengths: string[];
  concerns: string[];
  questionsToAsk: string[];
}

export interface AccreditationDraft {
  scope: string;
  academicYear: string;
  sections: { heading: string; text: string }[];
  dataGaps: string[];
}

export interface AskResult {
  answer: string;
  canAnswer: boolean;
  basis: string;
  table?: { columns: string[]; rows: string[][] } | null;
  scope: string;
}

export interface MentoringInsights {
  overview: string;
  analysed: number;
  students: { registerNumber: string; studentName: string; risk: 'HIGH' | 'MEDIUM' | 'LOW'; reasons: string[]; suggestedAction: string }[];
}

/** AI assistant (Gemini on the server). Every result is a suggestion the user reviews. */
export const aiService = {
  async status(): Promise<{ enabled: boolean }> {
    return (await apiGet<{ enabled: boolean }>('/ai/status')).data;
  },

  async readCertificate(file: File): Promise<{ fields: CertificateFields; warnings: string[] }> {
    const form = new FormData();
    form.append('file', file);
    return aiPost('/ai/certificate', form);
  },

  async verifyRecord(type: 'activity' | 'publication', id: string): Promise<VerifyResult> {
    return aiPost<VerifyResult>(`/ai/verify/${type}/${id}`);
  },

  async draftAppraisal(appraisalId: string): Promise<{ categories: { categoryKey: string; remarks: string }[] }> {
    return aiPost<{ categories: { categoryKey: string; remarks: string }[] }>(`/ai/appraisal/${appraisalId}/draft`);
  },

  async summarizeAppraisal(appraisalId: string): Promise<AppraisalSummary> {
    return aiPost<AppraisalSummary>(`/ai/appraisal/${appraisalId}/summary`);
  },

  async draftCriterion3(academicYear: string, departmentId?: string): Promise<AccreditationDraft> {
    return aiPost<AccreditationDraft>('/ai/accreditation/criterion-3', { academicYear, departmentId });
  },

  async ask(question: string): Promise<AskResult> {
    return aiPost<AskResult>('/ai/ask', { question });
  },

  async mentoringInsights(academicYear?: string): Promise<MentoringInsights> {
    return aiPost<MentoringInsights>('/ai/mentoring/insights', { academicYear });
  },
};
