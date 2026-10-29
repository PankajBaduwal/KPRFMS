import app from './app.js';
import { env } from './config/env.js';
import { connectDatabase, disconnectDatabase } from './config/database.js';
import { logger } from './utils/logger.js';
import { PRODUCT_NAME } from './config/brand.js';
import { enableServerMode } from './tenancy/context.js';

async function startServer(): Promise<void> {
  // Only per-request institution context from here on (no process-wide tenant)
  enableServerMode();
  // Connect to MongoDB before starting the server
  await connectDatabase();

  const server = app.listen(env.PORT, () => {
    logger.info(`${PRODUCT_NAME} API server running on port ${env.PORT}`);
    logger.info(`Environment: ${env.NODE_ENV}`);
  });
  // Keep idle connections open longer than clients and proxies do (nginx, load balancers, fetch
  // pools), so a reused connection is never closed by the server at the moment a request is sent
  server.keepAliveTimeout = 65_000;
  server.headersTimeout = 66_000;

  // Graceful shutdown
  const shutdown = async (signal: string): Promise<void> => {
    logger.info(`${signal} received. Starting graceful shutdown...`);

    server.close(async () => {
      logger.info('HTTP server closed');
      await disconnectDatabase();
      process.exit(0);
    });

    // Force shutdown after 10 seconds
    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason: unknown) => {
    logger.error('Unhandled Promise Rejection:', reason instanceof Error ? reason.message : String(reason));
  });

  // Handle uncaught exceptions
  process.on('uncaughtException', (error: Error) => {
    logger.error('Uncaught Exception:', error.message);
    process.exit(1);
  });
}

startServer().catch((error: unknown) => {
  logger.error('Failed to start server:', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
