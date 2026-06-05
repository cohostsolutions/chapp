import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Globe, MapPin } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface LoginLocation {
  country: string | null;
  country_code: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  failed: number;
  successful: number;
}

interface LoginWorldMapProps {
  locations: LoginLocation[];
}

// SVG world map coordinates for major regions (simplified)
const COUNTRY_POSITIONS: Record<string, { x: number; y: number }> = {
  US: { x: 120, y: 180 },
  CA: { x: 130, y: 130 },
  MX: { x: 110, y: 220 },
  BR: { x: 220, y: 320 },
  AR: { x: 200, y: 380 },
  GB: { x: 345, y: 145 },
  FR: { x: 360, y: 170 },
  DE: { x: 380, y: 155 },
  IT: { x: 385, y: 185 },
  ES: { x: 340, y: 190 },
  NL: { x: 370, y: 150 },
  PL: { x: 400, y: 150 },
  RU: { x: 500, y: 130 },
  UA: { x: 430, y: 160 },
  IN: { x: 530, y: 230 },
  CN: { x: 580, y: 200 },
  JP: { x: 660, y: 195 },
  KR: { x: 640, y: 195 },
  PH: { x: 635, y: 255 },
  AU: { x: 650, y: 370 },
  SG: { x: 595, y: 285 },
  ID: { x: 610, y: 300 },
  TH: { x: 585, y: 250 },
  VN: { x: 600, y: 245 },
  MY: { x: 595, y: 275 },
  AE: { x: 475, y: 225 },
  SA: { x: 455, y: 225 },
  ZA: { x: 420, y: 375 },
  NG: { x: 380, y: 270 },
  EG: { x: 420, y: 215 },
  IL: { x: 435, y: 200 },
  TR: { x: 430, y: 185 },
  SE: { x: 395, y: 115 },
  NO: { x: 380, y: 105 },
  FI: { x: 415, y: 105 },
  DK: { x: 380, y: 135 },
  CH: { x: 375, y: 170 },
  AT: { x: 390, y: 165 },
  BE: { x: 365, y: 155 },
  PT: { x: 330, y: 190 },
  IE: { x: 335, y: 145 },
  NZ: { x: 720, y: 400 },
  CL: { x: 185, y: 380 },
  CO: { x: 175, y: 275 },
  PE: { x: 170, y: 310 },
};

function latLongToXY(lat: number, lon: number): { x: number; y: number } {
  // Simple equirectangular projection
  const x = ((lon + 180) / 360) * 750;
  const y = ((90 - lat) / 180) * 450;
  return { x, y };
}

