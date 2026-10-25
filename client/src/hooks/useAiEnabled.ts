import { useQuery } from '@tanstack/react-query';
import { aiService } from '../services/ai.service';

/** True when the server has an AI key configured; AI buttons are hidden otherwise. */
export function useAiEnabled(): boolean {
  const { data } = useQuery({ queryKey: ['ai-status'], queryFn: aiService.status, staleTime: 10 * 60_000, retry: false });
  return Boolean(data?.enabled);
}
