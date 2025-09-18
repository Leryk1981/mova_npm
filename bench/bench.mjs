// Minimal deterministic micro-benchmark
// Usage: node bench/bench.mjs
import { performance } from 'node:perf_hooks';

const ITERATIONS = 5000;

function sampleTransform(x) {
  return JSON.stringify(JSON.parse('{"x":' + x + '}'));
}

const start = performance.now();
for (let i = 0; i < ITERATIONS; i += 1) {
  sampleTransform(i);
}
const end = performance.now();

const total = end - start;
const perOp = total / ITERATIONS;

console.log(JSON.stringify({ iter: ITERATIONS, ms_total: total, ms_per_op: perOp }));
