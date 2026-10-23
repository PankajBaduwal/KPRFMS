import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Alert, Input, Select, LoadingState } from '../components';
import { authService, type RegistrationOptions } from '../services/auth.service';
import { useAsyncAction } from '../hooks/useAsyncAction';
import { ROUTES } from '../constants/routes';

// Mirrors the server-side policy in server/src/validators/auth.validator.ts
const PASSWORD_POLICY = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

const buildSchema = (emailDomain: string) =>
  z
    .object({
      name: z.string().trim().min(3, 'Enter your full name (e.g. Dr. R. Priya)'),
      email: z
        .string()
        .trim()
        .toLowerCase()
        .email('Enter a valid email address')
        .refine((v) => v.endsWith(`@${emailDomain}`), `Use your college email ending in @${emailDomain}`),
      employeeId: z
        .string()
        .trim()
        .toUpperCase()
        .regex(/^[A-Z0-9-]{3,20}$/, '3-20 letters, numbers or hyphens'),
      departmentId: z.string().min(1, 'Select your department'),
      designation: z.string().min(1, 'Select your designation'),
      phone: z
        .string()
        .trim()
        .refine((v) => v === '' || /^(\+91[\s-]?)?[6-9]\d{9}$/.test(v), 'Enter a valid 10-digit mobile number'),
      password: z
        .string()
        .min(8, 'At least 8 characters')
        .regex(PASSWORD_POLICY, 'Use upper & lower case letters, a number and one of @$!%*?&'),
      confirmPassword: z.string().min(1, 'Re-enter your password'),
    })
    .refine((d) => d.password === d.confirmPassword, { message: 'Passwords do not match', path: ['confirmPassword'] });

type RegisterForm = z.infer<ReturnType<typeof buildSchema>>;

