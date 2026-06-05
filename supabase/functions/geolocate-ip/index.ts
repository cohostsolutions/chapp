import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { createCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";

interface GeoLocation {
  country: string;
  countryCode: string;
  city: string;
  region: string;
  lat: number;
  lon: number;
  isp: string;
}

async function lookupIP(ip: string): Promise<GeoLocation | null> {
  try {
    // Use ip-api.com (free, no API key required, 45 requests per minute)
    const response = await fetch(`http://ip-api.com/json/${ip}?fields=status,message,country,countryCode,region,city,lat,lon,isp`);
    const data = await response.json();
    
    if (data.status === 'success') {
      return {
        country: data.country,
        countryCode: data.countryCode,
        city: data.city || 'Unknown',
        region: data.region || 'Unknown',
        lat: data.lat,
        lon: data.lon,
        isp: data.isp || 'Unknown',
      };
    }
    console.log(`IP lookup failed for ${ip}:`, data.message);
    return null;
  } catch (error) {
    console.error(`Error looking up IP ${ip}:`, error);
    return null;
  }
}

serve(async (req) => {
  const corsHeaders = createCorsHeaders(req);
  
  const preflightResponse = handleCorsPreflightRequest(req);
  if (preflightResponse) return preflightResponse;

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { ip_address, login_attempt_id, batch_update } = await req.json();

    // Single IP lookup mode
    if (ip_address && !batch_update) {
      console.log(`Looking up geolocation for IP: ${ip_address}`);
      const geo = await lookupIP(ip_address);
      
      if (geo && login_attempt_id) {
        // Update the login attempt record with geolocation
        const { error } = await supabase
          .from('login_attempts')
          .update({
            country: geo.country,
            country_code: geo.countryCode,
            city: geo.city,
            region: geo.region,
            latitude: geo.lat,
            longitude: geo.lon,
            isp: geo.isp,
          })
          .eq('id', login_attempt_id);
          
        if (error) {
          console.error('Error updating login attempt:', error);
        }
      }

      return new Response(
        JSON.stringify({ success: true, geolocation: geo }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Batch update mode - update all login attempts missing geolocation
    if (batch_update) {
      console.log('Starting batch geolocation update...');
      
      // Get login attempts without geolocation data
      const { data: attempts, error: fetchError } = await supabase
        .from('login_attempts')
        .select('id, ip_address')
        .not('ip_address', 'is', null)
        .is('country', null)
        .order('attempted_at', { ascending: false })
        .limit(50); // Process 50 at a time to respect rate limits

      if (fetchError) {
        throw fetchError;
      }

      console.log(`Found ${attempts?.length || 0} attempts to geolocate`);

      let updated = 0;
      const uniqueIPs = new Map<string, GeoLocation | null>();

      for (const attempt of attempts || []) {
        if (!attempt.ip_address) continue;

        // Check cache first
        let geo = uniqueIPs.get(attempt.ip_address);
        if (geo === undefined) {
          // Rate limit: 45 requests per minute for ip-api.com
          await new Promise(resolve => setTimeout(resolve, 1400)); // ~42 requests/min
          geo = await lookupIP(attempt.ip_address);
          uniqueIPs.set(attempt.ip_address, geo);
        }

        if (geo) {
          const { error: updateError } = await supabase
            .from('login_attempts')
            .update({
              country: geo.country,
              country_code: geo.countryCode,
              city: geo.city,
              region: geo.region,
              latitude: geo.lat,
              longitude: geo.lon,
              isp: geo.isp,
            })
            .eq('id', attempt.id);

          if (!updateError) {
            updated++;
          }
        }
      }

      console.log(`Updated ${updated} login attempts with geolocation data`);

      return new Response(
        JSON.stringify({ success: true, updated, total: attempts?.length || 0 }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Missing ip_address or batch_update parameter" }),
      { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );

  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error("Error in geolocate-ip function:", error);
    return new Response(
      JSON.stringify({ error: errorMsg }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
