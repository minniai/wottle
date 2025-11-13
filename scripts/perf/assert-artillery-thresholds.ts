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
  try {
    return JSON.parse(raw) as ArtilleryReport;
  } catch (error) {
    console.error(`Failed to parse Artillery report from ${filePath}:`);
    console.error(raw.substring(0, 500));
    throw new Error(`Invalid JSON in Artillery report: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function validate(report: ArtilleryReport) {
  // Debug: Log report structure if aggregate is missing
  if (!report.aggregate) {
    console.error("Artillery report structure:");
    console.error(JSON.stringify(report, null, 2).substring(0, 2000));
    throw new Error("Artillery report is missing aggregate metrics. Check the report structure above.");
  }

  const aggregate = report.aggregate;
  const anyAggregate = aggregate as any;
  
  // Artillery v2 uses counters with dot-notation keys like "http.requests"
  // Try multiple possible field names for requests completed
  let sampleSize = aggregate.requestsCompleted ?? 0;
  
  if (sampleSize <= 0 && anyAggregate.counters) {
    // Try various counter key formats
    sampleSize = anyAggregate.counters["http.requests"] ?? 
                 anyAggregate.counters["http.requests.completed"] ??
                 anyAggregate.counters["http.responses"] ??
                 anyAggregate.counters["http.responses.completed"] ??
                 anyAggregate.counters.http?.requests?.completed ??
                 anyAggregate.counters.http?.requests ??
                 0;
  }
  
  // Also try nested structures
  if (sampleSize <= 0) {
    sampleSize = anyAggregate.http?.requests?.completed ??
                 anyAggregate.http?.requests ??
                 anyAggregate.requests?.completed ??
                 0;
  }

  if (sampleSize <= 0) {
    const summaryCount =
      anyAggregate.summaries?.["http.response_time"]?.count ??
      anyAggregate.histograms?.["http.response_time"]?.count ??
      0;
    if (summaryCount > 0) {
      sampleSize = summaryCount;
    }
  }
  
  if (Number.isNaN(sampleSize) || sampleSize <= 0) {
    console.error("Available aggregate fields:", Object.keys(aggregate));
    if (anyAggregate.counters) {
      console.error("Available counters:", Object.keys(anyAggregate.counters));
    }
    console.error("Aggregate structure (first 1000 chars):", JSON.stringify(aggregate, null, 2).substring(0, 1000));
    throw new Error(`Artillery report is missing requestsCompleted value. Sample size was: ${sampleSize}`);
  }

  // Artillery v2 may have latencies as array or object
  // Try multiple possible structures for latency metrics
  let latency = aggregate.latency;
  
  if (!latency) {
    // Try latencies array (Artillery v2 format)
    if (Array.isArray(anyAggregate.latencies) && anyAggregate.latencies.length > 0) {
      latency = anyAggregate.latencies[0];
    } else if (anyAggregate.latencies) {
      latency = anyAggregate.latencies;
    } else {
      // Try nested structures
      latency = anyAggregate.latency?.http ?? 
                anyAggregate.http?.latency ??
                anyAggregate.metrics?.latency ??
                anyAggregate.summaries?.["http.response_time"] ??
                anyAggregate.histograms?.["http.response_time"];
    }
  }
  
  if (!latency || (typeof latency !== "object")) {
    console.error("Available aggregate fields:", Object.keys(aggregate));
    if (anyAggregate.counters) {
      console.error("Available counters:", Object.keys(anyAggregate.counters));
    }
    console.error("Aggregate structure (first 1000 chars):", JSON.stringify(aggregate, null, 2).substring(0, 1000));
    throw new Error("Artillery report is missing latency metrics. Check the report structure above.");
  }

  const anyLatency = latency as any;
  const medianMs = Number(
    anyLatency.median ??
      anyLatency.p50 ??
      anyLatency["50"] ??
      anyLatency.percentiles?.p50 ??
      anyLatency.percentiles?.["50"] ??
      NaN,
  );
  const p95Ms = Number(
    anyLatency.p95 ??
      anyLatency["95"] ??
      anyLatency.percentiles?.p95 ??
      anyLatency.percentiles?.["95"] ??
      NaN,
  );

  if (Number.isNaN(medianMs) || Number.isNaN(p95Ms)) {
    console.error("Available latency fields:", Object.keys(latency));
    console.error("Latency structure:", JSON.stringify(latency, null, 2));
    throw new Error(`Artillery report does not include median/p95 latency values. median: ${medianMs}, p95: ${p95Ms}`);
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
