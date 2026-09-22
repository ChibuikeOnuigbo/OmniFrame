# Reference build and execution results

Date: 2026-09-22

| Scope | Result | Evidence / reason |
|---|---|---|
| Repository clone | 21/21 CLONED | Exact commits and durations in `clone-results.tsv` |
| Repository tree scan | 21/21 PASS | `git ls-tree -r --name-only HEAD` against every clone |
| Targeted source inspection | 9 repositories PASS | Recorded grep output in `source-observations.txt` |
| Web application dependency installs | SKIPPED | Installing 21 independent dependency graphs would be unrelated production modification and exceed this bounded surgical patch |
| Native desktop builds | SKIPPED | No GUI session; native project SDK/system-library prerequisites were not established |
| Native application screenshots | SKIPPED | No native editors were launched |
| CapCut installation/measurement | SKIPPED | CapCut was not installed in this Linux sandbox; no dimensions are invented |

Clone success is not reported as build or runtime success.
