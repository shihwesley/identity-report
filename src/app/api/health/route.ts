import { NextResponse } from 'next/server';

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  uptime: number;
  checks: {
    name: string;
    status: 'pass' | 'fail';
    message?: string;
  }[];
}

const startTime = Date.now();

export async function GET() {
  const checks: HealthStatus['checks'] = [];
  let overallStatus: HealthStatus['status'] = 'healthy';

  // Check 1: Basic runtime
  checks.push({
    name: 'runtime',
    status: 'pass',
    message: 'Node.js runtime operational'
  });

  // Check 2: Environment variables
  const requiredEnvVars = ['NODE_ENV'];
  const optionalEnvVars = ['PINATA_JWT', 'NEXT_PUBLIC_RPC_URL', 'NEXT_PUBLIC_REGISTRY_ADDRESS'];

  const missingRequired = requiredEnvVars.filter(v => !process.env[v]);
  const missingOptional = optionalEnvVars.filter(v => !process.env[v]);

  if (missingRequired.length > 0) {
    checks.push({
      name: 'environment',
      status: 'fail',
      message: `Missing required env vars: ${missingRequired.join(', ')}`
    });
    overallStatus = 'unhealthy';
  } else if (missingOptional.length > 0) {
    checks.push({
      name: 'environment',
      status: 'pass',
      message: `Optional env vars not set: ${missingOptional.join(', ')}`
    });
    // Don't mark as degraded for optional vars
  } else {
    checks.push({
      name: 'environment',
      status: 'pass',
      message: 'All environment variables configured'
    });
  }

  // Check 3: Memory usage
  const memUsage = process.memoryUsage();
  const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
  const heapTotalMB = Math.round(memUsage.heapTotal / 1024 / 1024);
  const heapPercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;

  if (heapPercent > 90) {
    checks.push({
      name: 'memory',
      status: 'fail',
      message: `High memory usage: ${heapUsedMB}MB / ${heapTotalMB}MB (${heapPercent.toFixed(1)}%)`
    });
    overallStatus = overallStatus === 'healthy' ? 'degraded' : overallStatus;
  } else {
    checks.push({
      name: 'memory',
      status: 'pass',
      message: `Memory usage: ${heapUsedMB}MB / ${heapTotalMB}MB (${heapPercent.toFixed(1)}%)`
    });
  }

  const healthStatus: HealthStatus = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '0.1.0',
    uptime: Math.round((Date.now() - startTime) / 1000),
    checks
  };

  const statusCode = overallStatus === 'healthy' ? 200 : overallStatus === 'degraded' ? 200 : 503;

  return NextResponse.json(healthStatus, { status: statusCode });
}

// HEAD request for simple availability check
export async function HEAD() {
  return new NextResponse(null, { status: 200 });
}
