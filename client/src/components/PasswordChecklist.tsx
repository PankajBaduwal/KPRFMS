import React from 'react';
import { PASSWORD_RULES } from '../utils/passwordPolicy';

/** Live checklist of the password rules (styles in login.css). */
export const PasswordChecklist: React.FC<{ password: string; confirmPassword: string }> = ({ password, confirmPassword }) => {
  const matches = Boolean(confirmPassword) && confirmPassword === password;
  return (
    <ul className="register-password-rules" aria-label="Password requirements">
      {PASSWORD_RULES.map((rule) => {
        const ok = rule.test(password);
        return (
          <li key={rule.label} className={ok ? 'is-met' : ''}>
            <i className={`bi ${ok ? 'bi-check-circle-fill' : 'bi-circle'}`} aria-hidden="true" />
            {rule.label}
          </li>
        );
      })}
      <li className={matches ? 'is-met' : ''}>
        <i className={`bi ${matches ? 'bi-check-circle-fill' : 'bi-circle'}`} aria-hidden="true" />
        Passwords match
      </li>
    </ul>
  );
};
