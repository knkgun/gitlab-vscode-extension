import * as vscode from 'vscode';
import * as gitLabService from '../services/gitlab_service';
import * as gitLab from '../types/gitlab';

const { showInformationMessage, showErrorMessage } = vscode.window;

export async function validate(): Promise<void> {
  const editor: vscode.TextEditor | undefined = vscode.window.activeTextEditor;

  if (!editor) {
    showInformationMessage('GitLab Workflow: No open file.');
    return;
  }

  const content: string = editor.document.getText();
  const response: gitLab.ValidCiConfig | null = await gitLabService.validateCIConfig(content);

  if (!response) {
    showInformationMessage('GitLab Workflow: Failed to validate CI configuration.');
    return;
  }

  const { status, errors, error } = response;

  if (status === 'valid') {
    showInformationMessage('GitLab Workflow: Your CI configuration is valid.');
  } else if (status === 'invalid') {
    if (errors && errors.length > 0 && errors[0]) {
      showErrorMessage(errors[0]);
    }

    showErrorMessage('GitLab Workflow: Invalid CI configuration.');
  } else if (error) {
    showErrorMessage(`GitLab Workflow: Failed to validate CI configuration. Reason: ${error}`);
  }
}
