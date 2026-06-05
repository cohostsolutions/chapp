import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar, Clock, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';

interface RequestDemoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prefilledPlan?: string;
}

export function RequestDemoDialog({ open, onOpenChange, prefilledPlan }: RequestDemoDialogProps) {
  const [step, setStep] = useState<'form' | 'schedule'>('form');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState({
    name: '',
    email: '',
    company: '',
    phone: '',
    plan: prefilledPlan || '',
    message: '',
    preferredDate: '',
    preferredTime: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (step === 'form') {
      setStep('schedule');
      return;
    }
    
    setIsSubmitting(true);
    
    // Simulate form submission
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    toast.success('Demo request submitted! Check your email for the calendar invite.');
    onOpenChange(false);
    setStep('form');
    setForm({
      name: '',
      email: '',
      company: '',
      phone: '',
      plan: '',
      message: '',
      preferredDate: '',
      preferredTime: '',
    });
    setIsSubmitting(false);
  };

  return (
    <Dialog open={open} onOpenChange={(open) => {
      onOpenChange(open);
      if (!open) setStep('form');
    }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary" />
            {step === 'form' ? 'Request a Demo' : 'Schedule Your Call'}
          </DialogTitle>
          <DialogDescription>
            {step === 'form' 
              ? 'Fill in your details and we\'ll show you how AlCor Nexus can transform your business.' 
              : 'Choose your preferred time for the demo call.'}
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          {step === 'form' ? (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="demo-name">Full Name *</Label>
                  <Input
                    id="demo-name"
                    value={form.name}
                    onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="John Doe"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="demo-email">Work Email *</Label>
                  <Input
                    id="demo-email"
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="john@company.com"
                    required
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="demo-company">Company Name *</Label>
                  <Input
                    id="demo-company"
                    value={form.company}
                    onChange={(e) => setForm(prev => ({ ...prev, company: e.target.value }))}
                    placeholder="Acme Inc."
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="demo-phone">Phone Number</Label>
                  <Input
                    id="demo-phone"
                    value={form.phone}
                    onChange={(e) => setForm(prev => ({ ...prev, phone: e.target.value }))}
                    placeholder="+1 234 567 8900"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="demo-plan">Interested Plan</Label>
                <Select
                  value={form.plan}
                  onValueChange={(value) => setForm(prev => ({ ...prev, plan: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a plan" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="jay">Jay - Sales Agent ($299/mo)</SelectItem>
                    <SelectItem value="may">May - Food Business ($249/mo)</SelectItem>
                    <SelectItem value="cece">Cece - Hotel Concierge ($349/mo)</SelectItem>
                    <SelectItem value="custom">Custom Build</SelectItem>
                    <SelectItem value="enterprise">Enterprise Solution</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="demo-message">What would you like to learn?</Label>
                <Textarea
                  id="demo-message"
                  value={form.message}
                  onChange={(e) => setForm(prev => ({ ...prev, message: e.target.value }))}
                  placeholder="Tell us about your use case and what you'd like to see in the demo..."
                  rows={3}
                />
              </div>
              
              <Button type="submit" className="w-full" variant="glow">
                Continue to Schedule
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </>
          ) : (
            <>
              <div className="p-4 rounded-xl bg-muted/50 mb-4">
                <p className="text-sm text-muted-foreground">
                  Demo for: <span className="text-foreground font-medium">{form.name}</span> at <span className="text-foreground font-medium">{form.company}</span>
                </p>
                {form.plan && (
                  <p className="text-sm text-primary mt-1">
                    Interested in: {form.plan === 'jay' ? 'Jay - Sales Agent' : 
                                    form.plan === 'may' ? 'May - Food Business' : 
                                    form.plan === 'cece' ? 'Cece - Hotel Concierge' :
                                    form.plan === 'custom' ? 'Custom Build' : 'Enterprise Solution'}
                  </p>
                )}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="demo-date">Preferred Date *</Label>
                <Input
                  id="demo-date"
                  type="date"
                  value={form.preferredDate}
                  onChange={(e) => setForm(prev => ({ ...prev, preferredDate: e.target.value }))}
                  min={new Date().toISOString().split('T')[0]}
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="demo-time">Preferred Time *</Label>
                <Select
                  value={form.preferredTime}
                  onValueChange={(value) => setForm(prev => ({ ...prev, preferredTime: value }))}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a time slot" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="9am">9:00 AM - 10:00 AM</SelectItem>
                    <SelectItem value="10am">10:00 AM - 11:00 AM</SelectItem>
                    <SelectItem value="11am">11:00 AM - 12:00 PM</SelectItem>
                    <SelectItem value="1pm">1:00 PM - 2:00 PM</SelectItem>
                    <SelectItem value="2pm">2:00 PM - 3:00 PM</SelectItem>
                    <SelectItem value="3pm">3:00 PM - 4:00 PM</SelectItem>
                    <SelectItem value="4pm">4:00 PM - 5:00 PM</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/10 text-sm">
                <Clock className="w-4 h-4 text-primary" />
                <span className="text-muted-foreground">Demo duration: ~30 minutes (PHT / GMT+8)</span>
              </div>
              
              <div className="flex gap-3">
                <Button 
                  type="button" 
                  variant="outline" 
                  className="flex-1"
                  onClick={() => setStep('form')}
                >
                  Back
                </Button>
                <Button 
                  type="submit" 
                  className="flex-1" 
                  variant="glow"
                  disabled={isSubmitting || !form.preferredDate || !form.preferredTime}
                >
                  {isSubmitting ? 'Scheduling...' : 'Schedule Demo'}
                </Button>
              </div>
            </>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}
