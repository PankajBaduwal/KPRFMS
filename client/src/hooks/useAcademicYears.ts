import { useQuery } from '@tanstack/react-query';
import { academicYearService } from '../services/academic-year.service';

/**
 * Academic years from the server (AcademicYear master, institution settings and
 * years already used by records). Never hardcode year lists in pages or forms.
 *
 * `currentYear` is '' until the server responds, so form defaults should be
 * applied once it becomes available.
 */
export function useAcademicYears() {
  const query = useQuery({
    queryKey: ['academic-years'],
    queryFn: academicYearService.getOptions,
  });

  const years = query.data?.academicYears ?? [];

  return {
    currentYear: query.data?.currentAcademicYear ?? '',
    years,
    options: years.map((y) => ({ value: y, label: y })),
    isLoading: query.isLoading,
  };
}
