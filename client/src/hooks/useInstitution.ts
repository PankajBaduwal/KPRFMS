import { useQuery } from '@tanstack/react-query';
import { apiGet } from '../api/client';
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
    queryFn: async () => (await apiGet<InstitutionBranding>('/public/institution')).data,
    staleTime: 5 * 60_000,
  });
  return (code && data) || FALLBACK;
}
