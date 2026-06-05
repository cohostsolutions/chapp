import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface DashboardLayoutProps {
  title: string;
  stats: React.ReactNode;
  mainContent: React.ReactNode;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({ title, stats, mainContent }) => {
  return (
    <div className="container mx-auto py-8 px-4 md:px-6">
      <h1 className="text-3xl font-bold mb-6">{title}</h1>

      <div className="grid gap-6 mb-6 md:grid-cols-2 lg:grid-cols-4">
        {stats}
      </div>

      <div className="grid gap-6">
        {mainContent}
      </div>
    </div>
  );
};
