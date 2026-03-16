import mongoose from 'mongoose';
import app from './app.js';
import config from './config/config.js';
import logger from './config/logger.js';
import cronJobs from './jobs/cron.jobs.js';

let server;
mongoose.connect(config.mongoose.url).then(() => {
  logger.info(`Env: ${config.env}`);
  logger.info(`Connected to MongoDB at ${mongoose.connection.host}`);
  server = app.listen(config.port, () => {
    logger.info(`Listening to port ${config.port}`);
    console.log('POrt', config.port);
    cronJobs.bakeAll();
  });
});

const exitHandler = () => {
  if (server) {
    server.close(() => {
      logger.info('Server closed');
      process.exit(1);
    });
  } else {
    process.exit(1);
  }
};

const unexpectedErrorHandler = (error) => {
  logger.error(error, 'Unexpected Error');
  exitHandler();
};

process.on('uncaughtException', unexpectedErrorHandler);
process.on('unhandledRejection', unexpectedErrorHandler);

process.on('SIGTERM', () => {
  logger.info('SIGTERM received');
  if (server) {
    server.close();
  }
});
