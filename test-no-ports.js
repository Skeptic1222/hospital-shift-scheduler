#!/usr/bin/env node

/**
 * ⚠️ CRITICAL: NO PORTS IN URLS - VALIDATION TEST
 * This test ensures NO PORTS are used in any URLs throughout the codebase
 * See NO-PORT-RULE.md for details
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🔍 NO-PORT-RULE Validation Test');
console.log('================================\n');

let violations = [];
let checked = 0;

// Patterns to check for port violations
const portPatterns = [
  /localhost:[0-9]+/gi,
  /127\.0\.0\.1:[0-9]+/gi,
  /:[0-9]{4}\//gi,  // Any 4-digit port
  /:3000/gi,
  /:3001/gi,
  /:8080/gi,
  /:8081/gi
];

// Files/directories to exclude
const excludePatterns = [
  'node_modules',
  '.git',
  'coverage',
  'build',
  'dist',
  'test-no-ports.js',
  'NO-PORT-RULE.md',
  'setupProxy.js'  // Development only file
];

// File extensions to check
const checkExtensions = [
  '.js', '.jsx', '.ts', '.tsx',
  '.json', '.env', '.md',
  '.html', '.css'
];

function shouldCheckFile(filePath) {
  // Check if file should be excluded
  for (const exclude of excludePatterns) {
    if (filePath.includes(exclude)) {
      return false;
    }
  }
  
  // Check if file has valid extension
  const ext = path.extname(filePath);
  return checkExtensions.includes(ext);
}

function checkFile(filePath) {
  if (!shouldCheckFile(filePath)) return;
  
  checked++;
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  
  lines.forEach((line, index) => {
    // Skip comments and documentation
    if (line.trim().startsWith('//') || line.trim().startsWith('*') || line.trim().startsWith('#')) {
      // But still check if it's a NO-PORT comment
      if (line.includes('NO PORT') || line.includes('NO-PORT')) {
        return; // This is documentation about the rule
      }
    }
    
    portPatterns.forEach(pattern => {
      const matches = line.match(pattern);
      if (matches) {
        violations.push({
          file: filePath,
          line: index + 1,
          content: line.trim(),
          match: matches[0]
        });
      }
    });
  });
}

function checkDirectory(dir) {
  const items = fs.readdirSync(dir);
  
  items.forEach(item => {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory() && !excludePatterns.includes(item)) {
      checkDirectory(fullPath);
    } else if (stat.isFile()) {
      checkFile(fullPath);
    }
  });
}

// Run the check
console.log('Checking for port violations...\n');
checkDirectory('.');

// Report results
console.log(`\n📊 Results:`);
console.log(`Files checked: ${checked}`);
console.log(`Violations found: ${violations.length}\n`);

if (violations.length > 0) {
  console.log('❌ PORT VIOLATIONS DETECTED:\n');
  violations.forEach(v => {
    console.log(`  File: ${v.file}:${v.line}`);
    console.log(`  Match: "${v.match}"`);
    console.log(`  Line: ${v.content}`);
    console.log('');
  });
  
  console.log('🔴 TEST FAILED - Ports found in URLs!');
  console.log('Please remove all port references. See NO-PORT-RULE.md');
  process.exit(1);
} else {
  console.log('✅ TEST PASSED - No ports found in URLs!');
  console.log('All URLs are correctly configured for IIS proxy.');
}

// Additional check using grep
console.log('\n🔍 Double-checking with grep...');
try {
  execSync('grep -r "localhost:[0-9]" \
    --exclude-dir=node_modules \
    --exclude-dir=coverage \
    --exclude-dir=build \
    --exclude="test-no-ports.js" \
    --exclude="NO-PORT-RULE.md" \
    --exclude="web.config" \
    --exclude="web.config.reverse-proxy.sample" \
    --exclude="setupProxy.js" \
    . 2>/dev/null', { stdio: 'pipe' });
  console.log('❌ Grep found port references!');
  process.exit(1);
} catch (e) {
  // Grep returns non-zero when no matches found
  console.log('✅ Grep confirms no port references found.');
}

console.log('\n🎉 All checks passed! The codebase is free of port references in URLs.');
