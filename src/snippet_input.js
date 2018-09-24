const vscode = require('vscode');
const openers = require('./openers');
const gitLabService = require('./gitlab_service');

const visibilityOptions = [
  {
    label: 'Public',
    type: 'public',
  },
  {
    label: 'Internal',
    type: 'internal',
  },
  {
    label: 'Private',
    type: 'private',
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

async function createSnippet(project, editor, visibility, context) {
  let content = '';
  const fileName = editor.document.fileName.split('/').reverse()[0];

  if (context === 'selection' && editor.selection) {
    const { start, end } = editor.selection;
    const endLine = start.line === end.line ? end.line + 1 : end.line;
    const startPos = new vscode.Position(start.line, 0);
    const endPos = new vscode.Position(endLine, 0);
    const range = new vscode.Range(startPos, endPos);
    content = editor.document.getText(range);
  } else {
    content = editor.document.getText();
  }

  const snippet = await gitLabService.createSnippet({
    id: project.id,
    title: fileName,
    file_name: fileName,
    code: content,
    visibility,
  });

  openers.openUrl(snippet.web_url);
}

async function showPicker() {
  const editor = vscode.window.activeTextEditor;
  const project = await gitLabService.fetchCurrentProject();

  if (editor) {
    if (project) {
      const visibility = await vscode.window.showQuickPick(visibilityOptions);

      if (visibility) {
        const context = await vscode.window.showQuickPick(contextOptions);

        if (context) {
          createSnippet(project, editor, visibility.type, context.type);
        }
      }
    } else {
      vscode.window.showInformationMessage('GitLab Workflow: No GitLab project found.');
    }
  } else {
    vscode.window.showInformationMessage('GitLab Workflow: No open file.');
  }
}

exports.show = showPicker;
