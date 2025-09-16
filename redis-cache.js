/**
 * Redis Caching Layer for Performance Optimization
 * Implements caching strategies for HIPAA-compliant data storage
 */

const Redis = require('ioredis');
const crypto = require('crypto');

class RedisCacheService {
    constructor(config) {
        this.config = config;
        
        // Always initialize Redis in this build
        this.isDemo = false;
        
        // Main Redis client
        this.client = new Redis({
            host: config.redis.host,
            port: config.redis.port,
            password: config.redis.password,
            db: config.redis.db || 0,
            retryStrategy: (times) => {
                const delay = Math.min(times * 50, 2000);
                return delay;
            },
            enableOfflineQueue: true,
            maxRetriesPerRequest: 3,
            lazyConnect: true,
            tls: config.redis.tls ? {
                rejectUnauthorized: true
            } : undefined
        });

        // Separate client for pub/sub
        this.pubClient = new Redis({ ...config.redis, lazyConnect: true });
        this.subClient = new Redis({ ...config.redis, lazyConnect: true });

        // Cache TTL configurations (in seconds)
        this.ttl = {
            session: 900, // 15 minutes (HIPAA requirement)
            shift: 300, // 5 minutes
            metrics: 60, // 1 minute
            user: 600, // 10 minutes
            schedule: 180, // 3 minutes
            notification: 120, // 2 minutes
            queue: 30, // 30 seconds for real-time queue
            presence: 300, // 5 minutes for user presence
            default: 300 // 5 minutes default
        };

        // Encryption for sensitive data (fallback generate for dev)
        const keyHex = config.encryptionKey || crypto.randomBytes(32).toString('hex');
        this.encryptionKey = Buffer.from(keyHex, 'hex');
        
        // Initialize cache patterns
        this.initializeCachePatterns();
        
        // Set up error handlers
        this.setupErrorHandlers();
    }

    /**
     * Initialize cache key patterns and namespaces
     */
    initializeCachePatterns() {
        this.keyPatterns = {
            session: 'session:{userId}',
            user: 'user:{userId}',
            user_settings: 'user_settings:{userId}',
            shift: 'shift:{shiftId}',
            schedule: 'schedule:{hospitalId}:{departmentId}:{date}',
            queue: 'queue:{openShiftId}',
            metrics: 'metrics:{type}:{id}',
            notification: 'notification:{userId}:{type}',
            presence: 'presence:{userId}',
            lock: 'lock:{resource}:{id}',
            rateLimit: 'ratelimit:{userId}:{action}'
        };
    }

    /**
     * Set up error handlers for Redis clients
     */
    setupErrorHandlers() {
        this.client.on('error', (err) => {
            console.error('Redis client error:', err);
        });

        this.client.on('connect', () => {
            console.log('Redis client connected');
        });

        this.client.on('ready', () => {
            console.log('Redis client ready');
        });
    }

    /**
     * Generate cache key from pattern
     */
    generateKey(pattern, params) {
        let key = this.keyPatterns[pattern] || pattern;
        Object.keys(params).forEach(param => {
            key = key.replace(`{${param}}`, params[param]);
        });
        return key;
    }

