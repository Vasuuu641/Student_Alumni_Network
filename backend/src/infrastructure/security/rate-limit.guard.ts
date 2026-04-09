import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RATE_LIMIT_KEY, RateLimitOptions } from './rate-limit.decorator';

type Bucket = {
  count: number;
  resetAt: number;
};

@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly buckets = new Map<string, Bucket>();

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const options = this.reflector.getAllAndOverride<RateLimitOptions>(RATE_LIMIT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!options) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const userId = request.user?.userId ?? 'anonymous';
    const routeKey = request.route?.path ?? request.url ?? 'unknown-route';
    const method = request.method ?? 'UNKNOWN';

    const key = `${method}:${routeKey}:${userId}`;
    const now = Date.now();

    const existing = this.buckets.get(key);
    if (!existing || now >= existing.resetAt) {
      this.buckets.set(key, {
        count: 1,
        resetAt: now + options.windowMs,
      });
      this.cleanupBuckets(now);
      return true;
    }

    if (existing.count >= options.maxRequests) {
      const retryAfterSeconds = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
      throw new HttpException(
        `Rate limit exceeded. Try again in ${retryAfterSeconds} second(s).`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    existing.count += 1;
    this.buckets.set(key, existing);
    this.cleanupBuckets(now);

    return true;
  }

  private cleanupBuckets(now: number): void {
    if (this.buckets.size < 2000) {
      return;
    }

    for (const [key, bucket] of this.buckets.entries()) {
      if (now >= bucket.resetAt) {
        this.buckets.delete(key);
      }
    }
  }
}
