import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from './Button';
import { Input } from './Input';
import { Alert } from './Alert';
import { authService } from '../services/auth.service';
import { useAuthStore } from '../stores/authStore';
import { PRODUCT_MARK, PRODUCT_NAME } from '../config/brand';

// Mirrors the server-side policy in server/src/validators/auth.validator.ts
const PASSWORD_POLICY = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

const schema = z
  .object({
    currentPassword: z.string().min(1, 'Enter the one-time password from your email'),
    newPassword: z.string().min(8, 'Must be at least 8 characters').regex(PASSWORD_POLICY, 'Use upper & lower case letters, a number and one of @$!%*?&'),
    confirmPassword: z.string().min(1, 'Please confirm your new password'),
  })
  .refine((d) => d.newPassword === d.confirmPassword, { message: 'Passwords do not match', path: ['confirmPassword'] })
  .refine((d) => d.newPassword !== d.currentPassword, { message: 'Choose a password different from the one-time password', path: ['newPassword'] });

type Form = z.infer<typeof schema>;

/**
 * Shown instead of the app to someone who signed in with an emailed one-time password.
 * The server refuses every other request until they choose their own password.
 */
export const ForcedPasswordChange: React.FC = () => {
  const { user, logout, setSessionUser } = useAuthStore();
  const [serverError, setServerError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Form>({ resolver: zodResolver(schema) });

  const submit = async (data: Form) => {
    setServerError(null);
    setSaving(true);
    try {
      await authService.changePassword({ currentPassword: data.currentPassword, newPassword: data.newPassword });
      // The session now reports mustChangePassword: false, which opens the app
      setSessionUser(await authService.getMe());
    } catch (err: any) {
      setServerError(err?.message || 'Your password could not be changed.');
      setSaving(false);
    }
  };

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 16px',
        background: 'linear-gradient(180deg, #EAF1FA 0%, #F7F9FC 100%)',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '440px',
          background: '#fff',
          border: '1px solid #E3EAF3',
          borderRadius: '16px',
          boxShadow: '0 20px 50px -24px rgba(16, 42, 86, 0.35)',
          padding: '28px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px' }}>
          <img src={PRODUCT_MARK} alt="" width={32} height={32} />
          <strong style={{ color: '#102A56' }}>{PRODUCT_NAME}</strong>
        </div>
        <h1 style={{ fontSize: '1.35rem', margin: '0 0 6px', color: '#102A56' }}>Choose your own password</h1>
        <p style={{ margin: '0 0 18px', color: '#5B6B82', fontSize: '0.92rem', lineHeight: 1.55 }}>
          Welcome{user?.name ? `, ${user.name}` : ''}. You signed in with a one-time password from your email. Set a password only you know to continue.
        </p>
        <form onSubmit={handleSubmit(submit)} noValidate style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {serverError && <Alert variant="danger">{serverError}</Alert>}
          <Input label="One-time password (from your email)" type="password" autoComplete="current-password" error={errors.currentPassword?.message} {...register('currentPassword')} />
          <Input
            label="New password"
            type="password"
            autoComplete="new-password"
            hint="At least 8 characters with upper & lower case, a number and one of @$!%*?&"
            error={errors.newPassword?.message}
            {...register('newPassword')}
          />
          <Input label="Confirm new password" type="password" autoComplete="new-password" error={errors.confirmPassword?.message} {...register('confirmPassword')} />
          <Button type="submit" loading={saving} style={{ marginTop: '4px' }}>
            {saving ? 'Saving…' : 'Save password and continue'}
          </Button>
          <Button type="button" variant="outline" onClick={() => logout()} disabled={saving}>
            Sign out
          </Button>
        </form>
      </div>
    </main>
  );
};
