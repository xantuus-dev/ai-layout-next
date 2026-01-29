/**
 * Agent Tools Test Endpoint
 *
 * Tests all Phase 1 integrated tools to verify they work correctly
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { toolRegistry } from '@/lib/agent/tools';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const results: any = {
      timestamp: new Date().toISOString(),
      userId: session.user.id,
      tests: [],
    };

    // Test 1: Tool Registry
    console.log('\n=== Testing Tool Registry ===');
    const allTools = toolRegistry.getAllTools();
    results.tests.push({
      name: 'Tool Registry',
      passed: allTools.length === 22,
      details: {
        totalTools: allTools.length,
        expected: 22,
        tools: allTools.map(t => ({ name: t.name, category: t.category })),
      },
    });

    // Test 2: Browser Tools
    console.log('\n=== Testing Browser Tools ===');
    const browserTools = ['browser.navigate', 'browser.extract', 'browser.click', 'browser.screenshot', 'browser.waitFor'];
    const browserTest = {
      name: 'Browser Tools',
      passed: true,
      details: {} as any,
    };

    for (const toolName of browserTools) {
      const tool = toolRegistry.getTool(toolName);
      browserTest.details[toolName] = {
        registered: !!tool,
        hasExecute: !!tool?.execute,
        hasValidate: !!tool?.validate,
        hasEstimateCost: !!tool?.estimateCost,
      };

      if (!tool?.execute || !tool?.validate || !tool?.estimateCost) {
        browserTest.passed = false;
      }
    }
    results.tests.push(browserTest);

    // Test 3: Email Tools
    console.log('\n=== Testing Email Tools ===');
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        googleAccessToken: true,
        googleGmailEnabled: true,
        googleDriveEnabled: true,
        googleCalendarEnabled: true,
      },
    });

    const emailTools = ['email.send', 'email.sendBatch'];
    const emailTest = {
      name: 'Email Tools',
      passed: true,
      details: {
        gmailConnected: !!user?.googleGmailEnabled,
        hasAccessToken: !!user?.googleAccessToken,
        tools: {} as any,
      },
    };

    for (const toolName of emailTools) {
      const tool = toolRegistry.getTool(toolName);
      emailTest.details.tools[toolName] = {
        registered: !!tool,
        hasExecute: !!tool?.execute,
      };

      if (!tool?.execute) {
        emailTest.passed = false;
      }
    }
    results.tests.push(emailTest);

    // Test 4: Google Drive Tools
    console.log('\n=== Testing Google Drive Tools ===');
    const driveTools = [
      'drive.upload',
      'drive.list',
      'drive.createDoc',
      'drive.createSheet',
      'drive.download',
      'drive.share',
    ];

    const driveTest = {
      name: 'Google Drive Tools',
      passed: true,
      details: {
        driveConnected: !!user?.googleDriveEnabled,
        tools: {} as any,
      },
    };

    for (const toolName of driveTools) {
      const tool = toolRegistry.getTool(toolName);
      driveTest.details.tools[toolName] = {
        registered: !!tool,
        hasExecute: !!tool?.execute,
        hasValidate: !!tool?.validate,
        hasEstimateCost: !!tool?.estimateCost,
      };

      if (!tool?.execute) {
        driveTest.passed = false;
      }
    }
    results.tests.push(driveTest);

    // Test 5: Google Calendar Tools
    console.log('\n=== Testing Google Calendar Tools ===');
    const calendarTools = [
      'calendar.createEvent',
      'calendar.listEvents',
      'calendar.updateEvent',
      'calendar.deleteEvent',
    ];

    const calendarTest = {
      name: 'Google Calendar Tools',
      passed: true,
      details: {
        calendarConnected: !!user?.googleCalendarEnabled,
        tools: {} as any,
      },
    };

    for (const toolName of calendarTools) {
      const tool = toolRegistry.getTool(toolName);
      calendarTest.details.tools[toolName] = {
        registered: !!tool,
        hasExecute: !!tool?.execute,
        hasValidate: !!tool?.validate,
        hasEstimateCost: !!tool?.estimateCost,
      };

      if (!tool?.execute) {
        calendarTest.passed = false;
      }
    }
    results.tests.push(calendarTest);

    // Test 6: Tool Categories
    console.log('\n=== Testing Tool Categories ===');
    const categoryTest = {
      name: 'Tool Categories',
      passed: true,
      details: {
        browser: toolRegistry.getToolsByCategory('browser').length,
        communication: toolRegistry.getToolsByCategory('communication').length,
        integration: toolRegistry.getToolsByCategory('integration').length,
        utility: toolRegistry.getToolsByCategory('utility').length,
        data: toolRegistry.getToolsByCategory('data').length,
      },
    };

    // Expected counts based on Phase 1 implementation
    if (categoryTest.details.browser !== 5) categoryTest.passed = false;
    if (categoryTest.details.communication !== 2) categoryTest.passed = false;
    if (categoryTest.details.integration !== 10) categoryTest.passed = false;
    if (categoryTest.details.utility !== 5) categoryTest.passed = false; // 3 AI tools + 2 HTTP tools

    results.tests.push(categoryTest);

    // Summary
    const passedTests = results.tests.filter((t: any) => t.passed).length;
    const totalTests = results.tests.length;

    results.summary = {
      totalTests,
      passed: passedTests,
      failed: totalTests - passedTests,
      successRate: `${((passedTests / totalTests) * 100).toFixed(1)}%`,
      allPassed: passedTests === totalTests,
    };

    console.log('\n=== Test Summary ===');
    console.log(`Total Tests: ${totalTests}`);
    console.log(`Passed: ${passedTests}`);
    console.log(`Failed: ${totalTests - passedTests}`);
    console.log(`Success Rate: ${results.summary.successRate}`);

    return NextResponse.json(results, {
      status: results.summary.allPassed ? 200 : 500,
    });
  } catch (error: any) {
    console.error('Error running agent tools test:', error);
    return NextResponse.json(
      {
        error: error.message,
        stack: error.stack,
      },
      { status: 500 }
    );
  }
}
