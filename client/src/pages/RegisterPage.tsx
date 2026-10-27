import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Alert, Input, Select, LoadingState } from '../components';
import { authService, type RegistrationOptions } from '../services/auth.service';
import { useAsyncAction } from '../hooks/useAsyncAction';
import { ROUTES } from '../constants/routes';
import { PasswordChecklist } from '../components/PasswordChecklist';
import { PASSWORD_POLICY } from '../utils/passwordPolicy';
import '../styles/login.css';
import { PRODUCT_NAME } from '../config/brand';
import { InstitutionName, InstitutionContact } from '../components/InstitutionName';
import { BrandMark } from '../components/BrandMark';
import { useInstitutionCode } from '../lib/institution';
import { InstitutionPicker } from '../components/InstitutionPicker';

const buildSchema = (emailDomain: string) =>
  z
    .object({
      name: z.string().trim().min(3, 'Enter your full name, e.g. Dr. R. Priya'),
      phone: z
        .string()
        .trim()
        .refine((v) => v === '' || /^(\+91[\s-]?)?[6-9]\d{9}$/.test(v), 'Enter a valid 10-digit mobile number'),
      employeeId: z
        .string()
        .trim()
        .toUpperCase()
        .regex(/^[A-Z0-9-]{3,20}$/, '3–20 letters, numbers or hyphens'),
      departmentId: z.string().min(1, 'Select your department'),
      designation: z.string().min(1, 'Select your designation'),
      // Only the part before "@"; a pasted full college address is accepted too
      emailUser: z
        .string()
        .trim()
        .toLowerCase()
        .transform((v) => (v.endsWith(`@${emailDomain}`) ? v.slice(0, -(emailDomain.length + 1)) : v))
        .pipe(
          z
            .string()
            .min(2, 'Enter the part of your college email before @')
            .regex(/^[a-z0-9._-]+$/, `Use only the part before @${emailDomain} (letters, numbers, . _ -)`)
        ),
      password: z.string().regex(PASSWORD_POLICY, 'Password does not meet all the requirements below'),
      confirmPassword: z.string().min(1, 'Re-enter your password'),
    })
    .refine((d) => d.password === d.confirmPassword, { message: 'Passwords do not match', path: ['confirmPassword'] });

type RegisterForm = z.input<ReturnType<typeof buildSchema>>;

const STEPS = [
  { icon: 'bi-pencil-square', title: 'Fill in your details', text: 'Use your official employee ID and college email.' },
  { icon: 'bi-envelope-check', title: 'Confirm your email', text: 'Enter the 6-digit code we send to your college inbox.' },
  { icon: 'bi-shield-check', title: 'Administrator approval', text: 'Your HOD and the administrator verify you against the staff roll.' },
  { icon: 'bi-person-badge', title: 'Sign in & complete your profile', text: 'Add qualifications and experience for HOD verification.' },
];

