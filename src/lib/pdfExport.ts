import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';

interface ReportMetrics {
  totalLeads: number;
  qualifiedLeads: number;
  convertedLeads: number;
  qualificationRate: number;
  conversionRate: number;
}

interface RevenueMetrics {
  totalRevenue: number;
  avgOrderValue: number;
  orderCount: number;
}

interface CommunicationMetrics {
  totalConversations: number;
  totalMessages: number;
  avgMessagesPerConversation: number;
}

interface LeadStatusData {
  name: string;
  value: number;
}

interface LeadTemperatureData {
  name: string;
  value: number;
}

interface LeadSourceData {
  name: string;
  value: number;
}

interface DistributionRow {
  label: string;
  count: number;
  percentage: number;
}

type DistributionKind = 'status' | 'temperature' | 'source';

interface PDFReportData {
  dateRange: string;
  conversionMetrics: ReportMetrics;
  revenueMetrics: RevenueMetrics;
  communicationMetrics: CommunicationMetrics;
  leadStatusData: LeadStatusData[];
  leadTemperatureData: LeadTemperatureData[];
  leadSourceData: LeadSourceData[];
  organizationName?: string;
  currencySymbol?: string;
}

export function generateReportPDF(data: PDFReportData): void {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  let yPos = 44;

  const brand = {
    deepBlue: [24, 50, 95] as [number, number, number],
    electricBlue: [41, 98, 255] as [number, number, number],
    slate: [69, 82, 110] as [number, number, number],
    muted: [109, 122, 145] as [number, number, number],
    lightBlue: [237, 243, 255] as [number, number, number],
    line: [210, 221, 242] as [number, number, number],
    white: [255, 255, 255] as [number, number, number],
  };

  const generatedAt = format(new Date(), "MMMM d, yyyy 'at' h:mm a");

  const currencyLabel = (value: number) => {
    const rawSymbol = (data.currencySymbol || '$').trim();
    const safeSymbol = /[^\x00-\x7F]/.test(rawSymbol) ? '$' : rawSymbol;
    return `${safeSymbol}${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  };

  const getLastTableY = () => {
    const lastTable = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable;
    return lastTable?.finalY ?? yPos;
  };

  const ensureSpace = (requiredHeight: number) => {
    if (yPos + requiredHeight > pageHeight - 22) {
      doc.addPage();
      yPos = 20;
    }
  };

  const addSectionHeader = (title: string, subtitle?: string) => {
    ensureSpace(18);
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...brand.deepBlue);
    doc.text(title, margin, yPos);

    if (subtitle) {
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...brand.muted);
      doc.text(subtitle, pageWidth - margin, yPos, { align: 'right' });
    }

    yPos += 6;
    doc.setDrawColor(...brand.line);
    doc.setLineWidth(0.5);
    doc.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 8;
  };

  const addMetricCard = (x: number, y: number, width: number, label: string, value: string) => {
    doc.setFillColor(...brand.lightBlue);
    doc.roundedRect(x, y, width, 22, 2, 2, 'F');

    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...brand.muted);
    doc.text(label.toUpperCase(), x + 4, y + 6);

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...brand.deepBlue);
    doc.text(value, x + 4, y + 15.5);
  };

  const renderTable = (title: string, head: string[], body: string[][], subtitle?: string) => {
    if (body.length === 0) return;

    addSectionHeader(title, subtitle);

    autoTable(doc, {
      startY: yPos,
      head: [head],
      body,
      theme: 'grid',
      margin: { left: margin, right: margin },
      tableWidth: 'auto',
      headStyles: {
        fillColor: brand.deepBlue,
        textColor: brand.white,
        fontStyle: 'bold',
        lineColor: brand.line,
        lineWidth: 0,
      },
      bodyStyles: {
        textColor: [35, 45, 65],
        lineColor: brand.line,
        lineWidth: 0.2,
      },
      alternateRowStyles: {
        fillColor: [248, 250, 255],
      },
      styles: {
        fontSize: 10,
        cellPadding: 3.5,
      },
    });

    yPos = getLastTableY() + 10;
  };

  const normalizeKey = (value: string) => value.trim().toLowerCase();

  const getColorForRow = (kind: DistributionKind, label: string): [number, number, number] => {
    const key = normalizeKey(label);

    if (kind === 'temperature') {
      if (key.includes('hot')) return [220, 53, 69];
      if (key.includes('warm')) return [245, 158, 11];
      if (key.includes('cold')) return [37, 99, 235];
      return [79, 70, 229];
    }

    if (kind === 'status') {
      if (key.includes('converted') || key.includes('won') || key.includes('closed')) return [22, 163, 74];
      if (key.includes('qualified') || key.includes('follow') || key.includes('contacted')) return [14, 116, 144];
      if (key.includes('new') || key.includes('open') || key.includes('pending')) return [41, 98, 255];
      if (key.includes('lost') || key.includes('disqual') || key.includes('rejected')) return [220, 38, 38];
      return [99, 102, 241];
    }

    const sourcePalette: Record<string, [number, number, number]> = {
      manual: [41, 98, 255],
      website: [14, 165, 233],
      facebook: [24, 119, 242],
      instagram: [225, 48, 108],
      whatsapp: [37, 211, 102],
      referral: [22, 163, 74],
      organic: [16, 185, 129],
      paid: [245, 158, 11],
      ads: [249, 115, 22],
      email: [79, 70, 229],
      call: [6, 182, 212],
      event: [168, 85, 247],
    };

    for (const sourceKey of Object.keys(sourcePalette)) {
      if (key.includes(sourceKey)) return sourcePalette[sourceKey];
    }

    return [99, 102, 241];
  };

  const buildLegend = (kind: DistributionKind, rows: DistributionRow[]) => {
    if (kind === 'temperature') {
      return [
        { label: 'Hot', color: [220, 53, 69] as [number, number, number] },
        { label: 'Warm', color: [245, 158, 11] as [number, number, number] },
        { label: 'Cold', color: [37, 99, 235] as [number, number, number] },
      ];
    }

    if (kind === 'status') {
      return [
        { label: 'New/Pending', color: [41, 98, 255] as [number, number, number] },
        { label: 'Qualified/In Progress', color: [14, 116, 144] as [number, number, number] },
        { label: 'Converted/Won', color: [22, 163, 74] as [number, number, number] },
        { label: 'Lost/Rejected', color: [220, 38, 38] as [number, number, number] },
      ];
    }

    const uniqueLabels = Array.from(new Set(rows.map((row) => row.label))).slice(0, 5);
    return uniqueLabels.map((label) => ({ label, color: getColorForRow('source', label) }));
  };

  const drawLegend = (items: Array<{ label: string; color: [number, number, number] }>) => {
    if (items.length === 0) return;

    const rowY = yPos - 3;
    let x = margin;

    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...brand.muted);

    for (const item of items) {
      const dotSize = 2.2;
      const textWidth = doc.getTextWidth(item.label);
      const requiredWidth = 4 + dotSize + 1.5 + textWidth + 6;

      if (x + requiredWidth > pageWidth - margin) break;

      doc.setFillColor(...item.color);
      doc.circle(x + dotSize, rowY, dotSize / 2, 'F');
      doc.text(item.label, x + dotSize + 2, rowY + 0.8);
      x += requiredWidth;
    }

    yPos += 2;
  };

  const renderDistributionTable = (
    title: string,
    firstColumnLabel: string,
    rows: DistributionRow[],
    kind: DistributionKind
  ) => {
    if (rows.length === 0) return;

    addSectionHeader(title, 'Color-coded visual share bars');
    drawLegend(buildLegend(kind, rows));

    autoTable(doc, {
      startY: yPos,
      head: [[firstColumnLabel, 'Count', 'Share of Leads', 'Visual']],
      body: rows.map((row) => [row.label, row.count.toLocaleString(), `${row.percentage.toFixed(1)}%`, '']),
      theme: 'grid',
      margin: { left: margin, right: margin },
      tableWidth: 'auto',
      headStyles: {
        fillColor: brand.deepBlue,
        textColor: brand.white,
        fontStyle: 'bold',
        lineColor: brand.line,
        lineWidth: 0,
      },
      bodyStyles: {
        textColor: [35, 45, 65],
        lineColor: brand.line,
        lineWidth: 0.2,
      },
      alternateRowStyles: {
        fillColor: [248, 250, 255],
      },
      styles: {
        fontSize: 10,
        cellPadding: 3.5,
      },
      columnStyles: {
        1: { halign: 'right' },
        2: { halign: 'right' },
        3: { cellWidth: 48 },
      },
      didDrawCell: (hookData) => {
        if (hookData.section !== 'body' || hookData.column.index !== 3) return;

        const row = rows[hookData.row.index];
        if (!row) return;

        const clampedPercentage = Math.max(0, Math.min(row.percentage, 100));
        const trackPadding = 3;
        const trackHeight = 2.8;
        const trackX = hookData.cell.x + trackPadding;
        const trackY = hookData.cell.y + hookData.cell.height / 2 - trackHeight / 2;
        const trackWidth = hookData.cell.width - trackPadding * 2;
        const fillWidth = (clampedPercentage / 100) * trackWidth;

        doc.setFillColor(...brand.line);
        doc.roundedRect(trackX, trackY, trackWidth, trackHeight, 1, 1, 'F');
        doc.setFillColor(...getColorForRow(kind, row.label));
        doc.roundedRect(trackX, trackY, fillWidth, trackHeight, 1, 1, 'F');
      },
    });

    yPos = getLastTableY() + 10;
  };

  const totalLeads = data.conversionMetrics.totalLeads;
  const distributionRows = (items: Array<{ name: string; value: number }>): DistributionRow[] =>
    items.map((item) => ({
      label: item.name,
      count: item.value,
      percentage: totalLeads > 0 ? (item.value / totalLeads) * 100 : 0,
    }));

  const topDistributionLabel = (rows: DistributionRow[]) => {
    if (rows.length === 0) return 'N/A';
    const winner = [...rows].sort((a, b) => b.count - a.count)[0];
    if (!winner) return 'N/A';
    return `${winner.label} (${winner.percentage.toFixed(1)}%)`;
  };

  const addCoverMetricCard = (x: number, y: number, width: number, label: string, value: string) => {
    doc.setFillColor(...brand.lightBlue);
    doc.roundedRect(x, y, width, 24, 2, 2, 'F');
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...brand.muted);
    doc.text(label.toUpperCase(), x + 4, y + 7);
    doc.setFontSize(15);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...brand.deepBlue);
    doc.text(value, x + 4, y + 18);
  };

  const addInsightRow = (title: string, value: string, y: number) => {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...brand.slate);
    doc.text(title, margin + 6, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...brand.deepBlue);
    doc.text(value, margin + 62, y);
  };

  const addExecutiveCoverPage = () => {
    const statusRows = distributionRows(data.leadStatusData);
    const tempRows = distributionRows(data.leadTemperatureData);
    const sourceRows = distributionRows(data.leadSourceData);
    const conversionRate = data.conversionMetrics.conversionRate;
    const qualificationRate = data.conversionMetrics.qualificationRate;

    // Hero band
    doc.setFillColor(...brand.deepBlue);
    doc.rect(0, 0, pageWidth, 52, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(30);
    doc.setTextColor(...brand.white);
    doc.text('Executive Summary', margin, 22);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.text(data.organizationName || 'Organization Analytics', margin, 31);
    doc.text(`Reporting Window: ${data.dateRange}`, margin, 38);
    doc.text(`Generated: ${generatedAt}`, margin, 45);

    // KPI panel
    const kpiY = 64;
    const gap = 4;
    const cardWidth = (pageWidth - margin * 2 - gap * 3) / 4;
    addCoverMetricCard(margin, kpiY, cardWidth, 'Total Leads', totalLeads.toLocaleString());
    addCoverMetricCard(
      margin + cardWidth + gap,
      kpiY,
      cardWidth,
      'Conversion Rate',
      `${conversionRate.toFixed(1)}%`
    );
    addCoverMetricCard(
      margin + (cardWidth + gap) * 2,
      kpiY,
      cardWidth,
      'Qualified Rate',
      `${qualificationRate.toFixed(1)}%`
    );
    addCoverMetricCard(
      margin + (cardWidth + gap) * 3,
      kpiY,
      cardWidth,
      'Total Revenue',
      currencyLabel(data.revenueMetrics.totalRevenue)
    );

    // Insight block
    const insightY = 98;
    doc.setFillColor(248, 250, 255);
    doc.setDrawColor(...brand.line);
    doc.roundedRect(margin, insightY, pageWidth - margin * 2, 58, 2, 2, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(...brand.deepBlue);
    doc.text('Key Insights', margin + 6, insightY + 10);

    addInsightRow('Top Status', topDistributionLabel(statusRows), insightY + 22);
    addInsightRow('Top Temperature', topDistributionLabel(tempRows), insightY + 32);
    addInsightRow('Top Source', topDistributionLabel(sourceRows), insightY + 42);
    addInsightRow('Average Order Value', currencyLabel(data.revenueMetrics.avgOrderValue), insightY + 52);

    // Narrative block
    const narrativeY = 166;
    doc.setFillColor(...brand.lightBlue);
    doc.roundedRect(margin, narrativeY, pageWidth - margin * 2, 36, 2, 2, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...brand.deepBlue);
    doc.text('Leadership Brief', margin + 6, narrativeY + 9);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(...brand.slate);
    const brief =
      `The organization generated ${totalLeads.toLocaleString()} leads with ${conversionRate.toFixed(1)}% conversion and ` +
      `${qualificationRate.toFixed(1)}% qualification. Revenue reached ${currencyLabel(data.revenueMetrics.totalRevenue)} ` +
      `from ${data.revenueMetrics.orderCount.toLocaleString()} orders during the selected period.`;
    doc.text(brief, margin + 6, narrativeY + 18, { maxWidth: pageWidth - margin * 2 - 12 });

    // CTA footer note
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8.5);
    doc.setTextColor(...brand.muted);
    doc.text('Detailed metric tables and distributions follow on subsequent pages.', margin, pageHeight - 14);
  };

  // Cover page first
  addExecutiveCoverPage();
  doc.addPage();
  yPos = 44;

  // Top banner
  doc.setFillColor(...brand.deepBlue);
  doc.rect(0, 0, pageWidth, 34, 'F');

  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...brand.white);
  doc.text('Analytics Report', margin, 15);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(data.organizationName || 'Organization Analytics', margin, 23);

  doc.setFontSize(9);
  doc.text('Performance intelligence and conversion diagnostics', margin, 29);

  // Report context row
  doc.setFontSize(10);
  doc.setTextColor(...brand.slate);
  doc.text(`Data Window: ${data.dateRange}`, margin, yPos);
  doc.text(`Generated: ${generatedAt}`, pageWidth - margin, yPos, { align: 'right' });
  yPos += 9;

  // KPI strip
  const cardGap = 4;
  const cardWidth = (pageWidth - margin * 2 - cardGap * 3) / 4;
  addMetricCard(margin, yPos, cardWidth, 'Total Leads', totalLeads.toLocaleString());
  addMetricCard(
    margin + cardWidth + cardGap,
    yPos,
    cardWidth,
    'Conversion Rate',
    `${data.conversionMetrics.conversionRate.toFixed(1)}%`
  );
  addMetricCard(
    margin + (cardWidth + cardGap) * 2,
    yPos,
    cardWidth,
    'Total Revenue',
    currencyLabel(data.revenueMetrics.totalRevenue)
  );
  addMetricCard(
    margin + (cardWidth + cardGap) * 3,
    yPos,
    cardWidth,
    'Total Orders',
    data.revenueMetrics.orderCount.toLocaleString()
  );
  yPos += 30;

  // Executive summary block
  doc.setFillColor(247, 249, 255);
  doc.setDrawColor(...brand.line);
  doc.roundedRect(margin, yPos, pageWidth - margin * 2, 30, 2, 2, 'FD');

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...brand.deepBlue);
  doc.text('Executive Summary', margin + 4, yPos + 7);

  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...brand.slate);
  const summaryText =
    `Captured ${data.conversionMetrics.totalLeads.toLocaleString()} leads with ${data.conversionMetrics.conversionRate.toFixed(1)}% conversion. ` +
    `Revenue reached ${currencyLabel(data.revenueMetrics.totalRevenue)} across ${data.revenueMetrics.orderCount.toLocaleString()} orders.`;
  doc.text(summaryText, margin + 4, yPos + 14, { maxWidth: pageWidth - margin * 2 - 8 });
  yPos += 37;

  renderTable('Lead Metrics', ['Metric', 'Value'], [
    ['Total Leads', data.conversionMetrics.totalLeads.toLocaleString()],
    ['Qualified Leads', data.conversionMetrics.qualifiedLeads.toLocaleString()],
    ['Converted Leads', data.conversionMetrics.convertedLeads.toLocaleString()],
    ['Qualification Rate', `${data.conversionMetrics.qualificationRate.toFixed(1)}%`],
    ['Conversion Rate', `${data.conversionMetrics.conversionRate.toFixed(1)}%`],
  ]);

  renderTable('Revenue Metrics', ['Metric', 'Value'], [
    ['Total Revenue', currencyLabel(data.revenueMetrics.totalRevenue)],
    ['Average Order Value', currencyLabel(data.revenueMetrics.avgOrderValue)],
    ['Total Orders', data.revenueMetrics.orderCount.toLocaleString()],
  ]);

  renderTable('Communication Metrics', ['Metric', 'Value'], [
    ['Total Conversations', data.communicationMetrics.totalConversations.toLocaleString()],
    ['Total Messages', data.communicationMetrics.totalMessages.toLocaleString()],
    ['Avg Messages / Conversation', data.communicationMetrics.avgMessagesPerConversation.toLocaleString()],
  ]);

  if (data.leadStatusData.length > 0) {
    renderDistributionTable(
      'Lead Status Distribution',
      'Status',
      distributionRows(data.leadStatusData),
      'status'
    );
  }

  if (data.leadTemperatureData.length > 0) {
    renderDistributionTable(
      'Lead Temperature Distribution',
      'Temperature',
      distributionRows(data.leadTemperatureData),
      'temperature'
    );
  }

  if (data.leadSourceData.length > 0) {
    renderDistributionTable('Lead Sources', 'Source', distributionRows(data.leadSourceData), 'source');
  }

  // Footer on each page
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...brand.muted);
    doc.setDrawColor(...brand.line);
    doc.line(margin, pageHeight - 14, pageWidth - margin, pageHeight - 14);
    doc.text(
      `Analytics Report - ${data.organizationName || 'Organization'} - Page ${i} of ${pageCount}`,
      pageWidth / 2,
      pageHeight - 8,
      { align: 'center' }
    );
  }

  const fileName = `analytics-report-${format(new Date(), 'yyyy-MM-dd')}.pdf`;
  doc.save(fileName);
}
