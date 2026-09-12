import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import type { LlmMessage } from "../../llm/types.js";

export interface SessionRecord {
  id: string;
  userId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  /** Memoria del agente: historial llm-style persistido de la sesión. */
  history: LlmMessage[];
  /** Número de turnos de usuario procesados. */
  turns: number;
  status: "idle" | "running" | "error";
  lastError?: string;
}

export interface SessionStore {
  get(id: string): SessionRecord | undefined;
  list(userId?: string): SessionRecord[];
  save(record: SessionRecord): void;
  delete(id: string): boolean;
  load(): Promise<void>;
  flush(): Promise<void>;
}

/**
 * Almacén de sesiones en memoria con snapshot JSON opcional.
 *
 * La fuente de verdad vive en RAM (rápido, ideal para el demo); si se
 * configura `BFF_STORE_FILE`, cada cambio se vuelca a un archivo JSON
 * para sobrevivir reinicios y para desarrollo.
 */
export class MemorySessionStore implements SessionStore {
  private readonly records = new Map<string, SessionRecord>();

  constructor(private readonly file?: string) {}

  get(id: string): SessionRecord | undefined {
    const record = this.records.get(id);
    return record ? { ...record, history: [...record.history] } : undefined;
  }

  list(userId?: string): SessionRecord[] {
    const all = [...this.records.values()];
    const filtered = userId ? all.filter((r) => r.userId === userId) : all;
    return filtered.map((r) => ({ ...r, history: [...r.history] }));
  }

  save(record: SessionRecord): void {
    this.records.set(record.id, { ...record, history: [...record.history] });
    void this.flush();
  }

  delete(id: string): boolean {
    const ok = this.records.delete(id);
    if (ok) void this.flush();
    return ok;
  }

  async load(): Promise<void> {
    if (!this.file) return;
    try {
      const raw = await readFile(this.file, "utf8");
      const parsed = JSON.parse(raw) as SessionRecord[];
      for (const record of parsed) this.records.set(record.id, record);
    } catch {
      // no hay snapshot aún o es ilegible: se arranca vacío.
    }
  }

  async flush(): Promise<void> {
    if (!this.file) return;
    await mkdir(dirname(this.file), { recursive: true });
    await writeFile(this.file, JSON.stringify([...this.records.values()], null, 2), "utf8");
  }
}