const assert = require('node:assert/strict');
const { describe, it } = require('node:test');

require('reflect-metadata');

// O Nest resolve dependências dos construtores na inicialização. Estas asserções leem os
// metadados dos decoradores para detectar importações ausentes sem banco, Redis ou storage.

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

// Exportações de módulos @Global() são injetáveis sem importação explícita; o Nest registra
// essa condição nesta chave de metadados.
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

  // Os dois serviços contam publicações adiadas e dependem de ObservabilityModule. Se a
  // importação desaparecer, o teste falha antes da inicialização da API.
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
        // Parâmetros por interface ou token viram Object em execução; @Inject() os resolve
        // fora do alcance desta verificação por reflexão.
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
