/**
 * Why an account has no faculty profile, and what fixes it. Academic roles (Faculty, HOD, Dean,
 * Principal) get a profile as soon as they have a home department; administrators do not need one.
 */
export function noProfileMessage(role: string | undefined, what: string): string {
  if (role === 'ADMIN') {
    return `Institution Admin accounts are not faculty members, so there is no personal ${what}. Use the Admin console to manage people and settings.`;
  }
  return `Your account has no home department yet, so there is no faculty profile and no personal ${what}. Ask your institution administrator to set your department (Admin console → Users → Edit); your profile is created automatically.`;
}
