export type StatusLevel = "info" | "success" | "warn" | "error" | "start";

const ICONS: Record<StatusLevel, string> = {
  start: "⏳",
  info: "ℹ️",
  success: "✅",
  warn: "⚠️",
  error: "❌"
};

export class StatusReporter {
  private scope: string;
  private escalation?: string;
  private showAdvanced: boolean;

  constructor(scope = "pipeline", options?: { escalationContact?: string; advanced?: boolean }) {
    this.scope = scope;
    this.escalation = options?.escalationContact;
    this.showAdvanced = Boolean(options?.advanced);
  }

  private emit(level: StatusLevel, message: string) {
    const icon = ICONS[level];
    const prefix = `[${this.scope}]`;
    const line = `${icon} ${prefix} ${message}`;
    if (level === "error") {
      console.error(line);
      if (this.escalation) {
        console.error(`   ↳ Need help? Reach out at ${this.escalation}`);
      }
    } else if (level === "warn") {
      console.warn(line);
    } else {
      console.log(line);
    }
  }

  start(message: string) {
    this.emit("start", message);
  }

  info(message: string) {
    this.emit("info", message);
  }

  success(message: string) {
    this.emit("success", message);
  }

  warn(message: string) {
    this.emit("warn", message);
  }

  error(message: string) {
    this.emit("error", message);
  }

  advanced(message: string) {
    if (!this.showAdvanced) return;
    this.emit("info", `(advanced) ${message}`);
  }

  emptyState(context: string, guidance: string) {
    this.warn(`${context} is empty.`);
    this.info(guidance);
  }

  async step<T>(message: string, fn: () => Promise<T>): Promise<T> {
    this.start(message);
    try {
      const result = await fn();
      this.success(`${message} — done.`);
      return result;
    } catch (error) {
      const errMessage = error instanceof Error ? error.message : String(error);
      this.error(`${message} — failed: ${errMessage}`);
      throw error;
    }
  }
}

export async function withRetry<T>(task: () => Promise<T>, options?: { attempts?: number; delayMs?: number }) {
  const attempts = options?.attempts ?? 3;
  const delayMs = options?.delayMs ?? 1000;
  let attempt = 0;
  let lastError: unknown;
  while (attempt < attempts) {
    try {
      return await task();
    } catch (error) {
      lastError = error;
      attempt += 1;
      if (attempt >= attempts) {
        break;
      }
      const backoff = delayMs * Math.pow(2, attempt - 1);
      await new Promise(resolve => setTimeout(resolve, backoff));
    }
  }
  throw lastError;
}
