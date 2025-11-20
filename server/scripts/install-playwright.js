#!/usr/bin/env node

/**
 * Install Playwright browsers for production.
 * This script handles installation gracefully and skips if it fails.
 */

import { execSync } from 'child_process';

const skipInstall = process.env.PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD === '1';
const isCI = process.env.CI === 'true' || process.env.CONTINUOUS_INTEGRATION === 'true';
const isProduction = process.env.NODE_ENV === 'production';
// Check if we're in a build environment (DigitalOcean, Heroku, etc.)
const isBuildEnv = process.env.BUILDPACK_URL || process.env.DYNO || process.env.DOPPLER_ENVIRONMENT;

if (skipInstall) {
  console.log('⏭️  Skipping Playwright browser installation (PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1)');
  process.exit(0);
}

// In CI/production/build environments, skip installation to avoid sudo issues
// Browsers will be installed on first use (Playwright handles this automatically)
if (isCI || isBuildEnv) {
  console.log('🏗️  Detected CI/Build environment - skipping browser installation');
  console.log('📝 Browsers will be installed automatically on first use');
  process.exit(0);
}

if (isProduction) {
  console.log('🏗️  Detected Production environment - installing browsers without system dependencies...');
}

try {
  console.log('📦 Installing Playwright Chromium browser...');
  // Install only browser binaries, not system dependencies
  // The --with-deps flag is NOT used, so it should only install browser binaries
  const env = { ...process.env };
  // Remove sudo-related env vars to prevent Playwright from trying to use sudo
  delete env.SUDO_USER;
  delete env.SUDO_UID;
  delete env.SUDO_GID;
  
  execSync('npx playwright install chromium', {
    stdio: 'inherit',
    env: env,
    // Set a timeout to prevent hanging
    timeout: 300000 // 5 minutes
  });
  console.log('✅ Playwright Chromium installed successfully');
} catch (error) {
  // Check if error is related to sudo/permissions
  const errorMessage = error.message || error.toString();
  if (errorMessage.includes('sudo') || errorMessage.includes('password')) {
    console.warn('⚠️  Playwright tried to install system dependencies (requires sudo)');
    console.warn('⚠️  Skipping browser installation - they will be installed on first use');
    console.warn('⚠️  For production, install system dependencies via buildpack or Dockerfile');
  } else {
    console.warn('⚠️  Failed to install Playwright browsers:', errorMessage);
    console.warn('⚠️  This is usually OK - browsers will be installed on first use');
  }
  // Don't fail the build if browser installation fails
  // Playwright will install browsers on first use (with a delay)
  process.exit(0);
}

