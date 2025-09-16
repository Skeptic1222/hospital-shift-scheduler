/**
 * Secrets Manager Utility
 * Generates and manages secure secrets for production use
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

class SecretsManager {
  constructor() {
    this.envPath = path.join(__dirname, '..', '.env');
    this.secretsPath = path.join(__dirname, '..', '.secrets');
  }

  /**
   * Generate cryptographically secure random string
   */
  generateSecret(length = 32) {
    return crypto.randomBytes(length).toString('base64');
  }

  /**
   * Generate hex string for encryption keys
   */
  generateHexKey(length = 32) {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Generate all required secrets
   */
  generateAllSecrets() {
    return {
      JWT_SECRET: this.generateSecret(32),
      JWT_REFRESH_SECRET: this.generateSecret(32),
      ENCRYPTION_KEY: this.generateHexKey(32),
      SESSION_SECRET: this.generateSecret(32),
      CSRF_SECRET: this.generateSecret(24),
      API_KEY: this.generateSecret(32),
      WEBHOOK_SECRET: this.generateSecret(24)
    };
  }

  /**
   * Validate environment variables
   */
  validateEnvironment() {
    const errors = [];
    const warnings = [];

    // Critical security variables
    const criticalVars = [
      'JWT_SECRET',
      'ENCRYPTION_KEY',
      'DB_PASSWORD'
    ];

    // Check for default/weak values
    const weakValues = [
      'CHANGE_THIS',
      'your-',
      'secret',
      'password',
      'admin',
      '123456',
      'default'
    ];

    for (const varName of criticalVars) {
      const value = process.env[varName];
      
      if (!value) {
        errors.push(`Missing critical variable: ${varName}`);
        continue;
      }

      // Check for weak values
      const lowerValue = value.toLowerCase();
      for (const weak of weakValues) {
        if (lowerValue.includes(weak.toLowerCase())) {
          errors.push(`Weak value detected for ${varName}: contains "${weak}"`);
        }
      }

      // Check minimum length
      if (varName.includes('SECRET') || varName.includes('KEY')) {
        if (value.length < 32) {
          warnings.push(`${varName} should be at least 32 characters (current: ${value.length})`);
        }
      }
    }

    // Database configuration (always required in this build)
    if (!process.env.DB_SERVER) {
      errors.push('DB_SERVER not configured');
    }
    if (!process.env.DB_NAME) {
      errors.push('DB_NAME not configured');
    }
    if (!process.env.USE_WINDOWS_AUTH || process.env.USE_WINDOWS_AUTH !== 'true') {
      if (!process.env.DB_USER) {
        errors.push('DB_USER required when not using Windows Auth');
      }
      if (!process.env.DB_PASSWORD) {
        errors.push('DB_PASSWORD required when not using Windows Auth');
      }
    }

    // Google OAuth
    if (!process.env.GOOGLE_CLIENT_ID) {
      warnings.push('GOOGLE_CLIENT_ID not configured - OAuth will not work');
    }
    if (!process.env.REACT_APP_GOOGLE_CLIENT_ID) {
      warnings.push('REACT_APP_GOOGLE_CLIENT_ID not configured - Frontend OAuth will not work');
    }

    // Security headers
    if (!process.env.ALLOWED_ORIGINS) {
      warnings.push('ALLOWED_ORIGINS not set - using default localhost only');
    }

    // SSL/TLS
    if (process.env.NODE_ENV === 'production') {
      if (!process.env.DB_ENCRYPT || process.env.DB_ENCRYPT !== 'true') {
        errors.push('DB_ENCRYPT must be true in production');
      }
      if (process.env.DB_TRUST_SERVER_CERT === 'true') {
        warnings.push('DB_TRUST_SERVER_CERT should be false in production');
      }
    }

    return { errors, warnings };
  }

  /**
   * Initialize secure environment
   */
  async initializeSecureEnvironment() {
    console.log('🔐 Initializing secure environment...\n');

    // Check if .env exists
    if (!fs.existsSync(this.envPath)) {
      console.log('📝 Creating .env file from .env.example...');
      const examplePath = path.join(__dirname, '..', '.env.example');
      if (fs.existsSync(examplePath)) {
        fs.copyFileSync(examplePath, this.envPath);
      } else {
        console.error('❌ .env.example not found!');
        return false;
      }
    }

    // Load current environment
    require('dotenv').config();

    // Validate environment
    const { errors, warnings } = this.validateEnvironment();

    if (errors.length > 0) {
      console.log('❌ Critical errors found:\n');
      errors.forEach(err => console.log(`  - ${err}`));
      console.log('');
    }

    if (warnings.length > 0) {
      console.log('⚠️  Warnings:\n');
      warnings.forEach(warn => console.log(`  - ${warn}`));
      console.log('');
    }

    // Generate new secrets if needed
    if (errors.some(e => e.includes('Weak value') || e.includes('Missing critical'))) {
      console.log('🔑 Generating secure secrets...\n');
      const secrets = this.generateAllSecrets();
      
      console.log('Generated secrets (save these securely):');
      console.log('═'.repeat(50));
      for (const [key, value] of Object.entries(secrets)) {
        console.log(`${key}=${value}`);
      }
      console.log('═'.repeat(50));
      console.log('\n⚠️  Add these to your .env file and restart the application');
      
      // Save to .secrets file (gitignored)
      fs.writeFileSync(this.secretsPath, JSON.stringify(secrets, null, 2));
      console.log(`\n💾 Secrets also saved to ${this.secretsPath} (add to .gitignore)`);
    }

    return errors.length === 0;
  }

  /**
   * Rotate secrets (for periodic rotation)
   */
  async rotateSecrets() {
    console.log('🔄 Rotating secrets...');
    
    const newSecrets = {
      JWT_SECRET_OLD: process.env.JWT_SECRET,
      JWT_SECRET: this.generateSecret(32),
      JWT_REFRESH_SECRET_OLD: process.env.JWT_REFRESH_SECRET,
      JWT_REFRESH_SECRET: this.generateSecret(32),
      ROTATION_DATE: new Date().toISOString()
    };

    // Save rotation info
    const rotationPath = path.join(__dirname, '..', '.rotation');
    fs.writeFileSync(rotationPath, JSON.stringify(newSecrets, null, 2));
    
    console.log('✅ New secrets generated');
    console.log('⚠️  Keep old secrets for 24 hours to allow token migration');
    console.log(`📁 Rotation details saved to ${rotationPath}`);
    
    return newSecrets;
  }

  /**
   * Check if running with default/insecure configuration
   */
  isInsecureConfiguration() {
    const insecurePatterns = [
      'CHANGE_THIS',
      'your-',
      'default',
      'test',
      'demo'
    ];

    const jwt = process.env.JWT_SECRET || '';
    const encryption = process.env.ENCRYPTION_KEY || '';
    
    for (const pattern of insecurePatterns) {
      if (jwt.includes(pattern) || encryption.includes(pattern)) {
        return true;
      }
    }

    return jwt.length < 32 || encryption.length < 32;
  }
}

// Export singleton
module.exports = new SecretsManager();

// Run validation if called directly
if (require.main === module) {
  const manager = new SecretsManager();
  manager.initializeSecureEnvironment().then(success => {
    process.exit(success ? 0 : 1);
  });
}
