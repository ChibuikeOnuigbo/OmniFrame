/** Small CPU processing worker boundary for mask morphology and reference effects. */
import { feather, fillHoles, removeSmallComponents, type Gray } from '@omniframe/engine';

const ctx = self as unknown as DedicatedWorkerGlobalScope;
ctx.onmessage = (event: MessageEvent<{ id: string; operation: 'refine-mask'; mask: Gray }>) => {
  const { id, operation, mask } = event.data;
  if (operation !== 'refine-mask') return;
  const refined = removeSmallComponents(fillHoles(feather(mask, 1.5)), 8);
  ctx.postMessage({ id, type: 'complete', mask: refined }, [refined.data.buffer as ArrayBuffer]);
};
