/**
 * File Upload Validation Middleware
 * Secure file upload handling with HIPAA compliance
 */

const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');

class FileUploadValidator {
  constructor() {
    // Allowed file types for medical documents
    this.allowedMimeTypes = {
      // Documents
      'application/pdf': '.pdf',
      'application/msword': '.doc',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
      
      // Images (for medical imaging, credentials)
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/gif': '.gif',
      'image/tiff': '.tiff',
      'image/dicom': '.dcm',
      
      // Spreadsheets (for schedules)
      'application/vnd.ms-excel': '.xls',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
      'text/csv': '.csv'
    };

    // Maximum file sizes by type
    this.maxSizes = {
      document: 10 * 1024 * 1024,    // 10MB for documents
      image: 50 * 1024 * 1024,        // 50MB for medical images
      spreadsheet: 5 * 1024 * 1024,   // 5MB for spreadsheets
      default: 5 * 1024 * 1024        // 5MB default
    };

    // Dangerous file extensions to block
    this.blockedExtensions = [
      '.exe', '.bat', '.cmd', '.sh', '.ps1', '.psm1',
      '.dll', '.so', '.dylib',
      '.js', '.vbs', '.wsf', '.jar',
      '.app', '.deb', '.rpm',
      '.com', '.scr', '.msi',
      '.html', '.htm', '.php', '.asp', '.aspx', '.jsp'
    ];

    // Upload directory (should be outside web root in production)
    this.uploadDir = path.join(__dirname, '..', 'uploads', 'secure');
    this.ensureUploadDirectory();
  }

