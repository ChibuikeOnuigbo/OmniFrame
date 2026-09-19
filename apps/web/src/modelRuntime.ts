import * as ort from 'onnxruntime-web';

export interface EditorAssistManifest {
  name: string;
  format: 'omniframe-editor-assist-linear-v1';
  tokenizer: 'fnv1a-token-ngram-v1';
  feature_count: number;
  labels: string[];
  onnx: string | null;
}

export interface EditorAssistPrediction {
  action: string;
  probability: number;
}

export interface EditorAssistRuntime {
  manifest: EditorAssistManifest;
  predict(text: string, limit?: number): Promise<EditorAssistPrediction[]>;
}

function fnv1a(text: string): number {
  const bytes = new TextEncoder().encode(text);
  let value = 2166136261;
  for (const byte of bytes) {
    value ^= byte;
    value = Math.imul(value, 16777619) >>> 0;
  }
  return value >>> 0;
}

function featureVector(text: string, featureCount: number): Float32Array {
  const tokens = (text.toLocaleLowerCase().match(/[\p{L}\p{N}_'-]+/gu) ?? []).filter((token) => token.replace(/[_-]/g, '').length > 0);
  const terms = tokens.concat(tokens.slice(0, -1).map((token, index) => `${token}::${tokens[index + 1]}`));
  const vector = new Float32Array(featureCount);
  for (const term of terms.length ? terms : ['<empty>']) vector[fnv1a(term) % featureCount] += 1;
  let norm = 0;
  for (const value of vector) norm += value * value;
  norm = Math.sqrt(norm) || 1;
  for (let index = 0; index < vector.length; index++) vector[index] /= norm;
  return vector;
}

/** Load only when a caller explicitly opts into the local model bundle. */
export async function loadEditorAssistModel(manifestUrl: string): Promise<EditorAssistRuntime> {
  const response = await fetch(manifestUrl);
  if (!response.ok) throw new Error(`Editor-assist manifest could not be loaded (${response.status}).`);
  const manifest = await response.json() as EditorAssistManifest;
  if (manifest.format !== 'omniframe-editor-assist-linear-v1' || manifest.tokenizer !== 'fnv1a-token-ngram-v1') {
    throw new Error('The editor-assist model contract is not compatible with this runtime.');
  }
  if (!manifest.onnx) throw new Error('The selected editor-assist bundle has no ONNX artifact.');
  const modelUrl = new URL(manifest.onnx, new URL(manifestUrl, window.location.href)).toString();
  const session = await ort.InferenceSession.create(modelUrl, { executionProviders: ['wasm'] });
  return {
    manifest,
    async predict(text, limit = 5) {
      if (!text.trim()) return [];
      const input = new ort.Tensor('float32', featureVector(text, manifest.feature_count), [1, manifest.feature_count]);
      const output = await session.run({ features: input });
      const values = output.probabilities?.data;
      if (!values) throw new Error('The editor-assist ONNX graph returned no probabilities output.');
      return Array.from(values as Float32Array)
        .map((probability, index) => ({ action: manifest.labels[index] ?? `label_${index}`, probability: Number(probability) }))
        .sort((a, b) => b.probability - a.probability)
        .slice(0, Math.max(1, limit));
    },
  };
}
