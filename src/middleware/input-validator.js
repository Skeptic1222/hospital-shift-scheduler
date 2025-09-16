/**
 * Enhanced input validation middleware for HIPAA compliance
 * Prevents SQL injection, XSS, and other injection attacks
 */

const validator = require('validator');
const DOMPurify = require('isomorphic-dompurify');

class InputValidator {
    constructor() {
        this.validationRules = {
            email: (value) => validator.isEmail(value),
            phone: (value) => validator.isMobilePhone(value, 'any'),
            date: (value) => validator.isISO8601(value),
            uuid: (value) => validator.isUUID(value),
            alphanumeric: (value) => validator.isAlphanumeric(value),
            numeric: (value) => validator.isNumeric(value),
            url: (value) => validator.isURL(value),
            json: (value) => {
                try {
                    JSON.parse(value);
                    return true;
                } catch {
                    return false;
                }
            },
            time: (value) => /^([0-1]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/.test(value),
            shift_status: (value) => ['open', 'filled', 'partial', 'cancelled'].includes(value),
            role: (value) => ['admin', 'supervisor', 'user', 'guest'].includes(value)
        };

        // SQL injection patterns to block
        this.sqlPatterns = [
            /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|ALTER|CREATE|EXEC|EXECUTE|SCRIPT|TRUNCATE)\b)/gi,
            /(-{2}|\/\*|\*\/)/g, // SQL comments
            /(;|\||&&)/g, // Command chaining
            /(xp_|sp_)/gi, // SQL Server stored procedures
        ];

        // XSS patterns to sanitize
        this.xssPatterns = [
            /<script[^>]*>.*?<\/script>/gi,
            /<iframe[^>]*>.*?<\/iframe>/gi,
            /javascript:/gi,
            /on\w+\s*=/gi, // Event handlers
            /<embed[^>]*>/gi,
            /<object[^>]*>/gi,
        ];
    }

    /**
     * Sanitize string input
     */
    sanitizeString(input, options = {}) {
        if (typeof input !== 'string') return input;

        let sanitized = input.trim();

        // Remove null bytes
        sanitized = sanitized.replace(/\0/g, '');

        // Escape HTML if not explicitly allowed
        if (!options.allowHtml) {
            sanitized = validator.escape(sanitized);
        } else {
            // Use DOMPurify for HTML content
            sanitized = DOMPurify.sanitize(sanitized, {
                ALLOWED_TAGS: options.allowedTags || ['b', 'i', 'em', 'strong', 'a', 'p', 'br'],
                ALLOWED_ATTR: options.allowedAttributes || ['href', 'title']
            });
        }

        // Check for SQL injection attempts
        for (const pattern of this.sqlPatterns) {
            if (pattern.test(sanitized)) {
                console.warn('[SECURITY] Potential SQL injection attempt blocked:', sanitized);
                sanitized = sanitized.replace(pattern, '');
            }
        }

        // Remove potential XSS
        for (const pattern of this.xssPatterns) {
            sanitized = sanitized.replace(pattern, '');
        }

        // Limit string length
        const maxLength = options.maxLength || 1000;
        if (sanitized.length > maxLength) {
            sanitized = sanitized.substring(0, maxLength);
        }

        return sanitized;
    }

    /**
     * Validate and sanitize object recursively
     */
    sanitizeObject(obj, schema = {}) {
        if (!obj || typeof obj !== 'object') return obj;

        const sanitized = Array.isArray(obj) ? [] : {};

        for (const key in obj) {
            if (!obj.hasOwnProperty(key)) continue;

            // Skip unexpected fields if schema is provided
            if (Object.keys(schema).length > 0 && !schema[key]) {
                console.warn(`[VALIDATION] Unexpected field '${key}' removed`);
                continue;
            }

            const value = obj[key];
            const fieldSchema = schema[key] || {};

            if (typeof value === 'string') {
                sanitized[key] = this.sanitizeString(value, fieldSchema);
                
                // Apply specific validation if rule is provided
                if (fieldSchema.validate && this.validationRules[fieldSchema.validate]) {
                    if (!this.validationRules[fieldSchema.validate](sanitized[key])) {
                        throw new ValidationError(`Invalid ${fieldSchema.validate}: ${key}`);
                    }
                }
            } else if (typeof value === 'number') {
                // Validate number ranges
                if (fieldSchema.min !== undefined && value < fieldSchema.min) {
                    throw new ValidationError(`${key} must be at least ${fieldSchema.min}`);
                }
                if (fieldSchema.max !== undefined && value > fieldSchema.max) {
                    throw new ValidationError(`${key} must be at most ${fieldSchema.max}`);
                }
                sanitized[key] = value;
            } else if (typeof value === 'boolean') {
                sanitized[key] = Boolean(value);
            } else if (value instanceof Date) {
                sanitized[key] = value.toISOString();
            } else if (typeof value === 'object' && value !== null) {
                sanitized[key] = this.sanitizeObject(value, fieldSchema.schema || {});
            } else {
                sanitized[key] = value;
            }
        }

        // Check required fields
        if (schema) {
            for (const key in schema) {
                if (schema[key].required && sanitized[key] === undefined) {
                    throw new ValidationError(`Required field missing: ${key}`);
                }
            }
        }

        return sanitized;
    }

    /**
     * Validate request against schema
     */
    validateRequest(schema) {
        return (req, res, next) => {
            try {
                // Validate and sanitize body
                if (schema.body && req.body) {
                    req.body = this.sanitizeObject(req.body, schema.body);
                }

                // Validate and sanitize query parameters
                if (schema.query && req.query) {
                    req.query = this.sanitizeObject(req.query, schema.query);
                }

                // Validate and sanitize URL parameters
                if (schema.params && req.params) {
                    req.params = this.sanitizeObject(req.params, schema.params);
                }

                next();
            } catch (error) {
                if (error instanceof ValidationError) {
                    return res.status(400).json({
                        error: 'Validation Error',
                        message: error.message
                    });
                }
                
                console.error('[VALIDATION] Unexpected error:', error);
                return res.status(500).json({
                    error: 'Internal Server Error',
                    message: 'An error occurred during validation'
                });
            }
        };
    }

    /**
     * Validate file uploads
     */
    validateFileUpload(options = {}) {
        const allowedMimeTypes = options.mimeTypes || [
            'image/jpeg',
            'image/png',
            'image/gif',
            'application/pdf',
            'text/csv'
        ];
        
        const maxFileSize = options.maxSize || 5 * 1024 * 1024; // 5MB default

        return (req, res, next) => {
            if (!req.files || Object.keys(req.files).length === 0) {
                return next();
            }

            for (const fieldName in req.files) {
                const file = req.files[fieldName];
                
                // Check file size
                if (file.size > maxFileSize) {
                    return res.status(400).json({
                        error: 'File Too Large',
                        message: `File ${fieldName} exceeds maximum size of ${maxFileSize} bytes`
                    });
                }

                // Check mime type
                if (!allowedMimeTypes.includes(file.mimetype)) {
                    return res.status(400).json({
                        error: 'Invalid File Type',
                        message: `File type ${file.mimetype} is not allowed`
                    });
                }

                // Sanitize filename
                file.name = validator.escape(file.name)
                    .replace(/[^a-zA-Z0-9.-]/g, '_')
                    .substring(0, 255);
            }

            next();
        };
    }
}

class ValidationError extends Error {
    constructor(message) {
        super(message);
        this.name = 'ValidationError';
    }
}

// Export singleton instance
module.exports = new InputValidator();