import '@testing-library/jest-dom';

type WorkerMessageHandler = (this: Worker, ev: MessageEvent<unknown>) => void;
type WorkerErrorHandler = (this: AbstractWorker, ev: ErrorEvent) => void;

class MockWorker extends EventTarget {
  readonly scriptURL?: string | URL;
  onmessage: WorkerMessageHandler | null = null;
  onmessageerror: WorkerMessageHandler | null = null;
  onerror: WorkerErrorHandler | null = null;

  constructor(scriptURL?: string | URL) {
    super();
    this.scriptURL = scriptURL;
  }

  postMessage(
    message: unknown,
    options?: StructuredSerializeOptions | Transferable[]
  ): void {
    // no-op in tests
    void message;
    void options;
  }

  terminate(): void {
    // no-op in tests
  }
}

globalThis.Worker = MockWorker as unknown as typeof Worker;
