import * as vscode from 'vscode';
import { API, Repository } from '../api/git';

export class RepositoryManager {
  private gitApi: API | undefined;

  private repositories: Repository[] = [];

  private disposables: vscode.Disposable[] = [];

  initialize(gitApi: API): void {
    this.gitApi = gitApi;
    this.repositories = [...this.gitApi.repositories];
    this.disposables = [
      this.gitApi.onDidOpenRepository(this.openedRepositoryHandler, this),
      this.gitApi.onDidCloseRepository(this.closedRepositoryHandler, this),
    ];
  }

  openedRepositoryHandler(repository: Repository): void {
    this.repositories = [...this.repositories, repository];
    vscode.window.showInformationMessage(`added repository ${repository.rootUri}`);
  }

  closedRepositoryHandler(repository: Repository): void {
    this.repositories = this.repositories.filter(r => r.rootUri !== repository.rootUri);
    vscode.window.showInformationMessage(`removed repository ${repository.rootUri}`);
  }

  dispose(): void {
    this.disposables.forEach(d => d.dispose());
  }
}
