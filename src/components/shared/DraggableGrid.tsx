import { Reorder, useDragControls } from 'framer-motion';
import { GripVertical } from 'lucide-react';
import { ReactNode } from 'react';

interface DraggableGridProps<T> {
  items: T[];
  onReorder: (items: T[]) => void;
  renderItem: (item: T, index: number, dragHandle: ReactNode) => ReactNode;
  keyExtractor: (item: T) => string;
  disabled?: boolean;
}

export function DraggableGrid<T>({
  items,
  onReorder,
  renderItem,
  keyExtractor,
  disabled = false,
}: DraggableGridProps<T>) {
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

interface DraggableItemProps<T> {
  item: T;
  index: number;
  renderItem: (item: T, index: number, dragHandle: ReactNode) => ReactNode;
  disabled: boolean;
}

function DraggableItem<T>({
  item,
  index,
  renderItem,
  disabled,
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
    >
      {renderItem(item, index, dragHandle)}
    </Reorder.Item>
  );
}
