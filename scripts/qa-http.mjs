import { request } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const baseUrl = process.env.OMNIFRAME_BASE_URL ?? 'http://127.0.0.1:4174';
const outputDir = resolve(process.env.OMNIFRAME_QA_DIR ?? '/tmp/omniframe-qa/http');
const context = await request.newContext({ baseURL: baseUrl });
try {
  const response = await context.get('/');
  const html = await response.text();
  const contentType = response.headers()['content-type'] ?? '';
  const cssLinks = [...html.matchAll(/<link[^>]+rel=["']stylesheet["'][^>]+href=["']([^"']+)["'][^>]*>/gi)].map((match) => match[1]);
  await mkdir(outputDir, { recursive: true });
  await writeFile(resolve(outputDir, 'index.html'), html);
  for (const [index, href] of cssLinks.entries()) {
    const cssResponse = await context.get(href);
    await writeFile(resolve(outputDir, `stylesheet-${index}.css`), await cssResponse.text());
  }
  const report = {
    baseUrl,
    url: response.url(),
    status: response.status(),
    contentType,
    htmlBytes: Buffer.byteLength(html),
    stylesheetCount: cssLinks.length,
    stylesheetUrls: cssLinks,
    browserLaunch: 'not attempted; this is Playwright request-context coverage',
  };
  await writeFile(resolve(outputDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
  if (!response.ok() || !contentType.includes('text/html') || !html.includes('id="root"')) process.exitCode = 1;
} finally {
  await context.dispose();
}
