import { useState, ReactNode } from 'react';
import { Reorder, useDragControls } from 'framer-motion';
import { GripVertical, ChevronDown, ChevronRight, FolderOpen, Plus, X, Check, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface CategoryDraggableGridProps<T> {
  items: T[];
  onReorder: (items: T[]) => void;
  onCategoryChange?: (itemId: string, newCategory: string | null) => void;
  onCategoryCreate?: (categoryName: string) => void;
  onCategoryRename?: (oldName: string, newName: string) => void;
  onCategoryDelete?: (categoryName: string) => void;
  renderItem: (item: T, index: number, dragHandle: ReactNode) => ReactNode;
  keyExtractor: (item: T) => string;
  categoryExtractor: (item: T) => string | null;
  disabled?: boolean;
  uncategorizedLabel?: string;
}

export function CategoryDraggableGrid<T>({
  items,
  onReorder,
  onCategoryChange,
  onCategoryCreate,
  onCategoryRename,
  onCategoryDelete,
  renderItem,
  keyExtractor,
  categoryExtractor,
  disabled = false,
  uncategorizedLabel = 'Uncategorized',
}: CategoryDraggableGridProps<T>) {
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());
  const [dragOverCategory, setDragOverCategory] = useState<string | null>(null);
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [emptyCategories, setEmptyCategories] = useState<string[]>([]);
  const [renamingCategory, setRenamingCategory] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  // Group items by category
  const groupedItems = items.reduce((acc, item) => {
    const category = categoryExtractor(item) || uncategorizedLabel;
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(item);
    return acc;
  }, {} as Record<string, T[]>);

  // Add empty categories (created but no items yet)
  emptyCategories.forEach(cat => {
    if (!groupedItems[cat]) {
      groupedItems[cat] = [];
    }
  });

  // Sort categories alphabetically, but keep uncategorized at the end
  const sortedCategories = Object.keys(groupedItems).sort((a, b) => {
    if (a === uncategorizedLabel) return 1;
    if (b === uncategorizedLabel) return -1;
    return a.localeCompare(b);
  });

  const toggleCategory = (category: string) => {
    setCollapsedCategories(prev => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  const handleCategoryReorder = (category: string, newItems: T[]) => {
    // Rebuild full items array with the reordered category
    const otherItems = items.filter(item => {
      const itemCategory = categoryExtractor(item) || uncategorizedLabel;
      return itemCategory !== category;
    });
    
    // Find where to insert the reordered items based on category order
    const result: T[] = [];
    for (const cat of sortedCategories) {
      if (cat === category) {
        result.push(...newItems);
      } else {
        result.push(...otherItems.filter(item => {
          const itemCat = categoryExtractor(item) || uncategorizedLabel;
          return itemCat === cat;
        }));
      }
    }
    
    onReorder(result);
  };

  const handleDragOver = (category: string) => {
    if (!disabled) {
      setDragOverCategory(category);
    }
  };

  const handleDragLeave = () => {
    setDragOverCategory(null);
  };

  const handleDropOnCategory = (targetCategory: string, itemId: string) => {
    if (onCategoryChange && !disabled) {
      const actualCategory = targetCategory === uncategorizedLabel ? null : targetCategory;
      onCategoryChange(itemId, actualCategory);
    }
    setDragOverCategory(null);
  };

  const handleAddCategory = () => {
    const trimmedName = newCategoryName.trim();
    if (trimmedName) {
      // Check if category already exists
      if (!groupedItems[trimmedName]) {
        setEmptyCategories(prev => [...prev, trimmedName]);
      }
      if (onCategoryCreate) {
        onCategoryCreate(trimmedName);
      }
      setNewCategoryName('');
      setIsAddingCategory(false);
    }
  };

  const handleCancelAddCategory = () => {
    setNewCategoryName('');
    setIsAddingCategory(false);
  };

  const handleStartRename = (category: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setRenamingCategory(category);
    setRenameValue(category);
  };

  const handleConfirmRename = () => {
    const trimmedName = renameValue.trim();
    if (trimmedName && renamingCategory && trimmedName !== renamingCategory) {
      // Update empty categories tracking if needed
      if (emptyCategories.includes(renamingCategory)) {
        setEmptyCategories(prev => prev.map(cat => cat === renamingCategory ? trimmedName : cat));
      }
      if (onCategoryRename) {
        onCategoryRename(renamingCategory, trimmedName);
      }
    }
    setRenamingCategory(null);
    setRenameValue('');
  };

  const handleCancelRename = () => {
    setRenamingCategory(null);
    setRenameValue('');
  };

  const handleDeleteCategory = (category: string, e: React.MouseEvent) => {
    e.stopPropagation();
    // Remove from empty categories tracking
    setEmptyCategories(prev => prev.filter(cat => cat !== category));
    if (onCategoryDelete) {
      onCategoryDelete(category);
    }
  };

  if (sortedCategories.length === 0) {
    return null;
  }

  // If only one category or no categories, use simple grid
  if (sortedCategories.length === 1 || (sortedCategories.length === 1 && sortedCategories[0] === uncategorizedLabel)) {
    return (
      <Reorder.Group
        axis="y"
        values={items}
        onReorder={onReorder}
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
      >
        {items.map((item, index) => (
          <DraggableItem
            key={keyExtractor(item)}
            item={item}
            index={index}
            renderItem={renderItem}
            disabled={disabled}
          />
        ))}
      </Reorder.Group>
    );
  }

  return (
    <div className="space-y-6">
      {/* Add Category Button/Input */}
      {onCategoryCreate && !disabled && (
        <div className="flex items-center gap-2">
          {isAddingCategory ? (
            <div className="flex items-center gap-2 w-full max-w-md">
              <Input
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="Enter category name..."
                className="flex-1"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddCategory();
                  if (e.key === 'Escape') handleCancelAddCategory();
                }}
              />
              <Button
                size="icon"
                variant="ghost"
                onClick={handleAddCategory}
                disabled={!newCategoryName.trim()}
                className="text-primary hover:text-primary"
              >
                <Check className="w-4 h-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={handleCancelAddCategory}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsAddingCategory(true)}
              className="gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Category
            </Button>
          )}
        </div>
      )}

      {sortedCategories.map(category => {
        const categoryItems = groupedItems[category];
        const isCollapsed = collapsedCategories.has(category);
        const isDragOver = dragOverCategory === category;

        return (
          <div 
            key={category} 
            className={cn(
              "rounded-lg border transition-all duration-200",
              isDragOver 
                ? "border-primary bg-primary/5 ring-2 ring-primary/20" 
                : "border-border bg-card/50"
            )}
            onDragOver={(e) => {
              e.preventDefault();
              handleDragOver(category);
            }}
            onDragLeave={handleDragLeave}
          >
            <div
              className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors rounded-t-lg"
            >
              <div className="flex items-center gap-2 flex-1">
                <button onClick={() => toggleCategory(category)} className="flex items-center gap-2">
                  {isCollapsed ? (
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  )}
                  <FolderOpen className="w-4 h-4 text-primary" />
                </button>
                
                {renamingCategory === category ? (
                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    <Input
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      className="h-7 w-40"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleConfirmRename();
                        if (e.key === 'Escape') handleCancelRename();
                      }}
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={handleConfirmRename}
                      disabled={!renameValue.trim() || renameValue.trim() === renamingCategory}
                      className="h-7 w-7 text-primary hover:text-primary"
                    >
                      <Check className="w-3 h-3" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={handleCancelRename}
                      className="h-7 w-7 text-muted-foreground hover:text-foreground"
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                ) : (
                  <>
                    <button onClick={() => toggleCategory(category)} className="flex items-center gap-2">
                      <span className="font-medium text-foreground">{category}</span>
                      <span className="text-sm text-muted-foreground">({categoryItems.length})</span>
                    </button>
                    
                    {!disabled && category !== uncategorizedLabel && (
                      <div className="flex items-center gap-1 ml-2">
                        {onCategoryRename && (
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={(e) => handleStartRename(category, e)}
                            className="h-6 w-6 text-muted-foreground hover:text-foreground"
                          >
                            <Pencil className="w-3 h-3" />
                          </Button>
                        )}
                        {onCategoryDelete && categoryItems.length === 0 && (
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={(e) => handleDeleteCategory(category, e)}
                            className="h-6 w-6 text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
              {!disabled && onCategoryChange && (
                <span className="text-xs text-muted-foreground">
                  Drag items here to move
                </span>
              )}
            </div>
            
            {!isCollapsed && (
              <div className="p-4 pt-0">
                {categoryItems.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground border-2 border-dashed border-border rounded-lg">
                    <FolderOpen className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Drag items here to add to this category</p>
                  </div>
                ) : (
                  <Reorder.Group
                    axis="y"
                    values={categoryItems}
                    onReorder={(newItems) => handleCategoryReorder(category, newItems)}
                    className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
                  >
                    {categoryItems.map((item, index) => (
                      <DraggableItem
                        key={keyExtractor(item)}
                        item={item}
                        index={index}
                        renderItem={renderItem}
                        disabled={disabled}
                        onDragEnd={() => {
                          if (dragOverCategory && dragOverCategory !== category) {
                            handleDropOnCategory(dragOverCategory, keyExtractor(item));
                          }
                        }}
                      />
                    ))}
                  </Reorder.Group>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

interface DraggableItemProps<T> {
  item: T;
  index: number;
  renderItem: (item: T, index: number, dragHandle: ReactNode) => ReactNode;
  disabled: boolean;
  onDragEnd?: () => void;
}

function DraggableItem<T>({
  item,
  index,
  renderItem,
  disabled,
  onDragEnd,
}: DraggableItemProps<T>) {
  const controls = useDragControls();

  const dragHandle = disabled ? null : (
    <div
      className="cursor-grab active:cursor-grabbing p-1 -m-1 text-muted-foreground hover:text-foreground transition-colors"
      onPointerDown={(e) => controls.start(e)}
    >
      <GripVertical className="w-4 h-4" />
    </div>
  );

  return (
    <Reorder.Item
      value={item}
      dragListener={false}
      dragControls={controls}
      className="list-none"
      whileDrag={{ 
        scale: 1.02, 
        boxShadow: "0 10px 30px -10px rgba(0,0,0,0.3)",
        zIndex: 50 
      }}
      onDragEnd={onDragEnd}
    >
      {renderItem(item, index, dragHandle)}
    </Reorder.Item>
  );
}