export function LoginWorldMap({ locations }: LoginWorldMapProps) {
  const mapPoints = useMemo(() => {
    const points: Array<{
      x: number;
      y: number;
      country: string;
      city: string;
      failed: number;
      successful: number;
      total: number;
      isSuspicious: boolean;
    }> = [];

    locations.forEach(loc => {
      let position: { x: number; y: number } | null = null;

      // Try to use exact coordinates first
      if (loc.latitude && loc.longitude) {
        position = latLongToXY(loc.latitude, loc.longitude);
      } else if (loc.country_code && COUNTRY_POSITIONS[loc.country_code]) {
        position = COUNTRY_POSITIONS[loc.country_code];
      }

      if (position) {
        const total = loc.failed + loc.successful;
        const failureRate = total > 0 ? loc.failed / total : 0;
        points.push({
          ...position,
          country: loc.country || 'Unknown',
          city: loc.city || 'Unknown',
          failed: loc.failed,
          successful: loc.successful,
          total,
          isSuspicious: failureRate > 0.5 && loc.failed >= 3,
        });
      }
    });

    return points;
  }, [locations]);

  const totalFailed = locations.reduce((sum, loc) => sum + loc.failed, 0);
  const totalSuccessful = locations.reduce((sum, loc) => sum + loc.successful, 0);
  const uniqueCountries = new Set(locations.filter(l => l.country).map(l => l.country)).size;

  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Globe className="w-4 h-4 text-primary" />
          Login Attempts by Location
        </CardTitle>
        <CardDescription className="flex gap-4">
          <span>{uniqueCountries} countries</span>
          <span className="text-primary">{totalSuccessful} successful</span>
          <span className="text-destructive">{totalFailed} failed</span>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="relative w-full aspect-[750/450] bg-muted/30 rounded-lg overflow-hidden border border-border">
          {/* World Map SVG Background */}
          <svg
            viewBox="0 0 750 450"
            className="absolute inset-0 w-full h-full"
            style={{ background: 'hsl(var(--muted) / 0.3)' }}
          >
            {/* Simplified world map outline */}
            <path
              d="M 50 180 Q 100 150 150 180 T 250 190 Q 300 210 280 280 Q 250 350 200 380 L 170 320 Q 160 280 175 250 Q 140 220 100 220 Q 60 210 50 180
                 M 320 100 Q 380 90 420 100 Q 450 120 430 180 Q 400 220 350 200 Q 320 180 330 150 Q 310 120 320 100
                 M 430 180 Q 500 150 550 170 Q 600 200 580 250 Q 550 280 500 260 Q 450 240 430 180
                 M 580 260 Q 620 280 650 320 Q 680 370 650 400 Q 600 420 580 380 Q 560 340 580 260
                 M 600 180 Q 650 170 700 200 Q 680 240 640 230 Q 610 210 600 180"
              fill="hsl(var(--border))"
              opacity="0.3"
            />
            
            {/* Grid lines */}
            {[0, 75, 150, 225, 300, 375, 450].map(y => (
              <line
                key={`h-${y}`}
                x1="0"
                y1={y}
                x2="750"
                y2={y}
                stroke="hsl(var(--border))"
                strokeWidth="0.5"
                opacity="0.3"
              />
            ))}
            {[0, 150, 300, 450, 600, 750].map(x => (
              <line
                key={`v-${x}`}
                x1={x}
                y1="0"
                x2={x}
                y2="450"
                stroke="hsl(var(--border))"
                strokeWidth="0.5"
                opacity="0.3"
              />
            ))}

            {/* Data points */}
            <TooltipProvider>
              {mapPoints.map((point, index) => (
                <Tooltip key={index}>
                  <TooltipTrigger asChild>
                    <g className="cursor-pointer">
                      {/* Outer ring for suspicious */}
                      {point.isSuspicious && (
                        <circle
                          cx={point.x}
                          cy={point.y}
                          r={Math.min(20, 6 + point.failed * 2)}
                          fill="none"
                          stroke="hsl(var(--destructive))"
                          strokeWidth="2"
                          opacity="0.5"
                          className="animate-pulse"
                        />
                      )}
                      {/* Main dot */}
                      <circle
                        cx={point.x}
                        cy={point.y}
                        r={Math.min(12, 4 + point.total)}
                        fill={point.isSuspicious ? 'hsl(var(--destructive))' : 'hsl(var(--primary))'}
                        opacity="0.8"
                        className="transition-all hover:opacity-100"
                      />
                      {/* Center dot */}
                      <circle
                        cx={point.x}
                        cy={point.y}
                        r="2"
                        fill="hsl(var(--background))"
                      />
                    </g>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="z-50">
                    <div className="space-y-1">
                      <p className="font-medium flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {point.city}, {point.country}
                      </p>
                      <div className="flex gap-2 text-xs">
                        <span className="text-primary">{point.successful} successful</span>
                        <span className="text-destructive">{point.failed} failed</span>
                      </div>
                      {point.isSuspicious && (
                        <Badge variant="destructive" className="text-xs">Suspicious</Badge>
                      )}
                    </div>
                  </TooltipContent>
                </Tooltip>
              ))}
            </TooltipProvider>
          </svg>

          {/* Legend */}
          <div className="absolute bottom-2 left-2 flex gap-3 text-xs bg-background/80 px-2 py-1 rounded">
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-primary" />
              <span>Normal</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
              <span>Suspicious</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
