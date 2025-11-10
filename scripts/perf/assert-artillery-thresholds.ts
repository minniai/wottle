import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const THRESHOLD_MS = Number(process.env.SWAP_LATENCY_THRESHOLD_MS ?? 200);
const MIN_SAMPLE_SIZE = Number(process.env.SWAP_LATENCY_MIN_SAMPLE ?? 10);

interface LatencyBucket {
  min: number;
  median: number;
  p95: number;
  p99?: number;
  max?: number;
}

interface ArtilleryAggregate {
  requestsCompleted?: number;
  latency?: LatencyBucket;
}

interface ArtilleryReport {
  aggregate?: ArtilleryAggregate;
}

function loadReport(path: string): ArtilleryReport {
  const filePath = resolve(process.cwd(), path);
  const raw = readFileSync(filePath, "utf8");
  return JSON.parse(raw) as ArtilleryReport;
}

function validate(report: ArtilleryReport) {
  const aggregate = report.aggregate;
  if (!aggregate) {
    throw new Error("Artillery report is missing aggregate metrics");
  }

  const sampleSize = aggregate.requestsCompleted ?? 0;
  if (Number.isNaN(sampleSize) || sampleSize <= 0) {
    throw new Error("Artillery report is missing requestsCompleted value");
  }

  const latency = aggregate.latency;
  if (!latency) {
    throw new Error("Artillery report is missing latency metrics");
  }

  const medianMs = Number(latency.median ?? NaN);
  const p95Ms = Number(latency.p95 ?? NaN);

  if (Number.isNaN(medianMs) || Number.isNaN(p95Ms)) {
    throw new Error("Artillery report does not include median/p95 latency values");
  }

  const summary = {
    event: "perf.swap.summary",
    thresholdMs: THRESHOLD_MS,
    minSampleSize: MIN_SAMPLE_SIZE,
    sampleSize,
    medianMs,
    p95Ms,
    passed:
      sampleSize >= MIN_SAMPLE_SIZE &&
      medianMs <= THRESHOLD_MS &&
      p95Ms <= THRESHOLD_MS,
  };

  console.log(JSON.stringify(summary));

  if (sampleSize < MIN_SAMPLE_SIZE) {
    throw new Error(
      `Perf gate failed: expected at least ${MIN_SAMPLE_SIZE} samples but received ${sampleSize}`,
    );
  }

  if (medianMs > THRESHOLD_MS) {
    throw new Error(
      `Perf gate failed: median latency ${medianMs}ms exceeds threshold ${THRESHOLD_MS}ms`,
    );
  }

  if (p95Ms > THRESHOLD_MS) {
    throw new Error(
      `Perf gate failed: p95 latency ${p95Ms}ms exceeds threshold ${THRESHOLD_MS}ms`,
    );
  }
}

function main() {
  const [, , reportPath] = process.argv;
  if (!reportPath) {
    console.error("Usage: tsx scripts/perf/assert-artillery-thresholds.ts <report.json>");
    process.exit(1);
    return;
  }

  try {
    const report = loadReport(reportPath);
    validate(report);
  } catch (error) {
    if (error instanceof Error) {
      console.error(error.message);
    } else {
      console.error(String(error));
    }
    process.exit(1);
  }
}

main();
