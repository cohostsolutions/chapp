import type React from 'react';
import { CalendarCheck, CheckSquare, ChevronRight, DollarSign, Loader2, MessageCircle, MessageCircleHeart, Save, ShoppingCart, Sparkles, Target, UserCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import type { SalesProcessConfig } from '@/hooks/useKnowledgeBaseSettings';

interface SalesProcessCardProps {
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  tab: string;
  onTabChange: (tab: string) => void;
  salesProcessConfig: SalesProcessConfig;
  updateSalesProcessField: <Section extends keyof SalesProcessConfig, Key extends keyof SalesProcessConfig[Section]>(
    section: Section,
    field: Key,
    value: SalesProcessConfig[Section][Key]
  ) => void;
  updateConversionField: <Step extends keyof SalesProcessConfig['conversion'], Key extends keyof SalesProcessConfig['conversion'][Step]>(
    type: Step,
    field: Key,
    value: SalesProcessConfig['conversion'][Step][Key]
  ) => void;
  requiredInfoText: {
    reservation: string;
    sale: string;
    order: string;
  };
  setRequiredInfoText: React.Dispatch<React.SetStateAction<{
    reservation: string;
    sale: string;
    order: string;
  }>>;
  qualificationQuestionsText: string;
  setQualificationQuestionsText: (value: string) => void;
  isJayOrg: boolean;
  isSaving: boolean;
  onSave: () => void;
}

export function SalesProcessCard({
  expanded,
  onExpandedChange,
  tab,
  onTabChange,
  salesProcessConfig,
  updateSalesProcessField,
  updateConversionField,
  requiredInfoText,
  setRequiredInfoText,
  qualificationQuestionsText,
  setQualificationQuestionsText,
  isJayOrg,
  isSaving,
  onSave,
}: SalesProcessCardProps) {
  return (
    <Card className={`border-primary/20 ${expanded ? 'lg:col-span-2' : ''}`}>
      <Collapsible open={expanded} onOpenChange={onExpandedChange}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors py-2.5 sm:py-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                <div className="p-1.5 sm:p-2 rounded-lg bg-gradient-to-br from-primary/20 to-primary/10 shrink-0">
                  <Sparkles className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <CardTitle className="text-sm sm:text-lg">Sales & Booking Process</CardTitle>
                  <CardDescription className="text-xs sm:text-sm line-clamp-1">
                    AI customer journey configuration
                  </CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                <Badge variant="outline" className="text-xs px-1.5 sm:px-2.5">
                  {expanded ? 'Expanded' : 'Configure'}
                </Badge>
                <ChevronRight className={`h-4 w-4 transition-transform ${expanded ? 'rotate-90' : ''}`} />
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0">
            <Tabs value={tab} onValueChange={onTabChange} className="w-full">
              <TabsList className="grid w-full grid-cols-5 mb-6">
                <TabsTrigger value="opening" className="text-xs sm:text-sm">
                  <MessageCircleHeart className="h-4 w-4 mr-1 hidden sm:inline" />
                  Opening
                </TabsTrigger>
                <TabsTrigger value="qualification" className="text-xs sm:text-sm">
                  <UserCheck className="h-4 w-4 mr-1 hidden sm:inline" />
                  Qualify
                </TabsTrigger>
                <TabsTrigger value="conversion" className="text-xs sm:text-sm">
                  <Target className="h-4 w-4 mr-1 hidden sm:inline" />
                  Convert
                </TabsTrigger>
                <TabsTrigger value="confirmation" className="text-xs sm:text-sm">
                  <CheckSquare className="h-4 w-4 mr-1 hidden sm:inline" />
                  Confirm
                </TabsTrigger>
                <TabsTrigger value="after_sales" className="text-xs sm:text-sm">
                  <MessageCircle className="h-4 w-4 mr-1 hidden sm:inline" />
                  Follow-up
                </TabsTrigger>
              </TabsList>

              <TabsContent value="opening" className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium flex items-center gap-2">
                      <MessageCircleHeart className="h-5 w-5 text-pink-500" />
                      Opening Message
                    </h4>
                    <p className="text-sm text-muted-foreground">How your AI greets customers</p>
                  </div>
                  <Switch
                    checked={salesProcessConfig.opening.enabled}
                    onCheckedChange={(checked) => updateSalesProcessField('opening', 'enabled', checked)}
                  />
                </div>
                {salesProcessConfig.opening.enabled && (
                  <div className="space-y-2">
                    <Label>Custom Greeting Message</Label>
                    <Textarea
                      placeholder="E.g., Hello! Welcome to [Business Name]. I'm here to help you with reservations, orders, or any questions. How can I assist you today?"
                      className="min-h-[120px]"
                      value={salesProcessConfig.opening.message}
                      onChange={(event) => updateSalesProcessField('opening', 'message', event.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">Leave empty to use the default greeting based on your AI agent type.</p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="qualification" className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium flex items-center gap-2">
                      <UserCheck className="h-5 w-5 text-blue-500" />
                      Lead Qualification
                    </h4>
                    <p className="text-sm text-muted-foreground">How to qualify and understand customer needs</p>
                  </div>
                  <Switch
                    checked={salesProcessConfig.qualification.enabled}
                    onCheckedChange={(checked) => updateSalesProcessField('qualification', 'enabled', checked)}
                  />
                </div>
                {salesProcessConfig.qualification.enabled && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Qualification Approach</Label>
                      <Textarea
                        placeholder="E.g., Ask open-ended questions to understand their needs, timeline, and budget. Listen for buying signals."
                        className="min-h-[80px]"
                        value={salesProcessConfig.qualification.description}
                        onChange={(event) => updateSalesProcessField('qualification', 'description', event.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Key Questions to Ask (comma-separated)</Label>
                      <Input
                        placeholder="E.g., budget, preferred dates, group size, special requirements, timeline"
                        value={qualificationQuestionsText}
                        onChange={(event) => setQualificationQuestionsText(event.target.value)}
                        onBlur={(event) => updateSalesProcessField('qualification', 'questions', event.target.value.split(',').map((item) => item.trim()).filter(Boolean))}
                      />
                    </div>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="conversion" className="space-y-6">
                <p className="text-sm text-muted-foreground">
                  Define what constitutes a successful conversion for each type relevant to your business.
                  {isJayOrg && (
                    <span className="block mt-1 text-xs text-primary">
                      Jay AI is optimized for sales. Reservation and order options are available for May and Cece organizations.
                    </span>
                  )}
                </p>

                {!isJayOrg && (
                  <div className="border rounded-lg p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <CalendarCheck className="h-5 w-5 text-blue-500" />
                        <div>
                          <h4 className="font-medium">Reservation</h4>
                          <p className="text-sm text-muted-foreground">Bookings, appointments</p>
                        </div>
                      </div>
                      <Switch
                        checked={salesProcessConfig.conversion.reservation.enabled}
                        onCheckedChange={(checked) => updateConversionField('reservation', 'enabled', checked)}
                      />
                    </div>
                    {salesProcessConfig.conversion.reservation.enabled && (
                      <div className="space-y-3 pl-8">
                        <div className="space-y-2">
                          <Label>Success Criteria</Label>
                          <Textarea
                            placeholder="E.g., Customer confirms date, time, and provides contact info."
                            className="min-h-[60px]"
                            value={salesProcessConfig.conversion.reservation.description}
                            onChange={(event) => updateConversionField('reservation', 'description', event.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Required Info (comma-separated)</Label>
                          <Input
                            placeholder="name, date, time, contact"
                            value={requiredInfoText.reservation}
                            onChange={(event) => setRequiredInfoText((current) => ({ ...current, reservation: event.target.value }))}
                            onBlur={(event) => updateConversionField('reservation', 'required_info', event.target.value.split(',').map((item) => item.trim()).filter(Boolean))}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="border rounded-lg p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <DollarSign className="h-5 w-5 text-green-500" />
                      <div>
                        <h4 className="font-medium">Sale</h4>
                        <p className="text-sm text-muted-foreground">Purchases, deals closed</p>
                      </div>
                    </div>
                    <Switch
                      checked={salesProcessConfig.conversion.sale.enabled}
                      onCheckedChange={(checked) => updateConversionField('sale', 'enabled', checked)}
                    />
                  </div>
                  {salesProcessConfig.conversion.sale.enabled && (
                    <div className="space-y-3 pl-8">
                      <div className="space-y-2">
                        <Label>Success Criteria</Label>
                        <Textarea
                          placeholder="E.g., Customer agrees to purchase and commits to payment."
                          className="min-h-[60px]"
                          value={salesProcessConfig.conversion.sale.description}
                          onChange={(event) => updateConversionField('sale', 'description', event.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Required Info (comma-separated)</Label>
                        <Input
                          placeholder="product selection, payment method, buyer details"
                          value={requiredInfoText.sale}
                          onChange={(event) => setRequiredInfoText((current) => ({ ...current, sale: event.target.value }))}
                          onBlur={(event) => updateConversionField('sale', 'required_info', event.target.value.split(',').map((item) => item.trim()).filter(Boolean))}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {!isJayOrg && (
                  <div className="border rounded-lg p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <ShoppingCart className="h-5 w-5 text-orange-500" />
                        <div>
                          <h4 className="font-medium">Order</h4>
                          <p className="text-sm text-muted-foreground">Food orders, service requests</p>
                        </div>
                      </div>
                      <Switch
                        checked={salesProcessConfig.conversion.order.enabled}
                        onCheckedChange={(checked) => updateConversionField('order', 'enabled', checked)}
                      />
                    </div>
                    {salesProcessConfig.conversion.order.enabled && (
                      <div className="space-y-3 pl-8">
                        <div className="space-y-2">
                          <Label>Success Criteria</Label>
                          <Textarea
                            placeholder="E.g., Customer confirms items, quantity, and pickup/delivery time."
                            className="min-h-[60px]"
                            value={salesProcessConfig.conversion.order.description}
                            onChange={(event) => updateConversionField('order', 'description', event.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Required Info (comma-separated)</Label>
                          <Input
                            placeholder="items, quantity, pickup time, customer name"
                            value={requiredInfoText.order}
                            onChange={(event) => setRequiredInfoText((current) => ({ ...current, order: event.target.value }))}
                            onBlur={(event) => updateConversionField('order', 'required_info', event.target.value.split(',').map((item) => item.trim()).filter(Boolean))}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="confirmation" className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium flex items-center gap-2">
                      <CheckSquare className="h-5 w-5 text-green-500" />
                      Confirmation & Closing
                    </h4>
                    <p className="text-sm text-muted-foreground">How to confirm and close the deal</p>
                  </div>
                  <Switch
                    checked={salesProcessConfig.confirmation.enabled}
                    onCheckedChange={(checked) => updateSalesProcessField('confirmation', 'enabled', checked)}
                  />
                </div>
                {salesProcessConfig.confirmation.enabled && (
                  <div className="space-y-2">
                    <Label>Confirmation Process</Label>
                    <Textarea
                      placeholder="E.g., Summarize the booking/order details, confirm all information is correct, provide reference number, and thank the customer. Mention next steps like payment or check-in procedures."
                      className="min-h-[120px]"
                      value={salesProcessConfig.confirmation.process}
                      onChange={(event) => updateSalesProcessField('confirmation', 'process', event.target.value)}
                    />
                  </div>
                )}
              </TabsContent>

              <TabsContent value="after_sales" className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium flex items-center gap-2">
                      <MessageCircle className="h-5 w-5 text-purple-500" />
                      After-Sales Follow-up
                    </h4>
                    <p className="text-sm text-muted-foreground">Post-conversion customer care</p>
                  </div>
                  <Switch
                    checked={salesProcessConfig.after_sales.enabled}
                    onCheckedChange={(checked) => updateSalesProcessField('after_sales', 'enabled', checked)}
                  />
                </div>
                {salesProcessConfig.after_sales.enabled && (
                  <div className="space-y-2">
                    <Label>Follow-up Guidelines</Label>
                    <Textarea
                      placeholder="E.g., Thank the customer for their business. Ask if they have any questions. Offer assistance with modifications. Remind them of important dates or next steps. Request feedback after service completion."
                      className="min-h-[120px]"
                      value={salesProcessConfig.after_sales.follow_up}
                      onChange={(event) => updateSalesProcessField('after_sales', 'follow_up', event.target.value)}
                    />
                  </div>
                )}
              </TabsContent>
            </Tabs>

            <div className="flex justify-end mt-6 pt-4 border-t">
              <Button onClick={onSave} disabled={isSaving}>
                {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                Save Process Configuration
              </Button>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}