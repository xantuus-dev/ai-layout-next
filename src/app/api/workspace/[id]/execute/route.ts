import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { aiRouter } from '@/lib/ai-providers';
import { verifyWorkspaceAccess } from '@/lib/workspace-utils';
import { checkAndResetCredits, hasEnoughCredits, resolveBillingUserId } from '@/lib/credits';
import { DEFAULT_ANTHROPIC_MODEL } from '@/lib/ai-providers/catalog';
import { getMemoryContext, extractAndStoreFacts, shouldExtractFacts } from '@/lib/memory/facts';
import { normalizeAttachment, isSupportedImageType, type NormalizedAttachment } from '@/lib/files/attachments';

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
      let billingUserId: string | null = null;

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
        billingUserId = await resolveBillingUserId(user.id);

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

        // 4. Check credits (resolves to the team billing pool if applicable)
        await checkAndResetCredits(user.id);
        if (!(await hasEnoughCredits(user.id, 0))) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: 'error', message: 'Insufficient credits' })}\n\n`)
          );
          controller.close();
          return;
        }

        const updatedUser = await prisma.user.findUnique({
          where: { id: billingUserId },
        });

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

          // Create attachments if files exist.
          //
          // normalizeAttachment tolerates both the flat shape and the older
          // nested { file: File } one, and drops anything without a usable
          // name. Previously this read file.name/.size/.data straight off a
          // payload that carried them on a nested File, so every upload hit
          // "Argument `fileName` is missing" and took the whole message
          // transaction down with it.
          if (files && files.length > 0) {
            const attachments = (files as unknown[])
              .map((raw) => normalizeAttachment(raw))
              .filter((a): a is NormalizedAttachment => a !== null);

            if (attachments.length !== files.length) {
              console.warn(
                `[Attachments] Skipped ${files.length - attachments.length} upload(s) with no usable file name`
              );
            }

            if (attachments.length > 0) {
              await tx.messageAttachment.createMany({
                data: attachments.map((file) => ({
                  messageId: msg.id,
                  fileName: file.name,
                  fileType: file.type,
                  fileSize: file.size,
                  fileData: file.data ?? null,
                })),
              });
            }
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

        // Add image files.
        //
        // Only a type the API actually accepts qualifies as an image block, and
        // only when bytes are present. The old check was file.type.startsWith
        // ('image/'), which happily passed the literal 'image/unknown' the
        // client used to send, together with data: undefined — a request the
        // API rejects. Anything else is described in text so the model at least
        // knows a file was attached.
        if (files && files.length > 0) {
          files.forEach((raw: any) => {
            const file = normalizeAttachment(raw);
            if (!file) return;

            if (isSupportedImageType(file.type) && file.data) {
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

        // Real streaming: deltas are forwarded the moment the model produces
        // them. This previously awaited the entire completion and then replayed
        // it through a setTimeout typewriter, which meant time-to-first-token
        // equalled total generation time and the fake replay added delay on top.
        // Reasoning text is streamed to the client for live display but is not
        // persisted — Message has no column for it, so it is intentionally not
        // accumulated here.
        let reasoningStartedAt = 0;
        let reasoningMs = 0;
        let hasEmittedStreaming = false;

        // Pull what we already know about this user. Returns null (never
        // throws) when memory is empty or unavailable, so chat is unaffected.
        const memoryContext = await getMemoryContext(user.id, message);

        const stream = aiRouter.chatStream(model || DEFAULT_ANTHROPIC_MODEL, {
          messages: [
            ...(memoryContext
              ? [{ role: 'system' as const, content: memoryContext }]
              : []),
            {
              role: 'user',
              content,
            },
          ],
          maxTokens: isThinkingEnabled ? 8192 : 4096,
          thinking: isThinkingEnabled ? { type: 'enabled', budget_tokens: 2048 } : undefined,
        });

        for await (const event of stream) {
          if (event.type === 'thinking') {
            if (!reasoningStartedAt) reasoningStartedAt = Date.now();
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ type: 'reasoning', content: event.delta })}\n\n`
              )
            );
          } else if (event.type === 'text') {
            // First answer token: reasoning is finished, so freeze its duration
            // and flip the client out of the thinking state.
            if (!hasEmittedStreaming) {
              if (reasoningStartedAt) {
                reasoningMs = Date.now() - reasoningStartedAt;
              }
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ type: 'streaming', reasoningMs })}\n\n`
                )
              );
              hasEmittedStreaming = true;
            }
            fullResponse += event.delta;
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ type: 'chunk', content: event.delta })}\n\n`
              )
            );
          } else if (event.type === 'done') {
            inputTokens = event.usage.inputTokens;
            outputTokens = event.usage.outputTokens;
          }
        }

        // A response consisting only of reasoning would leave the client stuck
        // in the thinking state, so make sure the transition always happens.
        if (!hasEmittedStreaming) {
          if (reasoningStartedAt) reasoningMs = Date.now() - reasoningStartedAt;
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: 'streaming', reasoningMs })}\n\n`)
          );
        }

        const totalTokens = inputTokens + outputTokens;

        const creditsUsed = aiRouter.estimateCredits(model || DEFAULT_ANTHROPIC_MODEL, totalTokens);
        creditsDeducted = creditsUsed;

        // 8. Save assistant message and create task
        await prisma.$transaction(async (tx) => {
          // Create assistant message
          const assistantMessage = await tx.message.create({
            data: {
              conversationId,
              role: 'assistant',
              content: fullResponse,
              model: model || DEFAULT_ANTHROPIC_MODEL,
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
              agentModel: model || DEFAULT_ANTHROPIC_MODEL,
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
              model: model || DEFAULT_ANTHROPIC_MODEL,
              tokens: totalTokens,
              credits: creditsUsed,
              metadata: {
                workspaceId,
                conversationId,
                messageId: assistantMessage.id,
              },
            },
          });

          // Update credits on the resolved billing owner (team pool if applicable)
          await tx.user.update({
            where: { id: billingUserId! },
            data: {
              creditsUsed: { increment: creditsUsed },
            },
          });
        });

        // 8b. Learn durable facts from the exchange.
        //
        // Cadence is driven by the real message count in the database, not by
        // anything the client sends — this endpoint receives no history, so a
        // client-derived count would never advance and extraction would never
        // fire. extractAndStoreFacts swallows its own errors, and this runs
        // after the reply has already been streamed to the user.
        try {
          const messageCount = await prisma.message.count({ where: { conversationId } });

          if (shouldExtractFacts(messageCount)) {
            const recent = await prisma.message.findMany({
              where: { conversationId },
              orderBy: { createdAt: 'desc' },
              take: 10,
              select: { role: true, content: true },
            });

            await extractAndStoreFacts({
              userId: user.id,
              messages: recent.reverse().map((m) => ({ role: m.role, content: m.content })),
            });
          }
        } catch (memoryError) {
          console.error('[Memory] Post-response extraction failed:', memoryError);
        }

        // 9. Send completion
        const creditsRemaining = updatedUser
          ? updatedUser.monthlyCredits - (updatedUser.creditsUsed + creditsDeducted)
          : null;
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
              // Credits already deducted - refund the billing owner (team pool if applicable)
              await prisma.user.update({
                where: { id: billingUserId || userId },
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
