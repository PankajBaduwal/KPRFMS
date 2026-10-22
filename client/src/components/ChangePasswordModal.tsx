import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Modal } from './Modal';
import { Button } from './Button';
import { Input } from './Input';
import { Alert } from './Alert';
import { useToast } from './Toast';
import { authService } from '../services/auth.service';
import { useAsyncAction } from '../hooks/useAsyncAction';

// Mirrors the server-side policy in server/src/validators/auth.validator.ts
const PASSWORD_POLICY = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z
      .string()
      .min(8, 'Must be at least 8 characters')
      .regex(PASSWORD_POLICY, 'Use upper & lower case letters, a number and one of @$!%*?&'),
    confirmPassword: z.string().min(1, 'Please confirm the new password'),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })
  .refine((d) => d.newPassword !== d.currentPassword, {
    message: 'New password must differ from the current one',
    path: ['newPassword'],
  });

type ChangePasswordForm = z.infer<typeof changePasswordSchema>;

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({ isOpen, onClose }) => {
  const { addToast } = useToast();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ChangePasswordForm>({ resolver: zodResolver(changePasswordSchema) });

  const handleClose = () => {
    reset();
    setServerError(null);
    onClose();
  };

  const submit = useAsyncAction(async (data: ChangePasswordForm) => {
    setServerError(null);
    try {
      await authService.changePassword({
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
      });
      addToast('Password changed. Other signed-in devices have been signed out.', 'success');
      handleClose();
    } catch (err: any) {
      setServerError(err?.message || 'Failed to change password.');
    }
  });
  const loading = submit.isPending;

  return (
    <Modal isOpen={isOpen} onClose={loading ? () => {} : handleClose} title="Change Password" size="sm">
      <form
        onSubmit={handleSubmit((data) => submit.run(data))}
        noValidate
        style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}
      >
        {serverError && <Alert variant="danger">{serverError}</Alert>}

        <Input
          label="Current Password"
          type="password"
          autoComplete="current-password"
          error={errors.currentPassword?.message}
          {...register('currentPassword')}
        />
        <Input
          label="New Password"
          type="password"
          autoComplete="new-password"
          hint="At least 8 characters with upper & lower case, a number and one of @$!%*?&"
          error={errors.newPassword?.message}
          {...register('newPassword')}
        />
        <Input
          label="Confirm New Password"
          type="password"
          autoComplete="new-password"
          error={errors.confirmPassword?.message}
          {...register('confirmPassword')}
        />

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
          <Button type="button" variant="outline" onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" loading={loading}>
            {loading ? 'Updating...' : 'Update Password'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
