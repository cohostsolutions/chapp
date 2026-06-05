import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BookOpen, Download, Upload, Star, TrendingUp, Users, Briefcase, ShoppingCart, Hotel } from 'lucide-react';
import { RubricCategory } from '@/lib/training/types';
import { useToast } from '@/hooks/use-toast';

export interface TemplateModule {
  id: string;
  title: string;
  description: string;
  industry: 'general' | 'saas' | 'ecommerce' | 'hospitality';
  difficulty: 'easy' | 'medium' | 'hard';
  popular: boolean;
  rubric: RubricCategory[];
  objectives: string[];
  persona: {
    name: string;
    mood: string;
    goals: string;
    constraints: string;
    background: string;
  };
}

const PRE_BUILT_TEMPLATES: TemplateModule[] = [
  {
    id: 'saas-objection-handling',
    title: 'SaaS Objection Handling',
    description: 'Handle common objections in SaaS sales: pricing, implementation, ROI concerns',
    industry: 'saas',
    difficulty: 'medium',
    popular: true,
    objectives: [
      'Address pricing objections with value-based responses',
      'Overcome implementation concerns',
      'Demonstrate ROI and business value',
      'Handle competitor comparisons professionally'
    ],
    persona: {
      name: 'Sarah Chen',
      mood: 'skeptical',
      goals: 'Evaluate software but concerned about cost and implementation time',
      constraints: 'Limited budget, small IT team, needs quick deployment',
      background: 'Operations Manager at a mid-sized company looking to improve team productivity'
    },
    rubric: [
      { id: '1', name: 'Value Communication', description: 'Articulates ROI clearly', guidelines: ['Quantify benefits', 'Use customer success stories'], weight: 2 },
      { id: '2', name: 'Empathy', description: 'Acknowledges concerns', guidelines: ['Validate feelings', 'Show understanding'], weight: 1 },
      { id: '3', name: 'Problem-Solving', description: 'Offers creative solutions', guidelines: ['Flexible payment options', 'Implementation support'], weight: 2 },
    ]
  },
  {
    id: 'ecommerce-customer-service',
    title: 'E-commerce Customer Service',
    description: 'Handle returns, complaints, and delivery issues with empathy and efficiency',
    industry: 'ecommerce',
    difficulty: 'easy',
    popular: true,
    objectives: [
      'Process returns and refunds professionally',
      'De-escalate upset customers',
      'Resolve shipping and delivery issues',
      'Turn complaints into positive experiences'
    ],
    persona: {
      name: 'Mike Rodriguez',
      mood: 'frustrated',
      goals: 'Get a refund or replacement for damaged product',
      constraints: 'Needs resolution quickly, considering switching to competitor',
      background: 'Long-time customer who received a damaged item and is disappointed'
    },
    rubric: [
      { id: '1', name: 'Empathy & Apology', description: 'Sincerely apologizes', guidelines: ['Acknowledge inconvenience', 'Take responsibility'], weight: 2 },
      { id: '2', name: 'Solution Speed', description: 'Offers quick resolution', guidelines: ['Immediate refund or replacement', 'No red tape'], weight: 2 },
      { id: '3', name: 'Recovery', description: 'Rebuilds trust', guidelines: ['Discount for next order', 'Premium shipping'], weight: 1 },
    ]
  },
  {
    id: 'hospitality-upsell',
    title: 'Hospitality Upselling',
    description: 'Upsell room upgrades, packages, and amenities without being pushy',
    industry: 'hospitality',
    difficulty: 'medium',
    popular: true,
    objectives: [
      'Identify upsell opportunities naturally',
      'Present premium options attractively',
      'Handle price resistance gracefully',
      'Close upsells with confidence'
    ],
    persona: {
      name: 'Jennifer and Tom Williams',
      mood: 'excited',
      goals: 'Book a romantic anniversary trip within budget',
      constraints: 'Budget-conscious but want special experience',
      background: 'Couple celebrating 10th anniversary, open to suggestions but watching expenses'
    },
    rubric: [
      { id: '1', name: 'Needs Discovery', description: 'Asks about occasion/preferences', guidelines: ['Listen actively', 'Identify desires'], weight: 2 },
      { id: '2', name: 'Value Presentation', description: 'Paints vivid picture', guidelines: ['Describe experience', 'Emotional appeal'], weight: 2 },
      { id: '3', name: 'Soft Closing', description: 'Non-pushy approach', guidelines: ['Suggest, don\'t pressure', 'Offer options'], weight: 1 },
    ]
  },
  {
    id: 'cold-call-prospecting',
    title: 'Cold Call Prospecting',
    description: 'Break through gatekeepers and book discovery calls with prospects',
    industry: 'general',
    difficulty: 'hard',
    popular: true,
    objectives: [
      'Get past gatekeepers professionally',
      'Deliver compelling value proposition in 30 seconds',
      'Handle initial resistance',
      'Book qualified discovery meetings'
    ],
    persona: {
      name: 'Executive Assistant (then CEO)',
      mood: 'busy and protective',
      goals: 'Screen calls, protect CEO\'s time',
      constraints: 'Sees dozens of sales calls daily, very selective',
      background: 'Gatekeeper at target company, trained to filter solicitations'
    },
    rubric: [
      { id: '1', name: 'Gatekeeper Navigation', description: 'Professional and respectful', guidelines: ['Build rapport', 'Sound legitimate'], weight: 2 },
      { id: '2', name: 'Value Prop', description: 'Clear and compelling', guidelines: ['30-second pitch', 'Relevant to their industry'], weight: 2 },
      { id: '3', name: 'Persistence', description: 'Handles rejection well', guidelines: ['Ask for referral', 'Leave door open'], weight: 1 },
    ]
  },
  {
    id: 'product-demo',
    title: 'Product Demo Excellence',
    description: 'Deliver engaging product demonstrations that focus on customer needs',
    industry: 'saas',
    difficulty: 'medium',
    popular: false,
    objectives: [
      'Discovery before demo',
      'Customize demo to customer needs',
      'Handle technical questions confidently',
      'Close with next steps'
    ],
    persona: {
      name: 'David Park',
      mood: 'analytical',
      goals: 'Evaluate if product meets technical requirements',
      constraints: 'Limited time, needs to see specific features',
      background: 'IT Director evaluating solutions, wants proof it works'
    },
    rubric: [
      { id: '1', name: 'Discovery', description: 'Asks qualifying questions first', guidelines: ['Understand pain points', 'Identify must-haves'], weight: 2 },
      { id: '2', name: 'Customization', description: 'Shows relevant features only', guidelines: ['Skip generic tour', 'Focus on their needs'], weight: 2 },
      { id: '3', name: 'Technical Confidence', description: 'Answers questions well', guidelines: ['Admit when unsure', 'Follow up promises'], weight: 1 },
    ]
  },
  {
    id: 'renewal-conversation',
    title: 'Contract Renewal Negotiation',
    description: 'Navigate renewal conversations, handle price objections, prevent churn',
    industry: 'saas',
    difficulty: 'hard',
    popular: false,
    objectives: [
      'Proactively address satisfaction',
      'Demonstrate ongoing value',
      'Handle discount requests strategically',
      'Secure multi-year commitments'
    ],
    persona: {
      name: 'Laura Thompson',
      mood: 'evaluating alternatives',
      goals: 'Renew but wants better pricing or more features',
      constraints: 'Budget cuts, competitive offers on the table',
      background: 'Existing customer for 2 years, generally happy but price-sensitive'
    },
    rubric: [
      { id: '1', name: 'Value Reinforcement', description: 'Recaps wins and ROI', guidelines: ['Use their data', 'Show impact'], weight: 2 },
      { id: '2', name: 'Negotiation', description: 'Protects margin while flexible', guidelines: ['Bundle value', 'Multi-year incentives'], weight: 2 },
      { id: '3', name: 'Churn Prevention', description: 'Addresses dissatisfaction', guidelines: ['Surface concerns early', 'Resolve issues'], weight: 1 },
    ]
  }
];

