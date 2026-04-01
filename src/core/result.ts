export interface AgentResult {
  success: boolean;
  output: string;
  totalSteps: number;
  runId: string;
  taskId: string;
  duration: number;
}
