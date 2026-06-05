import { RubricCategory, TrainingModule } from '@/lib/training/types';
import type { TemplateModule } from '@/components/training/ModuleTemplateLibrary';

export interface DraftModule {
  id?: string;
  title: string;
  description: string;
  industry: string;
  difficulty: string;
  persona: {
    name: string;
    mood: string;
    goals: string;
    constraints: string;
    background: string;
    ai_language?: string;
  };
  objectives: string;
  rubric: RubricCategory[];
  first_message_sender?: 'ai' | 'trainee';
  call_type?: 'cold_call' | 'warm_call';
}

export function createDefaultRubric(): RubricCategory[] {
  return [
    { id: 'empathy', name: 'Empathy', description: 'Acknowledges feelings', guidelines: ['Validate feelings'], weight: 1 },
    { id: 'clarity', name: 'Clarity', description: 'Gives clear steps', guidelines: ['Use simple steps'], weight: 1 },
  ];
}

export function createEmptyDraft(): DraftModule {
  return {
    title: '',
    description: '',
    industry: 'general',
    difficulty: 'medium',
    persona: { name: '', mood: 'neutral', goals: '', constraints: '', background: '', ai_language: 'en' },
    objectives: '',
    rubric: createDefaultRubric(),
    first_message_sender: 'ai',
    call_type: 'warm_call',
  };
}

export function createDraftFromModule(module: TrainingModule): DraftModule {
  const personaData = module.persona as unknown as {
    name?: string;
    mood?: string;
    goals?: string[];
    constraints?: string[];
    background?: string;
    ai_language?: string;
  } | undefined;

  return {
    id: module.id,
    title: module.title,
    description: module.description || '',
    industry: module.industry || 'general',
    difficulty: module.difficulty || 'medium',
    persona: {
      name: personaData?.name || '',
      mood: personaData?.mood || 'neutral',
      goals: personaData?.goals?.join(', ') || '',
      constraints: personaData?.constraints?.join(', ') || '',
      background: personaData?.background || '',
      ai_language: personaData?.ai_language || 'en',
    },
    objectives: (module.objectives || []).join('\n'),
    rubric: module.rubric || [],
    first_message_sender: module.first_message_sender || 'ai',
    call_type: module.call_type || 'warm_call',
  };
}

export function createDraftFromTemplate(template: TemplateModule): DraftModule {
  return {
    title: template.title,
    description: template.description,
    industry: template.industry,
    difficulty: template.difficulty,
    persona: {
      ...template.persona,
      ai_language: 'en',
    },
    objectives: template.objectives.join('\n'),
    rubric: template.rubric,
    first_message_sender: 'ai',
    call_type: 'warm_call',
  };
}