export const RegisterPage: React.FC = () => {
  const [options, setOptions] = useState<RegistrationOptions | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState<{ email: string; verified: boolean } | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(0);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((n) => n - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  // Departments and the email domain belong to the chosen institution
  const institution = useInstitutionCode();
  useEffect(() => {
    setOptions(null);
    setLoadError(null);
    if (!institution) return;
    authService
      .getRegistrationOptions()
      .then(setOptions)
      .catch((err) => setLoadError(err?.message || 'Unable to load the registration form.'));
  }, [institution]);

  const emailDomain = options?.emailDomain || 'college.edu';
  const schema = useMemo(() => buildSchema(emailDomain), [emailDomain]);

  const {
    register,
    handleSubmit,
    setError,
    watch,
    formState: { errors },
  } = useForm<RegisterForm>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', phone: '', employeeId: '', departmentId: '', designation: '', emailUser: '', password: '', confirmPassword: '' },
  });
  const password = watch('password') || '';
  const confirmPassword = watch('confirmPassword') || '';

  const submit = useAsyncAction(async (data: RegisterForm) => {
    setServerError(null);
    const parsed = schema.parse(data);
    try {
      const result = await authService.register({
        name: parsed.name,
        email: `${parsed.emailUser}@${emailDomain}`,
        employeeId: parsed.employeeId,
        departmentId: parsed.departmentId,
        designation: parsed.designation,
        phone: parsed.phone || undefined,
        password: parsed.password,
      });
      setSubmitted({ email: result.email, verified: result.emailVerificationRequired === false });
      setResendIn(60);
    } catch (err: any) {
      // Server field errors (duplicate email / employee ID) are shown next to the field
      for (const d of err?.details || []) {
        const field = d?.field === 'email' ? 'emailUser' : d?.field;
        if (field && field in data) setError(field as keyof RegisterForm, { message: err.message });
      }
      setServerError(err?.message || 'Registration failed. Please try again.');
    }
  });

  const verify = useAsyncAction(async () => {
    setCodeError(null);
    try {
      await authService.verifyEmail(submitted!.email, code);
      setSubmitted({ email: submitted!.email, verified: true });
    } catch (err: any) {
      setCodeError(err?.message || 'That code could not be verified.');
    }
  });

  const resend = useAsyncAction(async () => {
    setCodeError(null);
    await authService.resendVerification(submitted!.email).catch(() => null);
    setResendIn(60);
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

  const renderForm = () => (
    <>
      {serverError && (
        <div style={{ marginBottom: '1rem' }}>
          <Alert variant="danger" title="Registration failed" onDismiss={() => setServerError(null)}>
            {serverError}
          </Alert>
        </div>
      )}

      <InstitutionPicker />
      <form onSubmit={handleSubmit((data) => submit.run(data))} noValidate className="register-form">
        <fieldset className="register-section">
          <legend className="register-section-title">
            <span className="register-section-num">1</span> Personal details
          </legend>
          <div className="register-grid">
            <Input
              label="Full name"
              placeholder="e.g. Dr. R. Priya"
              autoComplete="name"
              prefixIcon={<i className="bi bi-person" aria-hidden="true" />}
              error={errors.name?.message}
              {...register('name')}
            />
            <Input
              label="Mobile number (optional)"
              type="tel"
              inputMode="tel"
              placeholder="98XXXXXXXX"
              autoComplete="tel"
              prefixIcon={<i className="bi bi-phone" aria-hidden="true" />}
              error={errors.phone?.message}
              {...register('phone')}
            />
          </div>
        </fieldset>

        <fieldset className="register-section">
          <legend className="register-section-title">
            <span className="register-section-num">2</span> Work details
          </legend>
          <Input
            label="Employee ID"
            placeholder="e.g. KPR2140"
            autoComplete="off"
            prefixIcon={<i className="bi bi-person-vcard" aria-hidden="true" />}
            hint="As printed on your staff ID card"
            error={errors.employeeId?.message}
            {...register('employeeId')}
          />
          <div className="register-grid">
            <Select
              label="Department"
              placeholder="Select department"
              options={(options?.departments || []).map((d) => ({ value: d._id, label: `${d.name} (${d.code})` }))}
              error={errors.departmentId?.message}
              {...register('departmentId')}
            />
            <Select
              label="Designation"
              placeholder="Select designation"
              options={(options?.designations || []).map((d) => ({ value: d, label: d }))}
              error={errors.designation?.message}
              {...register('designation')}
            />
          </div>
        </fieldset>

        <fieldset className="register-section">
          <legend className="register-section-title">
            <span className="register-section-num">3</span> Account
          </legend>
          <Input
            label="College email"
            placeholder="firstname.lastname"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            prefixIcon={<i className="bi bi-envelope" aria-hidden="true" />}
            suffixAction={<span className="register-email-domain">@{emailDomain}</span>}
            hint="You'll sign in with this email"
            error={errors.emailUser?.message}
            {...register('emailUser')}
          />
          <div className="register-grid">
            <Input
              label="Password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              prefixIcon={<i className="bi bi-lock" aria-hidden="true" />}
              suffixAction={passwordToggle}
              error={errors.password?.message}
              {...register('password')}
            />
            <Input
              label="Confirm password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              prefixIcon={<i className="bi bi-lock" aria-hidden="true" />}
              error={errors.confirmPassword?.message}
              {...register('confirmPassword')}
            />
          </div>
          <PasswordChecklist password={password} confirmPassword={confirmPassword} />
        </fieldset>

        <button type="submit" disabled={submit.isPending} className="login-submit-btn">
          {submit.isPending ? (
            <>
              <span className="spinner spinner-sm" aria-hidden="true" />
              <span>Submitting registration...</span>
            </>
          ) : (
            <>
              <i className="bi bi-person-plus" aria-hidden="true" />
              <span>Create account</span>
            </>
          )}
        </button>
        <p className="register-fineprint">
          <i className="bi bi-info-circle" aria-hidden="true" /> We will email a code to confirm your address. You can
          sign in after an administrator approves your registration.
        </p>
      </form>
    </>
  );

  return (
    <div className="login-page-container">
      <div className="login-split-layout register-layout">
        {/* Left: what registration involves */}
        <aside className="login-brand-panel register-brand" aria-label="How registration works">
          <div>
            <div className="register-brand-badge">
              <BrandMark size={22} />
              <span><InstitutionName fallback={PRODUCT_NAME} /></span>
            </div>
            <h1 className="login-brand-title">Join the Faculty Management System</h1>
            <p className="login-brand-desc">
              Create your account to manage your profile, publications, projects, leave, attendance and appraisals in one place.
            </p>

            <ol className="register-brand-steps">
              {STEPS.map((step, i) => (
                <li key={step.title}>
                  <span className="register-brand-step-icon" aria-hidden="true">
                    <i className={`bi ${step.icon}`} />
                  </span>
                  <span>
                    <strong>
                      {i + 1}. {step.title}
                    </strong>
                    <span>{step.text}</span>
                  </span>
                </li>
              ))}
            </ol>
          </div>

          <div className="register-brand-need">
            <div className="register-brand-need-title">Keep these ready</div>
            <div className="register-brand-chips">
              <span><i className="bi bi-person-vcard" aria-hidden="true" /> Employee ID</span>
              <span><i className="bi bi-envelope-at" aria-hidden="true" /> @{emailDomain} email</span>
              <span><i className="bi bi-building" aria-hidden="true" /> Department</span>
            </div>
            <div className="register-brand-help">
              Need help? Contact <InstitutionContact />
            </div>
          </div>
        </aside>

        {/* Right: form / status */}
        <div className="login-auth-panel register-panel">
          <div className="login-panel-header" style={{ marginBottom: '1.25rem' }}>
            <h2 className="login-panel-title">
              {!submitted ? 'Create your account' : submitted.verified ? 'Registration submitted' : 'Confirm your email'}
            </h2>
            <p className="login-panel-desc">
              {!submitted
                ? 'For staff with a college email address — takes about two minutes.'
                : submitted.verified
                  ? 'Your account is waiting for administrator approval.'
                  : `We sent a 6-digit code to ${submitted.email}.`}
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

          {submitted && !submitted.verified && (
            <form
              className="register-form"
              noValidate
              onSubmit={(e) => {
                e.preventDefault();
                verify.run();
              }}
            >
              <Input
                label="Verification code"
                inputMode="numeric"
                autoComplete="one-time-code"
                autoFocus
                maxLength={6}
                placeholder="123456"
                prefixIcon={<i className="bi bi-envelope-check" aria-hidden="true" />}
                hint="The code expires in 15 minutes. Check the spam folder if you can't find it."
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                error={codeError ?? undefined}
                style={{ letterSpacing: '0.35em', fontWeight: 600 }}
              />
              <button type="submit" className="login-submit-btn" disabled={verify.isPending || code.length !== 6}>
                {verify.isPending ? (
                  <>
                    <span className="spinner spinner-sm" aria-hidden="true" />
                    <span>Checking...</span>
                  </>
                ) : (
                  <>
                    <i className="bi bi-check2-circle" aria-hidden="true" />
                    <span>Confirm email</span>
                  </>
                )}
              </button>
              <p className="register-fineprint">
                Didn&apos;t get it?{' '}
                <button
                  type="button"
                  className="login-forgot-btn"
                  disabled={resendIn > 0 || resend.isPending}
                  onClick={() => resend.run()}
                >
                  {resendIn > 0 ? `Send a new code in ${resendIn}s` : 'Send a new code'}
                </button>
              </p>
            </form>
          )}

          {submitted?.verified && (
            <div className="register-success">
              <div className="register-success-icon" aria-hidden="true">
                <i className="bi bi-hourglass-split" />
              </div>
              <ol className="register-steps">
                <li className="is-done">
                  <strong>Email confirmed</strong>
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

          {options?.enabled && !submitted && renderForm()}

          <p className="register-footer">
            Already have an account? <Link to={ROUTES.LOGIN}>Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
};
