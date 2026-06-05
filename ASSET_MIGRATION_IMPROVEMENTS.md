# Asset Migration Improvements - Implementation Plan

This document provides detailed implementation guidance for addressing the issues identified in [ASSET_MIGRATION_AUDIT.md](ASSET_MIGRATION_AUDIT.md).

---

## 🎯 Phase 1: Critical Fixes (Priority: HIGH)

### Fix #1: Related Data Validation
**Estimated Time:** 3-4 hours  
**Priority:** 🔴 HIGH  
**Complexity:** Medium

#### Problem
Users can migrate child assets (bookings, orders, communications, ai_conversations) without their parent leads, creating orphaned relationships and data integrity issues.

#### Solution
Implement smart relationship validation with three protection layers:

1. **Auto-select parent assets** when child assets are selected
2. **Show warnings** for orphaned data selections
3. **Validation dialog** before migration

#### Implementation

**Step 1: Add validation function**

```typescript
// In AssetMigration.tsx, add after getTotalSelected()

interface ValidationWarning {
  category: string;
  issue: string;
  severity: 'error' | 'warning';
}

const validateMigrationPlan = (): ValidationWarning[] => {
  const warnings: ValidationWarning[] = [];
  
  // Check for orphaned relationships
  const relationshipMap: Record<string, string> = {
    bookings: 'leads',
    orders: 'leads',
    communications: 'leads',
    ai_conversations: 'leads',
  };
  
  categories.forEach(cat => {
    const parentKey = cat.relatedTo;
    if (parentKey && cat.selectedIds.length > 0) {
      const parent = categories.find(c => c.key === parentKey);
      
      if (!parent || parent.selectedIds.length === 0) {
        warnings.push({
          category: cat.label,
          issue: `Selected ${cat.selectedIds.length} ${cat.label.toLowerCase()} but no ${parent?.label.toLowerCase() || parentKey} are selected. This will create orphaned records.`,
          severity: 'error'
        });
      } else {
        // Check if ALL parent IDs are included
        // This requires loading the actual relationships (would need API call)
        // For now, just warn about potential issues
        warnings.push({
          category: cat.label,
          issue: `Ensure all related ${parent.label.toLowerCase()} are also migrated to avoid broken references.`,
          severity: 'warning'
        });
      }
    }
  });
  
  // Check for large migrations
  const totalSelected = getTotalSelected();
  if (totalSelected > 1000) {
    warnings.push({
      category: 'Performance',
      issue: `Migrating ${totalSelected} assets may take several minutes. Consider breaking into smaller batches.`,
      severity: 'warning'
    });
  }
  
  return warnings;
};
```

**Step 2: Add validation state**

```typescript
// Add to state declarations
const [validationWarnings, setValidationWarnings] = useState<ValidationWarning[]>([]);
const [showValidationDialog, setShowValidationDialog] = useState(false);
```

**Step 3: Update handleMigrateClick**

```typescript
const handleMigrateClick = () => {
  if (getTotalSelected() === 0) {
    toast({ 
      title: 'No assets selected', 
      description: 'Please select at least one asset to migrate.', 
      variant: 'destructive' 
    });
    return;
  }
  
  // Validate migration plan
  const warnings = validateMigrationPlan();
  const errors = warnings.filter(w => w.severity === 'error');
  
  if (errors.length > 0) {
    setValidationWarnings(warnings);
    setShowValidationDialog(true);
    return;
  }
  
  if (warnings.length > 0) {
    setValidationWarnings(warnings);
    setShowValidationDialog(true);
    return;
  }
  
  // No issues - proceed to confirmation
  setShowConfirmDialog(true);
};
```

**Step 4: Add Validation Dialog Component**

