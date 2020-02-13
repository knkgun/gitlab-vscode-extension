import * as vscode from 'vscode';
import * as tokenService from '../services/token_service';

export async function showInput(): Promise<void> {
  const instance: string | undefined = await vscode.window.showInputBox({
    ignoreFocusOut: true,
    value: 'https://gitlab.com',
    placeHolder: 'E.g. https://gitlab.com',
    prompt: 'URL to Gitlab instance',
  });

  const token: string | undefined = await vscode.window.showInputBox({
    ignoreFocusOut: true,
    password: true,
    placeHolder: 'Paste your GitLab Personal Access Token...',
  });

  if (instance && token) {
    tokenService.setToken(instance, token);
  }
}

export async function removeTokenPicker(): Promise<void> {
  const instanceUrls: string[] = tokenService.getInstanceUrls();
  const selectedInstanceUrl: string | undefined = await vscode.window.showQuickPick(instanceUrls, {
    ignoreFocusOut: true,
    placeHolder: 'Select Gitlab instance for PAT removal',
  });

  if (selectedInstanceUrl) {
    tokenService.setToken(selectedInstanceUrl, undefined);
  }
}
