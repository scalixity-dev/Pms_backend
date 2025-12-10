import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class CompressionLoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger('CompressionLogger');

  use(req: Request, res: Response, next: NextFunction) {
    const startTime = Date.now();
    let originalSize = 0;
    const logger = this.logger;
    const formatBytes = this.formatBytes.bind(this);

    const originalWrite = res.write.bind(res);
    const originalEnd = res.end.bind(res);

    res.write = function (chunk: any, encoding?: any, cb?: any) {
      if (chunk) {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding as BufferEncoding);
        originalSize += buffer.length;
      }
      return originalWrite(chunk, encoding, cb);
    };

    res.end = function (chunk: any, encoding?: any, cb?: any) {
      if (chunk) {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding as BufferEncoding);
        originalSize += buffer.length;
      }

      const contentEncoding = res.getHeader('content-encoding');
      const contentLengthHeader = res.getHeader('content-length');
      const contentTypeHeader = res.getHeader('content-type');
      const contentType = typeof contentTypeHeader === 'string' ? contentTypeHeader : Array.isArray(contentTypeHeader) ? contentTypeHeader[0] : '';
      
      const isCompressed = contentEncoding === 'gzip' || contentEncoding === 'br' || contentEncoding === 'deflate';
      const compressedSize = contentLengthHeader ? parseInt(String(contentLengthHeader), 10) : originalSize;
      const transferTime = Date.now() - startTime;

      if (isCompressed && originalSize > 0 && compressedSize < originalSize) {
        const compressionRatio = ((1 - compressedSize / originalSize) * 100).toFixed(1);
        const savedBytes = originalSize - compressedSize;
        const contentTypeDisplay = contentType ? contentType.split(';')[0] : 'unknown';
        
        logger.log(
          `[COMPRESSION] ${req.method} ${req.path} | ` +
          `Original: ${formatBytes(originalSize)} → ` +
          `Compressed: ${formatBytes(compressedSize)} | ` +
          `Saved: ${formatBytes(savedBytes)} (${compressionRatio}%) | ` +
          `Time: ${transferTime}ms | ` +
          `Type: ${contentTypeDisplay} | ` +
          `Encoding: ${contentEncoding}`
        );
      } else if (originalSize > 0) {
        logger.debug(
          `[COMPRESSION] ${req.method} ${req.path} | ` +
          `Not compressed: Original=${formatBytes(originalSize)}, ` +
          `ContentType=${contentType || 'none'}, ` +
          `Encoding=${contentEncoding || 'none'}, ` +
          `Threshold check: ${originalSize >= 1024 ? 'passed' : 'failed'}`
        );
      }

      return originalEnd(chunk, encoding, cb);
    };

    next();
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  }
}
