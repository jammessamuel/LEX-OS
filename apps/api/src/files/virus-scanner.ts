export const VIRUS_SCANNER = Symbol('VIRUS_SCANNER');

export type VirusScanOutcome = 'CLEAN' | 'ERROR' | 'INFECTED';

export interface VirusInspectionSession {
  inspect(chunk: Buffer): void;
  complete(): VirusScanOutcome;
}

export interface VirusScanner {
  createSession(): VirusInspectionSession;
}
