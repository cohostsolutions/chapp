import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Check } from 'lucide-react';
import { LucideIcon } from 'lucide-react';

interface FeatureDetail {
  id: string;
  title: string;
  icon: LucideIcon;
  description: string;
  benefits: string[];
  details: string;
}

interface FeatureDetailDialogProps {
  feature: FeatureDetail | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function FeatureDetailDialog({ feature, open, onOpenChange }: FeatureDetailDialogProps) {
  if (!feature) return null;
  
  const Icon = feature.icon;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center">
              <Icon className="w-6 h-6 text-white" />
            </div>
            <div>
              <DialogTitle className="text-xl">{feature.title}</DialogTitle>
            </div>
          </div>
          <DialogDescription className="text-base">
            {feature.description}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6 mt-4">
          <div>
            <h4 className="text-sm font-semibold text-foreground mb-3">Key Benefits</h4>
            <ul className="space-y-2">
              {feature.benefits.map((benefit, index) => (
                <li key={index} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  <span>{benefit}</span>
                </li>
              ))}
            </ul>
          </div>
          
          <div className="p-4 rounded-xl bg-muted/50">
            <h4 className="text-sm font-semibold text-foreground mb-2">How It Works</h4>
            <p className="text-sm text-muted-foreground">{feature.details}</p>
          </div>
        </div>
        
        <div className="mt-6">
          <Button className="w-full" variant="glow" onClick={() => onOpenChange(false)}>
            Got It
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
