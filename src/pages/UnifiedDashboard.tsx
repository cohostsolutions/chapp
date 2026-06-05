import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import CeceDashboard from '@/components/dashboard/CeceDashboard';
import AdminDashboard from '@/components/dashboard/AdminDashboard';
import { ErrorBoundary } from '@/components/ErrorBoundary';

function UnifiedDashboardContent() {
  const { isSuperAdmin, impersonatedRole } = useAuth();

  // Show AdminDashboard for super admins who are NOT impersonating
  if (isSuperAdmin && !impersonatedRole) {
    return <AdminDashboard />;
  }

  // Otherwise show Cece dashboard for all users
  return <CeceDashboard />;
}

export default function UnifiedDashboard() {
  return (
    <ErrorBoundary fullPage>
      <UnifiedDashboardContent />
    </ErrorBoundary>
  );
}
