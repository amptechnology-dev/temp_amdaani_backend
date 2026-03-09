import express from 'express';
import helmet from 'helmet';
import expressSanitize from '@exortek/express-mongo-sanitize';
import compression from 'compression';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import passport from 'passport';
import { jwtStrategy } from './config/passport.js';
import config from './config/config.js';
// import { authLimiter } from './middlewares/rateLimiter.js';
import { errorConverter, errorHandler } from './middlewares/error.middleware.js';
import { ApiError } from './utils/responseHandler.js';

const app = express();

// set security HTTP headers
app.use(helmet());
// parse json request body
app.use(express.json());
// parse urlencoded request body
app.use(express.urlencoded({ extended: true }));
// set static files
app.use(express.static('public'));
// sanitize request data
app.use(expressSanitize({ skipRoutes: ['/api/auth/logout', '/api/auth/refresh-tokens', '/api/how-to-videos'] }));
// gzip compression
app.use(compression());
// enable cors
app.use(cors(config.cors));
// cookie parser
app.use(cookieParser(config.cookieSecret));

// jwt authentication
app.use(passport.initialize());
passport.use('jwt', jwtStrategy);

// limit repeated failed requests to auth endpoints
// app.use('/v1/auth', authLimiter);

// API routes
import apiRouter from './routes/api.routes.js';
app.use('/api', apiRouter);

// healthcheck
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', uptime: process.uptime(), timestamp: new Date() });
});

// send back a 404 error for any unknown api request
app.use((req, res, next) => {
  next(new ApiError(404, 'Not found'));
});

// convert error to ApiError, if needed
app.use(errorConverter);
// handle error
app.use(errorHandler);

export default app;
