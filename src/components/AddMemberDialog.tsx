import { useState, useEffect } from 'react';
import { devError } from '@/lib/logger';
import {
  ResponsiveDialog,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogDescription,
  ResponsiveDialogBody,
  ResponsiveDialogFooter,
} from '@/components/shared/ResponsiveDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2, UserPlus, Search, User } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  AGENT_SUB_ROLE_OPTIONS,
  MEMBER_ROLE_OPTIONS,
  useOrganizationMemberAssignment,
  type AvailableOrganizationUser,
} from '@/hooks/useOrganizationMemberAssignment';

interface AddMemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
  organizationName: string;
  onMemberAdded: () => void;
}

export function AddMemberDialog({ 
  open, 
  onOpenChange, 
  organizationId, 
  organizationName,
  onMemberAdded 
}: AddMemberDialogProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [availableUsers, setAvailableUsers] = useState<AvailableOrganizationUser[]>([]);
  const [selectedUser, setSelectedUser] = useState<AvailableOrganizationUser | null>(null);
  const [selectedRole, setSelectedRole] = useState<string>('agent');
  const [selectedSubRole, setSelectedSubRole] = useState<string>('Sales');
  const [customSubRole, setCustomSubRole] = useState<string>('');
  const { toast } = useToast();
  const {
    isLoadingUsers,
    isAssigningMember,
    fetchAvailableUsers,
    assignMemberToOrganization,
  } = useOrganizationMemberAssignment();

  useEffect(() => {
    if (open) {
      void loadAvailableUsers();
    }
  }, [open]);

  const loadAvailableUsers = async () => {
    try {
      const users = await fetchAvailableUsers();
      setAvailableUsers(users);
    } catch (error) {
      devError('Error fetching users:', error);
      toast({
        title: 'Error',
        description: 'Failed to load available members',
        variant: 'destructive',
      });
    }
  };

  const filteredUsers = availableUsers.filter(user =>
    user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (user.full_name?.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedUser) {
      toast({
        title: "Validation Error",
        description: "Please select a user",
        variant: "destructive",
      });
      return;
    }

    try {
      const subRoleToSave = selectedRole === 'agent' 
        ? selectedSubRole === 'Others' ? customSubRole : selectedSubRole 
        : null;

      await assignMemberToOrganization({
        organizationId,
        userId: selectedUser.id,
        role: selectedRole as 'client_admin' | 'agent',
        subRole: subRoleToSave,
      });

      toast({
        title: "Member Added",
        description: `${selectedUser.full_name || selectedUser.email} has been added to ${organizationName}`,
      });

      onMemberAdded();
      onOpenChange(false);
      resetForm();
    } catch (error) {
      devError('Error adding member:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to add member",
        variant: "destructive",
      });
    }
  };

  const resetForm = () => {
    setSearchTerm('');
    setSelectedUser(null);
    setSelectedRole('agent');
    setSelectedSubRole('Sales');
    setCustomSubRole('');
  };

  const handleClose = (open: boolean) => {
    if (!open) resetForm();
    onOpenChange(open);
  };

  return (
    <ResponsiveDialog 
      open={open} 
      onOpenChange={handleClose}
      maxWidth="sm:max-w-[500px]"
      maxHeight="max-h-[75vh]"
      showCloseButton={false}
    >
      <ResponsiveDialogHeader>
        <ResponsiveDialogTitle className="flex items-center gap-2">
          <UserPlus className="w-5 h-5 text-primary" />
          Add Member
        </ResponsiveDialogTitle>
        <ResponsiveDialogDescription>
          Add a user to <strong>{organizationName}</strong>
        </ResponsiveDialogDescription>
      </ResponsiveDialogHeader>
      
      <ResponsiveDialogBody>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Search Users */}
          <div className="space-y-2">
            <Label>Select User</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by email or name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* User List */}
          <ScrollArea className="h-[180px] rounded-lg border border-border">
            {isLoadingUsers ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full p-4 text-center">
                <User className="w-8 h-8 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">
                  {searchTerm ? 'No users found' : 'No available users without organization'}
                </p>
              </div>
            ) : (
              <div className="p-2 space-y-1">
                {filteredUsers.map((user) => (
                  <button
                    key={user.id}
                    type="button"
                    onClick={() => setSelectedUser(user)}
                    className={`w-full p-3 rounded-lg text-left transition-colors ${
                      selectedUser?.id === user.id
                        ? 'bg-primary/20 border border-primary/30'
                        : 'hover:bg-secondary/50'
                    }`}
                  >
                    <p className="font-medium text-foreground text-sm">
                      {user.full_name || 'No name'}
                    </p>
                    <p className="text-xs text-muted-foreground">{user.email}</p>
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>

          {/* Selected User */}
          {selectedUser && (
            <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
              <p className="text-sm text-muted-foreground">Selected:</p>
              <p className="font-medium text-foreground">
                {selectedUser.full_name || selectedUser.email}
              </p>
            </div>
          )}

          {/* Role Selection */}
          <div className="space-y-2">
            <Label htmlFor="role">Role</Label>
            <Select value={selectedRole} onValueChange={setSelectedRole}>
              <SelectTrigger>
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent className="z-[60]">
                {MEMBER_ROLE_OPTIONS.map((role) => (
                  <SelectItem key={role.value} value={role.value}>
                    <div>
                      <p className="font-medium">{role.label}</p>
                      <p className="text-xs text-muted-foreground">{role.description}</p>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Sub Role */}
          {selectedRole === 'agent' && (
            <div className="space-y-2">
              <Label htmlFor="sub_role">Sub Role</Label>
              <Select value={selectedSubRole} onValueChange={setSelectedSubRole}>
                <SelectTrigger id="sub_role">
                  <SelectValue placeholder="Select a sub role" />
                </SelectTrigger>
                <SelectContent className="z-[60]">
                  {AGENT_SUB_ROLE_OPTIONS.map((role) => (
                    <SelectItem key={role} value={role}>{role}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          
          {selectedRole === 'agent' && selectedSubRole === 'Others' && (
            <div className="space-y-2">
              <Label htmlFor="custom_sub_role">Custom Sub Role</Label>
              <Input 
                id="custom_sub_role" 
                placeholder="Enter sub role"
                value={customSubRole}
                onChange={(e) => setCustomSubRole(e.target.value)}
              />
            </div>
          )}

          <ResponsiveDialogFooter>
            <Button type="button" variant="outline" onClick={() => handleClose(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="glow" disabled={isAssigningMember || !selectedUser}>
              {isAssigningMember ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Adding...
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4 mr-2" />
                  Add Member
                </>
              )}
            </Button>
          </ResponsiveDialogFooter>
        </form>
      </ResponsiveDialogBody>
    </ResponsiveDialog>
  );
}
