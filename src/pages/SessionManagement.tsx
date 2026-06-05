import { SessionsTable } from "@/components/settings/sessions/SessionsTable";

export default function SessionManagement() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Session Management</h3>
        <p className="text-sm text-muted-foreground">
          View and revoke active user sessions across the platform.
        </p>
      </div>
      <SessionsTable />
    </div>
  );
}
