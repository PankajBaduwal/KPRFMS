/** Where the owner sees each kind of record; used by notification links. */
export const RECORD_LINKS: Record<string, string> = {
  PUBLICATION: '/portal/publications',
  ACADEMIC_ACTIVITY: '/portal/activities',
  PROJECT: '/portal/projects',
  PATENT: '/portal/ipr-consultancy?tab=PATENTS',
  COPYRIGHT: '/portal/ipr-consultancy?tab=COPYRIGHTS',
  CONSULTANCY: '/portal/ipr-consultancy?tab=CONSULTANCY',
  STUDENT_PROJECT: '/portal/student-projects',
  LEAVE: '/portal/leaves',
  ATTENDANCE_CORRECTION: '/portal/attendance?tab=corrections',
  APPRAISAL: '/portal/appraisals',
  FACULTY_COURSE: '/portal/courses',
  FACULTY_ACHIEVEMENT: '/portal/achievements',
  QUALIFICATION: '/portal/profile?tab=academic',
  EXPERIENCE: '/portal/profile?tab=academic',
};
export const recordLink = (recordType: string) => RECORD_LINKS[recordType] ?? '/portal/dossier';
