import * as vscode from 'vscode';
import { GitlabTreeItem } from '../ui/gitlab_tree_item';

export abstract class GitlabDataProvider implements vscode.TreeDataProvider<GitlabTreeItem> {
  children: GitlabTreeItem[];

  private _onDidChangeTreeData = new vscode.EventEmitter<GitlabTreeItem>();

  // eslint-disable-next-line no-underscore-dangle
  readonly onDidChangeTreeData: vscode.Event<GitlabTreeItem> = this._onDidChangeTreeData.event;

  constructor() {
    this.children = [];
  }

  // eslint-disable-next-line class-methods-use-this
  getParent(): null {
    return null;
  }

  // eslint-disable-next-line class-methods-use-this
  getTreeItem(item: GitlabTreeItem) {
    return item;
  }

  refresh() {
    this.children = [];
    // eslint-disable-next-line no-underscore-dangle
    this._onDidChangeTreeData.fire();
  }

  abstract async getChildren(el?: GitlabTreeItem): Promise<GitlabTreeItem[]>;
}
