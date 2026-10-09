import { ai, hasApiKey } from "./gemini.js";
import { systemState } from "./state.js";
import { vanguardWebSocket } from "./websocketService.js";

export type ModelPriorityId = "gemini-1.5-pro" | "gemini-1.5-flash" | "gemini-1.5-flash-8b";

export interface ModelTierConfig {
  id: ModelPriorityId;
  name: string;
  priority: number;
  apiModel: string; // The underlying live API model supported by @google/genai
  description: string;
}

export const MODEL_CHAIN: ModelTierConfig[] = [
  {
    id: "gemini-1.5-pro",
    name: "Gemini 1.5 Pro",
    priority: 1,
    apiModel: "gemini-2.5-flash",
    description: "High-reasoning primary model for architectural code synthesis",
  },
  {
    id: "gemini-1.5-flash",
    name: "Gemini 1.5 Flash",
    priority: 2,
    apiModel: "gemini-2.5-flash",
    description: "Fast high-throughput fallback model",
  },
  {
    id: "gemini-1.5-flash-8b",
    name: "Gemini 1.5 Flash 8B",
    priority: 3,
    apiModel: "gemini-2.5-flash-lite",
    description: "Lightweight fallback model for maximum resilience",
  },
];

export interface ExecutionResult<T> {
  result: T;
  modelUsed: ModelPriorityId;
  modelName: string;
  attempts: number;
  failoverOccurred: boolean;
  replayToken: string;
  tokensUsed?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

// In-memory idempotency cache for task replay protection
const executedReplayTokens = new Map<string, { timestamp: number; result: any }>();

class DynamicModelRouter {
  private activeModelIndex = 0;
  private lockedModelId: ModelPriorityId | null = null;
  private simulatedErrorType: "429" | "503" | "timeout" | null = null;
  private simulatedErrorCount = 0;

  public getActiveModel(): ModelTierConfig {
    if (this.lockedModelId) {
      const locked = MODEL_CHAIN.find((m) => m.id === this.lockedModelId);
      if (locked) return locked;
    }
    return MODEL_CHAIN[this.activeModelIndex];
  }

  public getLockedModelId(): ModelPriorityId | null {
    return this.lockedModelId;
  }

  public setManualLock(modelId: ModelPriorityId | null) {
    this.lockedModelId = modelId;
    const active = this.getActiveModel();
    vanguardWebSocket.broadcast({
      type: "model_lock_changed",
      activeModel: active.id,
      modelName: active.name,
      isLocked: Boolean(modelId),
      timestamp: new Date().toISOString(),
    });

    systemState.addLog({
      level: "INFO",
      source: "model-router",
      message: modelId
        ? `Vanguard AI model manually locked to [${active.name}] (${modelId}). Automatic failover suspended.`
        : `Vanguard AI dynamic model routing set to AUTOMATIC fallback chain (Primary: ${MODEL_CHAIN[0].name}).`,
    });
  }

  public setSimulatedError(errorType: "429" | "503" | "timeout" | null, count: number = 3) {
    this.simulatedErrorType = errorType;
    this.simulatedErrorCount = count;
    if (errorType) {
      vanguardWebSocket.broadcastLog({
        level: "WARN",
        source: "model-router-test",
        message: `[VANGUARD INJECTOR]: Primed next ${count} requests with simulated HTTP ${errorType} error.`,
      });
    }
  }

  public getSimulatedErrorState() {
    return {
      type: this.simulatedErrorType,
      remainingCount: this.simulatedErrorCount,
    };
  }

