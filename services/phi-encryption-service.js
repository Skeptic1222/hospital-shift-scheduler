/**
 * PHI Encryption Service
 * Field-level encryption for Protected Health Information
 */

const crypto = require('crypto');

class PHIEncryptionService {
  constructor(masterKey) {
    this.masterKey = masterKey || process.env.ENCRYPTION_KEY || 'CHANGE_THIS_IN_PRODUCTION';
    this.algorithm = 'aes-256-gcm';
    
    // PHI field definitions
    this.phiFields = {
      users: ['ssn', 'date_of_birth', 'medical_license', 'home_address', 'personal_phone'],
      patients: ['first_name', 'last_name', 'ssn', 'date_of_birth', 'medical_record_number', 
                 'diagnosis', 'medications', 'allergies', 'insurance_info'],
      shifts: ['notes', 'patient_notes', 'medical_incidents'],
      audit_logs: ['patient_data', 'phi_details']
    };

    // Data classification levels
    this.dataClassification = {
      PUBLIC: 0,      // No encryption needed
      INTERNAL: 1,    // Basic encryption
      CONFIDENTIAL: 2, // Standard encryption
      PHI: 3,         // Strong encryption + audit
      RESTRICTED: 4   // Highest encryption + special access
    };
  }

  /**
   * Derive key from master key for specific purpose
   */
  deriveKey(purpose, salt) {
    return crypto.pbkdf2Sync(
      this.masterKey,
      salt || purpose,
      100000,
      32,
      'sha256'
    );
  }

  /**
   * Encrypt PHI data
   */
  encryptPHI(data, classification = this.dataClassification.PHI) {
    try {
      // Convert data to string if needed
      const text = typeof data === 'object' ? JSON.stringify(data) : String(data);
      
      // Generate crypto components
      const salt = crypto.randomBytes(64);
      const iv = crypto.randomBytes(16);
      const key = this.deriveKey(`phi_${classification}`, salt);
      
      // Create cipher
      const cipher = crypto.createCipheriv(this.algorithm, key, iv);
      
      // Encrypt data
      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      // Get auth tag for verification
      const authTag = cipher.getAuthTag();
      
      // Create encrypted package
      const encryptedPackage = {
        v: 1, // Version for future compatibility
        c: classification,
        e: encrypted,
        s: salt.toString('hex'),
        i: iv.toString('hex'),
        t: authTag.toString('hex'),
        ts: Date.now() // Timestamp for key rotation
      };

      // Return base64 encoded package
      return Buffer.from(JSON.stringify(encryptedPackage)).toString('base64');
    } catch (error) {
      console.error('PHI encryption error:', error);
      throw new Error('Failed to encrypt PHI data');
    }
  }

