import Fastify from "fastify";
import healthRoutes from "./routes/health";
import changeEventRoutes from "./routes/change-events";
import organizationRoutes from "./routes/organizations";
import apiKeyRoutes from "./routes/api-keys";
import rewindRoutes from "./routes/rewind";
import scoringRoutes from "./routes/scoring";
import userRoutes from "./routes/users";
import config from "./config/environment";
import { registerDatabase } from "./database/connection";
import fastifyCors from "@fastify/cors";
import githubWebhookRoutes from "./routes/github-webhooks";
import rawBody from "fastify-raw-body";

const fastify = Fastify({
  logger: {
    level: config.logging.level,
  },
});

// Start server
const start = async () => {
  try {
    // Register database connection
    await registerDatabase(fastify);

    // register cors
    fastify.register(fastifyCors, {
      origin: (origin, callback) => {
        const allowedOrigins = config.cors.origin;

        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);

        if (allowedOrigins.includes(origin)) {
          return callback(null, true);
        }

        console.warn(`CORS blocked origin: ${origin}`);
        return callback(new Error("Not allowed by CORS"), false);
      },
      credentials: true,
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    });

    fastify.register(rawBody, {
      field: "rawBody",
      runFirst: true,
      encoding: "utf8",
    });

    // Register routes
    fastify.register(healthRoutes);
    fastify.register(userRoutes, { prefix: config.api.prefix });
    fastify.register(changeEventRoutes, { prefix: config.api.prefix });
    fastify.register(organizationRoutes, { prefix: config.api.prefix });
    fastify.register(apiKeyRoutes, { prefix: config.api.prefix });
    fastify.register(rewindRoutes, { prefix: config.api.prefix });
    fastify.register(scoringRoutes, { prefix: config.api.prefix });
    fastify.register(githubWebhookRoutes);

    await fastify.listen({
      port: config.port,
      host: config.host,
    });
    console.log(`✅ Server is running on http://${config.host}:${config.port}`);
    console.log(`🌍 Environment: ${config.nodeEnv}`);
    console.log(`🔗 API Prefix: ${config.api.prefix}`);
    console.log(`📊 Log Level: ${config.logging.level}`);
  } catch (err) {
    console.error("❌ Failed to start server:", err);
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
