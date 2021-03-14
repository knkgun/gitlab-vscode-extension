import * as vscode from 'vscode';
import { API, Repository } from '../api/git';
import { WrappedRepository } from './wrapped_repository';

export class RepositoryManager {
  private gitApi: API | undefined;

  private repositories: WrappedRepository[] = [];

  private disposables: vscode.Disposable[] = [];

  onRepositoryChange = new vscode.EventEmitter<void>();

  initialize(gitApi: API): void {
    this.gitApi = gitApi;
    this.repositories = this.gitApi.repositories.map(r => new WrappedRepository(r));
    this.disposables = [
      this.gitApi.onDidOpenRepository(this.openedRepositoryHandler, this),
      this.gitApi.onDidCloseRepository(this.closedRepositoryHandler, this),
    ];
  }

  openedRepositoryHandler(repository: Repository): void {
    this.repositories = [...this.repositories, new WrappedRepository(repository)];
    vscode.window.showInformationMessage(`added repository ${repository.rootUri}`);
  }

  closedRepositoryHandler(repository: Repository): void {
    this.repositories = this.repositories.filter(r => r.rootFsPath !== repository.rootUri.fsPath);
    vscode.window.showInformationMessage(`removed repository ${repository.rootUri}`);
  }

  dispose(): void {
    this.disposables.forEach(d => d.dispose());
    this.gitApi = undefined;
    this.repositories = [];
    this.disposables = [];
  }

  async getAllRepositories(): Promise<WrappedRepository[]> {
    await Promise.all(this.repositories.map(r => r.initialize()));
    return this.repositories;
  }
}

export const repositoryManager = new RepositoryManager();
