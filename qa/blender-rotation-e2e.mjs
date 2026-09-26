import { chromium as pwChromium } from 'playwright'
import serverlessChromium, { inflate } from '@sparticuz/chromium'
import { mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const ROOT = process.cwd()
const URL = process.env.URL || 'http://localhost:5173/#studio'
const SHOTS = join(ROOT, 'evidence/screenshots')

mkdirSync(SHOTS, { recursive: true })

await inflate(join(ROOT, 'node_modules/@sparticuz/chromium/bin/al2023.tar.br'))
process.env.LD_LIBRARY_PATH = `${join(tmpdir(), 'al2023/lib')}:${tmpdir()}`

const browser = await pwChromium.launch({
  executablePath: await serverlessChromium.executablePath(),
  args: ['--no-sandbox', '--use-gl=swiftshader'],
})

const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })

console.log('Navigating to OmniFrame...');
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForSelector('[data-testid="preview-viewport"]', { timeout: 10000 });

// Add clip and select it
await page.evaluate(() => {
  const store = window.__omniframe_store;
  if (store) {
    store.getState().addTextTitleClip('Blender Gizmo Test', 5.0);
    const clips = store.getState().clips;
    if (clips.length > 0) {
      store.getState().selectClip(clips[0].id);
      store.getState().setRightOpen(true);
    }
  }
});
await page.waitForTimeout(500);

// Check for BlenderRotationIcon in DOM
const blenderIcons = page.locator('[data-testid="blender-rotation-icon"]');
const count = await blenderIcons.count();
console.log(`Found ${count} BlenderRotationIcon elements in inspector.`);

// Also open 3D tab in LeftDock
const threeTab = page.locator('[data-testid="left-tab-threed"]');
if (await threeTab.isVisible()) {
  await threeTab.click();
  await page.waitForTimeout(400);
}

const countAfter3D = await page.locator('[data-testid="blender-rotation-icon"]').count();
console.log(`Found ${countAfter3D} BlenderRotationIcon elements after opening 3D panel.`);

// Save screenshots
await page.screenshot({ path: join(SHOTS, 'blender-rotation-full.png') });
console.log('[PASS] Full page screenshot saved to evidence/screenshots/blender-rotation-full.png');

await browser.close();
if (countAfter3D === 0) {
  throw new Error('BlenderRotationIcon not found in DOM!');
}
console.log('Blender Rotation E2E Test Completed Successfully with count:', countAfter3D);
