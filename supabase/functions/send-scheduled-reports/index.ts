import { serve } from "std/http/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createCorsHeaders, handleCorsPreflightRequest } from "../_shared/cors.ts";
import { createInternalAuthErrorResponse, isAuthorizedInternalRequest } from "../_shared/internal-auth.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

// deno-lint-ignore no-explicit-any
type AppSupabaseClient = SupabaseClient<any, "public", any>;

interface ReportData {
  totalLeads: number;
  newLeads: number;
  qualifiedLeads: number;
  convertedLeads: number;
  conversionRate: number;
  totalRevenue: number;
  avgOrderValue: number;
  orderCount: number;
  conversationCount: number;
  totalMessages: number;
  avgMessages: number;
  leadsBySource: Record<string, number>;
  leadsByStatus: Record<string, number>;
  leadTemperature: Record<string, number>;
}

interface ReportConfig {
  included_metrics?: string[];
  included_charts?: string[];
  date_range?: string;
}

async function generateReportData(
  supabase: AppSupabaseClient,
  organizationId: string,
  config: ReportConfig
): Promise<ReportData> {
  const dateRange = config?.date_range || 'last_30_days';
  const startDate = new Date();
  
  switch (dateRange) {
    case 'last_7_days':
      startDate.setDate(startDate.getDate() - 7);
      break;
    case 'last_30_days':
      startDate.setDate(startDate.getDate() - 30);
      break;
    case 'last_90_days':
      startDate.setDate(startDate.getDate() - 90);
      break;
    case 'last_year':
      startDate.setFullYear(startDate.getFullYear() - 1);
      break;
    default:
      startDate.setDate(startDate.getDate() - 30);
  }

  // Fetch leads data
  const { data: leads } = await supabase
    .from('leads')
    .select('*')
    .eq('organization_id', organizationId)
    .gte('created_at', startDate.toISOString());

  // Fetch orders for revenue
  const { data: orders } = await supabase
    .from('orders')
    .select('total_amount')
    .eq('organization_id', organizationId)
    .gte('created_at', startDate.toISOString());

  // Fetch conversations with message counts
  const { data: conversations } = await supabase
    .from('ai_conversations')
    .select('id')
    .eq('organization_id', organizationId)
    .gte('created_at', startDate.toISOString());

  // Count messages from communications table for these conversations
  const _conversationIds = (conversations || []).map((c: Record<string, unknown>) => (c as Record<string, string>).id);
  const { data: messages } = await supabase
    .from('communications')
    .select('id')
    .eq('organization_id', organizationId)
    .gte('created_at', startDate.toISOString());

  const leadsArray = leads || [];
  const ordersArray = orders || [];
  const conversationsArray = conversations || [];
  const messagesArray = messages || [];

  // Calculate metrics
  const leadsBySource: Record<string, number> = {};
  const leadsByStatus: Record<string, number> = {};
  const leadTemperature: Record<string, number> = { cold: 0, warm: 0, hot: 0 };

  leadsArray.forEach((lead: { id: string; status: string; source?: string; lead_temperature?: string; [key: string]: unknown }) => {
    let source = (typeof lead.source === 'string' ? lead.source : '') || 'Unknown';
    if (source.startsWith('messenger:')) source = 'Facebook';
    if (source.startsWith('whatsapp:')) source = 'WhatsApp';
    if (source.startsWith('instagram:')) source = 'Instagram';
    leadsBySource[source] = (leadsBySource[source] || 0) + 1;
    
    const status = lead.status || 'new';
    leadsByStatus[status] = (leadsByStatus[status] || 0) + 1;

    const temp = (typeof lead.lead_temperature === 'string' ? lead.lead_temperature : 'cold') || 'cold';
    leadTemperature[temp] = (leadTemperature[temp] || 0) + 1;
  });

  const totalRevenue = ordersArray.reduce((sum: number, o: { total_amount?: number | string | null; [key: string]: unknown }) => sum + (Number(o.total_amount) || 0), 0);

  return {
    totalLeads: leadsArray.length,
    newLeads: leadsArray.filter((l: { status?: string; [key: string]: unknown }) => l.status === 'new').length,
    qualifiedLeads: leadsArray.filter((l: { status?: string; [key: string]: unknown }) => l.status === 'qualified').length,
    convertedLeads: leadsArray.filter((l: { status?: string; [key: string]: unknown }) => l.status === 'converted').length,
    conversionRate: leadsArray.length > 0 
      ? (leadsArray.filter((l: { status?: string; [key: string]: unknown }) => l.status === 'converted').length / leadsArray.length) * 100 
      : 0,
    totalRevenue,
    avgOrderValue: ordersArray.length > 0 ? totalRevenue / ordersArray.length : 0,
    orderCount: ordersArray.length,
    conversationCount: conversationsArray.length,
    totalMessages: messagesArray.length,
    avgMessages: conversationsArray.length > 0 ? Math.round(messagesArray.length / conversationsArray.length) : 0,
    leadsBySource,
    leadsByStatus,
    leadTemperature,
  };
}

