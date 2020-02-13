import * as vscode from 'vscode';
import { ProjectSchema } from 'gitlab';
import * as openers from '../actions/openers';
import * as gitLabService from '../services/gitlab_service';
import * as gitLab from '../types/gitlab';
import * as gitlabProjectInput from './gitlab_project_input';

const visibilityOptions = [
  {
    label: 'Public',
    type: gitLab.SnippetVisibility.public,
  },
  {
    label: 'Internal',
    type: gitLab.SnippetVisibility.internal,
  },
  {
    label: 'Private',
    type: gitLab.SnippetVisibility.private,
  },
];

const contextOptions = [
  {
    label: 'Snippet from file',
    type: 'file',
  },
  {
    label: 'Snippet from selection',
    type: 'selection',
  },
];

async function createSnippet(
  project: ProjectSchema,
  editor: vscode.TextEditor,
  visibility: gitLab.SnippetVisibility,
  context: string,
): Promise<void> {
  let content = '';
  const fileName: string = editor.document.fileName.split('/').reverse()[0];

  if (context === 'selection' && editor.selection) {
    const { start, end } = editor.selection;
    const endLine: number = end.line + 1;
    const startPos: vscode.Position = new vscode.Position(start.line, 0);
    const endPos: vscode.Position = new vscode.Position(endLine, 0);
    const range: vscode.Range = new vscode.Range(startPos, endPos);
    content = editor.document.getText(range);
  } else {
    content = editor.document.getText();
  }

  const data: gitLab.SnippetOptions = {
    title: fileName,
    // eslint-disable-next-line @typescript-eslint/camelcase
    file_name: fileName,
    visibility,
  };

  if (project) {
    data.id = project.id;
    data.code = content;
  } else {
    data.content = content;
  }

  const snippet: gitLab.Issuable | null = await gitLabService.createSnippet(data);

  if (snippet && snippet.web_url) {
    openers.openUrl(snippet.web_url);
    return;
  }
  vscode.window.showInformationMessage('GitLab Workflow: No open file.');
}

export async function showPicker(): Promise<void> {
  const editor: vscode.TextEditor | undefined = vscode.window.activeTextEditor;
  let workspaceFolder: string | null = null;
  let project: ProjectSchema | null = null;

  if (editor) {
    workspaceFolder = await gitLabService.getCurrenWorkspaceFolder();
    if (workspaceFolder) {
      project = await gitLabService.fetchCurrentProject(workspaceFolder);

      if (project == null) {
        workspaceFolder = await gitlabProjectInput.showPicker(
          [
            {
              label: "User's Snippets",
              uri: '',
            },
          ],
          "Select a Gitlab Project or use the User's Snippets",
        );
        if (workspaceFolder) {
          project = await gitLabService.fetchCurrentProject(workspaceFolder);
        }
      }

      const visibility = await vscode.window.showQuickPick(visibilityOptions);

      if (visibility) {
        const context = await vscode.window.showQuickPick(contextOptions);

        if (context && project) {
          createSnippet(project, editor, visibility.type, context.type);
          return;
        }
      }
    }
  }
  vscode.window.showInformationMessage('GitLab Workflow: No open file.');
}
