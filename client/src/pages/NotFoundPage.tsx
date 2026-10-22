import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components';
import { ROUTES } from '../constants/routes';

export const NotFoundPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="state-container" style={{ minHeight: '60vh' }}>
      <div className="state-icon" style={{ color: 'var(--color-primary)' }}>
        <i className="bi bi-compass" />
      </div>
      <h1 className="state-title" style={{ fontSize: '1.5rem', marginBottom: 'var(--space-2)' }}>
        404 — Page Not Found
      </h1>
      <p className="state-message" style={{ marginBottom: 'var(--space-6)' }}>
        The requested university portal address or resource is not available on this server.
      </p>
      <Button variant="primary" onClick={() => navigate(ROUTES.HOME)}>
        Back to Overview
      </Button>
    </div>
  );
};