function generateEmailHtml(report: Record<string, unknown>, data: ReportData, config: ReportConfig): string {
  const formatCurrency = (amount: number) => 
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  
  const includedMetrics = config.included_metrics || [
    'total_leads', 'qualified_leads', 'converted_leads', 'total_revenue'
  ];
  const includedCharts = config.included_charts || [
    'lead_sources', 'lead_status'
  ];

  // Build metrics HTML based on selection
  const metricsMap: Record<string, { value: string; label: string }> = {
    total_leads: { value: data.totalLeads.toString(), label: 'Total Leads' },
    new_leads: { value: data.newLeads.toString(), label: 'New Leads' },
    qualified_leads: { value: data.qualifiedLeads.toString(), label: 'Qualified Leads' },
    converted_leads: { value: data.convertedLeads.toString(), label: 'Converted Leads' },
    conversion_rate: { value: `${data.conversionRate.toFixed(1)}%`, label: 'Conversion Rate' },
    total_revenue: { value: formatCurrency(data.totalRevenue), label: 'Total Revenue' },
    avg_order_value: { value: formatCurrency(data.avgOrderValue), label: 'Avg Order Value' },
    order_count: { value: data.orderCount.toString(), label: 'Order Count' },
    total_conversations: { value: data.conversationCount.toString(), label: 'Total Conversations' },
    total_messages: { value: data.totalMessages.toString(), label: 'Total Messages' },
    avg_messages: { value: data.avgMessages.toString(), label: 'Avg Messages/Conversation' },
  };

  const metricsHtml = includedMetrics
    .filter(id => metricsMap[id])
    .map(id => `
      <div class="metric-card">
        <div class="metric-value">${metricsMap[id].value}</div>
        <div class="metric-label">${metricsMap[id].label}</div>
      </div>
    `)
    .join('');

  // Build charts/sections HTML based on selection
  let chartsHtml = '';

  if (includedCharts.includes('lead_sources') && Object.keys(data.leadsBySource).length > 0) {
    chartsHtml += `
      <h2>Lead Sources</h2>
      <div class="metric-card">
        ${Object.entries(data.leadsBySource)
          .sort((a, b) => b[1] - a[1])
          .map(([source, count]) => `<p><strong>${source}:</strong> ${count} leads</p>`)
          .join('')}
      </div>
    `;
  }

  if (includedCharts.includes('lead_status') && Object.keys(data.leadsByStatus).length > 0) {
    chartsHtml += `
      <h2>Lead Status Distribution</h2>
      <div class="metric-card">
        ${Object.entries(data.leadsByStatus)
          .map(([status, count]) => `<p><strong>${status}:</strong> ${count} leads</p>`)
          .join('')}
      </div>
    `;
  }

  if (includedCharts.includes('lead_temperature')) {
    chartsHtml += `
      <h2>Lead Temperature</h2>
      <div class="metric-card">
        <p><strong style="color: #3b82f6;">Cold:</strong> ${data.leadTemperature.cold} leads</p>
        <p><strong style="color: #f59e0b;">Warm:</strong> ${data.leadTemperature.warm} leads</p>
        <p><strong style="color: #ef4444;">Hot:</strong> ${data.leadTemperature.hot} leads</p>
      </div>
    `;
  }

  if (includedCharts.includes('sales_funnel')) {
    chartsHtml += `
      <h2>Sales Funnel</h2>
      <div class="metric-card">
        <p><strong>New:</strong> ${data.leadsByStatus.new || 0} leads</p>
        <p><strong>Contacted:</strong> ${data.leadsByStatus.contacted || 0} leads</p>
        <p><strong>Qualified:</strong> ${data.leadsByStatus.qualified || 0} leads</p>
        <p><strong>Converted:</strong> ${data.leadsByStatus.converted || 0} leads</p>
      </div>
    `;
  }

  const dateRangeLabel = {
    'last_7_days': 'Last 7 Days',
    'last_30_days': 'Last 30 Days',
    'last_90_days': 'Last 90 Days',
    'last_year': 'Last Year',
  }[config.date_range || 'last_30_days'] || 'Last 30 Days';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #0d9488, #14b8a6); color: white; padding: 20px; border-radius: 8px 8px 0 0; }
        .content { background: #f9fafb; padding: 20px; border-radius: 0 0 8px 8px; }
        .metric-card { background: white; padding: 15px; margin: 10px 0; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
        .metric-value { font-size: 24px; font-weight: bold; color: #0d9488; }
        .metric-label { color: #6b7280; font-size: 14px; }
        .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
        .footer { text-align: center; color: #9ca3af; font-size: 12px; margin-top: 20px; }
        .date-range { background: rgba(255,255,255,0.2); padding: 4px 12px; border-radius: 12px; font-size: 12px; display: inline-block; margin-top: 8px; }
        h2 { color: #0d9488; font-size: 18px; margin-top: 24px; margin-bottom: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 style="margin: 0;">${report.name}</h1>
          <p style="margin: 5px 0 0 0; opacity: 0.9;">Scheduled Report - ${new Date().toLocaleDateString()}</p>
          <span class="date-range">${dateRangeLabel}</span>
        </div>
        <div class="content">
          ${metricsHtml.length > 0 ? `
            <h2>Key Metrics</h2>
            <div class="grid">
              ${metricsHtml}
            </div>
          ` : ''}
          
          ${chartsHtml}
        </div>
        <div class="footer">
          <p>This is an automated report from AlCor Nexus CRM</p>
          <p>© ${new Date().getFullYear()} AlCor Digital Nexus OPC</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

const handler = async (req: Request): Promise<Response> => {
  const corsHeaders = createCorsHeaders(req, 'x-internal-function-secret');
  
  const preflightResponse = handleCorsPreflightRequest(req, 'x-internal-function-secret');
  if (preflightResponse) return preflightResponse;

  try {
    if (!isAuthorizedInternalRequest(req)) {
      return createInternalAuthErrorResponse(corsHeaders);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase: AppSupabaseClient = createClient(supabaseUrl, supabaseServiceKey);

    const now = new Date();
    const currentDay = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const currentDate = now.getDate(); // 1-31

    console.log(`Processing scheduled reports at ${now.toISOString()}`);

    // Fetch all scheduled reports
    const { data: reports, error: reportsError } = await supabase
      .from('reports')
      .select('*, organizations(name)')
      .eq('is_scheduled', true);

    if (reportsError) {
      console.error('Error fetching reports:', reportsError);
      throw reportsError;
    }

    console.log(`Found ${reports?.length || 0} scheduled reports`);

    let sentCount = 0;
    const errors: string[] = [];

    for (const report of reports || []) {
      try {
        // Check if report should be sent
        let shouldSend = false;

        if (report.schedule_frequency === 'daily') {
          shouldSend = true;
        } else if (report.schedule_frequency === 'weekly' && report.schedule_day === currentDay) {
          shouldSend = true;
        } else if (report.schedule_frequency === 'monthly' && report.schedule_day === currentDate) {
          shouldSend = true;
        }

        // Check if already sent today
        if (report.last_sent_at) {
          const lastSent = new Date(report.last_sent_at);
          if (lastSent.toDateString() === now.toDateString()) {
            console.log(`Report ${report.id} already sent today, skipping`);
            shouldSend = false;
          }
        }

        if (!shouldSend) {
          console.log(`Report ${report.id} not scheduled for today`);
          continue;
        }

        const recipients = report.recipient_emails || [];
        if (recipients.length === 0) {
          console.log(`Report ${report.id} has no recipients, skipping`);
          continue;
        }

        console.log(`Generating report ${report.id} for ${recipients.length} recipients`);

        // Generate report data
        const reportData = await generateReportData(
          supabase,
          report.organization_id,
          report.config
        );

        // Generate email HTML
        const emailHtml = generateEmailHtml(report, reportData, report.config || {});

        // Send email using fetch to Resend API
        const emailResponse = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${RESEND_API_KEY}`,
          },
          body: JSON.stringify({
            from: "AlCor Nexus <onboarding@resend.dev>",
            to: recipients,
            subject: `${report.name} - ${now.toLocaleDateString()}`,
            html: emailHtml,
          }),
        });

        if (!emailResponse.ok) {
          const errorData = await emailResponse.text();
          throw new Error(`Email send failed: ${errorData}`);
        }

        const emailResult = await emailResponse.json();
        console.log(`Email sent for report ${report.id}:`, emailResult);

        // Update last_sent_at
        await supabase
          .from('reports')
          .update({ last_sent_at: now.toISOString() })
          .eq('id', report.id);

        sentCount++;
      } catch (reportError: unknown) {
        const errorMsg = reportError instanceof Error ? reportError.message : String(reportError);
        console.error(`Error sending report:`, errorMsg);
        errors.push(`Report ${report.id}: ${errorMsg}`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        sentCount,
        errors: errors.length > 0 ? errors : undefined,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error("Error in send-scheduled-reports:", error);
    return new Response(
      JSON.stringify({ error: errorMsg }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