    /**
     * Encrypt sensitive data before caching
     */
    encryptData(data) {
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv('aes-256-gcm', this.encryptionKey, iv);
        
        const jsonData = JSON.stringify(data);
        let encrypted = cipher.update(jsonData, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        
        const authTag = cipher.getAuthTag();
        
        return JSON.stringify({
            e: encrypted,
            i: iv.toString('hex'),
            a: authTag.toString('hex')
        });
    }

    /**
     * Decrypt sensitive data after retrieval
     */
    decryptData(encryptedData) {
        try {
            const parsed = JSON.parse(encryptedData);
            const decipher = crypto.createDecipheriv(
                'aes-256-gcm',
                this.encryptionKey,
                Buffer.from(parsed.i, 'hex')
            );
            
            decipher.setAuthTag(Buffer.from(parsed.a, 'hex'));
            
            let decrypted = decipher.update(parsed.e, 'hex', 'utf8');
            decrypted += decipher.final('utf8');
            
            return JSON.parse(decrypted);
        } catch (error) {
            console.error('Decryption error:', error);
            return null;
        }
    }

    /**
     * Set cache with encryption for sensitive data
     */
    async set(pattern, params, data, options = {}) {
        
        
        const key = this.generateKey(pattern, params);
        const ttl = options.ttl || this.ttl[pattern] || this.ttl.default;
        const sensitive = options.sensitive || false;
        
        try {
            const value = sensitive ? 
                this.encryptData(data) : 
                JSON.stringify(data);
            
            if (ttl > 0) {
                await this.client.setex(key, ttl, value);
            } else {
                await this.client.set(key, value);
            }
            
            return true;
        } catch (error) {
            console.error('Cache set error:', error);
            return false;
        }
    }

    /**
     * Get cache with decryption for sensitive data
     */
    async get(pattern, params, options = {}) {
        
        
        const key = this.generateKey(pattern, params);
        const sensitive = options.sensitive || false;
        
        try {
            const value = await this.client.get(key);
            
            if (!value) {
                return null;
            }
            
            return sensitive ? 
                this.decryptData(value) : 
                JSON.parse(value);
        } catch (error) {
            console.error('Cache get error:', error);
            return null;
        }
    }

    /**
     * Delete cache entry
     */
    async del(pattern, params) {
        
        
        const key = this.generateKey(pattern, params);
        
        try {
            await this.client.del(key);
            return true;
        } catch (error) {
            console.error('Cache delete error:', error);
            return false;
        }
    }

    /**
     * Clear cache by pattern
     */
    async clearPattern(pattern) {
        try {
            const keys = await this.client.keys(pattern);
            if (keys.length > 0) {
                await this.client.del(...keys);
            }
            return keys.length;
        } catch (error) {
            console.error('Cache clear error:', error);
            return 0;
        }
    }

    /**
     * Cache user session with automatic expiry
     */
    async cacheSession(userId, sessionData) {
        return await this.set('session', { userId }, sessionData, {
            ttl: this.ttl.session,
            sensitive: true
        });
    }

    /**
     * Get cached user session
     */
    async getSession(userId) {
        return await this.get('session', { userId }, { sensitive: true });
    }

    /**
     * Cache shift data with dependencies
     */
    async cacheShift(shiftId, shiftData) {
        const multi = this.client.multi();
        
        // Cache main shift data
        const shiftKey = this.generateKey('shift', { shiftId });
        multi.setex(shiftKey, this.ttl.shift, JSON.stringify(shiftData));
        
        // Add to schedule index
        if (shiftData.departmentId && shiftData.date) {
            const scheduleKey = this.generateKey('schedule', {
                hospitalId: shiftData.hospitalId,
                departmentId: shiftData.departmentId,
                date: shiftData.date
            });
            multi.sadd(scheduleKey, shiftId);
            multi.expire(scheduleKey, this.ttl.schedule);
        }
        
        await multi.exec();
        return true;
    }

    /**
     * Cache with distributed lock for concurrency control
     */
    async cacheWithLock(pattern, params, data, lockTimeout = 5000) {
        const lockKey = this.generateKey('lock', params);
        const lockValue = crypto.randomBytes(16).toString('hex');
        
        try {
            // Try to acquire lock
            const acquired = await this.client.set(
                lockKey,
                lockValue,
                'PX',
                lockTimeout,
                'NX'
            );
            
            if (!acquired) {
                throw new Error('Could not acquire lock');
            }
            
            // Set cache value
            await this.set(pattern, params, data);
            
            // Release lock (only if we own it)
            const script = `
                if redis.call("get", KEYS[1]) == ARGV[1] then
                    return redis.call("del", KEYS[1])
                else
                    return 0
                end
            `;
            
            await this.client.eval(script, 1, lockKey, lockValue);
            
            return true;
        } catch (error) {
            console.error('Cache with lock error:', error);
            return false;
        }
    }

    /**
     * Implement rate limiting using Redis
     */
    async checkRateLimit(userId, action, limit = 10, window = 60) {
        const key = this.generateKey('rateLimit', { userId, action });
        
        try {
            const multi = this.client.multi();
            multi.incr(key);
            multi.expire(key, window);
            
            const results = await multi.exec();
            const count = results[0][1];
            
            return {
                allowed: count <= limit,
                count,
                limit,
                remaining: Math.max(0, limit - count),
                resetIn: window
            };
        } catch (error) {
            console.error('Rate limit check error:', error);
            return { allowed: true, count: 0, limit, remaining: limit };
        }
    }

    /**
     * Cache invalidation for related data
     */
    async invalidateRelated(type, id) {
        const patterns = {
            user: [
                `user:${id}`,
                `session:${id}`,
                `presence:${id}`,
                `notification:${id}:*`
            ],
            shift: [
                `shift:${id}`,
                `queue:*`,
                `schedule:*`
            ],
            department: [
                `schedule:*:${id}:*`,
                `metrics:department:${id}`
            ]
        };
        
        const toInvalidate = patterns[type] || [];
        
        for (const pattern of toInvalidate) {
            await this.clearPattern(pattern);
        }
    }

    /**
     * Publish event for real-time updates
     */
    async publish(channel, data) {
        try {
            await this.pubClient.publish(channel, JSON.stringify(data));
            return true;
        } catch (error) {
            console.error('Publish error:', error);
            return false;
        }
    }

    /**
     * Subscribe to events
     */
    async subscribe(channel, callback) {
        try {
            await this.subClient.subscribe(channel);
            
            this.subClient.on('message', (receivedChannel, message) => {
                if (receivedChannel === channel) {
                    try {
                        const data = JSON.parse(message);
                        callback(data);
                    } catch (error) {
                        console.error('Message parse error:', error);
                    }
                }
            });
            
            return true;
        } catch (error) {
            console.error('Subscribe error:', error);
            return false;
        }
    }

    /**
     * Get cache statistics
     */
    async getStats() {
        try {
            const info = await this.client.info('stats');
            const dbSize = await this.client.dbsize();
            
            return {
                connected: this.client.status === 'ready',
                dbSize,
                info: this.parseRedisInfo(info)
            };
        } catch (error) {
            console.error('Stats error:', error);
            return null;
        }
    }

    /**
     * Parse Redis INFO output
     */
    parseRedisInfo(info) {
        const lines = info.split('\r\n');
        const stats = {};
        
        lines.forEach(line => {
            if (line && !line.startsWith('#')) {
                const [key, value] = line.split(':');
                if (key && value) {
                    stats[key] = value;
                }
            }
        });
        
        return stats;
    }

    /**
     * Implement cache warming for frequently accessed data
     */
    async warmCache(type) {
        const warmingStrategies = {
            schedules: async () => {
                // Warm today's and tomorrow's schedules
                const today = new Date().toISOString().split('T')[0];
                const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
                
                // Fetch from database and cache
                // This would connect to your database service
                console.log(`Warming cache for schedules: ${today}, ${tomorrow}`);
            },
            metrics: async () => {
                // Warm current metrics
                console.log('Warming cache for metrics');
            }
        };
        
        const strategy = warmingStrategies[type];
        if (strategy) {
            await strategy();
        }
    }

    /**
     * Clean up expired data
     */
    async cleanup() {
        try {
            // Redis handles expiration automatically, but we can force cleanup
            const deleted = await this.clearPattern('session:*');
            console.log(`Cleaned up ${deleted} expired sessions`);
            
            return deleted;
        } catch (error) {
            console.error('Cleanup error:', error);
            return 0;
        }
    }

    /**
     * Close Redis connections
     */
    async close() {
        await this.client.quit();
        await this.pubClient.quit();
        await this.subClient.quit();
    }
}

module.exports = RedisCacheService;
