import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useRoomCapacityValidation } from '@/hooks/useRoomCapacityValidation';

export interface RoomCapacityAlertProps {
  guestCount?: number;
  roomCapacity?: number;
  roomName?: string;
  className?: string;
}

/**
 * Display alert if guest count exceeds room capacity
 */
export function RoomCapacityAlert({
  guestCount,
  roomCapacity,
  roomName = 'Room',
  className = '',
}: RoomCapacityAlertProps) {
  const { validateGuestCount } = useRoomCapacityValidation();

  if (!guestCount || !roomCapacity) {
    return null;
  }

  const validation = validateGuestCount(guestCount, roomCapacity, { notify: false });

  if (!validation.isValid) {
    return (
      <Alert variant="destructive" className={className}>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          {roomName} capacity is {roomCapacity} guests, but you entered {guestCount}.
          {validation.excessGuests && (
            <span className="block mt-1 font-medium">
              {validation.excessGuests} guest{validation.excessGuests > 1 ? 's' : ''} cannot be accommodated.
            </span>
          )}
        </AlertDescription>
      </Alert>
    );
  }

  const remainingCapacity = roomCapacity - guestCount;
  if (remainingCapacity === 0) {
    return (
      <Alert className={className}>
        <CheckCircle2 className="h-4 w-4" />
        <AlertDescription>
          This booking will fill {roomName} to capacity.
        </AlertDescription>
      </Alert>
    );
  }

  return null;
}
