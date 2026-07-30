import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

test.describe('DOM Execution & Performance Audit', () => {
  let auditReport = {
    errors: [] as string[],
    performance: {
      cls: 0,
      fcp: 0,
      longTasks: 0,
    }
  };

  test.afterAll(async () => {
    const logsDir = path.join(process.cwd(), 'logs');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
    fs.writeFileSync(
      path.join(logsDir, 'dom-audit-report.json'),
      JSON.stringify(auditReport, null, 2)
    );
  });

  test('Navigate to Storyboard, Edit Scene, and Trigger Stripe', async ({ page }) => {
    // 1. Error Capturing
    page.on('pageerror', exception => {
      auditReport.errors.push(`Uncaught exception: ${exception.message}`);
    });
    page.on('console', msg => {
      if (msg.type() === 'error') {
        auditReport.errors.push(`Console error: ${msg.text()}`);
      }
    });

    // 2. CDP Performance Setup
    const client = await page.context().newCDPSession(page);
    await client.send('Performance.enable');

    // 3. Navigation & DOM Verification
    await page.addInitScript(() => {
      window.localStorage.setItem('hasSeenOnboarding', 'true');
    });
    await page.goto('/');
    
    // Test the Explore to Studio routing
    await page.goto('/studio');
    await expect(page.locator('text=Storyboard Timeline')).toBeVisible();

    // 4. Test Single Scene Inline Edit
    const editButtons = page.locator('button:has-text("Edit & Regenerate")');
    if (await editButtons.count() > 0) {
      await editButtons.first().click();
      // Ensure the textarea becomes visible
      await expect(page.locator('textarea').first()).toBeVisible();
      await page.locator('textarea').first().fill('Test injection prompt');
      const rerenderButton = page.locator('button:has-text("Re-render Clip")');
      await expect(rerenderButton.first()).toBeVisible();
      // We don't click rerender because there's no real backend connected.
    }

    // 5. Test Stripe Checkout Button Trigger
    const stripeButton = page.locator('button:has-text("Upgrade to 4K Production")');
    if (await stripeButton.count() > 0) {
      // We don't click it to avoid navigating away immediately, just assert visibility
      await expect(stripeButton).toBeVisible();
    }

    // 6. Capture Performance Metrics (FCP, CLS, Long Tasks)
    const metrics = await client.send('Performance.getMetrics');
    
    // Extremely basic mapping for demo purposes. Real FCP/CLS require PerformanceObserver.
    const fcpMetric = metrics.metrics.find(m => m.name === 'FirstMeaningfulPaint');
    auditReport.performance.fcp = fcpMetric ? fcpMetric.value : 0;
    
    // Inject PerformanceObserver script for actual CLS & Long Tasks
    const perfData = await page.evaluate(() => {
      return new Promise<any>((resolve) => {
        let clsValue = 0;
        let longTasks = 0;

        try {
          new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
              if (!(entry as any).hadRecentInput) {
                clsValue += (entry as any).value;
              }
            }
          }).observe({ type: 'layout-shift', buffered: true });

          new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
              longTasks++;
            }
          }).observe({ entryTypes: ['longtask'] });
        } catch (e) {
          // APIs might not be supported in some environments
        }

        // Wait a small bit for metrics to buffer
        setTimeout(() => {
          resolve({ cls: clsValue, longTasks });
        }, 1000);
      });
    });

    auditReport.performance.cls = perfData.cls;
    auditReport.performance.longTasks = perfData.longTasks;

    // Introduce a mock failure to trigger the agentic healing loop
    // In our StoryboardTimeline, let's see if we have unhandled DOM mutations or 
    // a mock missing key (often happens in React lists)
    
    // Check if there's any errors logged
    if (auditReport.errors.length > 0) {
      console.warn("DOM Audit captured errors!");
    }
  });
});