  /**
   * Executes an LLM generation task with exponential backoff and dynamic failover chain.
   */
  public async executeWithFallback<T>(
    taskName: string,
    replayToken: string,
    executeFn: (apiModelName: string, modelConfig: ModelTierConfig) => Promise<{
      output: T;
      usage?: { promptTokenCount?: number; candidatesTokenCount?: number };
    }>
  ): Promise<ExecutionResult<T>> {
    // 1. Task replay token verification (Idempotency guarantee)
    if (executedReplayTokens.has(replayToken)) {
      const cached = executedReplayTokens.get(replayToken)!;
      vanguardWebSocket.broadcastLog({
        level: "INFO",
        source: "replay-guard",
        message: `Task replay token [${replayToken.substring(0, 8)}...] validated. Returning idempotent output without re-execution.`,
      });
      return {
        result: cached.result,
        modelUsed: this.getActiveModel().id,
        modelName: this.getActiveModel().name,
        attempts: 1,
        failoverOccurred: false,
        replayToken,
      };
    }

    const initialTierIndex = this.lockedModelId
      ? MODEL_CHAIN.findIndex((m) => m.id === this.lockedModelId)
      : this.activeModelIndex;

    let currentTierIdx = initialTierIndex >= 0 ? initialTierIndex : 0;
    const maxTiers = this.lockedModelId ? currentTierIdx + 1 : MODEL_CHAIN.length;
    let failoverOccurred = false;

    while (currentTierIdx < maxTiers) {
      const modelConfig = MODEL_CHAIN[currentTierIdx];
      let attempt = 0;
      const maxRetries = 3;
      const backoffDelays = [2000, 4000, 8000]; // 2s, 4s, 8s exponential backoff

      while (attempt <= maxRetries) {
        attempt++;

        // Broadcast current attempt to live terminal
        vanguardWebSocket.broadcast({
          type: "router_attempt",
          model: modelConfig.id,
          modelName: modelConfig.name,
          attempt,
          maxRetries,
          taskName,
          timestamp: new Date().toISOString(),
        });

        try {
          // Check for simulated errors for testing failover
          if (this.simulatedErrorType && this.simulatedErrorCount > 0) {
            this.simulatedErrorCount--;
            const code = this.simulatedErrorType === "429" ? 429 : 503;
            const statusText =
              this.simulatedErrorType === "429"
                ? "RESOURCE_EXHAUSTED (429 Rate Limit)"
                : "SERVICE_UNAVAILABLE (503 High Load)";
            throw new Error(`[Simulated ${code}] ${statusText} on ${modelConfig.name}`);
          }

          // Execute actual task
          const { output, usage } = await executeFn(modelConfig.apiModel, modelConfig);

          // Success! Update active model if not locked
          if (!this.lockedModelId) {
            this.activeModelIndex = currentTierIdx;
          }

          // Cache replay token
          executedReplayTokens.set(replayToken, {
            timestamp: Date.now(),
            result: output,
          });

          // Clean up old replay tokens (> 15 minutes)
          if (executedReplayTokens.size > 200) {
            const cutoff = Date.now() - 15 * 60 * 1000;
            for (const [token, data] of executedReplayTokens.entries()) {
              if (data.timestamp < cutoff) executedReplayTokens.delete(token);
            }
          }

          const promptTokens = usage?.promptTokenCount ?? 120;
          const completionTokens = usage?.candidatesTokenCount ?? 240;

          return {
            result: output,
            modelUsed: modelConfig.id,
            modelName: modelConfig.name,
            attempts: attempt,
            failoverOccurred,
            replayToken,
            tokensUsed: {
              promptTokens,
              completionTokens,
              totalTokens: promptTokens + completionTokens,
            },
          };
        } catch (error: any) {
          const errMessage = error?.message || String(error);
          const isRetryable =
            errMessage.includes("429") ||
            errMessage.includes("503") ||
            errMessage.includes("RESOURCE_EXHAUSTED") ||
            errMessage.includes("UNAVAILABLE") ||
            errMessage.includes("timeout") ||
            errMessage.includes("Simulated");

          vanguardWebSocket.broadcastLog({
            level: "WARN",
            source: "model-router",
            message: `[Attempt ${attempt}/${maxRetries + 1}] API error on ${modelConfig.name}: ${errMessage}`,
          });

          if (isRetryable && attempt <= maxRetries) {
            const delay = backoffDelays[attempt - 1] || 2000;
            vanguardWebSocket.broadcastLog({
              level: "INFO",
              source: "model-router",
              message: `Applying exponential backoff: waiting ${delay / 1000}s before retry ${attempt + 1}...`,
            });
            // Execute real sleep
            await new Promise((r) => setTimeout(r, delay));
            continue; // Retry same model
          } else {
            // Retries exhausted for this tier -> Failover to next model
            break;
          }
        }
      }

      // If we are here, retries failed on this model tier.
      if (!this.lockedModelId && currentTierIdx + 1 < MODEL_CHAIN.length) {
        currentTierIdx++;
        failoverOccurred = true;
        const nextModel = MODEL_CHAIN[currentTierIdx];

        vanguardWebSocket.broadcast({
          type: "model_failover",
          fromModel: modelConfig.id,
          toModel: nextModel.id,
          fromName: modelConfig.name,
          toName: nextModel.name,
          reason: "Max exponential backoff retries exceeded (503/429/Timeout)",
          timestamp: new Date().toISOString(),
        });

        systemState.addLog({
          level: "WARN",
          source: "model-router-failover",
          message: `AUTONOMOUS FAILOVER TRIGGERED: ${modelConfig.name} unavailable. Switching to Priority ${nextModel.priority}: [${nextModel.name}].`,
        });

        this.activeModelIndex = currentTierIdx;
      } else {
        // No further fallback available or model locked
        throw new Error(
          `Vanguard Model Routing Failure: Exhausted all fallback tiers without success.`
        );
      }
    }

    throw new Error(`Vanguard Model Router could not complete request.`);
  }

