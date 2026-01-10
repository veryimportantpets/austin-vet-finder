#!/usr/bin/env node
/**
 * DE Connect Adapter Runner CLI
 *
 * Command-line interface for running adapters standalone or in service mode.
 */

import { parseArgs } from 'util';
import { createLogger } from '@de-connect/shared';
import { AdapterRegistry } from './adapter-registry.js';
import { AdapterExecutor } from './adapter-executor.js';

const logger = createLogger('de-runner', 'info');

async function main(): Promise<void> {
  const { values, positionals } = parseArgs({
    options: {
      'adapters-dir': { type: 'string', short: 'a' },
      'output-dir': { type: 'string', short: 'o' },
      'agent-version': { type: 'string', default: '1.0.0' },
      'timeout': { type: 'string', default: '60000' },
      'help': { type: 'boolean', short: 'h' },
    },
    allowPositionals: true,
  });

  if (values.help) {
    printHelp();
    process.exit(0);
  }

  const command = positionals[0];

  if (!command) {
    logger.error('No command specified. Use --help for usage.');
    process.exit(1);
  }

  const adaptersDir = values['adapters-dir'] ?? './adapters';
  const outputDir = values['output-dir'] ?? './output';
  const agentVersion = values['agent-version'] ?? '1.0.0';
  const timeoutMs = parseInt(values.timeout ?? '60000', 10);

  const registry = new AdapterRegistry({
    adaptersDir,
    agentVersion,
    logger: logger.child('registry'),
  });

  const executor = new AdapterExecutor({
    defaultTimeoutMs: timeoutMs,
    outputDir,
    logger: logger.child('executor'),
  });

  try {
    switch (command) {
      case 'list':
        await listAdapters(registry);
        break;

      case 'detect':
        await detectSystems(registry, executor);
        break;

      case 'validate':
        // Would need profile and secrets from file or stdin
        logger.info('Validate command requires a profile file. Not implemented in CLI yet.');
        break;

      case 'sync':
        // Would need profile, secrets, and request from file or stdin
        logger.info('Sync command requires a profile file. Not implemented in CLI yet.');
        break;

      default:
        logger.error(`Unknown command: ${command}`);
        printHelp();
        process.exit(1);
    }
  } catch (error) {
    logger.error('Command failed', error instanceof Error ? error : undefined);
    process.exit(1);
  } finally {
    await registry.unloadAll();
  }
}

async function listAdapters(registry: AdapterRegistry): Promise<void> {
  const manifests = await registry.discoverAdapters();

  if (manifests.length === 0) {
    logger.info('No adapters found');
    return;
  }

  console.log('\nAvailable Adapters:\n');

  for (const manifest of manifests) {
    console.log(`  ${manifest.name} (${manifest.adapterId})`);
    console.log(`    Version: ${manifest.version}`);
    console.log(`    Supports: ${manifest.supportedKinds.join(', ')}`);
    console.log(`    Description: ${manifest.description}`);
    console.log();
  }
}

async function detectSystems(
  registry: AdapterRegistry,
  executor: AdapterExecutor
): Promise<void> {
  const manifests = await registry.discoverAdapters();

  if (manifests.length === 0) {
    logger.info('No adapters found');
    return;
  }

  console.log('\nDetecting PIMS systems...\n');

  for (const manifest of manifests) {
    const loaded = await registry.loadAdapter(manifest.adapterId);
    if (!loaded) continue;

    const systems = await executor.detect(loaded.instance, {
      requestId: `detect-${Date.now()}`,
    });

    if (systems.length === 0) {
      console.log(`  ${manifest.name}: No systems detected`);
    } else {
      for (const system of systems) {
        console.log(`  ${manifest.name}: ${system.displayName}`);
        console.log(`    Confidence: ${(system.confidence * 100).toFixed(0)}%`);
        console.log(`    Modes: ${system.acquisitionModes.join(', ')}`);
        console.log(`    Recommended: ${system.recommendedMode}`);
        if (system.connectionHints.dataPath) {
          console.log(`    Data path: ${system.connectionHints.dataPath}`);
        }
      }
    }
    console.log();
  }
}

function printHelp(): void {
  console.log(`
DE Connect Adapter Runner

Usage: de-runner [options] <command>

Commands:
  list      List available adapters
  detect    Detect PIMS systems on this machine
  validate  Validate a connection profile
  sync      Run a sync operation

Options:
  -a, --adapters-dir <path>  Directory containing adapters (default: ./adapters)
  -o, --output-dir <path>    Output directory for sync packages (default: ./output)
  --agent-version <version>  Agent version for compatibility check (default: 1.0.0)
  --timeout <ms>             Operation timeout in milliseconds (default: 60000)
  -h, --help                 Show this help message

Examples:
  de-runner list
  de-runner detect
  de-runner -a /path/to/adapters detect
`);
}

main().catch(error => {
  logger.error('Fatal error', error instanceof Error ? error : undefined);
  process.exit(1);
});
