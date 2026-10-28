/**
 * Research funding lifecycle (a project's `status`) and who may move it.
 *
 * Two separate questions, never mixed:
 *   1. Where is the application with the funding agency?  -> status
 *      IDEA, DRAFT, APPLIED (filed with the agency), SUBMITTED (formally submitted / acknowledged),
 *      PENDING (awaiting decision), UNDER_REVIEW, CLARIFICATION_REQUIRED, APPROVED (approved in
 *      principle), SANCTIONED (sanction order issued), ONGOING, COMPLETED, REJECTED, WITHDRAWN.
 *   2. Has the institution checked the record and its evidence?  -> verificationStatus
 *      DRAFT, SUBMITTED, VERIFIED, RETURNED_FOR_CORRECTION, REJECTED.
 * Agency decisions (APPROVED, SANCTIONED, REJECTED) are recorded by the HOD of the project's
 * department or institutional leadership after seeing the evidence, never by the investigator
 * themself. Only VERIFIED records count as institutional achievements.
 */

export const FUNDING_STATUS = {
  IDEA: 'IDEA',
  DRAFT: 'DRAFT',
  APPLIED: 'APPLIED',
  SUBMITTED: 'SUBMITTED',
  PENDING: 'PENDING',
  UNDER_REVIEW: 'UNDER_REVIEW',
  CLARIFICATION_REQUIRED: 'CLARIFICATION_REQUIRED',
  APPROVED: 'APPROVED',
  SANCTIONED: 'SANCTIONED',
  ONGOING: 'ONGOING',
  COMPLETED: 'COMPLETED',
  REJECTED: 'REJECTED',
  WITHDRAWN: 'WITHDRAWN',
} as const;
export type FundingStatus = (typeof FUNDING_STATUS)[keyof typeof FUNDING_STATUS];
export const FUNDING_STATUSES = Object.values(FUNDING_STATUS) as FundingStatus[];

export const VERIFICATION = {
  DRAFT: 'DRAFT',
  SUBMITTED: 'SUBMITTED',
  VERIFIED: 'VERIFIED',
  RETURNED_FOR_CORRECTION: 'RETURNED_FOR_CORRECTION',
  REJECTED: 'REJECTED',
} as const;
export type VerificationStatus = (typeof VERIFICATION)[keyof typeof VERIFICATION];

/** Statuses that mean money was granted (only counted when the record is also VERIFIED). */
export const FUNDED_STATUSES: FundingStatus[] = ['SANCTIONED', 'ONGOING', 'COMPLETED'];
/** Applications waiting for an agency decision. */
export const AWAITING_DECISION: FundingStatus[] = ['APPLIED', 'SUBMITTED', 'PENDING', 'UNDER_REVIEW', 'CLARIFICATION_REQUIRED'];
/** Decisions only the HOD or leadership may record. */
export const AGENCY_DECISIONS: FundingStatus[] = ['APPROVED', 'SANCTIONED', 'REJECTED'];

/** Mongo filter for funded projects that the institution has verified. */
export const verifiedFundedMatch = () => ({ status: { $in: FUNDED_STATUSES }, verificationStatus: VERIFICATION.VERIFIED });
/** The same rule inside an aggregation ($cond). */
export const VERIFIED_FUNDED_EXPR = { $and: [{ $in: ['$status', FUNDED_STATUSES] }, { $eq: ['$verificationStatus', VERIFICATION.VERIFIED] }] };

/** The same rule for a loaded record. */
export const isVerifiedFunded = (p: { status?: string; verificationStatus?: string }) =>
  (FUNDED_STATUSES as string[]).includes(p.status ?? '') && p.verificationStatus === VERIFICATION.VERIFIED;

