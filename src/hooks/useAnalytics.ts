import { useMemo } from 'react';
import { differenceInDays, format, startOfMonth, endOfMonth, eachMonthOfInterval, subMonths, parseISO, isWithinInterval, startOfDay, endOfDay } from 'date-fns';
import type { BookingWithRelations, RoomUnit } from '@/hooks/useAccommodationData';

export interface OccupancyDataPoint {
  date: string;
  occupancyRate: number;
  bookedNights: number;
  totalNights: number;
}

export interface RevenueDataPoint {
  period: string;
  revenue: number;
  bookingCount: number;
}

export interface RoomPerformance {
  roomId: string;
  roomName: string;
  occupancyRate: number;
  revenue: number;
  bookingCount: number;
  averageStay: number;
}

export interface StatusDistribution {
  status: string;
  count: number;
  percentage: number;
}

export interface AnalyticsMetrics {
  totalRevenue: number;
  totalBookings: number;
  averageBookingValue: number;
  averageStayDuration: number;
  overallOccupancyRate: number;
  occupancyTrend: OccupancyDataPoint[];
  revenueTrend: RevenueDataPoint[];
  statusDistribution: StatusDistribution[];
  roomPerformance: RoomPerformance[];
}

export function useAnalytics(
  bookings: BookingWithRelations[],
  rooms: RoomUnit[],
  dateRange: { from: Date; to: Date }
) {
  const analytics = useMemo(() => {
    const { from: startDate, to: endDate } = dateRange;

    // Filter bookings within date range
    const relevantBookings = bookings.filter(booking => {
      const checkIn = parseISO(booking.check_in);
      const checkOut = parseISO(booking.check_out);
      
      return (
        isWithinInterval(checkIn, { start: startDate, end: endDate }) ||
        isWithinInterval(checkOut, { start: startDate, end: endDate }) ||
        (checkIn <= startDate && checkOut >= endDate)
      );
    });

    // Calculate total revenue
    const totalRevenue = relevantBookings
      .filter(b => b.status !== 'cancelled')
      .reduce((sum, b) => sum + (b.total_price || 0), 0);

    // Total bookings (excluding cancelled)
    const activeBookings = relevantBookings.filter(b => b.status !== 'cancelled');
    const totalBookings = activeBookings.length;

    // Average booking value
    const averageBookingValue = totalBookings > 0 ? totalRevenue / totalBookings : 0;

    // Average stay duration
    const totalNights = activeBookings.reduce((sum, b) => {
      return sum + differenceInDays(parseISO(b.check_out), parseISO(b.check_in));
    }, 0);
    const averageStayDuration = totalBookings > 0 ? totalNights / totalBookings : 0;

    // Calculate overall occupancy rate
    const totalDaysInRange = differenceInDays(endDate, startDate) + 1;
    const totalAvailableNights = rooms.filter(r => r.is_active).length * totalDaysInRange;
    const totalBookedNights = activeBookings.reduce((sum, booking) => {
      const checkIn = parseISO(booking.check_in);
      const checkOut = parseISO(booking.check_out);
      const bookingStart = checkIn < startDate ? startDate : checkIn;
      const bookingEnd = checkOut > endDate ? endDate : checkOut;
      return sum + differenceInDays(bookingEnd, bookingStart);
    }, 0);
    const overallOccupancyRate = totalAvailableNights > 0 
      ? (totalBookedNights / totalAvailableNights) * 100 
      : 0;

    // Occupancy trend by month
    const months = eachMonthOfInterval({ start: startDate, end: endDate });
    const occupancyTrend: OccupancyDataPoint[] = months.map(monthDate => {
      const monthStart = startOfMonth(monthDate);
      const monthEnd = endOfMonth(monthDate);
      const daysInMonth = differenceInDays(monthEnd, monthStart) + 1;
      const availableNights = rooms.filter(r => r.is_active).length * daysInMonth;

      const bookedNights = activeBookings.reduce((sum, booking) => {
        const checkIn = parseISO(booking.check_in);
        const checkOut = parseISO(booking.check_out);
        
        if (checkOut <= monthStart || checkIn > monthEnd) return sum;
        
        const bookingStart = checkIn < monthStart ? monthStart : checkIn;
        const bookingEnd = checkOut > monthEnd ? monthEnd : checkOut;
        return sum + differenceInDays(bookingEnd, bookingStart);
      }, 0);

      const occupancyRate = availableNights > 0 ? (bookedNights / availableNights) * 100 : 0;

      return {
        date: format(monthDate, 'MMM yyyy'),
        occupancyRate: Math.round(occupancyRate * 10) / 10,
        bookedNights,
        totalNights: availableNights,
      };
    });

    // Revenue trend by month
    const revenueTrend: RevenueDataPoint[] = months.map(monthDate => {
      const monthStart = startOfMonth(monthDate);
      const monthEnd = endOfMonth(monthDate);

      const monthBookings = activeBookings.filter(booking => {
        const checkIn = parseISO(booking.check_in);
        return isWithinInterval(checkIn, { start: monthStart, end: monthEnd });
      });

      const revenue = monthBookings.reduce((sum, b) => sum + (b.total_price || 0), 0);

      return {
        period: format(monthDate, 'MMM yyyy'),
        revenue: Math.round(revenue * 100) / 100,
        bookingCount: monthBookings.length,
      };
    });

    // Status distribution
    const statusCounts = relevantBookings.reduce((acc, booking) => {
      acc[booking.status] = (acc[booking.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const statusDistribution: StatusDistribution[] = Object.entries(statusCounts).map(([status, count]) => ({
      status,
      count,
      percentage: Math.round((count / relevantBookings.length) * 100 * 10) / 10,
    }));

    // Room performance
    const roomPerformance: RoomPerformance[] = rooms
      .filter(r => r.is_active)
      .map(room => {
        const roomBookings = activeBookings.filter(b => b.room_unit_id === room.id);
        const roomRevenue = roomBookings.reduce((sum, b) => sum + (b.total_price || 0), 0);
        const roomNights = roomBookings.reduce((sum, b) => {
          return sum + differenceInDays(parseISO(b.check_out), parseISO(b.check_in));
        }, 0);
        const roomAvailableNights = totalDaysInRange;
        const roomOccupancyRate = roomAvailableNights > 0 ? (roomNights / roomAvailableNights) * 100 : 0;
        const avgStay = roomBookings.length > 0 ? roomNights / roomBookings.length : 0;

        return {
          roomId: room.id,
          roomName: room.name,
          occupancyRate: Math.round(roomOccupancyRate * 10) / 10,
          revenue: Math.round(roomRevenue * 100) / 100,
          bookingCount: roomBookings.length,
          averageStay: Math.round(avgStay * 10) / 10,
        };
      })
      .sort((a, b) => b.revenue - a.revenue);

    return {
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      totalBookings,
      averageBookingValue: Math.round(averageBookingValue * 100) / 100,
      averageStayDuration: Math.round(averageStayDuration * 10) / 10,
      overallOccupancyRate: Math.round(overallOccupancyRate * 10) / 10,
      occupancyTrend,
      revenueTrend,
      statusDistribution,
      roomPerformance,
    } as AnalyticsMetrics;
  }, [bookings, rooms, dateRange]);

  return analytics;
}
