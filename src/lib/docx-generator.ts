/**
 * DOCX Export Generator
 *
 * Generates professional Word document exports from conversations
 * Uses docx library for DOCX generation
 */

export async function generateDOCX(conversation: any): Promise<Buffer> {
  // Import docx dynamically to avoid issues with server-side rendering
  const {
    Document,
    Packer,
    Paragraph,
    TextRun,
    HeadingLevel,
    AlignmentType,
    BorderStyle,
  } = await import('docx');

  const children = [];

  // Title
  children.push(
    new Paragraph({
      text: conversation.title || 'Conversation',
      heading: HeadingLevel.HEADING_1,
      spacing: { after: 200 },
      alignment: AlignmentType.LEFT,
    })
  );

  // Metadata
  const metadataItems = [];
  metadataItems.push(`Created: ${new Date(conversation.createdAt).toLocaleDateString()}`);
  if (conversation.workspace?.name) {
    metadataItems.push(`Workspace: ${conversation.workspace.name}`);
  }
  if (conversation.model) {
    metadataItems.push(`Model: ${conversation.model}`);
  }
  metadataItems.push(`Messages: ${conversation.messageCount}`);

  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: metadataItems.join(' • '),
          size: 20,
          color: '666666',
        }),
      ],
      spacing: { after: 400 },
    })
  );

  // Horizontal line
  children.push(
    new Paragraph({
      border: {
        bottom: {
          color: 'CCCCCC',
          space: 1,
          style: BorderStyle.SINGLE,
          size: 6,
        },
      },
      spacing: { after: 300 },
    })
  );

  // Messages
  for (const message of conversation.messages) {
    // Role and timestamp
    const roleText = message.role === 'user' ? 'You' : 'AI Agent';
    const timestamp = new Date(message.createdAt).toLocaleString();

    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: roleText,
            bold: true,
            size: 24,
            color: message.role === 'user' ? '3B82F6' : '22C55E',
          }),
          new TextRun({
            text: ` • ${timestamp}`,
            size: 20,
            color: '999999',
          }),
        ],
        spacing: { before: 200, after: 100 },
      })
    );

    // Message content - split by newlines for proper formatting
    const contentLines = message.content.split('\n');
    for (const line of contentLines) {
      children.push(
        new Paragraph({
          text: line || ' ', // Empty line if blank
          spacing: { after: 100 },
        })
      );
    }

    // Metadata
    if (message.tokens || message.credits) {
      const metaText = [];
      if (message.tokens) metaText.push(`Tokens: ${message.tokens}`);
      if (message.credits) metaText.push(`Credits: ${message.credits}`);

      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: metaText.join(' • '),
              size: 18,
              color: '999999',
              italics: true,
            }),
          ],
          spacing: { after: 200 },
        })
      );
    }

    // Separator between messages
    children.push(
      new Paragraph({
        border: {
          bottom: {
            color: 'EEEEEE',
            space: 1,
            style: BorderStyle.SINGLE,
            size: 6,
          },
        },
        spacing: { after: 300 },
      })
    );
  }

  // Footer
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: `Exported from Xantuus AI on ${new Date().toLocaleDateString()}`,
          size: 18,
          color: '999999',
          italics: true,
        }),
      ],
      spacing: { before: 400 },
      alignment: AlignmentType.CENTER,
    })
  );

  // Create document
  const doc = new Document({
    sections: [
      {
        properties: {},
        children,
      },
    ],
  });

  // Generate buffer
  const buffer = await Packer.toBuffer(doc);
  return buffer;
}
