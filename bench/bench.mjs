// Minimal deterministic micro-benchmark
// Usage: node bench/bench.mjs
import { performance } from 'node:perf_hooks';
const ITER = 5000;
function fn(x){ return JSON.stringify(JSON.parse('{"x":'+x+'}')); }
const t0 = performance.now();
for (let i=0;i<ITER;i++) fn(i);
const t1 = performance.now();
const perOp = (t1 - t0) / ITER;
console.log(JSON.stringify({ iter: ITER, ms_total: t1 - t0, ms_per_op: perOp }));
