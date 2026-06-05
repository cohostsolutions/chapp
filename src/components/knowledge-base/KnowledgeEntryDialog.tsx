import { useEffect, useMemo, useState, type RefObject } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { AlertTriangle, Eye, Loader2, Plus, Sparkles, Upload, X } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { LocationPickerFields } from '@/components/shared/LocationPickerFields';
import {
  analyzeKnowledgeEntryConflicts,
  buildKnowledgeEntryPayload,
  getKnowledgeEntryAuthoringGuidance,
  getKnowledgeEntryFormDefaults,
  knowledgeEntryFormSchema,
  primaryVoiceOptions,
  sourcePriorityOptions,
  type KnowledgeEntryFormValues,
  type KnowledgeSectionId,
  type NormalizedKnowledgeEntryPayload,
} from '@/components/knowledge-base/knowledgeEntryForm';
import type { KnowledgeEntry } from '@/hooks/useKnowledgeBaseContent';

interface KnowledgeSection {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface UploadedFile {
  name: string;
  size: number;
  type: string;
}

interface KnowledgeEntryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingEntry: KnowledgeEntry | null;
  defaultCategory: KnowledgeSectionId;
  existingEntries: KnowledgeEntry[];
  currentUserDisplayName: string;
  uploadedFiles: UploadedFile[];
  clearUploadedFiles: () => void;
  removeUploadedFile: (index: number) => void;
  isDragging: boolean;
  isUploading: boolean;
  uploadProgress: number;
  onDragOver: (event: React.DragEvent) => void;
  onDragLeave: (event: React.DragEvent) => void;
  onDrop: (event: React.DragEvent) => void;
  onCancel: () => void;
  onSubmit: (payload: NormalizedKnowledgeEntryPayload) => Promise<void>;
  knowledgeSections: KnowledgeSection[];
  fileInputRef: RefObject<HTMLInputElement | null>;
  getFileIcon: (fileType: string) => React.ReactNode;
  getFileExtension: (fileType: string) => string;
  formatFileSize: (bytes: number | null) => string;
}

