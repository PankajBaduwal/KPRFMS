import { Types } from 'mongoose';
import { Patent, PATENT_STATUS, PATENT_VERIFICATION } from '../models/Patent.js';
import { Copyright, COPYRIGHT_VERIFICATION } from '../models/Copyright.js';
import { Consultancy, CONSULTANCY_STATUS, CONSULTANCY_VERIFICATION } from '../models/Consultancy.js';
import { ROLES, type Role } from '../permissions/roles.js';
import type { AuthenticatedUser } from '../types/index.js';

export interface IIPRYearlySummary {
  academicYear: string;
  patentsCount: number;
  patentsGranted: number;
  patentsPublished: number;
  patentsFiled: number;
  copyrightsCount: number;
  consultancyCount: number;
  consultancyTotalValue: number;
}

export interface IIPRAnalytics {
  totalPatents: number;
  patentsFiled: number;
  patentsPublished: number;
  patentsGranted: number;
  verifiedPatents: number;
  totalCopyrights: number;
  verifiedCopyrights: number;
  totalConsultancies: number;
  verifiedConsultancies: number;
  totalConsultancyValue: number;
  ongoingConsultancies: number;
  completedConsultancies: number;
  yearlySummaries: IIPRYearlySummary[];
}

export class IPRAnalyticsService {
  async getAnalytics(
    user: AuthenticatedUser,
    departmentId?: string,
    academicYear?: string
  ): Promise<IIPRAnalytics> {
    const baseFilter: Record<string, unknown> = {};

    const isLeadership = ([ROLES.ADMIN, ROLES.PRINCIPAL, ROLES.DEAN] as Role[]).includes(user.role as Role);

    if (user.role === ROLES.FACULTY) {
      baseFilter.userId = new Types.ObjectId(user.id);
    } else if (user.role === ROLES.HOD) {
      baseFilter.departmentId = new Types.ObjectId(user.departmentId);
    } else if (isLeadership && departmentId) {
      baseFilter.departmentId = new Types.ObjectId(departmentId);
    }

    if (academicYear) {
      baseFilter.academicYear = academicYear;
    }

    const [allPatents, allCopyrights, allConsultancies] = await Promise.all([
      Patent.find(baseFilter),
      Copyright.find(baseFilter),
      Consultancy.find(baseFilter),
    ]);

    const totalPatents = allPatents.length;
    const patentsFiled = allPatents.filter((p) => p.status === PATENT_STATUS.FILED).length;
    const patentsPublished = allPatents.filter((p) => p.status === PATENT_STATUS.PUBLISHED).length;
    const patentsGranted = allPatents.filter((p) => p.status === PATENT_STATUS.GRANTED).length;
    const verifiedPatents = allPatents.filter(
      (p) => p.verificationStatus === PATENT_VERIFICATION.VERIFIED
    ).length;

    const totalCopyrights = allCopyrights.length;
    const verifiedCopyrights = allCopyrights.filter(
      (c) => c.verificationStatus === COPYRIGHT_VERIFICATION.VERIFIED
    ).length;

    const totalConsultancies = allConsultancies.length;
    const verifiedConsultancies = allConsultancies.filter(
      (c) => c.verificationStatus === CONSULTANCY_VERIFICATION.VERIFIED
    ).length;
    const totalConsultancyValue = allConsultancies.reduce((sum, c) => sum + (c.value || 0), 0);
    const ongoingConsultancies = allConsultancies.filter(
      (c) => c.status === CONSULTANCY_STATUS.ONGOING
    ).length;
    const completedConsultancies = allConsultancies.filter(
      (c) => c.status === CONSULTANCY_STATUS.COMPLETED
    ).length;

    // Collect all unique academic years across all three collections
    const yearsSet = new Set<string>();
    allPatents.forEach((p) => {
      if (p.academicYear) yearsSet.add(p.academicYear);
    });
    allCopyrights.forEach((c) => {
      if (c.academicYear) yearsSet.add(c.academicYear);
    });
    allConsultancies.forEach((cs) => {
      if (cs.academicYear) yearsSet.add(cs.academicYear);
    });

    const sortedYears = Array.from(yearsSet).sort().reverse();

    const yearlySummaries: IIPRYearlySummary[] = sortedYears.map((yr) => {
      const yrPatents = allPatents.filter((p) => p.academicYear === yr);
      const yrCopyrights = allCopyrights.filter((c) => c.academicYear === yr);
      const yrConsultancies = allConsultancies.filter((cs) => cs.academicYear === yr);

      return {
        academicYear: yr,
        patentsCount: yrPatents.length,
        patentsGranted: yrPatents.filter((p) => p.status === PATENT_STATUS.GRANTED).length,
        patentsPublished: yrPatents.filter((p) => p.status === PATENT_STATUS.PUBLISHED).length,
        patentsFiled: yrPatents.filter((p) => p.status === PATENT_STATUS.FILED).length,
        copyrightsCount: yrCopyrights.length,
        consultancyCount: yrConsultancies.length,
        consultancyTotalValue: yrConsultancies.reduce((sum, cs) => sum + (cs.value || 0), 0),
      };
    });

    return {
      totalPatents,
      patentsFiled,
      patentsPublished,
      patentsGranted,
      verifiedPatents,
      totalCopyrights,
      verifiedCopyrights,
      totalConsultancies,
      verifiedConsultancies,
      totalConsultancyValue,
      ongoingConsultancies,
      completedConsultancies,
      yearlySummaries,
    };
  }
}

export const iprAnalyticsService = new IPRAnalyticsService();