interface Props {
  onApplyTemplate: (template: TemplateModule) => void;
  onExportTemplate?: (template: TemplateModule) => void;
}

export function ModuleTemplateLibrary({ onApplyTemplate, onExportTemplate }: Props) {
  const [selectedIndustry, setSelectedIndustry] = useState<string>('all');
  const { toast } = useToast();

  const filteredTemplates = PRE_BUILT_TEMPLATES.filter(
    template => selectedIndustry === 'all' || template.industry === selectedIndustry
  );

  const handleApplyTemplate = (template: TemplateModule) => {
    onApplyTemplate(template);
    toast({
      title: "Template Applied",
      description: `"${template.title}" has been loaded into your module editor.`,
      duration: 3000,
    });
  };

  const handleExport = (template: TemplateModule) => {
    const dataStr = JSON.stringify(template, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${template.id}.json`;
    link.click();
    URL.revokeObjectURL(url);

    toast({
      title: "Template Exported",
      description: `"${template.title}" downloaded as JSON file.`,
      duration: 3000,
    });
  };

  const getIndustryIcon = (industry: string) => {
    switch (industry) {
      case 'saas': return <Briefcase className="w-4 h-4" />;
      case 'ecommerce': return <ShoppingCart className="w-4 h-4" />;
      case 'hospitality': return <Hotel className="w-4 h-4" />;
      default: return <Users className="w-4 h-4" />;
    }
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy': return 'bg-green-500/10 text-green-700 dark:text-green-400';
      case 'medium': return 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400';
      case 'hard': return 'bg-red-500/10 text-red-700 dark:text-red-400';
      default: return 'bg-gray-500/10 text-gray-700';
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-primary" />
              Module Template Library
            </CardTitle>
            <CardDescription>Pre-built training scenarios to get started quickly</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Industry Filter */}
        <Tabs value={selectedIndustry} onValueChange={setSelectedIndustry} className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="saas">SaaS</TabsTrigger>
            <TabsTrigger value="ecommerce">E-commerce</TabsTrigger>
            <TabsTrigger value="hospitality">Hospitality</TabsTrigger>
            <TabsTrigger value="general">General</TabsTrigger>
          </TabsList>

          <TabsContent value={selectedIndustry} className="space-y-3 mt-4">
            {filteredTemplates.length === 0 ? (
              <div className="text-center py-8 text-sm text-muted-foreground">
                <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-20" />
                <p>No templates found for this industry.</p>
              </div>
            ) : (
              filteredTemplates.map(template => (
                <Card key={template.id} className="border-dashed hover:border-solid hover:shadow-md transition-all">
                  <CardContent className="pt-4">
                    <div className="space-y-3">
                      {/* Header */}
                      <div className="flex items-start justify-between">
                        <div className="space-y-1 flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold text-base">{template.title}</h4>
                            {template.popular && (
                              <Badge variant="secondary" className="text-xs">
                                <Star className="w-3 h-3 mr-1 fill-current" />
                                Popular
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">{template.description}</p>
                        </div>
                      </div>

                      {/* Badges */}
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="outline" className="text-xs">
                          {getIndustryIcon(template.industry)}
                          <span className="ml-1 capitalize">{template.industry}</span>
                        </Badge>
                        <Badge className={`text-xs ${getDifficultyColor(template.difficulty)}`}>
                          {template.difficulty.charAt(0).toUpperCase() + template.difficulty.slice(1)}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {template.objectives.length} objectives
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {template.rubric.length} rubric categories
                        </Badge>
                      </div>

                      {/* Objectives Preview */}
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-muted-foreground">Key Objectives:</p>
                        <ul className="text-xs space-y-1 list-disc list-inside text-muted-foreground">
                          {template.objectives.slice(0, 2).map((obj, idx) => (
                            <li key={idx}>{obj}</li>
                          ))}
                          {template.objectives.length > 2 && (
                            <li className="italic">+{template.objectives.length - 2} more...</li>
                          )}
                        </ul>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2 pt-2">
                        <Button
                          size="sm"
                          onClick={() => handleApplyTemplate(template)}
                          className="flex-1"
                        >
                          <Download className="w-4 h-4 mr-2" />
                          Use Template
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleExport(template)}
                        >
                          <Upload className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>
        </Tabs>

        {/* Stats Footer */}
        <div className="pt-3 border-t">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{PRE_BUILT_TEMPLATES.length} templates available</span>
            <span>{PRE_BUILT_TEMPLATES.filter(t => t.popular).length} popular</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default ModuleTemplateLibrary;
