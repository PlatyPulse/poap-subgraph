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

async function deployOne(network, version, deployPath) {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  Deploying ${network} → a-40acres-${network}-v2/${version}`);
  console.log(`${'═'.repeat(60)}`);

  if (!runCommand(`pnpm prepare:${network}`, `Preparing ${network} configuration`)) {
    return { network, version, success: false, step: 'prepare' };
  }
  if (!runCommand('pnpm codegen', 'Generating code')) {
    return { network, version, success: false, step: 'codegen' };
  }
  if (!runCommand('pnpm build', 'Building subgraph')) {
    return { network, version, success: false, step: 'build' };
  }

  const deployCommand = `goldsky subgraph deploy a-40acres-${network}-v2/${version} --path ${deployPath}`;
  if (!runCommand(deployCommand, `Deploying to Goldsky (a-40acres-${network}-v2/${version})`)) {
    return { network, version, success: false, step: 'deploy' };
  }

  saveVersion(network, version);
  return { network, version, success: true };
}

async function main() {
  console.log('🚀 Subgraph Deployment CLI\n');

  const configDir = path.join(__dirname, 'config');
  const configFiles = fs.readdirSync(configDir)
    .filter(file => file.endsWith('.json'))
    .map(file => file.replace('.json', ''));

  const versions = loadVersions();

  // Multi-select: pick one or more subgraphs to deploy.
  const { networks } = await inquirer.prompt([
    {
      type: 'checkbox',
      name: 'networks',
      message: 'Select subgraph(s) to deploy (space to toggle, enter to confirm):',
      choices: configFiles,
      pageSize: 10,
      validate: (selected) => selected.length > 0 || 'Pick at least one subgraph.'
    }
  ]);

  // Version strategy. With one selection we always prompt (preserves the old UX). With several,
  // ask whether to auto-increment everything or set each version individually.
  let useAutoIncrement = true;
  if (networks.length > 1) {
    const { strategy } = await inquirer.prompt([
      {
        type: 'list',
        name: 'strategy',
        message: `Version strategy for ${networks.length} subgraphs:`,
        choices: [
          { name: 'Auto-increment patch on each (recommended)', value: 'auto' },
          { name: 'Prompt for each version', value: 'manual' }
        ]
      }
    ]);
    useAutoIncrement = strategy === 'auto';
  } else {
    useAutoIncrement = false; // single deploy → always prompt, like before
  }

  // Resolve a version for each selected network.
  const plan = [];
  for (const network of networks) {
    const previousVersion = versions[network] || '';
    const defaultVersion = incrementVersion(previousVersion);
    let version;
    if (useAutoIncrement) {
      version = defaultVersion;
    } else {
      const answer = await inquirer.prompt([
        {
          type: 'input',
          name: 'version',
          message: `[${network}] enter version (previous: ${previousVersion || 'none'}, default: ${defaultVersion}):`,
          default: defaultVersion,
          validate: (input) => input.trim().length > 0 || 'Version cannot be empty'
        }
      ]);
      version = answer.version.trim();
    }
    plan.push({ network, version, previousVersion });
  }

  // One shared deploy path for the batch.
  const { deployPath } = await inquirer.prompt([
    {
      type: 'input',
      name: 'deployPath',
      message: 'Enter deploy path:',
      default: '.'
    }
  ]);

  // Show plan and confirm.
  console.log('\n📋 Deployment plan:');
  for (const { network, version, previousVersion } of plan) {
    const arrow = previousVersion ? ` (was ${previousVersion})` : ' (first deploy)';
    console.log(`   • ${network} → a-40acres-${network}-v2/${version}${arrow}`);
  }
  console.log(`   Path: ${deployPath}`);

  const { confirm } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirm',
      message: `Proceed with ${plan.length} deployment${plan.length > 1 ? 's' : ''}?`,
      default: true
    }
  ]);
  if (!confirm) {
    console.log('Deployment cancelled.');
    process.exit(0);
  }

  // Run sequentially. We do NOT abort on the first failure — surface a summary at the end so a
  // partial batch is recoverable without rerunning the whole list.
  const results = [];
  for (const { network, version } of plan) {
    const result = await deployOne(network, version, deployPath);
    results.push(result);
  }

  // Summary.
  console.log(`\n${'═'.repeat(60)}`);
  console.log('  Summary');
  console.log(`${'═'.repeat(60)}`);
  const succeeded = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  for (const r of succeeded) {
    console.log(`  ✅ ${r.network} → ${r.version}`);
  }
  for (const r of failed) {
    console.log(`  ❌ ${r.network} → ${r.version} (failed at: ${r.step})`);
  }
  console.log(`\n${succeeded.length} succeeded, ${failed.length} failed.`);
  process.exit(failed.length > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error('❌ Error:', error);
  process.exit(1);
});