```tsx
{/* Validation Dialog - Add before Confirmation Dialog */}
<AlertDialog open={showValidationDialog} onOpenChange={setShowValidationDialog}>
  <AlertDialogContent className="max-w-2xl">
    <AlertDialogHeader>
      <AlertDialogTitle className="flex items-center gap-2">
        <AlertTriangle className="w-5 h-5 text-warning" />
        Migration Validation Issues
      </AlertDialogTitle>
      <AlertDialogDescription className="space-y-4">
        <p>The following issues were detected in your migration plan:</p>
        
        <div className="space-y-2 max-h-[300px] overflow-y-auto">
          {validationWarnings.map((warning, idx) => (
            <Card key={idx} className={warning.severity === 'error' ? 'border-destructive' : 'border-warning'}>
              <CardContent className="p-3">
                <div className="flex items-start gap-2">
                  {warning.severity === 'error' ? (
                    <XCircle className="w-4 h-4 text-destructive mt-0.5" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-warning mt-0.5" />
                  )}
                  <div>
                    <p className="font-medium text-sm">{warning.category}</p>
                    <p className="text-sm text-muted-foreground">{warning.issue}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        
        {validationWarnings.some(w => w.severity === 'error') && (
          <p className="text-destructive font-medium">
            ❌ Migration blocked: Please fix the errors above before proceeding.
          </p>
        )}
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>Go Back</AlertDialogCancel>
      {!validationWarnings.some(w => w.severity === 'error') && (
        <AlertDialogAction 
          onClick={() => {
            setShowValidationDialog(false);
            setShowConfirmDialog(true);
          }}
          className="bg-warning text-warning-foreground hover:bg-warning/90"
        >
          Proceed Anyway
        </AlertDialogAction>
      )}
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

**Step 5: Add auto-select functionality**

```typescript
// Add button to automatically select parent assets
const autoSelectRelatedParents = () => {
  const updatedCategories = [...categories];
  
  categories.forEach((cat, idx) => {
    if (cat.relatedTo && cat.selectedIds.length > 0) {
      const parentIdx = updatedCategories.findIndex(c => c.key === cat.relatedTo);
      if (parentIdx !== -1 && updatedCategories[parentIdx].selectedIds.length === 0) {
        // Select all parent assets
        updatedCategories[parentIdx].selectedIds = 
          updatedCategories[parentIdx].items.map(i => i.id);
      }
    }
  });
  
  setCategories(updatedCategories);
  toast({ 
    title: 'Parent assets selected', 
    description: 'Related leads have been automatically selected.' 
  });
};
```

**Add button to UI:**

```tsx
{/* Add after "getTotalSelected() assets selected" text */}
{categories.some(c => c.relatedTo && c.selectedIds.length > 0) && (
  <Button variant="outline" size="sm" onClick={autoSelectRelatedParents}>
    <Link className="w-4 h-4 mr-2" />
    Auto-select Related
  </Button>
)}
```

#### Testing
- [ ] Test selecting bookings without leads → should show error
- [ ] Test "Auto-select Related" button
- [ ] Test proceeding with warnings (not errors)
- [ ] Test that errors block migration

---

### Fix #2: Transaction-Based Migration with Rollback
**Estimated Time:** 2-3 hours  
**Priority:** 🔴 HIGH  
**Complexity:** Medium-High

#### Problem
If migration fails midway (e.g., table 5 of 10 fails), previously migrated tables remain in target org, creating split data state.

#### Solution
Use Supabase RPC function with database transaction to ensure atomic migration.

#### Implementation

**Step 1: Create migration RPC function**

Create new migration: `supabase/migrations/20260109_migration_rpc.sql`

```sql
-- Create RPC function for atomic asset migration
CREATE OR REPLACE FUNCTION migrate_assets_atomic(
  p_source_org_id uuid,
  p_target_org_id uuid,
  p_assets jsonb,
  p_performed_by uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result jsonb := '{}';
  v_migration_id uuid;
  v_table_name text;
  v_ids jsonb;
  v_count int;
  v_category text;
BEGIN
  -- Validate inputs
  IF p_source_org_id = p_target_org_id THEN
    RAISE EXCEPTION 'Source and target organizations must be different';
  END IF;
  
  -- Create migration log entry
  INSERT INTO migration_logs (
    performed_by,
    source_organization_id,
    target_organization_id
  ) VALUES (
    p_performed_by,
    p_source_org_id,
    p_target_org_id
  ) RETURNING id INTO v_migration_id;
  
  -- Iterate through asset types
  FOR v_category, v_ids IN SELECT * FROM jsonb_each(p_assets)
  LOOP
    -- Skip empty arrays
    IF jsonb_array_length(v_ids) = 0 THEN
      CONTINUE;
    END IF;
    
    -- Map category to table name
    v_table_name := CASE v_category
      WHEN 'leads' THEN 'leads'
      WHEN 'platforms' THEN 'social_platforms'
      WHEN 'bookings' THEN 'bookings'
      WHEN 'orders' THEN 'orders'
      WHEN 'offerings' THEN 'offerings'
      WHEN 'room_units' THEN 'room_units'
      WHEN 'knowledge_entries' THEN 'knowledge_base_entries'
      WHEN 'knowledge_docs' THEN 'knowledge_base_documents'
      WHEN 'reports' THEN 'reports'
      WHEN 'workflows' THEN 'workflows'
      WHEN 'calendar_events' THEN 'calendar_events'
      WHEN 'communications' THEN 'communications'
      WHEN 'message_templates' THEN 'message_templates'
      WHEN 'training_modules' THEN 'training_modules'
      WHEN 'team_chats' THEN 'team_chats'
      WHEN 'ai_conversations' THEN 'ai_conversations'
      WHEN 'agent_priorities' THEN 'agent_priorities'
      WHEN 'rubric_templates' THEN 'rubric_templates'
      ELSE NULL
    END;
    
    IF v_table_name IS NULL THEN
      RAISE EXCEPTION 'Invalid asset category: %', v_category;
    END IF;
    
    -- Perform migration for this table
    EXECUTE format(
      'UPDATE %I SET organization_id = $1 WHERE id = ANY($2::uuid[])',
      v_table_name
    ) USING p_target_org_id, ARRAY(SELECT jsonb_array_elements_text(v_ids)::uuid);
    
    GET DIAGNOSTICS v_count = ROW_COUNT;
    
    -- Update migration log
    EXECUTE format(
      'UPDATE migration_logs SET migrated_%I = $1 WHERE id = $2',
      v_category
    ) USING v_ids, v_migration_id;
    
    -- Add to result
    v_result := jsonb_set(v_result, ARRAY[v_category], to_jsonb(v_count));
  END LOOP;
  
  -- Return migration ID and counts
  RETURN jsonb_build_object(
    'migration_id', v_migration_id,
    'counts', v_result
  );
  
EXCEPTION
  WHEN OTHERS THEN
    -- Rollback happens automatically
    RAISE EXCEPTION 'Migration failed: %', SQLERRM;
END;
$$;

-- Grant execute to authenticated users (edge function will check role)
GRANT EXECUTE ON FUNCTION migrate_assets_atomic TO authenticated;

COMMENT ON FUNCTION migrate_assets_atomic IS 'Atomically migrate assets between organizations with automatic rollback on failure';
```

**Step 2: Update migrate-assets edge function**

```typescript
// In supabase/functions/migrate-assets/index.ts

// Replace the sequential loop with RPC call
try {
  // ... existing auth checks ...

  const { data: result, error: rpcError } = await serviceClient
    .rpc('migrate_assets_atomic', {
      p_source_org_id: sourceOrgId,
      p_target_org_id: targetOrgId,
      p_assets: assets,
      p_performed_by: user.id
    });

  if (rpcError) {
    console.error('Migration RPC failed:', rpcError);
    return new Response(JSON.stringify({ 
      error: `Migration failed: ${rpcError.message}` 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Fetch the migration log
  const { data: logData, error: logError } = await serviceClient
    .from('migration_logs')
    .select('*')
    .eq('id', result.migration_id)
    .single();

  return new Response(JSON.stringify({ 
    success: true, 
    results: result.counts,
    migrationLog: logData 
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

} catch (err: unknown) {
  // ... existing error handling ...
}
```

#### Testing
- [ ] Test successful migration → all tables migrated
- [ ] Test failed migration (simulate DB error) → NO tables migrated (rollback)
- [ ] Verify migration_logs entry only created on success
- [ ] Test with 19 asset types at once

---

## 🎯 Phase 2: UX Improvements (Priority: MEDIUM)

### Fix #3: 500-Row Limit Warnings
**Estimated Time:** 1 hour  
**Priority:** 🟡 MEDIUM  
**Complexity:** Low

#### Implementation

```typescript
// Add state
const [truncatedCategories, setTruncatedCategories] = useState<Record<string, number>>({});

// In loadPreview, after each query:
const leadsRes = await supabase.from('leads')...limit(500);
if (leadsRes.data && leadsRes.data.length === 500) {
  // Fetch total count
  const { count } = await supabase
    .from('leads')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', sourceOrgId);
  
  if (count && count > 500) {
    setTruncatedCategories(prev => ({ ...prev, leads: count }));
  }
}

// In category card header:
{truncatedCategories[cat.key] && (
  <Badge variant="warning" className="ml-2">
    <AlertTriangle className="w-3 h-3 mr-1" />
    Showing 500 of {truncatedCategories[cat.key].toLocaleString()}
  </Badge>
)}
```

---

### Fix #4: Persist Undo State in localStorage
**Estimated Time:** 1-2 hours  
**Priority:** 🟡 MEDIUM  
**Complexity:** Low-Medium

#### Implementation

```typescript
// Add effect to save to localStorage
useEffect(() => {
  if (recentMigration && !recentMigration.is_undone) {
    localStorage.setItem('canvascapital_recent_migration', JSON.stringify({
      migration: recentMigration,
      expiresAt: recentMigration.can_undo_until
    }));
  } else {
    localStorage.removeItem('canvascapital_recent_migration');
  }
}, [recentMigration]);

// Add effect to restore on mount
useEffect(() => {
  const stored = localStorage.getItem('canvascapital_recent_migration');
  if (stored) {
    try {
      const { migration, expiresAt } = JSON.parse(stored);
      const expiryTime = new Date(expiresAt).getTime();
      
      if (Date.now() < expiryTime) {
        setRecentMigration(migration);
      } else {
        localStorage.removeItem('canvascapital_recent_migration');
      }
    } catch (e) {
      console.error('Failed to restore migration state:', e);
      localStorage.removeItem('canvascapital_recent_migration');
    }
  }
}, []); // Only on mount
```

---

### Fix #5: Improve Undo UX
**Estimated Time:** 30 minutes  
**Priority:** 🟡 MEDIUM  
**Complexity:** Low

#### Implementation

```typescript
const undoMigration = async () => {
  if (!recentMigration || undoTimeLeft === 0) return;

  // Immediately update UI
  setStep('select'); // ✅ Reset step first
  setUndoing(true);
  
  try {
    const { data, error } = await supabase.functions.invoke('undo-migration', {
      body: { migrationId: recentMigration.id },
    });

    if (error) throw new Error(error.message);
    if (data?.error) throw new Error(data.error);

    setRecentMigration(null);
    toast({ 
      title: 'Migration undone ✅', 
      description: 'All assets have been reverted to the source organization.',
      duration: 5000 
    });
    resetMigration(); // This now just clears selection
  } catch (error: unknown) {
    console.error('Undo error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error occurred';
    toast({ 
      title: 'Undo failed', 
      description: message, 
      variant: 'destructive' 
    });
    setStep('complete'); // Revert back if undo failed
  } finally {
    setUndoing(false);
  }
};
```

---

### Fix #6: Add Loading State for fetchOrganizations
**Estimated Time:** 30 minutes  
**Priority:** 🟡 MEDIUM  
**Complexity:** Low

#### Implementation

```typescript
const fetchOrganizations = async () => {
  setLoading(true); // ✅ Add loading state
  try {
    const { data, error } = await supabase
      .from('organizations')
      .select('id, name, slug')
      .eq('is_archived', false)
      .order('name');

    if (error) throw error;
    if (data) setOrganizations(data);
  } catch (error) {
    console.error('Failed to fetch organizations:', error);
    toast({
      title: 'Failed to load organizations',
      description: 'Please refresh the page',
      variant: 'destructive'
    });
  } finally {
    setLoading(false);
  }
};
```

---

## 🎯 Phase 3: Enhancements (Priority: LOW)

### Enhancement #1: Search/Filter Assets
**Estimated Time:** 2-3 hours

```typescript
// Add search state per category
const [searchTerms, setSearchTerms] = useState<Record<string, string>>({});

// Filter function
const getFilteredItems = (cat: AssetCategory) => {
  const term = searchTerms[cat.key]?.toLowerCase() || '';
  if (!term) return cat.items;
  
  return cat.items.filter(item => 
    item.name.toLowerCase().includes(term) ||
    item.subtitle?.toLowerCase().includes(term)
  );
};

// In UI before item list:
<Input
  placeholder={`Search ${cat.label.toLowerCase()}...`}
  value={searchTerms[cat.key] || ''}
  onChange={(e) => setSearchTerms(prev => ({ 
    ...prev, 
    [cat.key]: e.target.value 
  }))}
  className="mb-2"
/>

{getFilteredItems(cat).map(item => /* render item */)}
```

---

### Enhancement #2: Migration History
**Estimated Time:** 2-3 hours

```typescript
// New component: MigrationHistory.tsx
const MigrationHistory = () => {
  const [migrations, setMigrations] = useState<MigrationLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMigrationHistory();
  }, []);

  const fetchMigrationHistory = async () => {
    const { data, error } = await supabase
      .from('migration_logs')
      .select(`
        *,
        source_org:source_organization_id(name),
        target_org:target_organization_id(name),
        performed_by_user:performed_by(email)
      `)
      .order('performed_at', { ascending: false })
      .limit(50);

    if (data) setMigrations(data);
    setLoading(false);
  };

  return (
    <div className="space-y-4">
      <h2>Migration History</h2>
      {migrations.map(m => (
        <Card key={m.id}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">
                  {m.source_org.name} → {m.target_org.name}
                </p>
                <p className="text-sm text-muted-foreground">
                  {new Date(m.performed_at).toLocaleString()}
                </p>
              </div>
              <Badge variant={m.is_undone ? 'secondary' : 'default'}>
                {m.is_undone ? 'Undone' : 'Active'}
              </Badge>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
```

---

### Enhancement #3: Dry Run Mode
**Estimated Time:** 2-3 hours

```typescript
// Add to edge function
if (req.headers.get('X-Dry-Run') === 'true') {
  // Validation only - no actual updates
  const validationResults = {
    canMigrate: true,
    issues: [],
    estimatedTime: Math.ceil(totalAssets / 100) * 2
  };
  
  // Check for FK constraint violations
  // Check for duplicate keys
  // Check table permissions
  
  return new Response(JSON.stringify(validationResults), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}
```

---

## 📋 Testing Checklist

### Unit Tests
- [ ] validateMigrationPlan() with various scenarios
- [ ] toggleCategory() edge cases
- [ ] getTotalSelected() calculation
- [ ] Undo timer countdown logic

### Integration Tests
- [ ] Full migration flow (select → preview → migrate → complete)
- [ ] Undo within 60 seconds
- [ ] Undo after 60 seconds (should fail)
- [ ] Migration with validation warnings
- [ ] Migration with validation errors (should block)
- [ ] Page refresh during undo window

### E2E Tests
- [ ] Super admin can access page
- [ ] Non-super-admin redirected
- [ ] Select organizations and preview assets
- [ ] Migrate with success
- [ ] Migrate with failure (simulate DB error)
- [ ] Undo successfully
- [ ] Truncation warning appears for large datasets

---

## 🚀 Deployment Strategy

### Step 1: Database Migration
```bash
# Apply new RPC function
supabase migration new migration_rpc
# Add SQL from Fix #2
supabase db push
```

### Step 2: Deploy Edge Functions
```bash
# Update migrate-assets with transaction logic
supabase functions deploy migrate-assets

# Test in staging
curl -X POST https://[project].supabase.co/functions/v1/migrate-assets \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -d '{"sourceOrgId":"...","targetOrgId":"...","assets":{}}'
```

### Step 3: Deploy UI Changes
```bash
# Run tests
npm run test

# Build
npm run build

# Deploy via Lovable
```

### Step 4: Monitor
- Watch Supabase logs for errors
- Monitor migration_logs table for failures
- Check user feedback in support channels

---

## 📊 Success Metrics

### Before Improvements
- ❌ Partial migration failures leave split data
- ❌ Users can create orphaned relationships
- ❌ No warning for truncated data (500+ items)
- ❌ Undo state lost on page refresh
- ⚠️ No validation before migration

### After Improvements
- ✅ Atomic migrations with automatic rollback
- ✅ Relationship validation prevents orphaned data
- ✅ Clear warnings for truncated datasets
- ✅ Undo persists across page refreshes
- ✅ Comprehensive validation before migration
- ✅ 95%+ migration success rate
- ✅ Zero orphaned data incidents

---

## 🔄 Maintenance Plan

### Weekly
- Review migration_logs for failed migrations
- Check for patterns in validation warnings

### Monthly
- Analyze migration sizes and durations
- Optimize RPC function if bottlenecks found
- Update documentation based on user feedback

### Quarterly
- Review and update asset type list (new tables?)
- Performance testing with large datasets
- Security audit of RLS policies

---

## 📚 References

- [Supabase RPC Documentation](https://supabase.com/docs/guides/database/functions)
- [PostgreSQL Transactions](https://www.postgresql.org/docs/current/tutorial-transactions.html)
- [React Testing Library](https://testing-library.com/react)
- [Framer Motion Docs](https://www.framer.com/motion/)

---

**Document Version:** 1.0  
**Last Updated:** 2026-01-09  
**Next Review:** After Phase 1 implementation
