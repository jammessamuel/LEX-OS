import { Injectable } from '@nestjs/common';

interface WorkerStatus {
  name: 'lex-os-worker';
  status: 'ready';
  processingPipeline: 'active';
}

@Injectable()
export class WorkerService {
  getStatus(): WorkerStatus {
    return {
      name: 'lex-os-worker',
      status: 'ready',
      processingPipeline: 'active',
    };
  }
}
