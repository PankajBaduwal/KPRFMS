// Mirrors the server-side policy in server/src/validators/auth.validator.ts
export const PASSWORD_RULES = [
  { label: 'At least 8 characters', test: (v: string) => v.length >= 8 },
  { label: 'Upper & lower case letters', test: (v: string) => /[a-z]/.test(v) && /[A-Z]/.test(v) },
  { label: 'At least one number', test: (v: string) => /\d/.test(v) },
  { label: 'One special character (@$!%*?&)', test: (v: string) => /[@$!%*?&]/.test(v) },
];
export const PASSWORD_POLICY = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
