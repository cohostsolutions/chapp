import { serve } from "std/http/server";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Allow requests with apikey header (for training simulator which uses anon key)
    const apiKey = req.headers.get('apikey');
    const authHeader = req.headers.get('Authorization');
    
    // Either apikey or Authorization header is sufficient for TTS
    if (!apiKey && !authHeader) {
      console.error('TTS error: Missing authentication');
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { text, voiceId } = await req.json();

    if (!text) {
      throw new Error('Text is required');
    }

    const ELEVENLABS_API_KEY = Deno.env.get('ELEVENLABS_API_KEY');
    
    if (!ELEVENLABS_API_KEY) {
      console.error('TTS error: ELEVENLABS_API_KEY not configured');
      throw new Error('TTS service not configured');
    }

    // Use the provided voice or default to Sarah
    const selectedVoiceId = voiceId || 'EXAVITQu4vr4xnSDxMaL';

    console.log(`Generating TTS, text length: ${text.length}, voice: ${selectedVoiceId}`);

    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${selectedVoiceId}/stream`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': ELEVENLABS_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_turbo_v2_5',
          output_format: 'mp3_44100_128',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
            style: 0.3,
            use_speaker_boost: true,
            speed: 1.0,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('ElevenLabs API error:', response.status, errorText);
      const status = response.status;
      const message = status === 401
        ? 'Invalid or missing ElevenLabs API key. Set ELEVENLABS_API_KEY secret.'
        : `ElevenLabs API error: ${status}`;
      return new Response(JSON.stringify({ error: message, details: errorText }), {
        status: status === 401 ? 401 : 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Stream the audio response
    return new Response(response.body, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'audio/mpeg',
        'Transfer-Encoding': 'chunked',
      },
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('TTS error:', errorMessage);
    const hint = errorMessage.includes('ELEVENLABS_API_KEY')
      ? 'Set Supabase secret ELEVENLABS_API_KEY and redeploy the function.'
      : undefined;
    return new Response(JSON.stringify({ error: errorMessage, hint }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
