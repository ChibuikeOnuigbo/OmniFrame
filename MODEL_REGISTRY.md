# Model registry

The source of truth is `packages/engine/src/models/registry.ts`. It records:

- model/task/display name;
- source URL and revision;
- code licence and weight licence;
- size/quantisation/runtime;
- capabilities and browser/desktop support;
- Fast/Balanced/Quality tier;
- shippable/research-only decision;
- attribution and notes.

`auditModelLicences()` fails if an incompatible or unknown model is marked shippable.
