const assert = require('node:assert/strict');
const { describe, it } = require('node:test');

require('reflect-metadata');

// Nest resolves constructor dependencies at boot, so a service that injects a provider its
// module never imports fails only when the application starts — no unit test catches it and
// the API smoke test does not build the module graph. These assertions read the decorator
// metadata directly, which is cheap and needs no database, Redis, or object storage.

async function loadModuleMetadata(specifier, exportName) {
  const imported = await import(specifier);
  const moduleClass = imported[exportName];
  assert.ok(moduleClass !== undefined, `${exportName} is not exported by ${specifier}`);
  return {
    moduleClass,
    imports: Reflect.getMetadata('imports', moduleClass) ?? [],
    providers: Reflect.getMetadata('providers', moduleClass) ?? [],
    exports: Reflect.getMetadata('exports', moduleClass) ?? [],
  };
}

function constructorDependencies(target) {
  return Reflect.getMetadata('design:paramtypes', target) ?? [];
}

// A @Global() module's exports are injectable anywhere without being imported, so they have
// to be part of the available set. Nest records the flag under this metadata key.
const GLOBAL_MODULE_METADATA = '__module:global__';

async function globallyAvailableProviders() {
  const { AppModule } = await import('../../dist/app.module.js');
  const available = new Set();
  const queue = [AppModule];
  const visited = new Set();

  while (queue.length > 0) {
    const current = queue.pop();
    if (typeof current !== 'function' || visited.has(current)) {
      continue;
    }
    visited.add(current);

    if (Reflect.getMetadata(GLOBAL_MODULE_METADATA, current) === true) {
      for (const exported of Reflect.getMetadata('exports', current) ?? []) {
        available.add(exported);
      }
    }
    queue.push(...(Reflect.getMetadata('imports', current) ?? []));
  }

  return available;
}

describe('API module graph', () => {
  it('exports MetricsService from the module that declares it', async () => {
    const observability = await loadModuleMetadata(
      '../../dist/observability/observability.module.js',
      'ObservabilityModule',
    );
    const { MetricsService } = await import('../../dist/observability/metrics.service.js');

    assert.ok(
      observability.providers.includes(MetricsService),
      'ObservabilityModule must provide MetricsService',
    );
    assert.ok(
      observability.exports.includes(MetricsService),
      'ObservabilityModule must export MetricsService for consuming modules',
    );
  });

  // Both services count deferred enqueues, which is only reachable if their module imports
  // ObservabilityModule. Delete the import and this fails instead of the API failing to boot.
  for (const target of [
    {
      label: 'FilesService',
      modulePath: '../../dist/files/files.module.js',
      moduleName: 'FilesModule',
      servicePath: '../../dist/files/files.service.js',
      serviceName: 'FilesService',
    },
    {
      label: 'ProcessingService',
      modulePath: '../../dist/processing/processing.module.js',
      moduleName: 'ProcessingModule',
      servicePath: '../../dist/processing/processing.service.js',
      serviceName: 'ProcessingService',
    },
  ]) {
    it(`satisfies every class dependency of ${target.label}`, async () => {
      const owning = await loadModuleMetadata(target.modulePath, target.moduleName);
      const service = (await import(target.servicePath))[target.serviceName];

      assert.ok(
        owning.providers.includes(service),
        `${target.moduleName} must provide ${target.serviceName}`,
      );

      const available = new Set([...owning.providers, ...(await globallyAvailableProviders())]);
      for (const imported of owning.imports) {
        for (const exported of Reflect.getMetadata('exports', imported) ?? []) {
          available.add(exported);
        }
      }

      for (const dependency of constructorDependencies(service)) {
        // Interface-typed and token-injected parameters erase to Object at runtime; those are
        // resolved by @Inject() and are outside what this reflection can verify.
        if (typeof dependency !== 'function' || dependency === Object) {
          continue;
        }
        assert.ok(
          available.has(dependency),
          `${target.serviceName} injects ${dependency.name}, but ${target.moduleName} neither ` +
            'provides it nor imports a module that exports it',
        );
      }
    });
  }
});
