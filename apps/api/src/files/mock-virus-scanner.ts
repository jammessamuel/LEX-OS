import { Inject, Injectable } from '@nestjs/common';
import type { RuntimeConfig } from '@lex-os/config';

import { RUNTIME_CONFIG } from '../config/runtime-config.module.js';
import type { VirusInspectionSession, VirusScanner, VirusScanOutcome } from './virus-scanner.js';

const INFECTED_MARKER = Buffer.from('EICAR-STANDARD-ANTIVIRUS-TEST-FILE', 'utf8');
const FAILURE_MARKER = Buffer.from('LEXOS_MOCK_SCANNER_UNAVAILABLE', 'utf8');
const overlapSize = Math.max(INFECTED_MARKER.length, FAILURE_MARKER.length) - 1;

class MockVirusInspectionSession implements VirusInspectionSession {
  #overlap = Buffer.alloc(0);
  #outcome: VirusScanOutcome = 'CLEAN';

  inspect(chunk: Buffer): void {
    const inspected = Buffer.concat([this.#overlap, chunk]);
    if (inspected.includes(FAILURE_MARKER)) {
      this.#outcome = 'ERROR';
    } else if (this.#outcome === 'CLEAN' && inspected.includes(INFECTED_MARKER)) {
      this.#outcome = 'INFECTED';
    }
    this.#overlap = inspected.subarray(Math.max(0, inspected.length - overlapSize));
  }

  complete(): VirusScanOutcome {
    return this.#outcome;
  }
}

@Injectable()
export class MockVirusScanner implements VirusScanner {
  constructor(@Inject(RUNTIME_CONFIG) config: RuntimeConfig) {
    if (config.environment === 'production') {
      throw new Error('The mock virus scanner cannot run in production.');
    }
  }

  createSession(): VirusInspectionSession {
    return new MockVirusInspectionSession();
  }
}
