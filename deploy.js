#!/usr/bin/env node

const { execSync } = require('child_process');
const inquirer = require('inquirer');
const fs = require('fs');
const path = require('path');

const VERSIONS_FILE = path.join(__dirname, '.deploy-versions.json');

function loadVersions() {
  try {
    if (fs.existsSync(VERSIONS_FILE)) {
      const content = fs.readFileSync(VERSIONS_FILE, 'utf8');
      return JSON.parse(content);
    }
  } catch (error) {
    console.warn('⚠️  Could not load version history:', error.message);
  }
  return {};
}

function saveVersion(network, version) {
  try {
    const versions = loadVersions();
    versions[network] = version;
    fs.writeFileSync(VERSIONS_FILE, JSON.stringify(versions, null, 2) + '\n');
  } catch (error) {
    console.warn('⚠️  Could not save version:', error.message);
  }
}

function incrementVersion(version) {
  if (!version) {
    return '0.0.1';
  }
  
  // Parse semantic version (e.g., "0.0.3" or "1.2.3")
  const parts = version.split('.');
  if (parts.length < 3) {
    // If not semantic version, try to increment as number
    const num = parseInt(version, 10);
    if (!isNaN(num)) {
      return (num + 1).toString();
    }
    return '0.0.1';
  }
  
  // Increment patch version
  const major = parseInt(parts[0], 10) || 0;
  const minor = parseInt(parts[1], 10) || 0;
  const patch = parseInt(parts[2], 10) || 0;
  
  return `${major}.${minor}.${patch + 1}`;
}

function runCommand(command, description) {
  console.log(`\n${description}...`);
  try {
    execSync(command, { stdio: 'inherit' });
    console.log(`✓ ${description} completed successfully`);
    return true;
  } catch (error) {
    console.error(`✗ ${description} failed:`, error.message);
    return false;
  }
}

async function main() {
  console.log('🚀 Subgraph Deployment CLI\n');

  // Get available networks from config directory
  const configDir = path.join(__dirname, 'config');
  const configFiles = fs.readdirSync(configDir)
    .filter(file => file.endsWith('.json'))
    .map(file => file.replace('.json', ''));

  // Load previous versions
  const versions = loadVersions();

  // Prompt for network using arrow key selection
  const { network } = await inquirer.prompt([
    {
      type: 'list',
      name: 'network',
      message: 'Select network:',
      choices: configFiles,
      pageSize: 10
    }
  ]);

  // Prompt for version (auto-increment from previous version)
  const previousVersion = versions[network] || '';
  const defaultVersion = incrementVersion(previousVersion);
  const { version } = await inquirer.prompt([
    {
      type: 'input',
      name: 'version',
      message: `Enter version (previous: ${previousVersion || 'none'}, default: ${defaultVersion}):`,
      default: defaultVersion,
      validate: (input) => {
        if (!input.trim()) {
          return 'Version cannot be empty';
        }
        return true;
      }
    }
  ]);
  const versionTrimmed = version.trim();

  // Prompt for path (default to .)
  const { deployPath } = await inquirer.prompt([
    {
      type: 'input',
      name: 'deployPath',
      message: 'Enter deploy path:',
      default: '.'
    }
  ]);

  console.log(`\n📋 Deployment plan:`);
  console.log(`   Network: ${network}`);
  console.log(`   Version: ${versionTrimmed}`);
  console.log(`   Path: ${deployPath}`);
  console.log(`   Deploy path: a-40acres-${network}-v2/${versionTrimmed}`);

  const { confirm } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirm',
      message: 'Proceed with deployment?',
      default: true
    }
  ]);

  if (!confirm) {
    console.log('Deployment cancelled.');
    process.exit(0);
  }

  // Step 1: Prepare
  if (!runCommand(`pnpm prepare:${network}`, `Preparing ${network} configuration`)) {
    process.exit(1);
  }

  // Step 2: Codegen
  if (!runCommand('pnpm codegen', 'Generating code')) {
    process.exit(1);
  }

  // Step 3: Build
  if (!runCommand('pnpm build', 'Building subgraph')) {
    process.exit(1);
  }

  // Step 4: Deploy
  const deployCommand = `goldsky subgraph deploy a-40acres-${network}-v2/${versionTrimmed} --path ${deployPath}`;
  if (!runCommand(deployCommand, `Deploying to Goldsky (a-40acres-${network}-v2/${versionTrimmed})`)) {
    process.exit(1);
  }

  // Save version for next time
  saveVersion(network, versionTrimmed);

  console.log('\n✅ Deployment completed successfully!');
}

main().catch((error) => {
  console.error('❌ Error:', error);
  process.exit(1);
});
