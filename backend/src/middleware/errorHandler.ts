import { Request, Response, NextFunction } from 'express';

export interface AppError extends Error {
  statusCode?: number;
  code?:       number;
  keyValue?:   Record<string, string>;
  errors?:     Record<string, { message: string }>;
}

export function errorHandler(
  err: AppError,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  let statusCode = err.statusCode || 500;
  let message    = err.message    || 'Server Error';

  // Mongoose duplicate key error
  if (err.code === 11000 && err.keyValue) {
    const field = Object.keys(err.keyValue)[0];
    message    = `${field.charAt(0).toUpperCase() + field.slice(1)} already in use`;
    statusCode  = 409;
  }

  // Mongoose validation error
  if (err.name === 'ValidationError' && err.errors) {
    message    = Object.values(err.errors).map((e) => e.message).join(', ');
    statusCode  = 400;
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    message    = 'Invalid token';
    statusCode  = 401;
  }
  if (err.name === 'TokenExpiredError') {
    message    = 'Token expired';
    statusCode  = 401;
  }

  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
}

export function notFound(req: Request, res: Response): void {
  res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found` });
}
