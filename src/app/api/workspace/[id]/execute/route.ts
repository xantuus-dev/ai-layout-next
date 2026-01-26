import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { aiRouter } from '@/lib/ai-providers';
import { verifyWorkspaceAccess } from '@/lib/workspace-utils';
import { checkAndResetCredits } from '@/lib/credits';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const encoder = new TextEncoder();
  const workspaceId = params.id;

  // Create streaming response
  const stream = new ReadableStream({
    async start(controller) {
      let userMessageId: string | null = null;
      let creditsDeducted = 0;
      let userId: string | null = null;

      try {
        // 1. Authenticate user
        const session = await getServerSession(authOptions);
        if (!session?.user?.email) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: 'error', message: 'Unauthorized' })}\n\n`)
          );
          controller.close();
          return;
        }

        const user = await prisma.user.findUnique({
          where: { email: session.user.email },
        });

        if (!user) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: 'error', message: 'User not found' })}\n\n`)
          );
          controller.close();
          return;
        }

        userId = user.id;

        // 2. Verify workspace access
        const hasAccess = await verifyWorkspaceAccess(workspaceId, user.id);
        if (!hasAccess) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: 'error', message: 'Access denied' })}\n\n`)
          );
          controller.close();
          return;
        }

        // 3. Parse request body
        const body = await request.json();
        const { conversationId, message, files, pastedContent, model, isThinkingEnabled } = body;

        if (!message) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: 'error', message: 'Message is required' })}\n\n`)
          );
          controller.close();
          return;
        }

        // 4. Check credits
        await checkAndResetCredits(user.id);
        const updatedUser = await prisma.user.findUnique({
          where: { id: user.id },
        });

        if (!updatedUser || updatedUser.creditsUsed >= updatedUser.monthlyCredits) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: 'error', message: 'Insufficient credits' })}\n\n`)
          );
          controller.close();
          return;
        }

        // 5. Create user message with transaction
        const userMessage = await prisma.$transaction(async (tx) => {
          const msg = await tx.message.create({
            data: {
              conversationId,
              role: 'user',
              content: message,
              model,
              thinkingEnabled: isThinkingEnabled || false,
            },
          });

          // Create attachments if files exist
          if (files && files.length > 0) {
            await tx.messageAttachment.createMany({
              data: files.map((file: any) => ({
                messageId: msg.id,
                fileName: file.name,
                fileType: file.type,
                fileSize: file.size || 0,
                fileData: file.data,
              })),
            });
          }

          // Update conversation
          await tx.conversation.update({
            where: { id: conversationId },
            data: {
              messageCount: { increment: 1 },
              lastMessageAt: new Date(),
            },
          });

          return msg;
        });

        userMessageId = userMessage.id;

        // Send user message confirmation
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: 'userMessage', message: userMessage })}\n\n`)
        );

        // 6. Build AI request content
        const contentBlocks: any[] = [];

        // Add text message
        if (message) {
          contentBlocks.push({ type: 'text', text: message });
        }

        // Add pasted content
        if (pastedContent && pastedContent.length > 0) {
          pastedContent.forEach((content: any) => {
            if (content.type === 'image') {
              contentBlocks.push({
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: content.mimeType || 'image/png',
                  data: content.data,
                },
              });
            } else {
              contentBlocks.push({
                type: 'text',
                text: `Pasted content (${content.name}):\n${content.content}`,
              });
            }
          });
        }

        // Add image files
        if (files && files.length > 0) {
          files.forEach((file: any) => {
            if (file.type.startsWith('image/')) {
              contentBlocks.push({
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: file.type,
                  data: file.data,
                },
              });
            } else {
              contentBlocks.push({
                type: 'text',
                text: `File attached: ${file.name} (${file.type})`,
              });
            }
          });
        }

        // 7. Call AI with streaming
        let fullResponse = '';
        let inputTokens = 0;
        let outputTokens = 0;

        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: 'thinking' })}\n\n`)
        );

        const content = contentBlocks.length === 1 ? contentBlocks[0].text : contentBlocks;

        const aiResponse = await aiRouter.chat(model || 'claude-sonnet-4-5-20250929', {
          messages: [
            {
              role: 'user',
              content,
            },
          ],
          maxTokens: isThinkingEnabled ? 8192 : 4096,
          thinking: isThinkingEnabled ? { type: 'enabled', budget_tokens: 2048 } : undefined,
        });

        fullResponse = aiResponse.content;
        inputTokens = aiResponse.usage?.inputTokens || 0;
        outputTokens = aiResponse.usage?.outputTokens || 0;
        const totalTokens = inputTokens + outputTokens;

        // Stream the response in chunks
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: 'streaming' })}\n\n`)
        );

        // Split response into chunks for streaming effect
        const chunkSize = 50;
        for (let i = 0; i < fullResponse.length; i += chunkSize) {
          const chunk = fullResponse.substring(i, i + chunkSize);
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: 'chunk', content: chunk })}\n\n`)
          );
          // Small delay for streaming effect
          await new Promise(resolve => setTimeout(resolve, 10));
        }

        const creditsUsed = aiRouter.estimateCredits(model || 'claude-sonnet-4-5-20250929', totalTokens);
        creditsDeducted = creditsUsed;

        // 8. Save assistant message and create task
        await prisma.$transaction(async (tx) => {
          // Create assistant message
          const assistantMessage = await tx.message.create({
            data: {
              conversationId,
              role: 'assistant',
              content: fullResponse,
              model: model || 'claude-sonnet-4-5-20250929',
              tokens: totalTokens,
              credits: creditsUsed,
              thinkingEnabled: isThinkingEnabled || false,
            },
          });

          // Update conversation
          await tx.conversation.update({
            where: { id: conversationId },
            data: {
              messageCount: { increment: 1 },
              lastMessageAt: new Date(),
            },
          });

          // Create task record
          await tx.task.create({
            data: {
              userId: user.id,
              title: message.substring(0, 100),
              description: `Agent execution: ${message}`,
              status: 'completed',
              priority: 'medium',
              agentModel: model || 'claude-sonnet-4-5-20250929',
              agentConfig: {
                thinkingEnabled: isThinkingEnabled || false,
                conversationId,
                workspaceId,
              },
              result: {
                messageId: assistantMessage.id,
                tokens: totalTokens,
                credits: creditsUsed,
                response: fullResponse.substring(0, 500),
              },
              attempts: 1,
              lastRunAt: new Date(),
              completedAt: new Date(),
            },
          });

          // Create usage record
          await tx.usageRecord.create({
            data: {
              userId: user.id,
              type: 'agent',
              model: model || 'claude-sonnet-4-5-20250929',
              tokens: totalTokens,
              credits: creditsUsed,
              metadata: {
                workspaceId,
                conversationId,
                messageId: assistantMessage.id,
              },
            },
          });

          // Update user credits
          await tx.user.update({
            where: { id: user.id },
            data: {
              creditsUsed: { increment: creditsUsed },
            },
          });
        });

        // 9. Send completion
        const creditsRemaining = updatedUser.monthlyCredits - (updatedUser.creditsUsed + creditsDeducted);
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({
            type: 'complete',
            tokens: totalTokens,
            credits: creditsDeducted,
            creditsRemaining,
          })}\n\n`)
        );

        controller.close();
      } catch (error) {
        console.error('Streaming execution error:', error);

        // Rollback strategy
        try {
          if (userId) {
            if (userMessageId && creditsDeducted === 0) {
              // AI call failed before credit deduction - delete user message
              await prisma.message.delete({
                where: { id: userMessageId },
              });
            } else if (creditsDeducted > 0) {
              // Credits already deducted - refund
              await prisma.user.update({
                where: { id: userId },
                data: {
                  creditsUsed: { decrement: creditsDeducted },
                },
              });
            }
          }
        } catch (rollbackError) {
          console.error('Rollback error:', rollbackError);
        }

        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({
            type: 'error',
            message: error instanceof Error ? error.message : 'Unknown error',
          })}\n\n`)
        );
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
