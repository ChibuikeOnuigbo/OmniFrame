#!/usr/bin/env node
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const args = process.argv.slice(2);
const valueFor = (name, fallback) => {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};
const baseUrl = valueFor('--base-url', process.env.OMNIFRAME_BASE_URL ?? 'http://127.0.0.1:4174');
const outputDir = resolve(valueFor('--output-dir', 'qa/captures'));
const viewports = [
  { name: 'desktop-1440', width: 1440, height: 900 },
  { name: 'desktop-1280', width: 1280, height: 800 },
  { name: 'tablet-1024', width: 1024, height: 768 },
  { name: 'narrow-760', width: 760, height: 720 },
  { name: 'mobile-390', width: 390, height: 844 },
];

await mkdir(outputDir, { recursive: true });
let browser;
try {
  browser = await chromium.launch({ headless: true });
} catch (error) {
  const report = { ok: false, reason: 'browser-launch-failed', message: String(error), baseUrl, generatedAt: new Date().toISOString() };
  await writeFile(resolve(outputDir, 'browser-launch-error.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.error(JSON.stringify(report, null, 2));
  process.exitCode = 2;
}
if (browser) {
  const report = { ok: true, baseUrl, generatedAt: new Date().toISOString(), captures: [] };
  try {
    for (const viewport of viewports) {
      const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, deviceScaleFactor: 1 });
      const page = await context.newPage();
      for (const route of ['/', '/#editor']) {
        const routeName = route === '/' ? 'landing' : 'editor';
        await page.goto(`${baseUrl}${route}`, { waitUntil: 'networkidle' });
        await page.waitForTimeout(150);
        const geometry = await page.evaluate(() => {
          const selectors = ['.editor-topbar', '.editor-main', '.preview-panel', '.preview-canvas', '.timeline-panel', '.properties-panel', '.editor-statusbar'];
          const boxes = Object.fromEntries(selectors.map((selector) => {
            const element = document.querySelector(selector);
            if (!element) return [selector, null];
            const rect = element.getBoundingClientRect();
            return [selector, { x: rect.x, y: rect.y, width: rect.width, height: rect.height, right: rect.right, bottom: rect.bottom }];
          }));
          return { innerWidth: window.innerWidth, innerHeight: window.innerHeight, scrollWidth: document.documentElement.scrollWidth, scrollHeight: document.documentElement.scrollHeight, horizontalOverflow: document.documentElement.scrollWidth - window.innerWidth, boxes };
        });
        const file = `${viewport.name}-${routeName}.png`;
        await page.screenshot({ path: resolve(outputDir, file), fullPage: true });
        report.captures.push({ viewport, route, file, geometry });
        if (routeName === 'editor') {
          const aspect = page.getByLabel('Sequence aspect ratio');
          if (await aspect.count()) {
            for (const value of ['16:9', '1:1', '9:16', '4:5']) {
              await aspect.selectOption(value);
              await page.screenshot({ path: resolve(outputDir, `${viewport.name}-editor-${value.replace(':', 'x')}.png`), fullPage: true });
            }
          }
        }
      }
      await context.close();
    }
    await writeFile(resolve(outputDir, 'geometry.json'), `${JSON.stringify(report, null, 2)}\n`);
    console.log(JSON.stringify(report, null, 2));
  } finally {
    await browser.close();
  }
}
