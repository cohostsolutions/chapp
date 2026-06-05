import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { devError } from '@/lib/logger';
import type { OnboardingProgress } from '@/types/database';

// NOTE: The onboarding_progress table does not exist yet in the database schema.
// This implementation uses localStorage for onboarding state.

const ONBOARDING_STEPS = [
  {
    id: 'welcome',
    title: 'Welcome to AlCor Nexus',
    description: 'Let\'s get you set up with your CRM',
    component: 'WelcomeStep',
  },
  {
    id: 'organization',
    title: 'Organization Setup',
    description: 'Configure your organization settings',
    component: 'OrganizationStep',
  },
  {
    id: 'team',
    title: 'Add Team Members',
    description: 'Invite your team to collaborate',
    component: 'TeamStep',
  },
  {
    id: 'ai-config',
    title: 'AI Configuration',
    description: 'Set up your AI agent preferences',
    component: 'AIConfigStep',
  },
  {
    id: 'first-lead',
    title: 'Create Your First Lead',
    description: 'Add your first customer lead',
    component: 'FirstLeadStep',
  },
  {
    id: 'complete',
    title: 'You\'re All Set!',
    description: 'Start managing your leads',
    component: 'CompleteStep',
  },
];

const STORAGE_KEY = 'onboarding_progress';

function getStoredProgress(userId: string): OnboardingProgress | null {
  try {
    const stored = localStorage.getItem(`${STORAGE_KEY}_${userId}`);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

function setStoredProgress(userId: string, progress: OnboardingProgress) {
  try {
    localStorage.setItem(`${STORAGE_KEY}_${userId}`, JSON.stringify(progress));
  } catch (error) {
    devError('Failed to store onboarding progress:', error);
  }
}

export function useOnboardingProgress(userId: string) {
  return useQuery({
    queryKey: ['onboarding-progress', userId],
    queryFn: async () => {
      // Check localStorage first
      const stored = getStoredProgress(userId);
      if (stored) return stored;

      // Create new progress record
      const newProgress: OnboardingProgress = {
        id: crypto.randomUUID(),
        user_id: userId,
        completed_steps: [],
        current_step: 'welcome',
        is_completed: false,
        started_at: new Date().toISOString(),
        completed_at: null,
      };

      setStoredProgress(userId, newProgress);
      return newProgress;
    },
  });
}

export function useCompleteOnboardingStep() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, step }: { userId: string; step: string }) => {
      const progress = getStoredProgress(userId);
      if (!progress) throw new Error('Onboarding progress not found');

      const completedSteps = [...(progress.completed_steps || []), step];
      const currentStepIndex = ONBOARDING_STEPS.findIndex((s) => s.id === step);
      const nextStep = ONBOARDING_STEPS[currentStepIndex + 1]?.id || null;
      const isCompleted = currentStepIndex === ONBOARDING_STEPS.length - 1;

      const updatedProgress: OnboardingProgress = {
        ...progress,
        completed_steps: completedSteps,
        current_step: nextStep,
        is_completed: isCompleted,
        completed_at: isCompleted ? new Date().toISOString() : null,
      };

      setStoredProgress(userId, updatedProgress);
      return updatedProgress;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['onboarding-progress', variables.userId] });
    },
  });
}

export function useSkipOnboarding() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (userId: string) => {
      const progress = getStoredProgress(userId);
      if (!progress) throw new Error('Onboarding progress not found');

      const updatedProgress: OnboardingProgress = {
        ...progress,
        is_completed: true,
        completed_at: new Date().toISOString(),
      };

      setStoredProgress(userId, updatedProgress);
      return updatedProgress;
    },
    onSuccess: (_, userId) => {
      queryClient.invalidateQueries({ queryKey: ['onboarding-progress', userId] });
    },
  });
}

export { ONBOARDING_STEPS };
