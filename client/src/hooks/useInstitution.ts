import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiGet, API_BASE_URL } from '../api/client';
import { useInstitutionCode } from '../lib/institution';

export interface InstitutionBranding {
  productName: string;
  productFullName: string;
  name: string;
  shortCode: string;
  tagline: string;
  affiliation: string;
  logoUrl: string;
  websiteUrl: string;
  city: string;
  state: string;
  contactEmail: string;
  contactPhone: string;
  emailDomain: string;
  emailDomains: string[];
  address: string;
  accentColor: string;
  timezone: string;
  maintenanceMode: boolean;
  enabledModules: string[];
}

const FALLBACK: InstitutionBranding = {
  productName: 'FacultyCore',
  productFullName: 'FacultyCore Faculty Management System',
  name: '',
  shortCode: '',
  tagline: '',
  affiliation: '',
  logoUrl: '',
  websiteUrl: '',
  city: '',
  state: '',
  contactEmail: '',
  contactPhone: '',
  emailDomain: '',
  emailDomains: [],
  address: '',
  accentColor: '',
  timezone: '',
  maintenanceMode: false,
  enabledModules: [],
};

/**
 * This college's name, logo and contact details from Admin > Settings (public endpoint, so it
 * also works on the sign-in and home pages). Fields are '' until loaded; render accordingly.
 */
export function useInstitution(): InstitutionBranding {
  const code = useInstitutionCode();
  const { data } = useQuery({
    // Per institution, so switching institutions never shows the previous one's branding
    queryKey: ['institution-branding', code],
    enabled: Boolean(code),
    queryFn: async () => {
      const b = (await apiGet<InstitutionBranding>('/public/institution')).data;
      // An uploaded logo is served by the API, which may be on another origin
      return { ...b, logoUrl: b.logoUrl.startsWith('/api/') ? `${new URL(API_BASE_URL).origin}${b.logoUrl}` : b.logoUrl };
    },
    staleTime: 5 * 60_000,
  });
  const branding = (code && data) || FALLBACK;
  // The institution's accent colour (sidebar markers, sign-in panel); validated by the server
  useEffect(() => {
    const root = document.documentElement;
    if (/^#[0-9a-fA-F]{6}$/.test(branding.accentColor)) root.style.setProperty('--inst-accent', branding.accentColor);
    else root.style.removeProperty('--inst-accent');
  }, [branding.accentColor]);
  return branding;
}
