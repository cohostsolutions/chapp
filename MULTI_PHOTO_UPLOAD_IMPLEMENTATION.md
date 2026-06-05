# Multiple Photo/File Upload Implementation

## Summary
Successfully added multiple photo upload capability for menu/offerings (May/Jay organizations) and verified multiple file upload for knowledge bases (all client admins).

## Changes Made

### 1. Database Migrations

**File:** `20260117200000_add_image_urls_to_offerings.sql`
- Added `image_urls` column (text array) to `offerings` table
- Migrated existing `image_url` data to `image_urls` array
- Created GIN index for performance

**File:** `20260117200001_add_image_urls_to_knowledge_base.sql`
- Added `image_urls` column (text array) to `knowledge_base_entries` table
- Migrated existing `image_url` data to `image_urls` array
- Created GIN index for performance

### 2. Frontend Components

**OfferingsTabContent.tsx (Jay Organizations)**
- Replaced `ImageUpload` with `MultiImageUpload` component
- Updated interface to include `image_urls: string[]`
- Modified form state to handle array of images
- Updated `openAddDialog()` to reset `image_urls: []`
- Updated `openEditDialog()` to load from `image_urls` array or fallback to `image_url`
- Updated `handleSubmit()` to save both `image_url` (first item) and `image_urls` array
- Updated card display to show first image with "+X more" badge

**MenuItemsTabContent.tsx (May Organizations)**
- Replaced `ImageUpload` with `MultiImageUpload` component
- Updated interface to include `image_urls: string[]`
- Modified form state to handle array of images
- Updated dialog handlers to load/save `image_urls` array
- Updated grid view to show first image with "+X more" badge
- Updated list view to show first image with compact counter badge

### 3. AI Functions

**ai-chat/index.ts**
- Updated `getOfferings()` to fetch and display all images from `image_urls` array
- Updated `getMenuItems()` to fetch and display all images from `image_urls` array
- Added logic to number images when multiple exist (e.g., [IMAGE 1: url], [IMAGE 2: url])
- Maintained backward compatibility with single `image_url` field

### 4. Knowledge Base

**Verified Existing Implementation:**
- File input already has `multiple` attribute enabled
- Handles multiple document uploads (PDF, TXT, DOC, DOCX, images)
- Drag & drop supports multiple files
- Shows list of uploaded files with individual remove buttons
- **No changes needed** ✅

## Features

### For May & Jay Organizations (Menu/Offerings)
- ✅ Upload up to 10 photos per menu item/offering
- ✅ Drag to reorder photos (first image is main photo)
- ✅ Click to open lightbox gallery
- ✅ Delete individual photos
- ✅ Visual indicator showing "+X more" photos
- ✅ Backward compatible with existing single `image_url`

### For All Client Admins (Knowledge Base)
- ✅ Upload multiple documents at once
- ✅ Support for PDF, TXT, DOC, DOCX, JPG, PNG, WebP, GIF
- ✅ Drag & drop multiple files
- ✅ Auto-processing of uploaded documents
- ✅ File list with individual remove buttons

## Migration Path

### Deploy Steps

1. **Run Database Migrations:**
   ```bash
   supabase db push
   ```
   This will add `image_urls` columns to both tables.

2. **Verify Migrations:**
   ```sql
   -- Check offerings table
   SELECT column_name, data_type FROM information_schema.columns 
   WHERE table_name = 'offerings' AND column_name = 'image_urls';

   -- Check knowledge_base_entries table
   SELECT column_name, data_type FROM information_schema.columns 
   WHERE table_name = 'knowledge_base_entries' AND column_name = 'image_urls';
   ```

3. **Deploy Frontend:**
   Frontend changes are backward compatible. Existing offerings/menu items with `image_url` will automatically display correctly.

## Testing Checklist

### Jay Organizations (Offerings)
- [ ] Create new offering with multiple photos
- [ ] Edit existing offering and add more photos
- [ ] Verify first photo shows as main image
- [ ] Verify "+X more" badge appears when multiple photos exist
- [ ] Test AI chat shows all offering images
- [ ] Verify existing offerings with single image still work

### May Organizations (Menu Items)
- [ ] Create new menu item with multiple photos
- [ ] Edit existing menu item and add more photos
- [ ] Verify grid view shows first photo with counter
- [ ] Verify list view shows first photo with compact counter
- [ ] Test AI chat shows all menu item images
- [ ] Verify existing menu items with single image still work

### Knowledge Base (All Client Admins)
- [ ] Upload single document
- [ ] Upload multiple documents at once (3-5 files)
- [ ] Drag and drop multiple files
- [ ] Verify file list shows all uploaded files
- [ ] Verify individual file removal works
- [ ] Test "Clear All" button

## Backward Compatibility

All changes maintain backward compatibility:
- Existing offerings/menu items with `image_url` will display correctly
- Frontend checks for `image_urls` array first, then falls back to `image_url`
- Database migration preserves existing `image_url` data
- AI functions handle both single and multiple images

## TypeScript Errors

✅ **No errors found** in:
- `/workspaces/canvascapital/src/components/sales/OfferingsTabContent.tsx`
- `/workspaces/canvascapital/src/components/restaurant/MenuItemsTabContent.tsx`

## Notes

- `MultiImageUpload` component (already existed for room units) provides:
  - Drag to reorder photos
  - Lightbox gallery view
  - First image marked as "Main"
  - Maximum 10 images per item (configurable via `maxImages` prop)
  - Automatic upload to `item-images` storage bucket

- Knowledge base file upload already supported multiple files via HTML5 `multiple` attribute on file input
