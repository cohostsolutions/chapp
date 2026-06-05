import { useState } from 'react';
import { devError } from '@/lib/logger';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, SubmitHandler } from 'react-hook-form';
import { ZodSchema } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';

export interface GenericFormDialogProps<T extends ZodSchema> {
  formSchema: T;
  title: string;
  description?: string;
  triggerLabel: string;
  triggerIcon?: React.ReactNode;
  onSubmit: SubmitHandler<any>;
  isLoading?: boolean;
  fields?: FormFieldConfig[];
  submitLabel?: string;
}

export interface FormFieldConfig {
  name: string;
  label: string;
  description?: string;
  type: 'text' | 'email' | 'phone' | 'number' | 'date' | 'datetime-local' | 'textarea' | 'select' | 'checkbox' | 'multi-select';
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  selectOptions?: Array<{ value: string; label: string }>;
  min?: number;
  max?: number;
  step?: number;
  pattern?: string;
}

export function GenericFormDialog<T extends ZodSchema>({
  formSchema,
  title,
  description,
  triggerLabel,
  triggerIcon,
  onSubmit,
  isLoading = false,
  fields,
  submitLabel = 'Create',
}: GenericFormDialogProps<T>) {
  const [open, setOpen] = useState(false);

  const form = useForm({
    resolver: zodResolver(formSchema),
    mode: 'onChange',
  });

  const handleSubmit = async (data: any) => {
    try {
      await onSubmit(data);
      form.reset();
      setOpen(false);
    } catch (error) {
      devError('Form submission error:', error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="default"
          size="sm"
          className="gap-2"
          disabled={isLoading}
        >
          {triggerIcon}
          {triggerLabel}
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            {/* Render fields based on config or infer from schema */}
            {fields && fields.length > 0 ? (
              fields.map((field) => (
                <FormField
                  key={field.name}
                  control={form.control}
                  name={field.name}
                  render={({ field: fieldProps }) => (
                    <FormItem>
                      <FormLabel>{field.label}</FormLabel>
                      <FormControl>
                        {field.type === 'textarea' && (
                          <Textarea
                            placeholder={field.placeholder}
                            disabled={field.disabled || isLoading}
                            {...fieldProps}
                          />
                        )}
                        {field.type === 'select' && (
                          <Select
                            value={fieldProps.value || ''}
                            onValueChange={fieldProps.onChange}
                            disabled={field.disabled || isLoading}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder={field.placeholder} />
                            </SelectTrigger>
                            <SelectContent>
                              {field.selectOptions?.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                        {field.type === 'checkbox' && (
                          <div className="flex items-center gap-2">
                            <Checkbox
                              checked={fieldProps.value || false}
                              onCheckedChange={fieldProps.onChange}
                              disabled={field.disabled || isLoading}
                            />
                            <span className="text-sm">{field.label}</span>
                          </div>
                        )}
                        {field.type === 'multi-select' && (
                          <div className="space-y-2">
                            <div className="flex flex-wrap gap-2">
                              {(fieldProps.value || []).map((value: string) => (
                                <Badge
                                  key={value}
                                  variant="secondary"
                                  className="cursor-pointer"
                                  onClick={() => {
                                    const newValues = (fieldProps.value || []).filter(
                                      (v: string) => v !== value
                                    );
                                    fieldProps.onChange(newValues);
                                  }}
                                >
                                  {field.selectOptions?.find((o) => o.value === value)?.label}
                                  <span className="ml-1">×</span>
                                </Badge>
                              ))}
                            </div>
                            <Select
                              value=""
                              onValueChange={(value) => {
                                const currentValues = fieldProps.value || [];
                                if (!currentValues.includes(value)) {
                                  fieldProps.onChange([...currentValues, value]);
                                }
                              }}
                              disabled={field.disabled || isLoading}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder={field.placeholder} />
                              </SelectTrigger>
                              <SelectContent>
                                {field.selectOptions?.map((option) => (
                                  <SelectItem key={option.value} value={option.value}>
                                    {option.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                        {!['textarea', 'select', 'checkbox', 'multi-select'].includes(
                          field.type
                        ) && (
                          <Input
                            type={field.type}
                            placeholder={field.placeholder}
                            disabled={field.disabled || isLoading}
                            min={field.min}
                            max={field.max}
                            step={field.step}
                            pattern={field.pattern}
                            {...fieldProps}
                          />
                        )}
                      </FormControl>
                      {field.description && (
                        <FormDescription>{field.description}</FormDescription>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ))
            ) : (
              <p className="text-sm text-muted-foreground">
                No fields configured for this form
              </p>
            )}

            <div className="flex gap-2 justify-end pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? 'Creating...' : submitLabel}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
