import { useCallback, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useCreateSale } from '@/hooks/useCreateSale';
import { GenericFormDialog, FormFieldConfig } from '@/components/shared/GenericFormDialog';
import { saleSchema } from '@/lib/validations';
import { Briefcase } from 'lucide-react';

export interface Offering {
  id: string;
  name: string;
  description?: string;
}

export interface CreateSaleDialogProps {
  offerings: Offering[];
  isLoading?: boolean;
  onSuccess?: () => void;
}

export function CreateSaleDialog({
  offerings,
  isLoading = false,
  onSuccess,
}: CreateSaleDialogProps) {
  const { toast } = useToast();
  const { createSale, isLoading: isCreating } = useCreateSale();

  // Build form fields with dynamic offering options
  const formFields: FormFieldConfig[] = useMemo(
    () => [
      {
        name: 'name',
        label: 'Sales Lead Name',
        placeholder: 'Enter lead name',
        type: 'text',
        required: true,
      },
      {
        name: 'temperature',
        label: 'Lead Temperature',
        type: 'select',
        required: true,
        selectOptions: [
          { value: 'cold', label: '❄️ Cold' },
          { value: 'warm', label: '🔥 Warm' },
          { value: 'hot', label: '🌡️ Hot' },
        ],
      },
      {
        name: 'selectedOfferings',
        label: 'Offerings',
        type: 'multi-select',
        placeholder: 'Select offerings for this lead',
        selectOptions: offerings.map((offering) => ({
          value: offering.id,
          label: offering.name,
        })),
      },
      {
        name: 'notes',
        label: 'Notes',
        placeholder: 'Any additional information?',
        type: 'textarea',
      },
    ],
    [offerings]
  );

  const handleSubmit = useCallback(
    async (formData: any) => {
      const saleData = {
        name: formData.name,
        temperature: formData.temperature,
        selectedOfferings: formData.selectedOfferings || [],
        notes: formData.notes || null,
      };

      const result = await createSale(saleData);
      if (result) {
        onSuccess?.();
      }
    },
    [createSale, onSuccess]
  );

  return (
    <GenericFormDialog
      formSchema={saleSchema}
      title="New Sale"
      description="Create a new sales lead with offering selection"
      triggerLabel="New Sale"
      triggerIcon={<Briefcase className="w-4 h-4" />}
      fields={formFields}
      onSubmit={handleSubmit}
      isLoading={isCreating || isLoading}
      submitLabel="Create Sale"
    />
  );
}
