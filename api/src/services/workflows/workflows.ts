import { createResearchWorkflow } from 'src/lib/workflowRuntime'

export {
  workflowTemplates,
  startWorkflow,
  retryWorkflowStep,
} from 'src/lib/workflowRuntime'
export const createWorkflowTask = ({ input }) => createResearchWorkflow(input)
