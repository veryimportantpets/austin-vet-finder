/**
 * Adapter Registry
 *
 * Discovers, loads, and manages adapter plugins.
 */

import { readdir, readFile } from 'fs/promises';
import { join, resolve } from 'path';
import { existsSync } from 'fs';
import type {
  IAdapter,
  AdapterManifest,
  AdapterRegistration,
  AdapterFactory,
  PimsKind,
} from '@de-connect/contracts';
import { createLogger, type Logger } from '@de-connect/shared';

/**
 * Adapter registry configuration
 */
export interface RegistryConfig {
  /**
   * Directory containing adapter packages
   */
  adaptersDir: string;

  /**
   * Minimum agent version for compatibility check
   */
  agentVersion: string;

  /**
   * Logger instance
   */
  logger?: Logger;
}

/**
 * Loaded adapter info
 */
export interface LoadedAdapter {
  manifest: AdapterManifest;
  instance: IAdapter;
  loadedAt: Date;
  modulePath: string;
}

/**
 * Adapter Registry - manages adapter lifecycle
 */
export class AdapterRegistry {
  private adapters: Map<string, LoadedAdapter> = new Map();
  private logger: Logger;

  constructor(private config: RegistryConfig) {
    this.logger = config.logger ?? createLogger('AdapterRegistry');
  }

  /**
   * Discover and load all adapters from the adapters directory
   */
  async discoverAdapters(): Promise<AdapterManifest[]> {
    const { adaptersDir } = this.config;
    const manifests: AdapterManifest[] = [];

    if (!existsSync(adaptersDir)) {
      this.logger.warn('Adapters directory does not exist', { adaptersDir });
      return manifests;
    }

    const entries = await readdir(adaptersDir, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const adapterPath = join(adaptersDir, entry.name);

      try {
        const manifest = await this.loadAdapterManifest(adapterPath);
        if (manifest) {
          manifests.push(manifest);
          this.logger.info('Discovered adapter', {
            adapterId: manifest.adapterId,
            version: manifest.version,
          });
        }
      } catch (error) {
        this.logger.warn('Failed to load adapter manifest', {
          path: adapterPath,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return manifests;
  }

  /**
   * Load adapter manifest from a directory
   */
  private async loadAdapterManifest(adapterPath: string): Promise<AdapterManifest | null> {
    const manifestPath = join(adapterPath, 'manifest.json');

    if (!existsSync(manifestPath)) {
      // Try package.json with de-connect field
      const packagePath = join(adapterPath, 'package.json');
      if (existsSync(packagePath)) {
        const pkg = JSON.parse(await readFile(packagePath, 'utf-8'));
        if (pkg['de-connect']?.manifest) {
          return pkg['de-connect'].manifest as AdapterManifest;
        }
      }
      return null;
    }

    const content = await readFile(manifestPath, 'utf-8');
    return JSON.parse(content) as AdapterManifest;
  }

  /**
   * Load a specific adapter by ID
   */
  async loadAdapter(adapterId: string): Promise<LoadedAdapter | null> {
    // Check if already loaded
    const existing = this.adapters.get(adapterId);
    if (existing) {
      return existing;
    }

    const { adaptersDir } = this.config;
    const entries = await readdir(adaptersDir, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const adapterPath = join(adaptersDir, entry.name);
      const manifest = await this.loadAdapterManifest(adapterPath);

      if (manifest?.adapterId === adapterId) {
        return this.loadAdapterFromPath(adapterPath, manifest);
      }
    }

    this.logger.warn('Adapter not found', { adapterId });
    return null;
  }

  /**
   * Load adapter from path
   */
  private async loadAdapterFromPath(
    adapterPath: string,
    manifest: AdapterManifest
  ): Promise<LoadedAdapter> {
    // Check version compatibility
    if (!this.isCompatible(manifest)) {
      throw new Error(
        `Adapter ${manifest.adapterId} requires agent version ${manifest.minAgentVersion}, ` +
        `but current version is ${this.config.agentVersion}`
      );
    }

    // Determine entry point
    let entryPath = join(adapterPath, 'dist', 'index.js');
    if (!existsSync(entryPath)) {
      entryPath = join(adapterPath, 'index.js');
    }

    if (!existsSync(entryPath)) {
      throw new Error(`Adapter entry point not found: ${entryPath}`);
    }

    // Dynamic import
    const module = await import(entryPath);

    // Look for factory function or default export
    let factory: AdapterFactory;
    if (typeof module.createAdapter === 'function') {
      factory = module.createAdapter;
    } else if (typeof module.default === 'function') {
      factory = module.default;
    } else if (module.default && typeof module.default.createAdapter === 'function') {
      factory = module.default.createAdapter;
    } else {
      throw new Error(`Adapter ${manifest.adapterId} does not export a factory function`);
    }

    const instance = factory();

    const loaded: LoadedAdapter = {
      manifest,
      instance,
      loadedAt: new Date(),
      modulePath: entryPath,
    };

    this.adapters.set(manifest.adapterId, loaded);

    this.logger.info('Loaded adapter', {
      adapterId: manifest.adapterId,
      version: manifest.version,
    });

    return loaded;
  }

  /**
   * Check version compatibility
   */
  private isCompatible(manifest: AdapterManifest): boolean {
    // Simple version comparison (in production, use semver)
    const required = manifest.minAgentVersion.split('.').map(Number);
    const current = this.config.agentVersion.split('.').map(Number);

    for (let i = 0; i < Math.max(required.length, current.length); i++) {
      const req = required[i] ?? 0;
      const cur = current[i] ?? 0;

      if (cur > req) return true;
      if (cur < req) return false;
    }

    return true;
  }

  /**
   * Get adapter for a PIMS kind
   */
  async getAdapterForKind(kind: PimsKind): Promise<LoadedAdapter | null> {
    // Check loaded adapters first
    for (const loaded of this.adapters.values()) {
      if (loaded.manifest.supportedKinds.includes(kind)) {
        return loaded;
      }
    }

    // Discover and load
    const manifests = await this.discoverAdapters();
    for (const manifest of manifests) {
      if (manifest.supportedKinds.includes(kind)) {
        return this.loadAdapter(manifest.adapterId);
      }
    }

    return null;
  }

  /**
   * Get all loaded adapters
   */
  getLoadedAdapters(): Map<string, LoadedAdapter> {
    return new Map(this.adapters);
  }

  /**
   * Unload an adapter
   */
  async unloadAdapter(adapterId: string): Promise<void> {
    const loaded = this.adapters.get(adapterId);
    if (loaded) {
      await loaded.instance.disposeAsync();
      this.adapters.delete(adapterId);
      this.logger.info('Unloaded adapter', { adapterId });
    }
  }

  /**
   * Unload all adapters
   */
  async unloadAll(): Promise<void> {
    for (const [adapterId, loaded] of this.adapters) {
      try {
        await loaded.instance.disposeAsync();
      } catch (error) {
        this.logger.error('Error disposing adapter', error instanceof Error ? error : undefined, { adapterId });
      }
    }
    this.adapters.clear();
  }
}
