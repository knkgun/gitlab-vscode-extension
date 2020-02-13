import * as vscode from 'vscode';
import * as path from 'path';
import {
  Issuable,
  GitlabCustomQueryParametersTypes,
  GitlabCustomQueryParameters,
} from '../types/gitlab';

export class GitlabTreeItem extends vscode.TreeItem {
  constructor(
    title: string,
    data: Issuable | GitlabCustomQueryParameters | null = null,
    type: GitlabCustomQueryParametersTypes = GitlabCustomQueryParametersTypes.mergeRequests,
    collapsibleState: vscode.TreeItemCollapsibleState | undefined = undefined,
    workspaceFolder: string | null = null,
  ) {
    super(title, collapsibleState);

    const { enableExperimentalFeatures } = vscode.workspace.getConfiguration('gitlab');

    let iconPathLight = `/src/assets/images/light/stop.svg`;
    let iconPathDark = `/src/assets/images/dark/stop.svg`;
    if (data) {
      iconPathLight = `/src/assets/images/light/${type}.svg`;
      iconPathDark = `/src/assets/images/dark/${type}.svg`;
      if (type === 'custom_query' || type === 'project' || data == null) {
        this.contextValue = 'custom-query-';
        Object.entries(data).forEach(entry => {
          if (Array.isArray(entry[1])) {
            this.contextValue += `${entry[0]}:${entry[1].join(',')};`;
          } else {
            this.contextValue += `${entry[0]}:${entry[1]};`;
          }
        });
        if (type === 'project') {
          this.contextValue += `projectUri:${workspaceFolder};`;
        }
        this.command = {
          title: `Open ${title}`,
          command: '',
          arguments: [],
        };
      } else if (type === 'vulnerabilities' && (data as Issuable)?.location?.file) {
        const file = `${vscode.workspace.rootPath}/${(data as Issuable)?.location?.file}`;
        this.command = {
          title: `Open ${title}`,
          command: 'vscode.open',
          arguments: [vscode.Uri.file(file)],
        };
      } else if ((type !== 'issues' && type !== 'merge_requests') || !enableExperimentalFeatures) {
        const issuable: Issuable = data as Issuable;
        if (issuable.web_url) {
          this.command = {
            title: `Open ${title}`,
            command: 'vscode.open',
            arguments: [vscode.Uri.parse(issuable.web_url)],
          };
        }
      } else {
        this.command = {
          title: `Open ${title}`,
          command: 'gl.showRichContent',
          arguments: [data, workspaceFolder],
        };
      }
    }
    this.iconPath = {
      light: path.join(path.resolve(__dirname, '../../../'), iconPathLight),
      dark: path.join(path.resolve(__dirname, '../../../'), iconPathDark),
    };
  }
}