  /**
   * Decrypt PHI data
   */
  decryptPHI(encryptedData) {
    try {
      // Decode package
      const packageStr = Buffer.from(encryptedData, 'base64').toString('utf8');
      const package = JSON.parse(packageStr);
      
      // Extract components
      const salt = Buffer.from(package.s, 'hex');
      const iv = Buffer.from(package.i, 'hex');
      const authTag = Buffer.from(package.t, 'hex');
      const key = this.deriveKey(`phi_${package.c}`, salt);
      
      // Create decipher
      const decipher = crypto.createDecipheriv(this.algorithm, key, iv);
      decipher.setAuthTag(authTag);
      
      // Decrypt data
      let decrypted = decipher.update(package.e, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      // Try to parse as JSON, otherwise return as string
      try {
        return JSON.parse(decrypted);
      } catch {
        return decrypted;
      }
    } catch (error) {
      console.error('PHI decryption error:', error);
      throw new Error('Failed to decrypt PHI data');
    }
  }

  /**
   * Encrypt object with PHI fields
   */
  encryptObject(obj, tableName) {
    const encrypted = { ...obj };
    const phiFields = this.phiFields[tableName] || [];
    
    for (const field of phiFields) {
      if (obj[field] !== null && obj[field] !== undefined) {
        encrypted[field] = this.encryptPHI(obj[field]);
        encrypted[`${field}_encrypted`] = true;
      }
    }
    
    return encrypted;
  }

  /**
   * Decrypt object with PHI fields
   */
  decryptObject(obj, tableName) {
    const decrypted = { ...obj };
    const phiFields = this.phiFields[tableName] || [];
    
    for (const field of phiFields) {
      if (obj[`${field}_encrypted`] && obj[field]) {
        try {
          decrypted[field] = this.decryptPHI(obj[field]);
          delete decrypted[`${field}_encrypted`];
        } catch (error) {
          console.error(`Failed to decrypt field ${field}:`, error);
          decrypted[field] = '[DECRYPTION_ERROR]';
        }
      }
    }
    
    return decrypted;
  }

  /**
   * Mask PHI for display (show only last 4 characters)
   */
  maskPHI(value, showLast = 4) {
    if (!value) return '';
    
    const str = String(value);
    if (str.length <= showLast) {
      return '*'.repeat(str.length);
    }
    
    const masked = '*'.repeat(str.length - showLast) + str.slice(-showLast);
    return masked;
  }

  /**
   * Mask object with PHI fields for display
   */
  maskObject(obj, tableName, userRole = 'viewer') {
    const masked = { ...obj };
    const phiFields = this.phiFields[tableName] || [];
    
    // Determine masking level based on role
    const maskingRules = {
      admin: [], // No masking
      supervisor: ['ssn'], // Mask SSN only
      manager: ['ssn', 'medical_license'],
      user: ['ssn', 'medical_license', 'date_of_birth'],
      viewer: phiFields // Mask all PHI
    };
    
    const fieldsToMask = maskingRules[userRole] || phiFields;
    
    for (const field of fieldsToMask) {
      if (masked[field]) {
        // Special handling for different field types
        if (field === 'ssn') {
          masked[field] = this.maskPHI(masked[field], 4);
        } else if (field === 'date_of_birth') {
          masked[field] = masked[field] ? '**/**/****' : null;
        } else if (field === 'medical_license') {
          masked[field] = this.maskPHI(masked[field], 3);
        } else {
          masked[field] = this.maskPHI(masked[field], 0);
        }
      }
    }
    
    return masked;
  }

  /**
   * Generate data encryption key for specific record
   */
  generateDataKey(recordId) {
    const dek = crypto.randomBytes(32);
    const encryptedDek = this.encryptPHI(dek.toString('hex'), this.dataClassification.RESTRICTED);
    
    return {
      plainKey: dek,
      encryptedKey: encryptedDek,
      keyId: crypto.randomUUID(),
      createdAt: new Date()
    };
  }

  /**
   * Rotate encryption keys
   */
  async rotateKeys(db) {
    console.log('Starting PHI encryption key rotation...');
    
    try {
      // Generate new master key
      const newMasterKey = crypto.randomBytes(32).toString('hex');
      
      // Get all encrypted data
      const tables = Object.keys(this.phiFields);
      
      for (const table of tables) {
        const fields = this.phiFields[table];
        if (fields.length === 0) continue;
        
        // Re-encrypt all PHI fields with new key
        const records = await db.query(`SELECT * FROM scheduler.${table}`);
        
        for (const record of records.recordset) {
          let needsUpdate = false;
          const updates = {};
          
          for (const field of fields) {
            if (record[`${field}_encrypted`] && record[field]) {
              // Decrypt with old key
              const decrypted = this.decryptPHI(record[field]);
              
              // Re-encrypt with new key
              const oldKey = this.masterKey;
              this.masterKey = newMasterKey;
              updates[field] = this.encryptPHI(decrypted);
              this.masterKey = oldKey;
              
              needsUpdate = true;
            }
          }
          
          if (needsUpdate) {
            // Update record with new encryption
            await db.query(
              `UPDATE scheduler.${table} SET ${Object.keys(updates).map(f => `${f} = @${f}`).join(', ')} WHERE id = @id`,
              { ...updates, id: record.id }
            );
          }
        }
      }
      
      // Update master key
      this.masterKey = newMasterKey;
      
      console.log('PHI encryption key rotation completed successfully');
      return newMasterKey;
    } catch (error) {
      console.error('Key rotation failed:', error);
      throw error;
    }
  }

  /**
   * Tokenize sensitive data for secure storage
   */
  tokenizePHI(data) {
    const token = crypto.randomBytes(16).toString('hex');
    const encrypted = this.encryptPHI(data, this.dataClassification.RESTRICTED);
    
    // In production, store token->encrypted mapping in secure vault
    // For now, embed encrypted data in token
    return `PHI_TOKEN_${token}_${encrypted}`;
  }

  /**
   * Detokenize sensitive data
   */
  detokenizePHI(token) {
    if (!token.startsWith('PHI_TOKEN_')) {
      throw new Error('Invalid PHI token');
    }
    
    const parts = token.split('_');
    if (parts.length < 4) {
      throw new Error('Malformed PHI token');
    }
    
    const encrypted = parts.slice(3).join('_');
    return this.decryptPHI(encrypted);
  }

  /**
   * Express middleware for automatic PHI encryption/decryption
   */
  middleware() {
    return (req, res, next) => {
      // Encrypt PHI in request body
      if (req.body && req.method !== 'GET') {
        const table = this.getTableFromPath(req.path);
        if (table && this.phiFields[table]) {
          req.body = this.encryptObject(req.body, table);
          req.phiEncrypted = true;
        }
      }

      // Override res.json to decrypt PHI in responses
      const originalJson = res.json.bind(res);
      res.json = function(data) {
        // Skip decryption for non-authenticated requests
        if (!req.user) {
          return originalJson(data);
        }

        // Decrypt PHI based on user role
        const decrypted = this.decryptResponse(data, req.user.roles?.[0] || 'viewer', req.path);
        return originalJson(decrypted);
      }.bind(this);

      next();
    };
  }

  /**
   * Get table name from API path
   */
  getTableFromPath(path) {
    const pathParts = path.split('/').filter(Boolean);
    const tableMap = {
      'users': 'users',
      'staff': 'users',
      'patients': 'patients',
      'shifts': 'shifts',
      'audit': 'audit_logs'
    };
    
    for (const part of pathParts) {
      if (tableMap[part]) {
        return tableMap[part];
      }
    }
    
    return null;
  }

  /**
   * Decrypt response data based on user role
   */
  decryptResponse(data, userRole, path) {
    const table = this.getTableFromPath(path);
    if (!table) return data;

    if (Array.isArray(data)) {
      return data.map(item => this.maskObject(this.decryptObject(item, table), table, userRole));
    } else if (data && typeof data === 'object') {
      // Handle paginated responses
      if (data.data && Array.isArray(data.data)) {
        return {
          ...data,
          data: data.data.map(item => this.maskObject(this.decryptObject(item, table), table, userRole))
        };
      }
      // Handle single object
      return this.maskObject(this.decryptObject(data, table), table, userRole);
    }
    
    return data;
  }
}

// Export singleton
module.exports = new PHIEncryptionService();