export const RegisterPage: React.FC = () => {
  const [options, setOptions] = useState<RegistrationOptions | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState<{ email: string } | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    authService
      .getRegistrationOptions()
      .then(setOptions)
      .catch((err) => setLoadError(err?.message || 'Unable to load the registration form.'));
  }, []);

  const emailDomain = options?.emailDomain || 'kpriet.ac.in';
  const schema = useMemo(() => buildSchema(emailDomain), [emailDomain]);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<RegisterForm>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', email: '', employeeId: '', departmentId: '', designation: '', phone: '', password: '', confirmPassword: '' },
  });

  const submit = useAsyncAction(async (data: RegisterForm) => {
    setServerError(null);
    try {
      const { confirmPassword: _confirm, ...payload } = data;
      const result = await authService.register({ ...payload, phone: payload.phone || undefined });
      setSubmitted({ email: result.email });
    } catch (err: any) {
      // Field-level errors from the server (duplicate email / employee ID, domain) go next to the field
      for (const d of err?.details || []) {
        if (d?.field && d.field in data) setError(d.field as keyof RegisterForm, { message: err.message });
      }
      setServerError(err?.message || 'Registration failed. Please try again.');
    }
  });

  const passwordToggle = (
    <button
      type="button"
      onClick={() => setShowPassword((v) => !v)}
      aria-label={showPassword ? 'Hide password' : 'Show password'}
      className="register-password-toggle"
    >
      <i className={`bi ${showPassword ? 'bi-eye-slash' : 'bi-eye'}`} aria-hidden="true" />
    </button>
  );

  return (
    <div className="login-page-container">
      <div className="login-auth-panel register-panel">
        <div className="login-panel-header">
          <div className="login-panel-logo" style={{ marginBottom: '1.25rem' }}>
            <Link to={ROUTES.HOME} style={{ textDecoration: 'none', display: 'inline-block' }}>
              <img
                src="/images/kpriet-logo.png"
                alt="KPR Institute of Engineering and Technology"
                style={{ height: '46px', maxWidth: '220px', objectFit: 'contain' }}
              />
            </Link>
          </div>
          <h2 className="login-panel-title">{submitted ? 'Registration submitted' : 'Faculty registration'}</h2>
          <p className="login-panel-desc">
            {submitted
              ? 'Your account is waiting for administrator approval.'
              : `Create your Faculty Management System account with your college email (@${emailDomain}).`}
          </p>
        </div>

        {loadError && (
          <Alert variant="danger" title="Could not load the form">
            {loadError}
          </Alert>
        )}

        {!options && !loadError && <LoadingState message="Loading registration form..." />}

        {options && !options.enabled && !submitted && (
          <Alert variant="info" title="Self-registration is closed">
            New accounts are currently created by the administrator. Please contact the IT office or your HOD with your
            employee ID and college email.
          </Alert>
        )}

        {submitted && (
          <div className="register-success">
            <div className="register-success-icon" aria-hidden="true">
              <i className="bi bi-hourglass-split" />
            </div>
            <ol className="register-steps">
              <li className="is-done">
                <strong>Registration received</strong>
                <span>{submitted.email}</span>
              </li>
              <li className="is-current">
                <strong>Administrator approval</strong>
                <span>Your HOD and the administrator have been notified.</span>
              </li>
              <li>
                <strong>Sign in and complete your profile</strong>
                <span>Once approved, sign in with your college email and the password you chose.</span>
              </li>
            </ol>
            <Link to={ROUTES.LOGIN} className="login-submit-btn" style={{ textDecoration: 'none' }}>
              <i className="bi bi-box-arrow-in-right" aria-hidden="true" />
              <span>Back to Sign In</span>
            </Link>
          </div>
        )}

        {options?.enabled && !submitted && (
          <>
            {serverError && (
              <div style={{ marginBottom: '1rem' }}>
                <Alert variant="danger" title="Registration failed" onDismiss={() => setServerError(null)}>
                  {serverError}
                </Alert>
              </div>
            )}

            <form onSubmit={handleSubmit((data) => submit.run(data))} noValidate className="login-form register-form">
              <div className="register-grid">
                <Input
                  label="Full name"
                  placeholder="e.g. Dr. R. Priya"
                  autoComplete="name"
                  error={errors.name?.message}
                  {...register('name')}
                />
                <Input
                  label="Employee ID"
                  placeholder="e.g. KPR2140"
                  autoComplete="off"
                  error={errors.employeeId?.message}
                  {...register('employeeId')}
                />
              </div>

              <Input
                label="College email"
                type="email"
                placeholder={`firstname.lastname@${emailDomain}`}
                autoComplete="email"
                prefixIcon={<i className="bi bi-envelope" aria-hidden="true" />}
                hint={`Only @${emailDomain} addresses are accepted`}
                error={errors.email?.message}
                {...register('email')}
              />

              <div className="register-grid">
                <Select
                  label="Department"
                  placeholder="Select department"
                  options={options.departments.map((d) => ({ value: d._id, label: `${d.name} (${d.code})` }))}
                  error={errors.departmentId?.message}
                  {...register('departmentId')}
                />
                <Select
                  label="Designation"
                  placeholder="Select designation"
                  options={options.designations.map((d) => ({ value: d, label: d }))}
                  error={errors.designation?.message}
                  {...register('designation')}
                />
              </div>

              <Input
                label="Mobile number (optional)"
                type="tel"
                placeholder="98XXXXXXXX"
                autoComplete="tel"
                error={errors.phone?.message}
                {...register('phone')}
              />

              <div className="register-grid">
                <Input
                  label="Password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  hint="8+ characters with upper & lower case, a number and @$!%*?&"
                  suffixAction={passwordToggle}
                  error={errors.password?.message}
                  {...register('password')}
                />
                <Input
                  label="Confirm password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  error={errors.confirmPassword?.message}
                  {...register('confirmPassword')}
                />
              </div>

              <button type="submit" disabled={submit.isPending} className="login-submit-btn">
                {submit.isPending ? (
                  <>
                    <span className="spinner spinner-sm" aria-hidden="true" />
                    <span>Submitting...</span>
                  </>
                ) : (
                  <>
                    <i className="bi bi-person-plus" aria-hidden="true" />
                    <span>Create account</span>
                  </>
                )}
              </button>
            </form>

            <div className="login-security-notice">
              <i className="bi bi-shield-check" aria-hidden="true" />
              <div className="login-security-text">
                <strong>Approval required.</strong> An administrator verifies every registration against the staff roll
                before the account can sign in.
              </div>
            </div>
          </>
        )}

        <p className="register-footer">
          Already have an account? <Link to={ROUTES.LOGIN}>Sign in</Link>
        </p>
      </div>
    </div>
  );
};
