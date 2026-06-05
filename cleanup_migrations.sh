#!/bin/bash
# Archive improperly named migration files that don't match <timestamp>_<name>.sql pattern

ARCHIVE_DIR="supabase/migrations/.archive"
mkdir -p "$ARCHIVE_DIR"

# List of files to archive (wrong format)
FILES_TO_ARCHIVE=(
  ".deploy"
  ".trigger"
  "enhance_ai_communication_system.sql"
  "20260110_inventory_items.sql"
  "20260110_lead_offerings.sql"
  "20260111_atomic_migration_rpc.sql"
)

for file in "${FILES_TO_ARCHIVE[@]}"; do
  if [ -f "supabase/migrations/$file" ]; then
    echo "Archiving: $file"
    mv "supabase/migrations/$file" "$ARCHIVE_DIR/$file.bak"
  fi
done

echo "Cleanup complete. Archived files are in $ARCHIVE_DIR"
