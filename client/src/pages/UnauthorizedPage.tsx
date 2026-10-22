import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Badge, Modal } from '../components';
import { ROUTES } from '../constants/routes';
import { useAuthStore } from '../stores/authStore';
import { ROLE_LABELS } from '../constants/roles';

export const UnauthorizedPage: React.FC = () => {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [supportModalOpen, setSupportModalOpen] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState(false);

  const handleSwitchAccount = async () => {
    await logout();
    navigate(ROUTES.LOGIN);
  };

  const handleCopyEmail = () => {
    navigator.clipboard.writeText('helpdesk@kpriet.ac.in').then(() => {
      setCopiedEmail(true);
      setTimeout(() => setCopiedEmail(false), 2000);
    });
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '75vh',
        padding: 'var(--space-6) var(--space-4)',
      }}
    >
      <div
        className="card-custom"
        style={{
          maxWidth: '540px',
          width: '100%',
          textAlign: 'center',
          boxShadow: 'var(--shadow-md)',
          padding: 'var(--space-8) var(--space-6)',
        }}
        role="alert"
      >
        {/* Security Shield Icon */}
        <div
          style={{
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            backgroundColor: 'var(--color-warning-bg)',
            border: '1px solid var(--color-warning-border)',
            color: 'var(--color-warning)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.75rem',
            marginBottom: 'var(--space-4)',
          }}
          aria-hidden="true"
        >
          <i className="bi bi-shield-lock-fill" />
        </div>

        {/* Title & Hierarchy */}
        <div style={{ marginBottom: 'var(--space-2)' }}>
          <span
            style={{
              fontSize: 'var(--font-size-xs)',
              fontWeight: 'var(--font-weight-semibold)',
              color: 'var(--color-warning)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            Security Compliance &bull; Error 403
          </span>
        </div>

        <h1
          style={{
            fontSize: 'var(--font-size-xl)',
            fontWeight: 'var(--font-weight-bold)',
            color: 'var(--color-text)',
            marginBottom: 'var(--space-3)',
          }}
        >
          Institutional Access Restricted
        </h1>

        <p
          style={{
            fontSize: 'var(--font-size-sm)',
            color: 'var(--color-text-secondary)',
            lineHeight: 1.5,
            marginBottom: 'var(--space-6)',
          }}
        >
          You do not possess the required institutional authorization level to access this confidential resource or administrative console.
        </p>

        {/* Current Identity & Role Diagnostic Panel */}
        {user ? (
          <div
            style={{
              backgroundColor: 'var(--color-background)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              padding: 'var(--space-4)',
              marginBottom: 'var(--space-6)',
              textAlign: 'left',
              fontSize: 'var(--font-size-xs)',
            }}
          >
            <div style={{ fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-text)', marginBottom: 'var(--space-1)' }}>
              Current Active Session
            </div>
            <div style={{ color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
              <span>
                <strong>{user.name}</strong> ({user.employeeId}) &bull; {user.designation || 'Institutional Faculty'}
              </span>
              <Badge variant="neutral">
                {ROLE_LABELS[user.role] || user.role}
              </Badge>
            </div>
          </div>
        ) : (
          <div
            style={{
              backgroundColor: 'var(--color-background)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              padding: 'var(--space-3)',
              marginBottom: 'var(--space-6)',
              fontSize: 'var(--font-size-xs)',
              color: 'var(--color-text-secondary)',
            }}
          >
            <i className="bi bi-info-circle me-1" aria-hidden="true" />
            No active institutional session detected. Please sign in to verify your role permissions.
          </div>
        )}

        {/* Action Buttons */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-2)',
          }}
        >
          {user ? (
            <Button
              variant="primary"
              fullWidth
              icon={<i className="bi bi-house-door" />}
              onClick={() => navigate(ROUTES.PORTAL)}
            >
              Return to My Portal Dashboard
            </Button>
          ) : (
            <Button
              variant="primary"
              fullWidth
              icon={<i className="bi bi-box-arrow-in-right" />}
              onClick={() => navigate(ROUTES.LOGIN)}
            >
              Sign In with Institutional Account
            </Button>
          )}

          {user && (
            <Button
              variant="outline"
              fullWidth
              onClick={handleSwitchAccount}
              icon={<i className="bi bi-arrow-repeat" />}
            >
              Sign In with Different Account
            </Button>
          )}

          <Button
            variant="ghost"
            fullWidth
            onClick={() => setSupportModalOpen(true)}
            icon={<i className="bi bi-question-circle" />}
          >
            Request Role Access / Contact Admin
          </Button>
        </div>
      </div>

      {/* Role Delegation & Access Request Modal */}
      <Modal
        isOpen={supportModalOpen}
        onClose={() => setSupportModalOpen(false)}
        title="Role Access & Authorization Guidance"
        size="md"
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)' }}>
            <Button variant="outline" size="sm" onClick={() => setSupportModalOpen(false)}>
              Close
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={<i className={`bi ${copiedEmail ? 'bi-check2' : 'bi-clipboard'}`} />}
              onClick={handleCopyEmail}
            >
              {copiedEmail ? 'Copied' : 'Copy Helpdesk Email'}
            </Button>
          </div>
        }
      >
        <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text)' }}>
          <p style={{ marginBottom: 'var(--space-3)' }}>
            Access to institutional dashboards (Department Head Console, Dean Console, Principal Dashboard, System Admin) is governed by institutional role-based access control (RBAC).
          </p>

          <div
            style={{
              background: 'var(--color-background)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              padding: 'var(--space-4)',
              marginBottom: 'var(--space-4)',
              fontSize: 'var(--font-size-xs)',
            }}
          >
            <div style={{ fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-primary)', marginBottom: 'var(--space-1)' }}>
              How to Request Role Delegation
            </div>
            <p style={{ margin: 0, color: 'var(--color-text-secondary)' }}>
              If you have been appointed as an Acting Department Head, Coordinator, or Committee Member, your Department Head or Dean must grant temporary or permanent role delegation through the System Admin console.
            </p>
          </div>

          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
            <strong>Central Support:</strong> helpdesk@kpriet.ac.in &bull; Ext: 4101
          </div>
        </div>
      </Modal>
    </div>
  );
};
