/**
 * Price Monitor Test Script
 *
 * Run this to test the competitor price monitor workflow end-to-end
 *
 * Usage:
 *   npx tsx test-price-monitor.ts
 */

import { AgentExecutor } from './src/lib/agent/executor';
import { toolRegistry, initializeTools } from './src/lib/agent/tools';
import {
  createPriceMonitorPlan,
  createPriceMonitorTask,
  validatePriceMonitorConfig,
  CompetitorPriceMonitorConfig,
} from './src/lib/agent/workflows/competitor-price-monitor';

// Initialize tools
initializeTools();

async function testPriceMonitor() {
  console.log('🧪 Testing Competitor Price Monitor Workflow\n');
  console.log('='.repeat(60));

  // Test configuration
  const config: CompetitorPriceMonitorConfig = {
    competitorUrl: 'https://www.amazon.com/dp/B08N5WRWNW', // Amazon Echo Dot
    priceSelector: '.a-price-whole',
    thresholdPrice: 50.00,
    alertEmail: 'test@example.com',
    checkFrequency: 'daily',
    checkTime: '09:00',
  };

  console.log('\n📋 Configuration:');
  console.log(JSON.stringify(config, null, 2));

  // Step 1: Validate configuration
  console.log('\n✓ Step 1: Validating configuration...');
  const validation = validatePriceMonitorConfig(config);

  if (!validation.valid) {
    console.error('❌ Validation failed:');
    validation.errors.forEach(err => console.error(`  - ${err}`));
    return;
  }

  console.log('✅ Configuration valid!');

  // Step 2: Create task
  console.log('\n✓ Step 2: Creating agent task...');
  const taskTemplate = createPriceMonitorTask('test-user-123', config);
  const task = {
    id: 'test-task-' + Date.now(),
    ...taskTemplate,
    createdAt: new Date(),
  };

  console.log(`✅ Task created: ${task.id}`);

  // Step 3: Create execution plan
  console.log('\n✓ Step 3: Creating execution plan...');
  const plan = createPriceMonitorPlan(task.id, config);

  console.log(`✅ Plan created with ${plan.steps.length} steps:`);
  plan.steps.forEach((step, i) => {
    console.log(`  ${i + 1}. ${step.description} (${step.estimatedCredits} credits)`);
  });

  console.log(`\n💰 Estimated cost: ${plan.estimatedCredits} credits`);
  console.log(`⏱️  Estimated time: ${Math.round(plan.estimatedDuration / 1000)}s`);

  // Step 4: Execute the workflow
  console.log('\n✓ Step 4: Executing workflow...');
  console.log('='.repeat(60));

  try {
    const executor = new AgentExecutor(
      task.type,
      task.config,
      toolRegistry
    );

    // Set up event logging
    executor.onEvent((event) => {
      switch (event.type) {
        case 'task.started':
          console.log('\n🚀 Agent started execution');
          break;
        case 'task.step.started':
          console.log(`\n📍 Step ${event.stepNumber}: Starting...`);
          break;
        case 'task.step.completed':
          console.log(`✅ Step ${event.stepNumber}: Completed`);
          if (event.result.data) {
            console.log('   Output:', JSON.stringify(event.result.data, null, 2));
          }
          break;
        case 'task.step.failed':
          console.log(`❌ Step ${event.stepNumber}: Failed`);
          console.log(`   Error: ${event.error}`);
          break;
        case 'task.completed':
          console.log('\n🎉 Agent completed successfully!');
          break;
        case 'task.failed':
          console.log('\n❌ Agent failed!');
          console.log(`   Error: ${event.error}`);
          break;
      }
    });

    // Execute
    const result = await executor.execute(task, plan);

    // Step 5: Display results
    console.log('\n='.repeat(60));
    console.log('📊 Execution Results:');
    console.log('='.repeat(60));
    console.log(`Status: ${result.status}`);
    console.log(`Steps completed: ${result.steps}/${plan.totalSteps}`);
    console.log(`Duration: ${Math.round(result.duration / 1000)}s`);
    console.log(`Credits used: ${result.creditsUsed}`);
    console.log(`Tokens used: ${result.tokensUsed}`);

    if (result.result) {
      console.log('\nResult data:');
      console.log(JSON.stringify(result.result, null, 2));
    }

    if (result.error) {
      console.log('\nError:');
      console.log(result.error);
    }

    // Display trace
    console.log('\n📝 Execution Trace:');
    console.log('='.repeat(60));
    result.trace.forEach((trace) => {
      const status = trace.status === 'completed' ? '✅' : '❌';
      console.log(`\n${status} Step ${trace.stepNumber}: ${trace.action}`);
      console.log(`   Duration: ${trace.duration}ms`);
      console.log(`   Credits: ${trace.credits}`);
      if (trace.reasoning) {
        console.log(`   Reasoning: ${trace.reasoning}`);
      }
      if (trace.error) {
        console.log(`   Error: ${trace.error}`);
      }
    });

    // Final summary
    console.log('\n='.repeat(60));
    console.log('✅ TEST COMPLETE!');
    console.log('='.repeat(60));

    if (result.status === 'completed') {
      console.log('\n🎉 Workflow executed successfully!');
      console.log('\nNext steps:');
      console.log('1. Check the execution trace above');
      console.log('2. Verify the email was sent (if threshold met)');
      console.log('3. Test with different competitor URLs');
      console.log('4. Create a real monitor via the UI');
    } else {
      console.log('\n⚠️  Workflow did not complete successfully.');
      console.log('Review the error messages above and check:');
      console.log('- Is the competitor URL accessible?');
      console.log('- Is the CSS selector correct?');
      console.log('- Is Gmail connected for email sending?');
    }

  } catch (error: any) {
    console.error('\n❌ Fatal error during execution:');
    console.error(error.message);
    console.error('\nStack trace:');
    console.error(error.stack);
  }
}

// Run the test
console.log('Starting test in 2 seconds...\n');
setTimeout(() => {
  testPriceMonitor()
    .then(() => {
      console.log('\n✅ Test script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Test script failed:');
      console.error(error);
      process.exit(1);
    });
}, 2000);
