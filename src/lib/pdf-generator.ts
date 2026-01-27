/**
 * PDF Export Generator
 *
 * Generates professional PDF exports from conversations
 * Uses jsPDF for PDF generation
 */

export async function generatePDF(conversation: any): Promise<Buffer> {
  // Import jsPDF dynamically to avoid issues with server-side rendering
  const { default: jsPDF } = await import('jspdf');

  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const maxWidth = pageWidth - (margin * 2);
  let yPosition = margin;

  // Helper function to add new page if needed
  const checkAddPage = (requiredSpace: number = 20) => {
    if (yPosition + requiredSpace > pageHeight - margin) {
      doc.addPage();
      yPosition = margin;
      return true;
    }
    return false;
  };

  // Helper function to add text with word wrapping
  const addText = (text: string, fontSize: number = 10, isBold: boolean = false) => {
    doc.setFontSize(fontSize);
    doc.setFont('helvetica', isBold ? 'bold' : 'normal');

    const lines = doc.splitTextToSize(text, maxWidth);
    const lineHeight = fontSize * 0.5;

    for (const line of lines) {
      checkAddPage(lineHeight);
      doc.text(line, margin, yPosition);
      yPosition += lineHeight;
    }

    return yPosition;
  };

  // Title
  doc.setFillColor(59, 130, 246); // Blue
  doc.rect(0, 0, pageWidth, 40, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text(conversation.title || 'Conversation', margin, 25);
  yPosition = 50;

  // Reset text color
  doc.setTextColor(0, 0, 0);

  // Metadata
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  doc.text(`Created: ${new Date(conversation.createdAt).toLocaleDateString()}`, margin, yPosition);
  yPosition += 7;

  if (conversation.workspace?.name) {
    doc.text(`Workspace: ${conversation.workspace.name}`, margin, yPosition);
    yPosition += 7;
  }

  if (conversation.model) {
    doc.text(`Model: ${conversation.model}`, margin, yPosition);
    yPosition += 7;
  }

  doc.text(`Messages: ${conversation.messageCount}`, margin, yPosition);
  yPosition += 15;

  // Separator line
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, yPosition, pageWidth - margin, yPosition);
  yPosition += 15;

  // Messages
  doc.setTextColor(0, 0, 0);

  for (const message of conversation.messages) {
    checkAddPage(30);

    // Role label with background
    const roleText = message.role === 'user' ? 'You' : 'AI Agent';
    const roleColor = message.role === 'user' ? [59, 130, 246] : [34, 197, 94]; // Blue or Green

    doc.setFillColor(roleColor[0], roleColor[1], roleColor[2]);
    doc.roundedRect(margin, yPosition - 5, 30, 8, 2, 2, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text(roleText, margin + 2, yPosition);

    // Timestamp
    doc.setTextColor(150, 150, 150);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    const timestamp = new Date(message.createdAt).toLocaleString();
    doc.text(timestamp, margin + 35, yPosition);
    yPosition += 12;

    // Message content
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');

    // Handle long content
    const contentLines = doc.splitTextToSize(message.content, maxWidth);
    for (const line of contentLines) {
      checkAddPage(7);
      doc.text(line, margin, yPosition);
      yPosition += 5;
    }

    // Metadata
    if (message.tokens || message.credits) {
      yPosition += 3;
      checkAddPage(10);
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      let metaText = '';
      if (message.tokens) metaText += `Tokens: ${message.tokens}`;
      if (message.credits) metaText += ` • Credits: ${message.credits}`;
      doc.text(metaText, margin, yPosition);
      yPosition += 8;
    }

    // Spacing between messages
    yPosition += 8;

    // Separator line
    checkAddPage(10);
    doc.setDrawColor(230, 230, 230);
    doc.line(margin, yPosition, pageWidth - margin, yPosition);
    yPosition += 12;
  }

  // Footer on last page
  const pageCount = doc.internal.pages.length - 1;
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(
      `Exported from Xantuus AI • ${new Date().toLocaleDateString()} • Page ${i} of ${pageCount}`,
      margin,
      pageHeight - 10
    );
  }

  // Convert to buffer
  const pdfOutput = doc.output('arraybuffer');
  return Buffer.from(pdfOutput);
}
