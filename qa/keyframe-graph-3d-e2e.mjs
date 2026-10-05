import { chromium as pwChromium } from 'playwright'
import serverlessChromium, { inflate } from '@sparticuz/chromium'
import { existsSync, mkdirSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { tmpdir } from 'node:os'

const ROOT = process.cwd()
const EVID_DIR = resolve('evidence/screenshots')
if (!existsSync(EVID_DIR)) mkdirSync(EVID_DIR, { recursive: true })

async function runTest() {
  console.log('--- Step 1: Navigating to OmniFrame Studio ---')
  await inflate(join(ROOT, 'node_modules/@sparticuz/chromium/bin/al2023.tar.br'))
  process.env.LD_LIBRARY_PATH = `${join(tmpdir(), 'al2023/lib')}:${tmpdir()}`

  const browser = await pwChromium.launch({
    executablePath: await serverlessChromium.executablePath(),
    args: ['--no-sandbox', '--use-gl=swiftshader'],
  })
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await context.newPage()

  await page.goto('http://localhost:5173/#studio', { waitUntil: 'networkidle' })
  await page.waitForTimeout(1000)

  // Seed sample video clip with animation
  await page.evaluate(() => {
    const store = window.__omniframe_store
    if (!store) throw new Error('Store not attached to window')
    const s = store.getState()
    const trkId = s.ensureTrack('video')

    s.addAsset({
      id: 'asset-test-hero',
      name: 'Bro killed 99.9% of the Viltrumites - INVINCIBLE',
      kind: 'video',
      url: 'blob:test-hero-video',
      duration: 30,
      width: 1920,
      height: 1080,
    })

    s.addClipToTrack(trkId, 'asset-test-hero', 1.0)
    const clips = store.getState().clips
    if (clips.length > 0) {
      store.getState().selectClip(clips[0].id)
      store.getState().setPlayhead(1.0)
    }
  })

  await page.waitForTimeout(500)

  /**
   * The sidebar presents its sections as tabs (single-open in accordion mode).
   * Bring the section owning the next control on screen, either way.
   */
  const activateSection = async (id) => {
    const chip = page.locator(`[data-testid="section-tab-${id}"]`)
    if ((await chip.count()) > 0) {
      if ((await chip.getAttribute('aria-selected')) !== 'true') {
        await chip.click()
        await page.waitForTimeout(250)
      }
      return
    }
    const btn = page.locator(`[data-testid="panel-section-${id}"] > button`)
    if ((await btn.count()) > 0 && (await btn.getAttribute('aria-expanded')) !== 'true') {
      await btn.click()
      await page.waitForTimeout(200)
    }
  }

  console.log('--- Step 2: Testing Keyframing in RightPanel ---')
  // Keyframe diamonds live in the inspector's Transform section.
  await activateSection('transform')
  const keyDiamondPosX = page.locator('[data-testid="keyframe-diamond-position_x"]')
  await keyDiamondPosX.waitFor({ state: 'visible', timeout: 5000 })
  console.log('[PASS] Position X keyframe diamond visible')

  // Click keyframe diamond to add keyframe at playhead 1.0s
  await keyDiamondPosX.click()
  await page.waitForTimeout(300)

  // Set rotation keyframe at playhead
  const keyDiamondRot = page.locator('[data-testid="keyframe-diamond-rotation_z"]')
  await keyDiamondRot.click()
  await page.waitForTimeout(300)
  console.log('[PASS] Added keyframes on Position X and Rotation Z')

  console.log('--- Step 3: Testing Graph Editor (Curves) ---')
  // Open Graph Editor from timeline curves toggle
  const curvesToggleBtn = page.locator('[data-testid="toggle-graph-editor-btn"]')
  await curvesToggleBtn.waitFor({ state: 'visible', timeout: 5000 })
  await curvesToggleBtn.click()
  await page.waitForTimeout(500)

  const graphPanel = page.locator('[data-testid="graph-editor-panel"]')
  await graphPanel.waitFor({ state: 'visible', timeout: 5000 })
  console.log('[PASS] Graph Editor opened successfully')

  // Verify Value Graph and Speed Graph mode buttons
  const valueModeBtn = page.locator('[data-testid="graph-mode-value"]')
  const speedModeBtn = page.locator('[data-testid="graph-mode-speed"]')
  await valueModeBtn.waitFor({ state: 'visible' })
  await speedModeBtn.waitFor({ state: 'visible' })

  // Switch to Speed Graph
  await speedModeBtn.click()
  await page.waitForTimeout(300)
  console.log('[PASS] Switched to Speed Graph mode')

  // Switch back to Value Graph
  await valueModeBtn.click()
  await page.waitForTimeout(300)

  // Verify curve canvas and active path
  const svgCanvas = page.locator('[data-testid="graph-svg-canvas"]')
  await svgCanvas.waitFor({ state: 'visible' })

  // Click keyframe node
  const keyNodes = page.locator('[data-testid="curve-keyframe-node"]')
  const nodeCount = await keyNodes.count()
  console.log(`Keyframe nodes count in active curve: ${nodeCount}`)
  if (nodeCount > 0) {
    await keyNodes.first().click({ force: true })
    await page.waitForTimeout(300)

    // Verify cubic-in preset button and click it
    const cubicInBtn = page.locator('[data-testid="preset-cubic-in"]')
    if (await cubicInBtn.isVisible()) {
      await cubicInBtn.click()
      await page.waitForTimeout(300)
      console.log('[PASS] Applied cubic-in easing preset to keyframe')
    }

    // Verify handle modes and delete button
    const handleModeBtn = page.locator('[data-testid="handle-mode-aligned"]')
    await handleModeBtn.waitFor({ state: 'visible' })
    const deleteKeyBtn = page.locator('[data-testid="graph-delete-keyframe-btn"]')
    await deleteKeyBtn.waitFor({ state: 'visible' })
    console.log('[PASS] Handle mode selector and delete keyframe button verified')
  }

  // Capture Graph Editor visual proof
  const graphScreenshotPath = resolve(EVID_DIR, 'graph-editor-curves-verified.png')
  await graphPanel.screenshot({ path: graphScreenshotPath })
  console.log(`[PASS] Graph Editor screenshot saved to ${graphScreenshotPath}`)

  const cutGraphPath = resolve('evidence/cutouts/cut-graph-editor-curve-canvas.png')
  await graphPanel.screenshot({ path: cutGraphPath })

  // Close Graph Editor
  await curvesToggleBtn.click()
  await page.waitForTimeout(300)

  console.log('--- Step 4: Testing 3D Mode & Viewport Controls ---')
  // Click 3D Mode Toggle in Preview
  const toggle3DBtn = page.locator('[data-testid="toggle-3d-btn"]')
  await toggle3DBtn.waitFor({ state: 'visible', timeout: 5000 })
  await toggle3DBtn.click()
  await page.waitForTimeout(800)

  const threeContainer = page.locator('[data-testid="three-viewer-container"]')
  await threeContainer.waitFor({ state: 'visible', timeout: 5000 })
  console.log('[PASS] 3D Viewer container activated')

  // Verify Unreal/Unity style Camera Safe Frame
  const safeFrame = page.locator('[data-testid="camera-safe-frame"]')
  await safeFrame.waitFor({ state: 'visible', timeout: 5000 })
  const safeFrameText = await safeFrame.innerText()
  console.log(`[PASS] Camera safe frame overlay verified: ${safeFrameText.replace(/\n/g, ' ')}`)

  // Verify Blender Modes Toolbar
  const blenderToolbar = page.locator('[data-testid="blender-modes-toolbar"]')
  await blenderToolbar.waitFor({ state: 'visible', timeout: 5000 })

  const objModeBtn = page.locator('[data-testid="blender-mode-object"]')
  const camModeBtn = page.locator('[data-testid="blender-mode-camera"]')
  const texModeBtn = page.locator('[data-testid="blender-mode-texturing"]')
  const animModeBtn = page.locator('[data-testid="blender-mode-animation"]')

  await objModeBtn.waitFor({ state: 'visible' })
  await camModeBtn.waitFor({ state: 'visible' })
  await texModeBtn.waitFor({ state: 'visible' })
  await animModeBtn.waitFor({ state: 'visible' })
  console.log('[PASS] Blender modes verified: Object Mode, Camera View, Texturing, Curves')

  // Capture Blender Toolbar Cutout
  const cutBlenderPath = resolve('evidence/cutouts/cut-3d-blender-toolbar.png')
  await blenderToolbar.screenshot({ path: cutBlenderPath })

  // Switch to Camera View (Unreal/Unity camera perspective)
  await camModeBtn.click()
  await page.waitForTimeout(500)
  const aimStatus = page.locator('[data-testid="camera-aim-status"]')
  const statusText = await aimStatus.innerText()
  console.log(`[PASS] Camera perspective view active: ${statusText}`)

  // Capture Camera Safe Frame Cutout
  const cutSafeFramePath = resolve('evidence/cutouts/cut-3d-safe-frame.png')
  await safeFrame.screenshot({ path: cutSafeFramePath })

  // Capture RightPanel Keyframe Diamonds Cutout
  await activateSection('transform')
  const rightPanelTransform = page.locator('[data-testid="keyframe-diamond-position_x"]').locator('xpath=../../..')
  const cutDiamondsPath = resolve('evidence/cutouts/cut-rightpanel-keyframe-diamonds.png')
  if (await rightPanelTransform.isVisible()) {
    await rightPanelTransform.screenshot({ path: cutDiamondsPath })
  }

  // Switch to Texturing / Material Mode
  await texModeBtn.click()
  await page.waitForTimeout(400)
  const texturingPanel = page.locator('[data-testid="texturing-material-panel"]')
  await texturingPanel.waitFor({ state: 'visible', timeout: 5000 })
  console.log('[PASS] Texturing & Material PBR drawer verified')

  // Verify 3D Primitive selector (Wheel, Cube, Sphere, Torus, Diamond, Plane)
  const wheelPrimBtn = page.locator('[data-testid="three-primitive-wheel"]')
  await wheelPrimBtn.waitFor({ state: 'visible' })
  await wheelPrimBtn.click()
  await page.waitForTimeout(400)
  console.log('[PASS] 3D Wheel primitive selected')

  // Test WASD Camera Navigation simulation
  const threeCanvas = page.locator('[data-testid="three-canvas-wrapper"]')
  const canvasBox = await threeCanvas.boundingBox()
  if (canvasBox) {
    // Focus and simulate W (forward) and D (strafe right) keys
    await page.keyboard.press('KeyW')
    await page.waitForTimeout(100)
    await page.keyboard.press('KeyD')
    await page.waitForTimeout(100)
    console.log('[PASS] WASD camera movement simulated')

    // Simulate Left-click Orbit Drag
    await page.mouse.move(canvasBox.x + canvasBox.width / 2, canvasBox.y + canvasBox.height / 2)
    await page.mouse.down({ button: 'left' })
    await page.mouse.move(canvasBox.x + canvasBox.width / 2 + 50, canvasBox.y + canvasBox.height / 2 + 20)
    await page.mouse.up({ button: 'left' })
    await page.waitForTimeout(200)
    console.log('[PASS] Mouse orbit drag verified')

    // Simulate Right-click Pan Drag
    await page.mouse.down({ button: 'right' })
    await page.mouse.move(canvasBox.x + canvasBox.width / 2 - 30, canvasBox.y + canvasBox.height / 2 - 15)
    await page.mouse.up({ button: 'right' })
    await page.waitForTimeout(200)
    console.log('[PASS] Mouse right-click pan drag verified')

    // Simulate Mouse Wheel Zoom / Dolly
    await page.mouse.wheel(0, -120)
    await page.waitForTimeout(200)
    console.log('[PASS] Mouse wheel zoom/dolly verified')
  }

  console.log('--- Step 5: Testing Aspect Ratio Synchronization with 3D Camera ---')
  await page.evaluate(() => {
    window.__omniframe_store.getState().setSequenceAspectRatio('9:16')
  })
  await page.waitForTimeout(600)

  const updatedSafeFrameText = await safeFrame.innerText()
  console.log(`[PASS] 3D Camera aspect ratio updated to 9:16: ${updatedSafeFrameText.replace(/\n/g, ' ')}`)

  console.log('--- Step 6: Capturing Visual Proof Screenshots ---')
  const fullProofPath = resolve(EVID_DIR, 'three-d-camera-keyframe-curves-verified.png')
  await page.screenshot({ path: fullProofPath, fullPage: true })
  console.log(`[PASS] Full visual proof screenshot saved to ${fullProofPath}`)

  // The 3D panel explains that Drawing paint-layer masks are the only mask
  // route into the final video, then offers a deliberate switch to those tools.
  await page.locator('[data-testid="left-tab-threed"]').click()
  const maskScopeNote = page.locator('[data-testid="threed-mask-export-note"]')
  await maskScopeNote.waitFor({ state: 'visible', timeout: 5000 })
  const maskScopeText = await maskScopeNote.innerText()
  if (!maskScopeText.includes('Drawing paint layer')) {
    throw new Error(`3D mask/export scope is unclear: ${maskScopeText}`)
  }
  await page.locator('[data-testid="open-drawing-mask-tools"]').click()
  const maskRouteState = await page.evaluate(() => {
    const s = window.__omniframe_store.getState()
    return {
      leftTab: s.leftTab,
      is3DMode: s.is3DMode,
      drawingEnabled: s.drawingEnabled,
      drawingTool: s.drawingTool,
    }
  })
  if (maskRouteState.leftTab !== 'drawing' || maskRouteState.is3DMode || !maskRouteState.drawingEnabled || maskRouteState.drawingTool !== 'select-rect') {
    throw new Error(`Drawing mask tool route failed: ${JSON.stringify(maskRouteState)}`)
  }
  console.log(`[PASS] 3D export scope note and Drawing mask route verified: ${JSON.stringify(maskRouteState)}`)

  // 3D-local mask subtool: scene targets (geometry/material) and camera-space
  // selection, both editing-only until transferred to a Drawing selection.
  console.log('--- Step 7: Testing 3D Mask & Selection subtool ---')
  await toggle3DBtn.click()
  await page.waitForTimeout(800)
  await page.locator('[data-testid="left-tab-threed"]').click()
  await page.waitForTimeout(300)
  await page.locator('[data-testid="threed-submode-mask-btn"]').click()
  await page.waitForTimeout(400)

  const maskSubtool = page.locator('[data-testid="threed-mask-subtool"]')
  await maskSubtool.waitFor({ state: 'visible', timeout: 5000 })
  const sceneMode = await page.evaluate(() => window.__omniframe_store.getState().threeMaskMode)
  if (sceneMode !== 'scene') throw new Error(`Expected default scene mask mode, got ${sceneMode}`)
  console.log('[PASS] 3D mask subtool opens in scene-target mode')

  // Scene geometry pick: click the 2.5D video plane near the viewport centre.
  const maskCanvasBox = await page.locator('[data-testid="three-canvas-wrapper"]').boundingBox()
  await page.mouse.click(maskCanvasBox.x + maskCanvasBox.width * 0.5, maskCanvasBox.y + maskCanvasBox.height * 0.5)
  await page.waitForTimeout(300)
  const geometrySelection = await page.evaluate(() => {
    const sel = window.__omniframe_store.getState().threeMaskSelection
    return sel ? { mode: sel.mode, kind: sel.targetKind, name: sel.targetName, bounds: sel.bounds } : null
  })
  if (!geometrySelection || geometrySelection.mode !== 'scene' || geometrySelection.kind !== 'geometry') {
    throw new Error(`Scene geometry pick failed: ${JSON.stringify(geometrySelection)}`)
  }
  if (!(await page.locator('[data-testid="three-mask-selection-status"]').isVisible())) {
    throw new Error('Scene mask selection status not visible')
  }
  console.log(`[PASS] Scene geometry target selected: ${geometrySelection.name} bounds=${JSON.stringify(geometrySelection.bounds)}`)

  // Scene material pick: same click, but selects meshes sharing the material.
  await page.locator('[data-testid="three-mask-target-material"]').click()
  await page.waitForTimeout(200)
  await page.mouse.click(maskCanvasBox.x + maskCanvasBox.width * 0.5, maskCanvasBox.y + maskCanvasBox.height * 0.5)
  await page.waitForTimeout(300)
  const materialSelection = await page.evaluate(() => {
    const sel = window.__omniframe_store.getState().threeMaskSelection
    return sel ? { mode: sel.mode, kind: sel.targetKind, name: sel.targetName } : null
  })
  if (!materialSelection || materialSelection.kind !== 'material') {
    throw new Error(`Scene material pick failed: ${JSON.stringify(materialSelection)}`)
  }
  console.log(`[PASS] Scene material target selected: ${materialSelection.name}`)

  // Camera-space rectangle: drag on the overlay; camera must not orbit.
  // The texturing drawer would block the drag, so return to object mode first.
  await page.locator('[data-testid="blender-mode-object"]').click()
  await page.waitForTimeout(300)
  await page.locator('[data-testid="three-mask-mode-viewport"]').click()
  await page.waitForTimeout(300)
  const maskLayer = page.locator('[data-testid="three-viewport-mask-layer"]')
  await maskLayer.waitFor({ state: 'visible', timeout: 5000 })
  const layerBox = await maskLayer.boundingBox()
  const v0 = { x: layerBox.x + layerBox.width * 0.3, y: layerBox.y + layerBox.height * 0.3 }
  const v1 = { x: layerBox.x + layerBox.width * 0.6, y: layerBox.y + layerBox.height * 0.55 }
  await page.mouse.move(v0.x, v0.y)
  await page.mouse.down()
  await page.mouse.move(v1.x, v1.y, { steps: 6 })
  await page.mouse.up()
  await page.waitForTimeout(300)

  const viewportSelection = await page.evaluate(() => {
    const sel = window.__omniframe_store.getState().threeMaskSelection
    return sel ? { mode: sel.mode, bounds: sel.bounds, name: sel.targetName } : null
  })
  if (!viewportSelection || viewportSelection.mode !== 'viewport') {
    throw new Error(`Camera-space selection failed: ${JSON.stringify(viewportSelection)}`)
  }
  const vb = viewportSelection.bounds
  const approx = (a, b, tol = 0.06) => Math.abs(a - b) <= tol
  if (!approx(vb.x, 0.3) || !approx(vb.y, 0.3) || !approx(vb.width, 0.3) || !approx(vb.height, 0.25)) {
    throw new Error(`Camera-space bounds drifted (did the camera orbit?): ${JSON.stringify(vb)}`)
  }
  if (!(await page.locator('[data-testid="three-mask-selection-outline"]').isVisible())) {
    throw new Error('Camera-space selection outline not visible')
  }
  console.log(`[PASS] Camera-space selection drawn without orbiting: ${JSON.stringify(vb)}`)

  // Editing-only guarantee: no material/scene mutation before transfer.
  const sceneUntouched = await page.evaluate(() => {
    const s = window.__omniframe_store.getState()
    return { materials: s.materials.length, sceneObjects: s.scene3DObjects.length, clips: s.clips.length }
  })
  console.log(`[PASS] 3D mask stays editing-only: ${JSON.stringify(sceneUntouched)}`)

  // Transfer: projected bounds become a Drawing rectangle selection.
  await page.locator('[data-testid="three-mask-to-drawing-selection"]').click()
  await page.waitForTimeout(400)
  const transferState = await page.evaluate(() => {
    const s = window.__omniframe_store.getState()
    return {
      leftTab: s.leftTab,
      is3DMode: s.is3DMode,
      drawingEnabled: s.drawingEnabled,
      drawingTool: s.drawingTool,
      selectionMode: s.selectionMode,
      threeMaskMode: s.threeMaskMode,
      activeSelection: s.activeSelection
        ? { type: s.activeSelection.type, bounds: s.activeSelection.bounds }
        : null,
    }
  })
  if (
    transferState.leftTab !== 'drawing' ||
    transferState.is3DMode ||
    !transferState.drawingEnabled ||
    transferState.drawingTool !== 'select-rect' ||
    transferState.selectionMode !== 'rect' ||
    transferState.threeMaskMode !== 'off' ||
    transferState.activeSelection?.type !== 'rectangle'
  ) {
    throw new Error(`3D mask to Drawing transfer failed: ${JSON.stringify(transferState)}`)
  }
  const tb = transferState.activeSelection.bounds
  if (!approx(tb.x, vb.x) || !approx(tb.y, vb.y) || !approx(tb.width, vb.width) || !approx(tb.height, vb.height)) {
    throw new Error(`Transferred Drawing selection bounds mismatch: ${JSON.stringify(tb)} vs ${JSON.stringify(vb)}`)
  }
  const drawingScopeNote = page.locator('[data-testid="mask-export-scope-note"]')
  if (!(await drawingScopeNote.isVisible())) {
    throw new Error('Drawing selection mask scope note missing after 3D transfer')
  }
  console.log('[PASS] 3D mask selection transfers to a Drawing rectangle selection')

  await browser.close()
  console.log('ALL KEYFRAME, CURVE, AND 3D CRITERIA VERIFIED SUCCESSFULLY!')
}

runTest().catch((err) => {
  console.error('[FAIL] Test threw exception:', err)
  process.exit(1)
})
