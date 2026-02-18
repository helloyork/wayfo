import { RunEvent } from "@wayfo/shared";

type Listener = (event: RunEvent) => void;

class EventBus {
  private listeners = new Map<string, Set<Listener>>();

  emit(event: RunEvent) {
    const set = this.listeners.get(event.runId);
    if (!set) {
      return;
    }
    for (const listener of set) {
      listener(event);
    }
  }

  subscribe(runId: string, listener: Listener) {
    const set = this.listeners.get(runId) ?? new Set<Listener>();
    set.add(listener);
    this.listeners.set(runId, set);
    return () => {
      const existing = this.listeners.get(runId);
      if (!existing) {
        return;
      }
      existing.delete(listener);
      if (existing.size === 0) {
        this.listeners.delete(runId);
      }
    };
  }
}

export const eventBus = new EventBus();
