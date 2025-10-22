import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();

    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const isProduction = process.env.NODE_ENV === 'production';

    // Extract error message safely
    let errorMessage = 'Internal server error';
    let errorDetails: any = null;

    if (exception instanceof HttpException) {
      const exceptionResponse = exception.getResponse();
      
      if (typeof exceptionResponse === 'string') {
        errorMessage = exceptionResponse;
      } else if (typeof exceptionResponse === 'object') {
        errorMessage = (exceptionResponse as any).message || exception.message;
        errorDetails = exceptionResponse;
      }
    } else if (exception instanceof Error) {
      errorMessage = isProduction ? 'Internal server error' : exception.message;
    }

    // Log full error details internally (including stack trace)
    const logContext = {
      method: request.method,
      url: request.url,
      ip: request.ip,
      userAgent: request.headers['user-agent'],
      userId: request.user?.userId,
      statusCode: status,
    };

    if (status >= 500) {
      this.logger.error(
        `[${status}] ${request.method} ${request.url} - ${errorMessage}`,
        exception instanceof Error ? exception.stack : undefined,
        JSON.stringify(logContext),
      );
    } else {
      this.logger.warn(
        `[${status}] ${request.method} ${request.url} - ${errorMessage}`,
        JSON.stringify(logContext),
      );
    }

    // Return sanitized error to client
    const errorResponse: any = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    // In production, only return generic messages for 500 errors
    if (isProduction && status === HttpStatus.INTERNAL_SERVER_ERROR) {
      errorResponse.message = 'Internal server error';
      errorResponse.error = 'Internal Server Error';
    } else {
      errorResponse.message = errorMessage;
      
      // Include error details only for non-500 errors or in development
      if (errorDetails && (!isProduction || status < 500)) {
        errorResponse.error = errorDetails;
      }
    }

    // Never expose stack traces in production
    if (!isProduction && exception instanceof Error && exception.stack) {
      errorResponse.stack = exception.stack.split('\n');
    }

    response.status(status).json(errorResponse);
  }
}
