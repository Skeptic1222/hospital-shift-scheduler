#!/usr/bin/env node

/**
 * Debug Log Monitor - Comprehensive log analysis for shift creation issues
 * This script monitors and analyzes all logs to identify the root cause
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Log locations
const LOG_PATHS = {
  appLogs: path.join(__dirname, 'logs'),
  iisLogs: 'C:\\inetpub\\logs\\LogFiles\\W3SVC1',
  failedRequests: 'C:\\inetpub\\logs\\FailedReqLogFiles',
  eventViewer: 'System and Application logs (manual check required)'
};

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

class LogMonitor {
  constructor() {
    this.errors = [];
    this.warnings = [];
    this.shiftCreationAttempts = [];
    this.databaseErrors = [];
    this.networkErrors = [];
    this.authErrors = [];
  }

  log(color, label, message) {
    console.log(`${color}[${label}]${colors.reset} ${message}`);
  }

  async analyzeFile(filePath, type) {
    if (!fs.existsSync(filePath)) {
      this.log(colors.yellow, 'SKIP', `File not found: ${filePath}`);
      return;
    }

    const stats = fs.statSync(filePath);
    this.log(colors.cyan, 'ANALYZE', `${type}: ${filePath} (${stats.size} bytes)`);

    const fileStream = fs.createReadStream(filePath);
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });

    let lineNumber = 0;
    for await (const line of rl) {
      lineNumber++;
      this.analyzeLine(line, filePath, lineNumber, type);
    }
  }

  analyzeLine(line, file, lineNum, type) {
    const lowerLine = line.toLowerCase();

    // Check for errors
    if (lowerLine.includes('error') || lowerLine.includes('exception') || lowerLine.includes('failed')) {
      this.errors.push({
        file: path.basename(file),
        line: lineNum,
        content: line.substring(0, 200),
        type
      });

      // Database specific errors
      if (lowerLine.includes('database') || lowerLine.includes('sql') || lowerLine.includes('mssql')) {
        this.databaseErrors.push({
          file: path.basename(file),
          line: lineNum,
          content: line,
          type
        });
      }

      // Auth errors
      if (lowerLine.includes('auth') || lowerLine.includes('unauthorized') || lowerLine.includes('403') || lowerLine.includes('401')) {
        this.authErrors.push({
          file: path.basename(file),
          line: lineNum,
          content: line,
          type
        });
      }
    }

    // Check for warnings
    if (lowerLine.includes('warn') || lowerLine.includes('deprecated')) {
      this.warnings.push({
        file: path.basename(file),
        line: lineNum,
        content: line.substring(0, 200),
        type
      });
    }

    // Check for shift creation attempts
    if (lowerLine.includes('shift') && (lowerLine.includes('create') || lowerLine.includes('post'))) {
      this.shiftCreationAttempts.push({
        file: path.basename(file),
        line: lineNum,
        content: line,
        type,
        timestamp: this.extractTimestamp(line)
      });
    }

    // Network errors
    if (lowerLine.includes('cors') || lowerLine.includes('network') || lowerLine.includes('timeout')) {
      this.networkErrors.push({
        file: path.basename(file),
        line: lineNum,
        content: line,
        type
      });
    }

    // HTTP status codes
    const statusMatch = line.match(/\b([4-5]\d{2})\b/);
    if (statusMatch) {
      const status = statusMatch[1];
      if (status.startsWith('4') || status.startsWith('5')) {
        this.errors.push({
          file: path.basename(file),
          line: lineNum,
          content: `HTTP ${status}: ${line.substring(0, 150)}`,
          type: 'HTTP_ERROR'
        });
      }
    }
  }

  extractTimestamp(line) {
    // Try to extract timestamp from various formats
    const patterns = [
      /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/,
      /\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/,
      /\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}:\d{2}/
    ];

    for (const pattern of patterns) {
      const match = line.match(pattern);
      if (match) return match[0];
    }
    return 'unknown';
  }

  async analyzeAllLogs() {
    this.log(colors.bright + colors.green, 'START', 'Beginning comprehensive log analysis...\n');

    // Analyze application logs
    const appLogsDir = path.join(__dirname, 'logs');
    if (fs.existsSync(appLogsDir)) {
      const files = fs.readdirSync(appLogsDir);
      for (const file of files) {
        if (file.endsWith('.log') || file.includes('debug')) {
          await this.analyzeFile(path.join(appLogsDir, file), 'APP');
        }
      }
    }

    // Check for shift-create-debug.log specifically
    const shiftDebugLog = path.join(appLogsDir, 'shift-create-debug.log');
    if (fs.existsSync(shiftDebugLog)) {
      this.log(colors.bright + colors.yellow, 'IMPORTANT', 'Found shift-create-debug.log - analyzing...');
      await this.analyzeFile(shiftDebugLog, 'SHIFT_DEBUG');
    }

    // Check for client debug logs
    const clientDebugLog = path.join(appLogsDir, `client-debug-${new Date().toISOString().split('T')[0]}.log`);
    if (fs.existsSync(clientDebugLog)) {
      this.log(colors.bright + colors.yellow, 'IMPORTANT', 'Found client debug log - analyzing...');
      await this.analyzeFile(clientDebugLog, 'CLIENT');
    }

    // Check today's debug logs
    const today = new Date().toISOString().split('T')[0];
    const debugFiles = [
      `debug-main-${today}.log`,
      `debug-sql-${today}.log`,
      `debug-http-${today}.log`,
      `debug-shift-${today}.log`
    ];

    for (const debugFile of debugFiles) {
      const debugPath = path.join(appLogsDir, debugFile);
      if (fs.existsSync(debugPath)) {
        await this.analyzeFile(debugPath, 'DEBUG');
      }
    }
  }

  generateReport() {
    console.log('\n' + '='.repeat(80));
    this.log(colors.bright + colors.cyan, 'REPORT', 'LOG ANALYSIS COMPLETE');
    console.log('='.repeat(80) + '\n');

    // Shift Creation Attempts
    if (this.shiftCreationAttempts.length > 0) {
      this.log(colors.bright + colors.yellow, 'SHIFT ATTEMPTS', `Found ${this.shiftCreationAttempts.length} shift creation attempts:`);
      this.shiftCreationAttempts.slice(-5).forEach(attempt => {
        console.log(`  ${colors.cyan}[${attempt.timestamp}]${colors.reset} ${attempt.file}:${attempt.line}`);
        console.log(`    ${attempt.content.substring(0, 100)}`);
      });
      console.log();
    }

    // Database Errors
    if (this.databaseErrors.length > 0) {
      this.log(colors.bright + colors.red, 'DATABASE ERRORS', `Found ${this.databaseErrors.length} database errors:`);
      this.databaseErrors.slice(-5).forEach(error => {
        console.log(`  ${colors.red}${error.file}:${error.line}${colors.reset}`);
        console.log(`    ${error.content.substring(0, 150)}`);
      });
      console.log();
    }

    // Auth Errors
    if (this.authErrors.length > 0) {
      this.log(colors.bright + colors.red, 'AUTH ERRORS', `Found ${this.authErrors.length} authentication errors:`);
      this.authErrors.slice(-5).forEach(error => {
        console.log(`  ${colors.red}${error.file}:${error.line}${colors.reset}`);
        console.log(`    ${error.content.substring(0, 150)}`);
      });
      console.log();
    }

    // Network Errors
    if (this.networkErrors.length > 0) {
      this.log(colors.bright + colors.red, 'NETWORK ERRORS', `Found ${this.networkErrors.length} network/CORS errors:`);
      this.networkErrors.slice(-5).forEach(error => {
        console.log(`  ${colors.red}${error.file}:${error.line}${colors.reset}`);
        console.log(`    ${error.content.substring(0, 150)}`);
      });
      console.log();
    }

    // General Errors
    if (this.errors.length > 0) {
      this.log(colors.bright + colors.red, 'ALL ERRORS', `Total errors found: ${this.errors.length}`);
      // Group errors by type
      const errorTypes = {};
      this.errors.forEach(error => {
        const key = error.type || 'UNKNOWN';
        if (!errorTypes[key]) errorTypes[key] = 0;
        errorTypes[key]++;
      });

      console.log('  Error distribution:');
      Object.entries(errorTypes).forEach(([type, count]) => {
        console.log(`    ${type}: ${count}`);
      });

      console.log('\n  Most recent errors:');
      this.errors.slice(-10).forEach(error => {
        console.log(`    ${colors.red}[${error.type}]${colors.reset} ${error.file}:${error.line}`);
        console.log(`      ${error.content.substring(0, 100)}`);
      });
      console.log();
    }

    // Summary
    console.log('='.repeat(80));
    this.log(colors.bright + colors.magenta, 'SUMMARY', 'Analysis Statistics:');
    console.log(`  Total Errors: ${colors.red}${this.errors.length}${colors.reset}`);
    console.log(`  Total Warnings: ${colors.yellow}${this.warnings.length}${colors.reset}`);
    console.log(`  Shift Creation Attempts: ${colors.cyan}${this.shiftCreationAttempts.length}${colors.reset}`);
    console.log(`  Database Errors: ${colors.red}${this.databaseErrors.length}${colors.reset}`);
    console.log(`  Auth Errors: ${colors.red}${this.authErrors.length}${colors.reset}`);
    console.log(`  Network Errors: ${colors.red}${this.networkErrors.length}${colors.reset}`);
    console.log('='.repeat(80));

    // Recommendations
    this.generateRecommendations();
  }

  generateRecommendations() {
    console.log('\n' + colors.bright + colors.green + 'RECOMMENDATIONS:' + colors.reset);

    const recommendations = [];

    if (this.databaseErrors.length > 0) {
      recommendations.push('1. Database connection issues detected. Check SQL Server is running and accessible.');
      recommendations.push('   - Verify connection string in .env file');
      recommendations.push('   - Check SQL Server authentication mode');
      recommendations.push('   - Ensure database schema exists');
    }

    if (this.authErrors.length > 0) {
      recommendations.push('2. Authentication errors found. Verify Google OAuth configuration.');
      recommendations.push('   - Check AUTH0_* environment variables');
      recommendations.push('   - Verify user roles and permissions');
      recommendations.push('   - Check JWT token validation');
    }

    if (this.networkErrors.length > 0) {
      recommendations.push('3. Network/CORS issues detected. Check allowed origins configuration.');
      recommendations.push('   - Verify ALLOWED_ORIGINS in .env');
      recommendations.push('   - Check IIS CORS module configuration');
      recommendations.push('   - Ensure no port numbers in URLs');
    }

    if (this.shiftCreationAttempts.length > 0 && this.errors.length > 0) {
      recommendations.push('4. Shift creation is being attempted but failing.');
      recommendations.push('   - Check browser console for client-side errors');
      recommendations.push('   - Verify form validation on frontend');
      recommendations.push('   - Check network tab for failed API calls');
    }

    if (recommendations.length === 0) {
      recommendations.push('No specific issues detected. Check browser console for client-side errors.');
    }

    recommendations.forEach(rec => console.log(colors.cyan + rec + colors.reset));

    console.log('\n' + colors.bright + colors.yellow + 'NEXT STEPS:' + colors.reset);
    console.log('1. Open browser DevTools (F12) and try creating a shift');
    console.log('2. Check Network tab for failed requests');
    console.log('3. Check Console tab for JavaScript errors');
    console.log('4. Run: window.debugTools.downloadLogs() to export client logs');
    console.log('5. Check Windows Event Viewer for IIS/Node.js errors');
  }

  async checkLiveStatus() {
    console.log('\n' + colors.bright + colors.blue + 'CHECKING LIVE STATUS:' + colors.reset);

    // Check if server is running
    try {
      const http = require('http');
      const options = {
        hostname: 'localhost',
        port: 80,
        path: '/scheduler/api/health',
        method: 'GET'
      };

      const req = http.request(options, (res) => {
        this.log(colors.green, 'HEALTH', `API Health endpoint responded with status ${res.statusCode}`);
      });

      req.on('error', (e) => {
        this.log(colors.red, 'HEALTH', `API Health check failed: ${e.message}`);
      });

      req.end();
    } catch (e) {
      this.log(colors.red, 'ERROR', `Could not check health status: ${e.message}`);
    }
  }
}

// Main execution
async function main() {
  const monitor = new LogMonitor();

  console.clear();
  console.log(colors.bright + colors.cyan);
  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║         SHIFT CREATION DEBUG LOG MONITOR v1.0                ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝');
  console.log(colors.reset);

  await monitor.analyzeAllLogs();
  monitor.generateReport();
  await monitor.checkLiveStatus();

  console.log('\n' + colors.bright + colors.green + 'Monitor complete. Press Ctrl+C to exit.' + colors.reset);
}

// Run the monitor
main().catch(console.error);

// Export for use in other scripts
module.exports = LogMonitor;