#!/usr/bin/env node

/**
 * Development Watch Script for Vocoder SDK
 * 
 * This script monitors all packages and automatically rebuilds them when files change.
 * It provides real-time feedback and ensures your consumer app gets updates immediately.
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

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

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logPackage(packageName, message, color = 'reset') {
  const timestamp = new Date().toLocaleTimeString();
  console.log(`${colors[color]}[${timestamp}] [${packageName}]${colors.reset} ${message}`);
}

// Package configuration
const packages = [
  { name: 'types', path: 'packages/types', color: 'cyan' },
  { name: 'react', path: 'packages/react', color: 'blue' },
  { name: 'cli', path: 'packages/cli', color: 'magenta' }
];

// Store child processes
const processes = new Map();

function startWatchProcess(pkg) {
  const packagePath = path.join(__dirname, '..', pkg.path);
  
  logPackage(pkg.name, `Starting watch mode...`, pkg.color);
  
  const child = spawn('pnpm', ['watch'], {
    cwd: packagePath,
    stdio: ['pipe', 'pipe', 'pipe'],
    shell: true
  });
  
  // Handle stdout
  child.stdout.on('data', (data) => {
    const output = data.toString().trim();
    if (output) {
      logPackage(pkg.name, output, pkg.color);
    }
  });
  
  // Handle stderr
  child.stderr.on('data', (data) => {
    const output = data.toString().trim();
    if (output && !output.includes('Watching for file changes')) {
      logPackage(pkg.name, `ERROR: ${output}`, 'red');
    }
  });
  
  // Handle process exit
  child.on('exit', (code) => {
    if (code !== 0) {
      logPackage(pkg.name, `Watch process exited with code ${code}`, 'red');
      // Restart the process after a short delay
      setTimeout(() => {
        logPackage(pkg.name, 'Restarting watch process...', pkg.color);
        startWatchProcess(pkg);
      }, 2000);
    }
  });
  
  // Handle process error
  child.on('error', (error) => {
    logPackage(pkg.name, `Watch process error: ${error.message}`, 'red');
  });
  
  processes.set(pkg.name, child);
  return child;
}

function stopAllProcesses() {
  log('\n🛑 Stopping all watch processes...', 'yellow');
  
  for (const [name, process] of processes) {
    logPackage(name, 'Stopping...', 'yellow');
    process.kill('SIGTERM');
  }
  
  processes.clear();
  process.exit(0);
}

// Handle graceful shutdown
process.on('SIGINT', stopAllProcesses);
process.on('SIGTERM', stopAllProcesses);

// Main execution
async function main() {
  log('🚀 Starting Vocoder SDK Development Watch Mode', 'bright');
  log('This will monitor all packages and rebuild them automatically on file changes.\n', 'reset');
  
  log('📦 Starting watch processes for:', 'bright');
  packages.forEach(pkg => {
    log(`  • ${pkg.name} (${pkg.path})`, pkg.color);
  });
  log('');
  
  // Start all watch processes
  for (const pkg of packages) {
    startWatchProcess(pkg);
    // Small delay to avoid overwhelming the console
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  log('✅ All watch processes started successfully!', 'green');
  log('💡 Your vocoder-consumer app will now get updates immediately when you make changes.', 'green');
  log('🔄 Press Ctrl+C to stop all watch processes.\n', 'yellow');
  
  // Keep the main process alive
  process.stdin.resume();
}

// Run the main function
main().catch(error => {
  log(`❌ Fatal error: ${error.message}`, 'red');
  process.exit(1);
}); 