const T: Record<FundingStatus, FundingStatus[]> = {
  IDEA: ['DRAFT', 'WITHDRAWN'],
  DRAFT: ['IDEA', 'APPLIED', 'SUBMITTED', 'WITHDRAWN'],
  APPLIED: ['SUBMITTED', 'PENDING', 'UNDER_REVIEW', 'REJECTED', 'WITHDRAWN'],
  SUBMITTED: ['PENDING', 'UNDER_REVIEW', 'CLARIFICATION_REQUIRED', 'APPROVED', 'REJECTED', 'WITHDRAWN', 'DRAFT'],
  PENDING: ['UNDER_REVIEW', 'CLARIFICATION_REQUIRED', 'APPROVED', 'SANCTIONED', 'REJECTED', 'WITHDRAWN'],
  UNDER_REVIEW: ['PENDING', 'CLARIFICATION_REQUIRED', 'APPROVED', 'SANCTIONED', 'REJECTED', 'WITHDRAWN'],
  CLARIFICATION_REQUIRED: ['UNDER_REVIEW', 'PENDING', 'REJECTED', 'WITHDRAWN'],
  APPROVED: ['SANCTIONED', 'REJECTED', 'WITHDRAWN'],
  SANCTIONED: ['ONGOING', 'COMPLETED'],
  ONGOING: ['COMPLETED'],
  COMPLETED: [],
  REJECTED: ['DRAFT'],
  WITHDRAWN: ['DRAFT'],
};

export function nextStatuses(from: FundingStatus): FundingStatus[] {
  return T[from] ?? [];
}

export type Actor = 'OWNER' | 'REVIEWER';

/** Who may move a project to `to`: the investigator (owner) or a reviewer (HOD of its department / leadership). */
export function mayMove(to: FundingStatus, actor: Actor): boolean {
  if (AGENCY_DECISIONS.includes(to)) return actor === 'REVIEWER';
  return true;
}

/** What each target status needs. Returns human-readable problems (empty when fine). */
export function requirementsFor(
  to: FundingStatus,
  p: { fundingAgency?: string; requestedAmount?: number; sanctionedAmount?: number; receivedAmount?: number; sanctionNumber?: string; grantNumber?: string },
  note?: string
): string[] {
  const out: string[] = [];
  const needsNote: FundingStatus[] = ['CLARIFICATION_REQUIRED', 'REJECTED', 'WITHDRAWN'];
  if (needsNote.includes(to) && (!note || note.trim().length < 5)) out.push('Add a note of at least 5 characters explaining this step.');
  if (to === 'APPLIED' && !p.fundingAgency) out.push('Name the funding agency before marking the proposal as applied.');
  if (to === 'APPLIED' && !(Number(p.requestedAmount) > 0)) out.push('Enter the amount requested before marking the proposal as applied.');
  if (to === 'SANCTIONED') {
    if (!(Number(p.sanctionedAmount) > 0)) out.push('Enter the sanctioned amount.');
    if (!p.sanctionNumber && !p.grantNumber) out.push('Enter the sanction order or grant number.');
  }
  if (Number(p.receivedAmount) > 0 && Number(p.sanctionedAmount) > 0 && Number(p.receivedAmount) > Number(p.sanctionedAmount)) {
    out.push('The amount received cannot be more than the amount sanctioned.');
  }
  return out;
}

/** Verification state a project should start with, derived from its lifecycle status. */
export function initialVerification(status: string | undefined): VerificationStatus {
  return status === 'IDEA' || status === 'DRAFT' || !status ? VERIFICATION.DRAFT : VERIFICATION.SUBMITTED;
}

export const STATUS_LABELS: Record<FundingStatus, string> = {
  IDEA: 'Idea',
  DRAFT: 'Draft',
  APPLIED: 'Applied',
  SUBMITTED: 'Submitted',
  PENDING: 'Pending decision',
  UNDER_REVIEW: 'Under review',
  CLARIFICATION_REQUIRED: 'Clarification required',
  APPROVED: 'Approved',
  SANCTIONED: 'Sanctioned',
  ONGOING: 'Ongoing',
  COMPLETED: 'Completed',
  REJECTED: 'Rejected',
  WITHDRAWN: 'Withdrawn',
};
