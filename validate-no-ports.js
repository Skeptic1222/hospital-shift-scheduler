#!/usr/bin/env node

/**
 * ⚠️⚠️⚠️ CRITICAL: PORT VALIDATION SCRIPT ⚠️⚠️⚠️
 * 
 * This script enforces the ABSOLUTE NO-PORT RULE
 * Scans all code files for URLs containing ports
 * 
 * VIOLATIONS ARE CRITICAL ERRORS THAT MUST BE FIXED IMMEDIATELY
 * See NO-PORT-ABSOLUTE-RULE.md for details
 */

const fs = require('fs');
const path = require('path');

// Patterns that indicate port usage in URLs (all are violations)
const PORT_PATTERNS = [
  /:3000/g,
  /:3001/g,
  /:8080/g,
  /:8000/g,
  /:5000/g,
  /:4200/g,
  /:443/g,
  /:80(?!\d)/g,  // :80 but not :8080
  /localhost:\d+/g,
  /127\.0\.0\.1:\d+/g,
  /0\.0\.0\.0:\d+/g,
  /https?:\/\/[^\/\s]+:\d+/g,  // Any URL with a port
];

// Files/directories to skip
const SKIP_PATHS = [
  'node_modules',
  '.git',
  'build',
  'dist',
  '.next',
  'coverage',
  'NO-PORT-ABSOLUTE-RULE.md',  // This file documents the violations
  'validate-no-ports.js',  // This script itself
  'setupProxy.js',  // Internal dev proxy (with warnings)
];

// File extensions to check
const CHECK_EXTENSIONS = [
  '.js', '.jsx', '.ts', '.tsx',
  '.html', '.htm',
  '.css', '.scss', '.sass',
  '.json',
  '.md',
  '.env', '.env.example',
  '.yml', '.yaml',
  '.xml',
  '.config',
];

let violations = [];
let filesChecked = 0;

function shouldCheckFile(filePath) {
  // Skip if in skip paths
  for (const skip of SKIP_PATHS) {
    if (filePath.includes(skip)) return false;
  }
  
  // Check if has valid extension
  const ext = path.extname(filePath).toLowerCase();
  return CHECK_EXTENSIONS.includes(ext);
}

function checkFile(filePath) {
  if (!shouldCheckFile(filePath)) return;
  
  filesChecked++;
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  
  lines.forEach((line, index) => {
    // Skip comment lines in code files
    const trimmed = line.trim();
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('#')) {
      // Still check comments for documentation purposes
      // but mark them differently
    }
    
    PORT_PATTERNS.forEach(pattern => {
      const matches = line.match(pattern);
      if (matches) {
        violations.push({
          file: filePath,
          line: index + 1,
          content: line.trim(),
          pattern: pattern.toString(),
          isComment: trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('#'),
        });
      }
    });
  });
}

function scanDirectory(dir) {
  const items = fs.readdirSync(dir);
  
  items.forEach(item => {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory() && !SKIP_PATHS.includes(item)) {
      scanDirectory(fullPath);
    } else if (stat.isFile()) {
      checkFile(fullPath);
    }
  });
}

// Main execution
console.log('⚠️  NO-PORT VALIDATION SCRIPT');
console.log('=============================');
console.log('Scanning for port violations in URLs...\n');

const startDir = process.argv[2] || '.';
scanDirectory(startDir);

console.log(`✓ Scanned ${filesChecked} files\n`);

if (violations.length === 0) {
  console.log('✅ SUCCESS: No port violations found!');
  console.log('All URLs are correctly formatted without ports.');
  process.exit(0);
} else {
  console.log(`🔴 CRITICAL: Found ${violations.length} port violations!\n`);
  console.log('VIOLATIONS MUST BE FIXED IMMEDIATELY:\n');
  
  // Group by file
  const byFile = {};
  violations.forEach(v => {
    if (!byFile[v.file]) byFile[v.file] = [];
    byFile[v.file].push(v);
  });
  
  Object.keys(byFile).forEach(file => {
    console.log(`\n📁 ${file}`);
    byFile[file].forEach(v => {
      const commentMark = v.isComment ? ' (in comment)' : '';
      console.log(`   Line ${v.line}${commentMark}: ${v.content.substring(0, 80)}...`);
    });
  });
  
  console.log('\n' + '='.repeat(60));
  console.log('⚠️  THESE VIOLATIONS MUST BE FIXED!');
  console.log('See NO-PORT-ABSOLUTE-RULE.md for guidance');
  console.log('='.repeat(60));
  
  process.exit(1);
}