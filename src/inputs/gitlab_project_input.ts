import * as vscode from 'vscode';
import * as gitLabService from '../services/gitlab_service';
import * as gitLab from '../types/gitlab';

export async function showPicker(
  additionalEntries: gitLab.GitlabProject[] = [],
  placeHolder = 'Select a Gitlab Project',
): Promise<string | null> {
  const workspaceFolderOptions: gitLab.GitlabProject[] = await gitLabService.getAllGitlabProjects();

  additionalEntries.forEach(additionalEntry => {
    workspaceFolderOptions.push(additionalEntry);
  });

  if (workspaceFolderOptions.length === 0) {
    return null;
  }
  if (workspaceFolderOptions.length === 1) {
    return workspaceFolderOptions[0].uri;
  }

  const workspaceFolder: gitLab.GitlabProject | undefined = await vscode.window.showQuickPick(
    workspaceFolderOptions,
    {
      placeHolder,
    },
  );

  if (workspaceFolder) {
    return workspaceFolder.uri;
  }

  return null;
}
