import { useState, useEffect } from 'react';
import { devError } from '@/lib/logger';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Shield, 
  ShieldOff, 
  Plus, 
  Trash2, 
  Clock, 
  Globe,
  RefreshCw,
  CheckCircle,
  Bot,
  User
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format, formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';

interface IPBlockEntry {
  id: string;
  ip_address: string;
  list_type: string;
  reason: string | null;
  expires_at: string | null;
  is_active: boolean;
  auto_blocked: boolean;
  blocked_email: string | null;
  failed_attempts: number | null;
  created_at: string;
  created_by: string | null;
}

export function IPBlocklistManager() {
  const [entries, setEntries] = useState<IPBlockEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'block' | 'allow'>('block');
  
  // Form state
  const [newIP, setNewIP] = useState('');
  const [newReason, setNewReason] = useState('');
  const [newListType, setNewListType] = useState<'block' | 'allow'>('block');
  const [newExpiration, setNewExpiration] = useState<string>('24h');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchEntries = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('ip_blocklist')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setEntries(data || []);
    } catch (error) {
      devError('Error fetching IP blocklist:', error);
      toast.error('Failed to load IP blocklist');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchEntries();
  }, []);

  const handleAddEntry = async () => {
    if (!newIP.trim()) {
      toast.error('IP address is required');
      return;
    }

    // Basic IP validation
    const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (!ipRegex.test(newIP.trim())) {
      toast.error('Please enter a valid IP address');
      return;
    }

    setIsSubmitting(true);
    try {
      let expiresAt: string | null = null;
      if (newExpiration !== 'never') {
        const hours = newExpiration === '1h' ? 1 
          : newExpiration === '24h' ? 24 
          : newExpiration === '7d' ? 168 
          : newExpiration === '30d' ? 720 
          : 0;
        if (hours > 0) {
          expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
        }
      }

      const { error } = await supabase
        .from('ip_blocklist')
        .upsert({
          ip_address: newIP.trim(),
          list_type: newListType,
          reason: newReason.trim() || null,
          expires_at: expiresAt,
          is_active: true,
          auto_blocked: false,
        }, { 
          onConflict: 'ip_address',
          ignoreDuplicates: false 
        });

      if (error) throw error;

      toast.success(`IP address ${newListType === 'block' ? 'blocked' : 'allowlisted'} successfully`);
      setIsAddDialogOpen(false);
      setNewIP('');
      setNewReason('');
      setNewListType('block');
      setNewExpiration('24h');
      fetchEntries();
    } catch (error) {
      devError('Error adding IP entry:', error);
      toast.error('Failed to add IP entry');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleActive = async (entry: IPBlockEntry) => {
    try {
      const { error } = await supabase
        .from('ip_blocklist')
        .update({ is_active: !entry.is_active })
        .eq('id', entry.id);

      if (error) throw error;

      toast.success(`IP ${entry.is_active ? 'deactivated' : 'activated'}`);
      fetchEntries();
    } catch (error) {
      devError('Error toggling IP entry:', error);
      toast.error('Failed to update IP entry');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from('ip_blocklist')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success('IP entry removed');
      fetchEntries();
    } catch (error) {
      devError('Error deleting IP entry:', error);
      toast.error('Failed to delete IP entry');
    }
  };

  const filteredEntries = entries.filter(e => e.list_type === activeTab);
  const blockedCount = entries.filter(e => e.list_type === 'block' && e.is_active).length;
  const allowedCount = entries.filter(e => e.list_type === 'allow' && e.is_active).length;
  const autoBlockedCount = entries.filter(e => e.auto_blocked && e.is_active).length;

  const isExpired = (expiresAt: string | null) => {
    if (!expiresAt) return false;
    return new Date(expiresAt) < new Date();
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="glass">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Blocked IPs</p>
                <p className="text-2xl font-bold text-destructive">{blockedCount}</p>
              </div>
              <ShieldOff className="w-8 h-8 text-destructive/50" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="glass">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Allowed IPs</p>
                <p className="text-2xl font-bold text-green-500">{allowedCount}</p>
              </div>
              <Shield className="w-8 h-8 text-green-500/50" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="glass">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Auto-Blocked</p>
                <p className="text-2xl font-bold text-amber-500">{autoBlockedCount}</p>
              </div>
              <Bot className="w-8 h-8 text-amber-500/50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Card */}
      <Card className="glass">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-primary" />
                IP Blocklist & Allowlist
              </CardTitle>
              <CardDescription>
                Manage blocked and allowed IP addresses
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={fetchEntries}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </Button>
              <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Entry
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add IP Entry</DialogTitle>
                    <DialogDescription>
                      Block or allow a specific IP address
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label>IP Address</Label>
                      <Input
                        placeholder="192.168.1.1"
                        value={newIP}
                        onChange={(e) => setNewIP(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>List Type</Label>
                      <Select value={newListType} onValueChange={(v) => setNewListType(v as 'block' | 'allow')}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="block">
                            <div className="flex items-center gap-2">
                              <ShieldOff className="w-4 h-4 text-destructive" />
                              Block
                            </div>
                          </SelectItem>
                          <SelectItem value="allow">
                            <div className="flex items-center gap-2">
                              <Shield className="w-4 h-4 text-green-500" />
                              Allow
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Expiration</Label>
                      <Select value={newExpiration} onValueChange={setNewExpiration}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1h">1 hour</SelectItem>
                          <SelectItem value="24h">24 hours</SelectItem>
                          <SelectItem value="7d">7 days</SelectItem>
                          <SelectItem value="30d">30 days</SelectItem>
                          <SelectItem value="never">Never (permanent)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Reason (optional)</Label>
                      <Textarea
                        placeholder="Reason for blocking/allowing this IP..."
                        value={newReason}
                        onChange={(e) => setNewReason(e.target.value)}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleAddEntry} disabled={isSubmitting}>
                      {isSubmitting ? 'Adding...' : 'Add Entry'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'block' | 'allow')}>
            <TabsList className="mb-4">
              <TabsTrigger value="block" className="flex items-center gap-2">
                <ShieldOff className="w-4 h-4" />
                Blocked ({entries.filter(e => e.list_type === 'block').length})
              </TabsTrigger>
              <TabsTrigger value="allow" className="flex items-center gap-2">
                <Shield className="w-4 h-4" />
                Allowed ({entries.filter(e => e.list_type === 'allow').length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value={activeTab}>
              <ScrollArea className="h-[400px]">
                {isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : filteredEntries.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                    <CheckCircle className="w-8 h-8 mb-2 text-green-500" />
                    <p>No {activeTab === 'block' ? 'blocked' : 'allowed'} IPs</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>IP Address</TableHead>
                        <TableHead>Reason</TableHead>
                        <TableHead>Expires</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredEntries.map((entry) => (
                        <TableRow 
                          key={entry.id}
                          className={!entry.is_active || isExpired(entry.expires_at) ? 'opacity-50' : ''}
                        >
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Globe className="w-4 h-4 text-muted-foreground" />
                              <span className="font-mono">{entry.ip_address}</span>
                              {entry.auto_blocked && (
                                <Badge variant="secondary" className="text-xs">
                                  <Bot className="w-3 h-3 mr-1" />
                                  Auto
                                </Badge>
                              )}
                            </div>
                            {entry.blocked_email && (
                              <p className="text-xs text-muted-foreground mt-1">
                                Target: {entry.blocked_email}
                              </p>
                            )}
                          </TableCell>
                          <TableCell>
                            <p className="text-sm max-w-[200px] truncate" title={entry.reason || ''}>
                              {entry.reason || '-'}
                            </p>
                          </TableCell>
                          <TableCell>
                            {entry.expires_at ? (
                              <div className="flex items-center gap-1">
                                <Clock className="w-3 h-3 text-muted-foreground" />
                                <span className={`text-xs ${isExpired(entry.expires_at) ? 'text-destructive' : ''}`}>
                                  {isExpired(entry.expires_at) 
                                    ? 'Expired' 
                                    : formatDistanceToNow(new Date(entry.expires_at), { addSuffix: true })
                                  }
                                </span>
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">Never</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Switch
                                checked={entry.is_active && !isExpired(entry.expires_at)}
                                onCheckedChange={() => handleToggleActive(entry)}
                                disabled={isExpired(entry.expires_at)}
                              />
                              <Badge 
                                variant={entry.is_active && !isExpired(entry.expires_at) ? 'default' : 'secondary'}
                              >
                                {isExpired(entry.expires_at) ? 'Expired' : entry.is_active ? 'Active' : 'Inactive'}
                              </Badge>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(entry.id)}
                            >
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
