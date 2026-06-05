import { useQuery } from '@tanstack/react-query';
import { fetchOrganizationTraining, fetchTrainingAnalytics } from '@/lib/training/api';
import type { TrainingAnalytics } from '@/lib/training/types';

interface DashboardTrainingData {
  trainingEnabled: boolean;
  trainingStats: TrainingAnalytics | null;
}

export function useDashboardTraining(organizationId?: string | null, enabled: boolean = true) {
  return useQuery({
    queryKey: ['dashboard-training', organizationId],
    enabled: enabled && !!organizationId,
    queryFn: async (): Promise<DashboardTrainingData> => {
      const org = await fetchOrganizationTraining(organizationId!);
      const trainingEnabled = org?.training_enabled ?? false;

      if (!trainingEnabled) {
        return {
          trainingEnabled: false,
          trainingStats: null,
        };
      }

      const trainingStats = await fetchTrainingAnalytics(organizationId!);

      return {
        trainingEnabled,
        trainingStats,
      };
    },
    staleTime: 60000,
  });
}