import * as vscode from 'vscode';
import * as gitLabService from '../services/gitlab_service';
import * as gitLab from '../types/gitlab';
import * as openers from '../actions/openers';

export async function showPicker(): Promise<void> {
  const items = [
    {
      label: 'View latest pipeline on GitLab',
      action: gitLab.PipelineAction.view,
    },
    {
      label: 'Create a new pipeline from current branch',
      action: gitLab.PipelineAction.create,
    },
    {
      label: 'Retry last pipeline',
      action: gitLab.PipelineAction.retry,
    },
    {
      label: 'Cancel last pipeline',
      action: gitLab.PipelineAction.cancel,
    },
  ];

  const workspaceFolder: string | null = await gitLabService.getCurrentWorkspaceFolderOrSelectOne();

  const selected = await vscode.window.showQuickPick(items);

  if (selected) {
    if (selected.action === 'view') {
      openers.openCurrentPipeline(workspaceFolder);
      return;
    }
    if (workspaceFolder) {
      gitLabService.handlePipelineAction(selected.action, workspaceFolder);
    }
  }
}
