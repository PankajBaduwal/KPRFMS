import React from 'react';
import { useInstitution } from '../hooks/useInstitution';

/** This college's name (or short code) from Admin > Settings; `fallback` until it loads. */
export const InstitutionName: React.FC<{ short?: boolean; fallback?: string }> = ({ short, fallback = 'your institution' }) => {
  const inst = useInstitution();
  return <>{(short ? inst.shortCode : inst.name) || fallback}</>;
};

/** The college's contact email from Admin > Settings as a mailto link, or `fallback` text when none is set. */
export const InstitutionContact: React.FC<{ fallback?: string }> = ({ fallback = 'your administrator' }) => {
  const { contactEmail } = useInstitution();
  return contactEmail ? <a href={`mailto:${contactEmail}`}>{contactEmail}</a> : <>{fallback}</>;
};

/** One line about the college (tagline · affiliation) from Admin > Settings; empty when neither is set. */
export const InstitutionDetails: React.FC = () => {
  const { tagline, affiliation } = useInstitution();
  return <>{[tagline, affiliation].filter(Boolean).join(' · ')}</>;
};
