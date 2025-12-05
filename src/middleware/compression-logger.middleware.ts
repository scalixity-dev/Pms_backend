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
    const originalJson = res.json.bind(res);

    const logCompressionStats = () => {
      const contentEncoding = res.getHeader('content-encoding');
      const contentLengthHeader = res.getHeader('content-length');
      const contentTypeHeader = res.getHeader('content-type');
      const contentType = typeof contentTypeHeader === 'string' ? contentTypeHeader : Array.isArray(contentTypeHeader) ? contentTypeHeader[0] : '';
      const acceptEncoding = req.headers['accept-encoding'] || 'none';
      
      const isCompressed = contentEncoding === 'gzip' || contentEncoding === 'br' || contentEncoding === 'deflate';
      const compressedSize = contentLengthHeader ? parseInt(String(contentLengthHeader), 10) : originalSize;
      const transferTime = Date.now() - startTime;
      const contentTypeDisplay = contentType ? contentType.split(';')[0] : 'unknown';

      if (originalSize > 0) {
        if (isCompressed) {
          if (compressedSize < originalSize) {
            const compressionRatio = ((1 - compressedSize / originalSize) * 100).toFixed(1);
            const savedBytes = originalSize - compressedSize;
            
            logger.log(
              `[COMPRESSION] ${req.method} ${req.path} | ` +
              `Original: ${formatBytes(originalSize)} → ` +
              `Compressed: ${formatBytes(compressedSize)} | ` +
              `Saved: ${formatBytes(savedBytes)} (${compressionRatio}%) | ` +
              `Time: ${transferTime}ms | ` +
              `Type: ${contentTypeDisplay} | ` +
              `Encoding: ${contentEncoding}`
            );
          } else {
            logger.log(
              `[COMPRESSION] ${req.method} ${req.path} | ` +
              `Compressed but no benefit: Original=${formatBytes(originalSize)}, ` +
              `Compressed=${formatBytes(compressedSize)}, ` +
              `Type: ${contentTypeDisplay}, Encoding: ${contentEncoding}`
            );
          }
        } else {
          logger.log(
            `[COMPRESSION] ${req.method} ${req.path} | ` +
            `Not compressed: Original=${formatBytes(originalSize)}, ` +
            `ContentType=${contentTypeDisplay}, ` +
            `Accept-Encoding=${acceptEncoding}, ` +
            `Reason: ${!acceptEncoding || acceptEncoding === 'none' ? 'client does not accept compression' : 'filtered or not compressible'}`
          );
        }
      }
    };

    res.write = function (chunk: any, encoding?: any, cb?: any) {
      if (chunk) {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding as BufferEncoding);
        originalSize += buffer.length;
      }
      return originalWrite(chunk, encoding, cb);
    };

    res.json = function (body: any) {
      if (body) {
        const jsonString = JSON.stringify(body);
        originalSize += Buffer.byteLength(jsonString, 'utf8');
      }
      return originalJson.call(this, body);
    };

    res.end = function (chunk: any, encoding?: any, cb?: any) {
      if (chunk) {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding as BufferEncoding);
        originalSize += buffer.length;
      }

      res.once('finish', logCompressionStats);

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