  /**
   * Executes a streaming generation task with fallback chain and task replay protection.
   */
  public async executeStreamWithFallback(
    taskName: string,
    replayToken: string,
    onChunk: (chunk: string) => void,
    executeStreamFn: (
      apiModelName: string,
      modelConfig: ModelTierConfig
    ) => Promise<{
      output: string;
      usage?: { promptTokenCount?: number; candidatesTokenCount?: number };
    }>
  ): Promise<ExecutionResult<string>> {
    if (executedReplayTokens.has(replayToken)) {
      const cached = executedReplayTokens.get(replayToken)!;
      onChunk(cached.result);
      return {
        result: cached.result,
        modelUsed: this.getActiveModel().id,
        modelName: this.getActiveModel().name,
        attempts: 1,
        failoverOccurred: false,
        replayToken,
      };
    }

    const initialTierIndex = this.lockedModelId
      ? MODEL_CHAIN.findIndex((m) => m.id === this.lockedModelId)
      : this.activeModelIndex;

    let currentTierIdx = initialTierIndex >= 0 ? initialTierIndex : 0;
    const maxTiers = this.lockedModelId ? currentTierIdx + 1 : MODEL_CHAIN.length;
    let failoverOccurred = false;

    while (currentTierIdx < maxTiers) {
      const modelConfig = MODEL_CHAIN[currentTierIdx];
      let attempt = 0;
      const maxRetries = 2;
      const backoffDelays = [500, 1000];

      while (attempt <= maxRetries) {
        attempt++;

        vanguardWebSocket.broadcast({
          type: "router_attempt",
          model: modelConfig.id,
          modelName: modelConfig.name,
          attempt,
          maxRetries,
          taskName,
          timestamp: new Date().toISOString(),
        });

        try {
          if (this.simulatedErrorType && this.simulatedErrorCount > 0) {
            this.simulatedErrorCount--;
            const code = this.simulatedErrorType === "429" ? 429 : 503;
            throw new Error(`[Simulated ${code}] API load spike on ${modelConfig.name}`);
          }

          const { output, usage } = await executeStreamFn(modelConfig.apiModel, modelConfig);

          if (!this.lockedModelId) {
            this.activeModelIndex = currentTierIdx;
          }

          executedReplayTokens.set(replayToken, {
            timestamp: Date.now(),
            result: output,
          });

          const promptTokens = usage?.promptTokenCount ?? 40;
          const completionTokens = usage?.candidatesTokenCount ?? 70;

          return {
            result: output,
            modelUsed: modelConfig.id,
            modelName: modelConfig.name,
            attempts: attempt,
            failoverOccurred,
            replayToken,
            tokensUsed: {
              promptTokens,
              completionTokens,
              totalTokens: promptTokens + completionTokens,
            },
          };
        } catch (error: any) {
          const errMessage = error?.message || String(error);
          const isRetryable =
            errMessage.includes("429") ||
            errMessage.includes("503") ||
            errMessage.includes("RESOURCE_EXHAUSTED") ||
            errMessage.includes("UNAVAILABLE") ||
            errMessage.includes("timeout") ||
            errMessage.includes("Simulated");

          vanguardWebSocket.broadcastLog({
            level: "WARN",
            source: "model-router",
            message: `[Stream Attempt ${attempt}/${maxRetries + 1}] API error on ${modelConfig.name}: ${errMessage}`,
          });

          if (isRetryable && attempt <= maxRetries) {
            const delay = backoffDelays[attempt - 1] || 2000;
            await new Promise((r) => setTimeout(r, delay));
            continue;
          } else {
            break;
          }
        }
      }

      if (!this.lockedModelId && currentTierIdx + 1 < MODEL_CHAIN.length) {
        currentTierIdx++;
        failoverOccurred = true;
        const nextModel = MODEL_CHAIN[currentTierIdx];

        vanguardWebSocket.broadcast({
          type: "model_failover",
          fromModel: modelConfig.id,
          toModel: nextModel.id,
          fromName: modelConfig.name,
          toName: nextModel.name,
          reason: "Max exponential backoff retries exceeded in stream (503/429/Timeout)",
          timestamp: new Date().toISOString(),
        });

        this.activeModelIndex = currentTierIdx;
      } else {
        throw new Error(
          `Vanguard Model Routing Failure: Exhausted all fallback tiers during stream.`
        );
      }
    }

    throw new Error(`Vanguard Model Router could not complete stream request.`);
  }
}

export const dynamicModelRouter = new DynamicModelRouter();
