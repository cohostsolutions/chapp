import { useState } from 'react';
import { devError } from '@/lib/logger';
import {
  ResponsiveDialog,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogBody,
  ResponsiveDialogFooter,
} from '@/components/shared/ResponsiveDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, UserPlus } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { FieldErrorText } from '@/components/shared/FieldErrorText';
import { createLeadSchema, validateWithSchema } from '@/lib/validations';
import { normalizePhoneNumber } from '@/lib/phone';
import { useOrganizationPhone } from '@/hooks/useOrganizationPhone';

interface AddLeadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLeadAdded: (lead: unknown) => void;
}

const sourceOptions = ['Facebook', 'Website', 'Referral', 'Instagram', 'Google Ads', 'WhatsApp', 'Other'];

export function AddLeadDialog({ open, onOpenChange, onLeadAdded }: AddLeadDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    source: '',
    notes: '',
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const { toast } = useToast();
  const { profile } = useAuth();
  const { defaultCountryCode, phonePlaceholder } = useOrganizationPhone();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFieldErrors({});
    
    const normalizedPhone = normalizePhoneNumber(formData.phone, defaultCountryCode);

    // Validate with zod schema
    const validation = validateWithSchema(createLeadSchema(defaultCountryCode), { ...formData, phone: normalizedPhone });
    
    if (validation.success === false) {
      // Parse errors into field-specific messages
      const errors: Record<string, string> = {};
      validation.errors.forEach(err => {
        const [field, ...messageParts] = err.split(': ');
        if (field && messageParts.length > 0) {
          errors[field] = messageParts.join(': ');
        }
      });
      setFieldErrors(errors);
      
      toast({
        title: "Validation Error",
        description: validation.errors[0] || "Please check the form fields",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const organizationId = profile?.organization_id;
      
      if (!organizationId) {
        throw new Error("No organization found");
      }

      const validatedData = { ...validation.data, phone: normalizedPhone };

      const { data, error } = await supabase
        .from('leads')
        .insert({
          name: validatedData.name,
          email: validatedData.email || null,
          phone: validatedData.phone || null,
          source: validatedData.source || null,
          notes: validatedData.notes || null,
          organization_id: organizationId,
          status: 'new',
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Lead Added",
        description: `${validatedData.name} has been added successfully`,
      });

      onLeadAdded(data);
      onOpenChange(false);
      setFormData({ name: '', email: '', phone: '', source: '', notes: '' });
      setFieldErrors({});
    } catch (error) {
      devError('Error adding lead:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to add lead",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear field error when user starts typing
    if (fieldErrors[field]) {
      setFieldErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const getFieldErrorId = (field: keyof typeof formData) => `${field}-error`;

  return (
    <ResponsiveDialog 
      open={open} 
      onOpenChange={onOpenChange}
      maxWidth="sm:max-w-[500px]"
      maxHeight="max-h-[70vh]"
      showCloseButton={false}
    >
      <ResponsiveDialogHeader>
        <ResponsiveDialogTitle className="flex items-center gap-2">
          <UserPlus className="w-5 h-5 text-primary" />
          Add New Lead
        </ResponsiveDialogTitle>
      </ResponsiveDialogHeader>
      
      <ResponsiveDialogBody>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name *</Label>
            <Input
              id="name"
              placeholder="Enter lead name"
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              error={!!fieldErrors.name}
              aria-describedby={fieldErrors.name ? getFieldErrorId('name') : undefined}
              required
            />
            <FieldErrorText id={getFieldErrorId('name')} message={fieldErrors.name} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="email@example.com"
                value={formData.email}
                onChange={(e) => handleChange('email', e.target.value)}
                error={!!fieldErrors.email}
                aria-describedby={fieldErrors.email ? getFieldErrorId('email') : undefined}
              />
              <FieldErrorText id={getFieldErrorId('email')} message={fieldErrors.email} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                type="tel"
                placeholder={phonePlaceholder}
                value={formData.phone}
                onChange={(e) => handleChange('phone', e.target.value)}
                error={!!fieldErrors.phone}
                aria-describedby={fieldErrors.phone ? getFieldErrorId('phone') : undefined}
              />
              <FieldErrorText id={getFieldErrorId('phone')} message={fieldErrors.phone} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="source">Source</Label>
            <Select value={formData.source} onValueChange={(value) => handleChange('source', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select lead source" />
              </SelectTrigger>
              <SelectContent className="z-[60]">
                {sourceOptions.map((source) => (
                  <SelectItem key={source} value={source}>
                    {source}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              placeholder="Add any notes about this lead..."
              value={formData.notes}
              onChange={(e) => handleChange('notes', e.target.value)}
              error={!!fieldErrors.notes}
              aria-describedby={fieldErrors.notes ? getFieldErrorId('notes') : undefined}
              rows={3}
            />
            <FieldErrorText id={getFieldErrorId('notes')} message={fieldErrors.notes} />
          </div>

          <ResponsiveDialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="glow" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Adding...
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4 mr-2" />
                  Add Lead
                </>
              )}
            </Button>
          </ResponsiveDialogFooter>
        </form>
      </ResponsiveDialogBody>
    </ResponsiveDialog>
  );
}