export function KnowledgeEntryDialog({
  open,
  onOpenChange,
  editingEntry,
  defaultCategory,
  existingEntries,
  currentUserDisplayName,
  uploadedFiles,
  clearUploadedFiles,
  removeUploadedFile,
  isDragging,
  isUploading,
  uploadProgress,
  onDragOver,
  onDragLeave,
  onDrop,
  onCancel,
  onSubmit,
  knowledgeSections,
  fileInputRef,
  getFileIcon,
  getFileExtension,
  formatFileSize,
}: KnowledgeEntryDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [markReviewed, setMarkReviewed] = useState(!editingEntry);

  const form = useForm<KnowledgeEntryFormValues>({
    resolver: zodResolver(knowledgeEntryFormSchema),
    defaultValues: getKnowledgeEntryFormDefaults(editingEntry, defaultCategory, currentUserDisplayName),
  });

  useEffect(() => {
    if (open) {
      form.reset(getKnowledgeEntryFormDefaults(editingEntry, defaultCategory, currentUserDisplayName));
      setMarkReviewed(!editingEntry);
    }
  }, [currentUserDisplayName, defaultCategory, editingEntry, form, open]);

  const selectedCategory = form.watch('category');
  const watchedValues = form.watch();
  const businessOverviewValues = selectedCategory === 'business-overview'
    ? watchedValues as Extract<KnowledgeEntryFormValues, { category: 'business-overview' }>
    : null;

  const guidance = useMemo(
    () => getKnowledgeEntryAuthoringGuidance(selectedCategory),
    [selectedCategory]
  );

  const previewPayload = useMemo(() => {
    const parsed = knowledgeEntryFormSchema.safeParse(watchedValues);
    if (!parsed.success) return null;

    return buildKnowledgeEntryPayload(parsed.data);
  }, [watchedValues]);

  const previewContentForDisplay = useMemo(() => {
    if (!previewPayload?.content) return '';

    // Strip hidden dynamic metadata so users see the human-readable text the AI retrieves.
    return previewPayload.content.replace(/<!--\s*KB_DYNAMIC:.*?\s*-->/s, '').trim();
  }, [previewPayload]);

  const conflicts = useMemo(() => {
    if (!previewPayload) {
      return [];
    }

    return analyzeKnowledgeEntryConflicts(previewPayload, existingEntries, editingEntry?.id ?? null);
  }, [editingEntry?.id, existingEntries, previewPayload]);

  const handleSectionChange = (category: KnowledgeSectionId) => {
    const currentValues = form.getValues();
    const nextValues = getKnowledgeEntryFormDefaults(null, category, currentUserDisplayName);

    form.reset({
      ...nextValues,
      tags: currentValues.tags,
      owner_name: currentValues.owner_name,
      source_priority: currentValues.source_priority,
      is_active: currentValues.is_active,
    });
  };

  const handleSubmit = async (values: KnowledgeEntryFormValues) => {
    setIsSubmitting(true);
    try {
      const payload = buildKnowledgeEntryPayload(values);
      await onSubmit({
        ...payload,
        reviewed_at: markReviewed ? new Date().toISOString() : editingEntry?.reviewed_at ?? null,
        reviewed_by_name: markReviewed ? currentUserDisplayName : editingEntry?.reviewed_by_name ?? null,
      });
      form.reset(getKnowledgeEntryFormDefaults(null, values.category, currentUserDisplayName));
      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Add Entry
        </Button>
      </DialogTrigger>
      <DialogContent className="flex h-[92vh] w-[calc(100vw-1rem)] max-w-5xl flex-col overflow-hidden p-0 sm:max-h-[92vh] sm:h-auto sm:w-[calc(100vw-2rem)]">
        <DialogHeader className="border-b px-4 py-4 sm:px-6">
          <DialogTitle>{editingEntry ? 'Edit Entry' : 'Add Knowledge Entry'}</DialogTitle>
          <DialogDescription>
            Structure knowledge by section so the AI receives clearer, more reusable guidance.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="flex min-h-0 flex-1 flex-col">
            <div className="flex-1 min-h-0 space-y-6 overflow-y-auto overflow-x-hidden px-4 py-4 pb-6 sm:px-6">
            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Section</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={(value) => {
                      field.onChange(value);
                      handleSectionChange(value as KnowledgeSectionId);
                    }}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select section" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {knowledgeSections.map((section) => (
                        <SelectItem key={section.id} value={section.id}>
                          <div className="flex items-center gap-2">
                            <section.icon className="h-4 w-4" />
                            {section.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="rounded-xl border bg-muted/30 p-4 space-y-4">
              <div className="flex items-start gap-3">
                <div className="rounded-lg bg-primary/10 p-2 text-primary">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold text-foreground">Authoring Guidance</h3>
                  <p className="text-sm text-muted-foreground">
                    Keep this section focused so retrieval stays clean and the AI gets one clear source of truth.
                  </p>
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-foreground">Focus On</p>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    {guidance.focusPoints.map((point) => (
                      <li key={point} className="flex gap-2">
                        <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                        <span className="break-words">{point}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-foreground">Avoid</p>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    {guidance.avoidPoints.map((point) => (
                      <li key={point} className="flex gap-2">
                        <span className="mt-1 h-1.5 w-1.5 rounded-full bg-destructive shrink-0" />
                        <span className="break-words">{point}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              {guidance.note ? (
                <p className="text-sm rounded-lg border border-border/60 bg-background/80 px-3 py-2 text-muted-foreground">
                  {guidance.note}
                </p>
              ) : null}
            </div>

            {conflicts.length > 0 ? (
              <Alert className="border-warning/40 bg-warning/5">
                <AlertTriangle className="h-4 w-4 text-warning" />
                <AlertTitle>Review Similar Active Entries</AlertTitle>
                <AlertDescription>
                  <div className="space-y-2">
                    {conflicts.map((conflict) => (
                      <div key={`${conflict.kind}-${conflict.entryId}`} className="rounded-md border border-border/60 bg-background/80 px-3 py-2">
                        <p className="text-sm font-medium text-foreground">
                          {conflict.kind === 'duplicate' ? 'Possible duplicate' : 'Possible contradiction'}: {conflict.entryTitle}
                        </p>
                        <p className="text-sm text-muted-foreground">{conflict.description}</p>
                      </div>
                    ))}
                  </div>
                </AlertDescription>
              </Alert>
            ) : null}

            {selectedCategory === 'tone-personality' && (
              <>
                <FormField
                  control={form.control}
                  name="primary_voice"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Primary Voice</FormLabel>
                      <div className="grid grid-cols-1 gap-3 rounded-lg border p-4 sm:grid-cols-2">
                        {primaryVoiceOptions.map((option) => {
                          const checked = field.value.includes(option);
                          return (
                            <label key={option} className="flex items-center gap-2 text-sm">
                              <Checkbox
                                checked={checked}
                                onCheckedChange={(nextChecked) => {
                                  if (nextChecked) {
                                    field.onChange([...field.value, option]);
                                  } else {
                                    field.onChange(field.value.filter((value) => value !== option));
                                  }
                                }}
                              />
                              <span>{option}</span>
                            </label>
                          );
                        })}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid gap-4 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="standard_greeting"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Standard Greeting</FormLabel>
                        <FormControl>
                          <Input placeholder="Hi there!" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="standard_signoff"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Standard Sign-off</FormLabel>
                        <FormControl>
                          <Input placeholder="Best regards," {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="vocab_dos"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Vocabulary To Use</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder={'Warm welcome\nHelpful language\nClear next steps'}
                          className="min-h-[110px]"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="vocab_donts"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Vocabulary To Avoid</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder={'Corporate jargon\nSlang\nNegative phrasing'}
                          className="min-h-[110px]"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="emoji_usage"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Emoji Usage</FormLabel>
                      <FormControl>
                        <RadioGroup value={field.value} onValueChange={field.onChange} className="grid gap-3 md:grid-cols-3">
                          <label className="flex items-center gap-2 rounded-lg border p-3 text-sm">
                            <RadioGroupItem value="none" id="emoji-none" />
                            <span>None</span>
                          </label>
                          <label className="flex items-center gap-2 rounded-lg border p-3 text-sm">
                            <RadioGroupItem value="sparingly" id="emoji-sparingly" />
                            <span>Sparingly</span>
                          </label>
                          <label className="flex items-center gap-2 rounded-lg border p-3 text-sm">
                            <RadioGroupItem value="liberally" id="emoji-liberally" />
                            <span>Liberally</span>
                          </label>
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            )}

            {selectedCategory === 'business-overview' && (
              <>
                <FormField
                  control={form.control}
                  name="company_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Company Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Canvas Capital" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <LocationPickerFields
                  value={businessOverviewValues || {}}
                  onChange={(nextValue) => {
                    form.setValue('country', nextValue.country || '');
                    form.setValue('region', nextValue.region || '');
                    form.setValue('city', nextValue.city || '');
                    form.setValue('district', nextValue.district || '');
                  }}
                />
                <FormField
                  control={form.control}
                  name="elevator_pitch"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Elevator Pitch</FormLabel>
                      <FormControl>
                        <Textarea className="min-h-[100px]" placeholder="Brief summary of what the company does" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="target_audience"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Target Audience</FormLabel>
                      <FormControl>
                        <Textarea className="min-h-[100px]" placeholder="Who the business serves best" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="value_proposition"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Value Proposition</FormLabel>
                      <FormControl>
                        <Textarea className="min-h-[100px]" placeholder="Why customers choose this business" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            )}

            {selectedCategory === 'faqs' && (
              <>
                <FormField
                  control={form.control}
                  name="question"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Question</FormLabel>
                      <FormControl>
                        <Input placeholder="What is your refund policy?" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="answer"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Answer</FormLabel>
                      <FormControl>
                        <Textarea className="min-h-[140px]" placeholder="Provide the canonical answer" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="reference_link"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Reference Link</FormLabel>
                      <FormControl>
                        <Input placeholder="https://example.com/help/refunds" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            )}

            {selectedCategory === 'sample-conversations' && (
              <>
                <FormField
                  control={form.control}
                  name="scenario_context"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Scenario Context</FormLabel>
                      <FormControl>
                        <Input placeholder="Customer asks about same-day availability" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="customer_says"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Customer Says</FormLabel>
                      <FormControl>
                        <Textarea className="min-h-[120px]" placeholder="Customer prompt or message" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="ideal_response"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Ideal Response</FormLabel>
                      <FormControl>
                        <Textarea className="min-h-[160px]" placeholder="Best-practice AI response" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            )}

            <div className="space-y-2 border-t pt-6">
              <Label>File Upload</Label>
              {uploadedFiles.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-foreground">Uploaded Files ({uploadedFiles.length})</p>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-xs text-muted-foreground hover:text-destructive"
                      onClick={clearUploadedFiles}
                    >
                      Clear All
                    </Button>
                  </div>
                  {uploadedFiles.map((file, index) => (
                    <div key={`${file.name}-${index}`} className="border rounded-lg p-3 bg-muted/30">
                      <div className="flex items-center justify-between">
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="p-2 bg-primary/10 rounded-lg">{getFileIcon(file.type)}</div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground truncate max-w-[150px] sm:max-w-[320px]">{file.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {getFileExtension(file.type)} • {formatFileSize(file.size)}
                            </p>
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() => removeUploadedFile(index)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div
                className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer ${
                  isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50'
                }`}
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
                onClick={() => !isUploading && fileInputRef.current?.click()}
              >
                <Upload className={`h-8 w-8 mx-auto mb-2 ${isDragging ? 'text-primary' : 'text-muted-foreground'}`} />
                {isUploading ? (
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">Uploading...</p>
                    <Progress value={uploadProgress} className="h-2 w-48 mx-auto" />
                    <p className="text-xs text-muted-foreground">{Math.round(uploadProgress)}%</p>
                  </div>
                ) : (
                  <>
                    <p className="text-sm font-medium text-foreground">{isDragging ? 'Drop your files here' : 'Drag & drop files here'}</p>
                    <p className="text-xs text-muted-foreground mt-1">or click to browse • PDF, TXT, DOC, DOCX, JPG, PNG, WebP, GIF</p>
                  </>
                )}
              </div>
            </div>

            <FormField
              control={form.control}
              name="tags"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tags</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., greeting, pricing, objection" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="source_priority"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Source Priority</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select priority" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {sourcePriorityOptions.map((option) => (
                          <SelectItem key={option} value={option}>
                            {option === 'canonical' ? 'Canonical' : option === 'supporting' ? 'Supporting' : 'Reference Only'}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Canonical entries should win when overlapping information exists.
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="owner_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Owner</FormLabel>
                    <FormControl>
                      <Input placeholder="Who should review this entry?" {...field} />
                    </FormControl>
                    <p className="text-xs text-muted-foreground">
                      Use the responsible person or team so stale knowledge can be routed correctly.
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="rounded-lg border p-4 space-y-3">
              <label className="flex items-start gap-3 text-sm">
                <Checkbox checked={markReviewed} onCheckedChange={(checked) => setMarkReviewed(Boolean(checked))} />
                <span className="space-y-1">
                  <span className="font-medium text-foreground block">Mark as reviewed on save</span>
                  <span className="text-muted-foreground block">
                    This updates the review timestamp and reviewer name so stale entries can be surfaced later.
                  </span>
                </span>
              </label>
              {editingEntry?.reviewed_at ? (
                <p className="text-xs text-muted-foreground">
                  Last reviewed {new Date(editingEntry.reviewed_at).toLocaleDateString()} by {editingEntry.reviewed_by_name || 'Unknown'}.
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">This entry has not been reviewed yet.</p>
              )}
            </div>

            <FormField
              control={form.control}
              name="is_active"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel>Active</FormLabel>
                    <p className="text-sm text-muted-foreground">Inactive entries remain stored but are excluded from the AI's active knowledge set.</p>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />

            <div className="rounded-xl border bg-background p-4 space-y-4">
              <div className="flex items-start gap-3">
                <div className="rounded-lg bg-primary/10 p-2 text-primary">
                  <Eye className="h-4 w-4" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold text-foreground">AI Preview</h3>
                  <p className="text-sm text-muted-foreground">
                    This is the normalized title and content the AI will retrieve after save.
                  </p>
                </div>
              </div>

              {previewPayload ? (
                <div className="space-y-4">
                  <div className="grid gap-3 md:grid-cols-3">
                    <div className="rounded-lg border bg-muted/20 px-3 py-2 text-sm">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Priority</p>
                      <p className="font-medium text-foreground">{previewPayload.source_priority}</p>
                    </div>
                    <div className="rounded-lg border bg-muted/20 px-3 py-2 text-sm">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Owner</p>
                      <p className="font-medium text-foreground">{previewPayload.owner_name || 'Unassigned'}</p>
                    </div>
                    <div className="rounded-lg border bg-muted/20 px-3 py-2 text-sm">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Review On Save</p>
                      <p className="font-medium text-foreground">{markReviewed ? currentUserDisplayName : 'No review update'}</p>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Generated Title</p>
                    <div className="rounded-lg border bg-muted/30 px-3 py-2 text-sm font-medium text-foreground">
                      {previewPayload.title}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Retrieved Content Preview</p>
                    <pre className="max-h-72 overflow-auto whitespace-pre-wrap [overflow-wrap:anywhere] rounded-lg border bg-muted/20 px-3 py-3 text-xs text-foreground">
                      {previewContentForDisplay}
                    </pre>
                    <details className="rounded-lg border border-dashed border-border/70 bg-muted/10 px-3 py-2">
                      <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
                        Show technical stored payload
                      </summary>
                      <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap [overflow-wrap:anywhere] text-[11px] text-muted-foreground">
                        {previewPayload.content}
                      </pre>
                    </details>
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border border-dashed bg-muted/20 px-3 py-4 text-sm text-muted-foreground">
                  Complete the required fields above to preview the exact title and content the AI will use.
                </div>
              )}
            </div>

            </div>

            <DialogFooter className="shrink-0 border-t bg-background px-4 py-3 sm:px-6">
              <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting || isUploading}>
                {isSubmitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                {editingEntry ? 'Update Entry' : 'Create Entry'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}