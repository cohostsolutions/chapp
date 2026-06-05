import { useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';

export interface RoomCapacityValidation {
  isValid: boolean;
  message?: string;
  capacity?: number;
  guestCount?: number;
  excessGuests?: number;
}

export interface RoomCapacityValidationOptions {
  notify?: boolean;
}

/**
 * Validate guest count against room capacity
 */
export function useRoomCapacityValidation() {
  const { toast } = useToast();

  const validateGuestCount = useCallback(
    (
      guestCount: number,
      roomCapacity?: number,
      options?: RoomCapacityValidationOptions
    ): RoomCapacityValidation => {
      const shouldNotify = options?.notify ?? true;

      if (!roomCapacity) {
        return { isValid: true };
      }

      if (guestCount > roomCapacity) {
        const excessGuests = guestCount - roomCapacity;
        const message = `Guest count (${guestCount}) exceeds room capacity (${roomCapacity}). ${excessGuests} extra guest${excessGuests > 1 ? 's' : ''} cannot be accommodated.`;

        if (shouldNotify) {
          toast({
            title: 'Capacity Exceeded',
            description: message,
            variant: 'destructive',
          });
        }

        return {
          isValid: false,
          message,
          capacity: roomCapacity,
          guestCount,
          excessGuests,
        };
      }

      const remainingCapacity = roomCapacity - guestCount;
      if (remainingCapacity === 0 && shouldNotify) {
        toast({
          title: 'At Capacity',
          description: 'This room is at full capacity with the current guest count.',
          variant: 'default',
        });
      }

      return {
        isValid: true,
        capacity: roomCapacity,
        guestCount,
      };
    },
    [toast]
  );

  return { validateGuestCount };
}