  /**
   * Ensure upload directory exists
   */
  ensureUploadDirectory() {
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true, mode: 0o700 });
    }
  }

  /**
   * Generate secure filename
   */
  generateSecureFilename(originalName) {
    const ext = path.extname(originalName).toLowerCase();
    const timestamp = Date.now();
    const random = crypto.randomBytes(16).toString('hex');
    return `${timestamp}-${random}${ext}`;
  }

  /**
   * Validate file extension
   */
  validateExtension(filename) {
    const ext = path.extname(filename).toLowerCase();
    
    // Check against blocked extensions
    if (this.blockedExtensions.includes(ext)) {
      throw new Error(`File type ${ext} is not allowed for security reasons`);
    }

    // Validate double extensions
    const parts = filename.split('.');
    if (parts.length > 2) {
      // Check for dangerous double extensions like .pdf.exe
      for (let i = 1; i < parts.length; i++) {
        if (this.blockedExtensions.includes(`.${parts[i]}`)) {
          throw new Error('Double extension detected with dangerous type');
        }
      }
    }

    return true;
  }

  /**
   * Validate MIME type
   */
  validateMimeType(mimetype) {
    if (!this.allowedMimeTypes[mimetype]) {
      throw new Error(`File type ${mimetype} is not allowed`);
    }
    return true;
  }

  /**
   * Get file type category
   */
  getFileCategory(mimetype) {
    if (mimetype.startsWith('image/')) return 'image';
    if (mimetype.includes('spreadsheet') || mimetype === 'text/csv') return 'spreadsheet';
    return 'document';
  }

  /**
   * Scan file content for malware patterns
   */
  scanFileContent(filepath) {
    const content = fs.readFileSync(filepath, { encoding: 'utf8', flag: 'r' });
    
    // Check for common malware patterns
    const dangerousPatterns = [
      /<script[\s\S]*?<\/script>/gi,     // JavaScript
      /<iframe[\s\S]*?>/gi,               // iFrames
      /eval\s*\(/gi,                      // eval() calls
      /document\.write/gi,                // document.write
      /window\.location/gi,               // Redirects
      /\.exe|\.dll|\.bat|\.cmd/gi,       // Executable references
      /%3Cscript/gi,                     // URL encoded script
      /javascript:/gi,                    // JavaScript protocol
      /on\w+\s*=/gi                       // Event handlers
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(content)) {
        return false; // Dangerous content detected
      }
    }

    return true; // File appears safe
  }

  /**
   * Create multer storage configuration
   */
  createStorage() {
    return multer.diskStorage({
      destination: (req, file, cb) => {
        cb(null, this.uploadDir);
      },
      filename: (req, file, cb) => {
        try {
          this.validateExtension(file.originalname);
          const secureFilename = this.generateSecureFilename(file.originalname);
          cb(null, secureFilename);
        } catch (error) {
          cb(error);
        }
      }
    });
  }

  /**
   * File filter for multer
   */
  fileFilter() {
    return (req, file, cb) => {
      try {
        // Validate MIME type
        this.validateMimeType(file.mimetype);
        
        // Validate extension
        this.validateExtension(file.originalname);
        
        // Check file size (basic check, more detailed in limits)
        const category = this.getFileCategory(file.mimetype);
        const maxSize = this.maxSizes[category] || this.maxSizes.default;
        
        cb(null, true);
      } catch (error) {
        cb(error);
      }
    };
  }

  /**
   * Get multer limits configuration
   */
  getLimits() {
    return {
      fileSize: this.maxSizes.image, // Use largest allowed
      files: 10,                      // Max 10 files per request
      fields: 20,                     // Max 20 fields
      fieldSize: 1024 * 1024,        // 1MB max field size
      headerPairs: 100               // Max header pairs
    };
  }

  /**
   * Create multer upload middleware
   */
  createUploadMiddleware(fieldName = 'file', maxCount = 1) {
    const upload = multer({
      storage: this.createStorage(),
      fileFilter: this.fileFilter(),
      limits: this.getLimits()
    });

    if (maxCount === 1) {
      return upload.single(fieldName);
    } else {
      return upload.array(fieldName, maxCount);
    }
  }

  /**
   * Post-upload validation middleware
   */
  postUploadValidation() {
    return async (req, res, next) => {
      try {
        // Skip if no files
        if (!req.file && !req.files) {
          return next();
        }

        const files = req.files || [req.file];

        for (const file of files) {
          // Verify file actually exists
          if (!fs.existsSync(file.path)) {
            throw new Error('Upload failed - file not found');
          }

          // Check actual file size
          const stats = fs.statSync(file.path);
          const category = this.getFileCategory(file.mimetype);
          const maxSize = this.maxSizes[category] || this.maxSizes.default;

          if (stats.size > maxSize) {
            fs.unlinkSync(file.path); // Delete oversized file
            throw new Error(`File too large. Maximum size: ${maxSize / 1024 / 1024}MB`);
          }

          // Scan for malware patterns (for text-based files)
          if (file.mimetype.startsWith('text/') || 
              file.mimetype.includes('xml') || 
              file.mimetype.includes('json')) {
            if (!this.scanFileContent(file.path)) {
              fs.unlinkSync(file.path); // Delete dangerous file
              throw new Error('File contains potentially dangerous content');
            }
          }

          // Add metadata
          file.uploadedAt = new Date();
          file.uploadedBy = req.user ? req.user.id : 'anonymous';
          file.category = category;
          file.securePath = file.path;
          
          // Generate access token for secure download
          file.accessToken = crypto.randomBytes(32).toString('hex');
          
          // Log upload for audit (HIPAA requirement)
          console.log(`File uploaded: ${file.filename} by ${file.uploadedBy}`);
        }

        next();
      } catch (error) {
        // Clean up any uploaded files on error
        if (req.file) {
          fs.unlink(req.file.path, () => {});
        }
        if (req.files) {
          req.files.forEach(file => {
            fs.unlink(file.path, () => {});
          });
        }
        
        res.status(400).json({ 
          error: 'File validation failed', 
          details: error.message 
        });
      }
    };
  }

  /**
   * Secure file download middleware
   */
  secureDownload() {
    return async (req, res, next) => {
      try {
        const { token, filename } = req.params;
        
        // Validate token (in production, check against database)
        if (!token || token.length !== 64) {
          return res.status(403).json({ error: 'Invalid access token' });
        }

        // Sanitize filename
        const sanitized = path.basename(filename);
        const filepath = path.join(this.uploadDir, sanitized);

        // Check file exists
        if (!fs.existsSync(filepath)) {
          return res.status(404).json({ error: 'File not found' });
        }

        // Set secure headers
        res.setHeader('Content-Disposition', `attachment; filename="${sanitized}"`);
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        
        // Stream file
        const stream = fs.createReadStream(filepath);
        stream.pipe(res);
        
        // Log download for audit
        console.log(`File downloaded: ${sanitized} by ${req.user ? req.user.id : 'anonymous'}`);
      } catch (error) {
        res.status(500).json({ error: 'Download failed' });
      }
    };
  }

  /**
   * Cleanup old uploads (run periodically)
   */
  cleanupOldUploads(daysToKeep = 30) {
    const cutoff = Date.now() - (daysToKeep * 24 * 60 * 60 * 1000);
    
    fs.readdir(this.uploadDir, (err, files) => {
      if (err) return;
      
      files.forEach(file => {
        const filepath = path.join(this.uploadDir, file);
        fs.stat(filepath, (err, stats) => {
          if (err) return;
          
          if (stats.mtimeMs < cutoff) {
            fs.unlink(filepath, err => {
              if (!err) {
                console.log(`Cleaned up old upload: ${file}`);
              }
            });
          }
        });
      });
    });
  }
}

// Export singleton
module.exports = new FileUploadValidator();