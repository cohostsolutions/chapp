import * as React from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ResponsiveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
  className?: string;
  /** Maximum width for desktop dialog. Default: "sm:max-w-[500px]" */
  maxWidth?: string;
  /** Maximum height for scroll content. Default: "max-h-[60vh]" */
  maxHeight?: string;
  /** Whether to show built-in close button on mobile drawer */
  showCloseButton?: boolean;
}

interface ResponsiveDialogHeaderProps {
  children: React.ReactNode;
  className?: string;
}

interface ResponsiveDialogTitleProps {
  children: React.ReactNode;
  className?: string;
}

interface ResponsiveDialogDescriptionProps {
  children: React.ReactNode;
  className?: string;
}

interface ResponsiveDialogContentProps {
  children: React.ReactNode;
  className?: string;
}

interface ResponsiveDialogFooterProps {
  children: React.ReactNode;
  className?: string;
}

const ResponsiveDialogContext = React.createContext<{ isMobile: boolean }>({
  isMobile: false,
});

export function ResponsiveDialog({
  open,
  onOpenChange,
  children,
  className,
  maxWidth = "sm:max-w-[500px]",
  maxHeight = "max-h-[60vh]",
  showCloseButton = true,
}: ResponsiveDialogProps) {
  const isMobile = useIsMobile();


  if (isMobile) {
    return (
      <ResponsiveDialogContext.Provider value={{ isMobile: true }}>
        <Drawer open={open} onOpenChange={onOpenChange}>
          <DrawerContent className={cn("max-h-[85vh] flex flex-col", className)}>
            <ScrollArea className="flex-1 overflow-y-auto px-4 pr-6">
              {children}
            </ScrollArea>
            {showCloseButton && (
              <DrawerFooter className="pt-2 shrink-0">
                <DrawerClose asChild>
                  <Button variant="outline" className="w-full">
                    <X className="w-4 h-4 mr-2" />
                    Close
                  </Button>
                </DrawerClose>
              </DrawerFooter>
            )}
          </DrawerContent>
        </Drawer>
      </ResponsiveDialogContext.Provider>
    );
  }

  return (
    <ResponsiveDialogContext.Provider value={{ isMobile: false }}>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className={cn("max-h-[90vh] flex flex-col", maxWidth, className)}>
          <ScrollArea className={cn("flex-1 overflow-y-auto pr-6", maxHeight)}>
            {children}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </ResponsiveDialogContext.Provider>
  );
}


export function ResponsiveDialogHeader({ children, className }: ResponsiveDialogHeaderProps) {
  const { isMobile } = React.useContext(ResponsiveDialogContext);
  
  if (isMobile) {
    return <DrawerHeader className={cn("text-left", className)}>{children}</DrawerHeader>;
  }
  
  return <DialogHeader className={className}>{children}</DialogHeader>;
}

export function ResponsiveDialogTitle({ children, className }: ResponsiveDialogTitleProps) {
  const { isMobile } = React.useContext(ResponsiveDialogContext);
  
  if (isMobile) {
    return <DrawerTitle className={className}>{children}</DrawerTitle>;
  }
  
  return <DialogTitle className={className}>{children}</DialogTitle>;
}

export function ResponsiveDialogDescription({ children, className }: ResponsiveDialogDescriptionProps) {
  const { isMobile } = React.useContext(ResponsiveDialogContext);
  
  if (isMobile) {
    return <DrawerDescription className={className}>{children}</DrawerDescription>;
  }
  
  return <DialogDescription className={className}>{children}</DialogDescription>;
}

export function ResponsiveDialogBody({ children, className }: ResponsiveDialogContentProps) {
  return <div className={cn("px-1 py-4", className)}>{children}</div>;
}

export function ResponsiveDialogFooter({ children, className }: ResponsiveDialogFooterProps) {
  const { isMobile } = React.useContext(ResponsiveDialogContext);
  
  if (isMobile) {
    return (
      <div className={cn("flex flex-col-reverse gap-2 pt-4 pb-2", className)}>
        {children}
      </div>
    );
  }
  
  return <DialogFooter className={cn("pt-4", className)}>{children}</DialogFooter>;
}
