import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Flag, AlertTriangle, CheckCircle } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

interface LoginAttempt {
  id: string;
  email: string;
  ip_address: string | null;
  was_successful: boolean;
  attempted_at: string;
  country: string | null;
  country_code: string | null;
  city: string | null;
}

interface CountryBreakdownProps {
  loginAttempts: LoginAttempt[];
}

// Country flag emoji helper
function getCountryFlag(countryCode: string | null): string {
  if (!countryCode || countryCode.length !== 2) return '🌐';
  const codePoints = countryCode
    .toUpperCase()
    .split('')
    .map(char => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}

export function CountryBreakdown({ loginAttempts }: CountryBreakdownProps) {
  const countryStats = useMemo(() => {
    const stats = loginAttempts.reduce((acc, attempt) => {
      const country = attempt.country || 'Unknown';
      const code = attempt.country_code || null;
      const key = country;
      
      if (!acc[key]) {
        acc[key] = {
          country,
          countryCode: code,
          cities: new Set<string>(),
          failed: 0,
          successful: 0,
          ips: new Set<string>(),
          lastAttempt: attempt.attempted_at,
        };
      }
      
      if (attempt.was_successful) {
        acc[key].successful++;
      } else {
        acc[key].failed++;
      }
      
      if (attempt.city) acc[key].cities.add(attempt.city);
      if (attempt.ip_address) acc[key].ips.add(attempt.ip_address);
      
      if (new Date(attempt.attempted_at) > new Date(acc[key].lastAttempt)) {
        acc[key].lastAttempt = attempt.attempted_at;
      }
      
      return acc;
    }, {} as Record<string, {
      country: string;
      countryCode: string | null;
      cities: Set<string>;
      failed: number;
      successful: number;
      ips: Set<string>;
      lastAttempt: string;
    }>);

    return Object.values(stats)
      .map(s => ({
        ...s,
        cities: Array.from(s.cities),
        cityCount: s.cities.size,
        ipCount: s.ips.size,
        total: s.failed + s.successful,
        failureRate: (s.failed + s.successful) > 0 
          ? (s.failed / (s.failed + s.successful)) * 100 
          : 0,
      }))
      .sort((a, b) => b.total - a.total);
  }, [loginAttempts]);

  const suspiciousCountries = countryStats.filter(
    c => c.failureRate > 50 && c.failed >= 3
  );

  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Flag className="w-4 h-4 text-primary" />
          Login Attempts by Country
        </CardTitle>
        <CardDescription>
          {countryStats.length} countries • {suspiciousCountries.length} with high failure rates
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[350px]">
          {countryStats.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <CheckCircle className="w-8 h-8 mb-2 text-green-500" />
              <p>No geolocation data available yet</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Country</TableHead>
                  <TableHead>Cities</TableHead>
                  <TableHead className="text-right">Attempts</TableHead>
                  <TableHead>Success Rate</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {countryStats.map((country) => (
                  <TableRow 
                    key={country.country}
                    className={country.failureRate > 50 && country.failed >= 3 ? 'bg-destructive/5' : ''}
                  >
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{getCountryFlag(country.countryCode)}</span>
                        <div>
                          <p className="font-medium">{country.country}</p>
                          <p className="text-xs text-muted-foreground">{country.ipCount} IPs</p>
                        </div>
                        {country.failureRate > 50 && country.failed >= 3 && (
                          <AlertTriangle className="w-4 h-4 text-destructive ml-1" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="max-w-[150px]">
                        <p className="text-sm truncate" title={country.cities.join(', ')}>
                          {country.cities.slice(0, 3).join(', ')}
                          {country.cityCount > 3 && ` +${country.cityCount - 3}`}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Badge variant="outline" className="text-primary">
                          {country.successful}
                        </Badge>
                        <Badge variant="destructive">{country.failed}</Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <Progress 
                          value={100 - country.failureRate} 
                          className="h-2"
                        />
                        <p className="text-xs text-muted-foreground">
                          {(100 - country.failureRate).toFixed(0)}% success
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
