export type StepStatus = 'pending' | 'in_progress' | 'completed'
export type Step = { content: string; activeForm?: string; status: StepStatus }
export type Plan = { steps: Step[]; drawnDone: number }

declare module 'claude-code' {
  interface PluginState {
    'progress-glow': { plan: Plan | null; action: string | null; isOpen: boolean }
  }
}
