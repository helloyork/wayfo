import type { Response } from "express";
export function sendError(
  res: Response,
  input: { code: string; message: string; retryable?: boolean; suggestion?: string },
  status = 400
) {
  res.status(status).json({
    code: input.code,
    message: input.message,
    retryable: input.retryable ?? false,
    suggestion: input.suggestion
  });
}
