import { useState, useEffect } from 'react';
import { devError } from '@/lib/logger';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Json } from '@/integrations/supabase/types';
import { useToast } from '@/hooks/use-toast';

type DashboardType = 'jay' | 'may' | 'cece';

interface DashboardLayoutConfig {
  selectedWidgets: string[];
}

interface FeatureFlags {
  training_enabled?: boolean;
}

export function useDashboardLayout(
  dashboardType: DashboardType,
  defaultWidgets: string[],
  availableWidgetsList: string[],
  featureFlags: FeatureFlags = {}
) {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [selectedWidgets, setSelectedWidgets] = useState<string[]>(defaultWidgets);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Filter available widgets based on feature flags
  const availableWidgets = availableWidgetsList.filter(widget => {
    if (widget === 'training') {
      return featureFlags.training_enabled === true;
    }
    return true;
  });

  // Sanitize selected widgets to only include available ones
  const sanitizeWidgets = (widgets: string[]): string[] => {
    return widgets.filter(w => availableWidgets.includes(w));
  };

  // Load layout from database
  useEffect(() => {
    const loadLayout = async () => {
      if (!profile?.organization_id || !profile?.id) {
        setIsLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('dashboard_layouts')
          .select('layout')
          .eq('organization_id', profile.organization_id)
          .eq('user_id', profile.id)
          .eq('dashboard_type', dashboardType)
          .maybeSingle();

        if (error) throw error;

        if (data?.layout) {
          const config = data.layout as unknown as DashboardLayoutConfig;
          const sanitized = sanitizeWidgets(config.selectedWidgets || defaultWidgets);
          setSelectedWidgets(sanitized);
        } else {
          setSelectedWidgets(sanitizeWidgets(defaultWidgets));
        }
      } catch (error) {
        devError('Error loading dashboard layout:', error);
        setSelectedWidgets(sanitizeWidgets(defaultWidgets));
      } finally {
        setIsLoading(false);
      }
    };

    loadLayout();
  }, [profile?.organization_id, profile?.id, dashboardType]);

  // Save layout to database
  const saveLayout = async () => {
    if (!profile?.organization_id || !profile?.id) return;

    setIsSaving(true);
    try {
      const layoutData: DashboardLayoutConfig = {
        selectedWidgets: sanitizeWidgets(selectedWidgets),
      };

      const { error } = await supabase
        .from('dashboard_layouts')
        .upsert({
          organization_id: profile.organization_id,
          user_id: profile.id,
          dashboard_type: dashboardType,
          layout: layoutData as unknown as Json,
        }, {
          onConflict: 'organization_id,user_id,dashboard_type'
        });

      if (error) throw error;

      toast({
        title: "Layout saved",
        description: "Your dashboard layout has been saved successfully.",
      });
      setIsEditMode(false);
    } catch (error) {
      devError('Error saving dashboard layout:', error);
      toast({
        title: "Error saving layout",
        description: "Failed to save your dashboard layout. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Reset to default layout
  const resetLayout = async () => {
    if (!profile?.organization_id || !profile?.id) return;

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('dashboard_layouts')
        .delete()
        .eq('organization_id', profile.organization_id)
        .eq('user_id', profile.id)
        .eq('dashboard_type', dashboardType);

      if (error) throw error;

      setSelectedWidgets(sanitizeWidgets(defaultWidgets));
      toast({
        title: "Layout reset",
        description: "Your dashboard layout has been reset to default.",
      });
      setIsEditMode(false);
    } catch (error) {
      devError('Error resetting dashboard layout:', error);
      toast({
        title: "Error resetting layout",
        description: "Failed to reset your dashboard layout. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Toggle widget selection
  const toggleWidget = (widget: string) => {
    setSelectedWidgets(prev => {
      if (prev.includes(widget)) {
        return prev.filter(w => w !== widget);
      } else {
        return [...prev, widget];
      }
    });
  };

  return {
    selectedWidgets,
    availableWidgets,
    isEditMode,
    setIsEditMode,
    isSaving,
    isLoading,
    saveLayout,
    resetLayout,
    toggleWidget,
  };
}
