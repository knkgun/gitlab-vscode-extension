import * as vscode from 'vscode';
import * as url from 'url';
import { GitExtension, API, Repository, Branch, APIState } from '../api/git';
import { gitlabOutputChannel } from '../extension';
import * as statusBar from '../ui/status_bar';
import * as sidebar from '../ui/sidebar';

let gitExtension: GitExtension | undefined;
let git: API | undefined;

export interface GitlabRemote {
  schema: string;
  host: string;
  namespace: string;
  project: string;
}

const currentInstanceUrl = () => vscode.workspace.getConfiguration('gitlab').instanceUrl;

function fetchBranchName(workspaceFolder: string): string | null {
  const path = vscode.Uri.file(workspaceFolder);
  const repository: Repository | null | undefined = git?.getRepository(path);
  const head: Branch | undefined = repository?.state.HEAD;

  if (head) {
    const { name: branch } = head;
    if (branch) {
      return branch;
    }
  }
  return null;
}

/**
 * Fetches remote tracking branch name of current branch.
 * This should be used in link openers.
 *
 * Fixes #1 where local branch name is renamed and doesn't exists on remote but
 * local branch still tracks another branch on remote.
 */
export async function fetchTrackingBranchName(workspaceFolder: string): Promise<string | null> {
  const branchName = fetchBranchName(workspaceFolder);

  try {
    const path = vscode.Uri.file(workspaceFolder);
    const repository: Repository | null | undefined = git?.getRepository(path);
    const ref: string | undefined = await repository?.getConfig(`branch.${branchName}.merge`);

    if (ref) {
      return ref.replace('refs/heads/', '');
    }
  } catch (e) {
    gitlabOutputChannel.appendLine(
      `WARNING: Couldn't find tracking branch. Extension will fallback to branch name ${branchName}`,
    );
  }

  return branchName;
}

export function fetchLastCommitId(workspaceFolder: string): string | null {
  const path = vscode.Uri.file(workspaceFolder);
  const repository: Repository | null | undefined = git?.getRepository(path);
  const head: Branch | undefined = repository?.state.HEAD;

  if (head) {
    const { commit } = head;
    if (commit) {
      return commit;
    }
  }
  return null;
}

const getInstancePath = (): string => {
  const { pathname } = url.parse(currentInstanceUrl());
  if (pathname && pathname !== '/') {
    // Remove trailing slash if exists
    return pathname.replace(/\/$/, '');
  }

  // Do not return extra slash if no extra path in instance url
  return '';
};

const escapeForRegExp = (str: string): string => {
  return str.replace(/[-[\]/{}()*+?.\\^$|]/g, '\\$&');
};

export const parseGitRemote = (remote: string): string[] | null => {
  let parsedRemote = remote;
  // Regex to match gitlab potential starting names for ssh remotes.
  if (/^[a-zA-Z0-9_-]+@/.exec(parsedRemote)) {
    parsedRemote = `ssh:// ${parsedRemote}`;
  }

  const { protocol, host, pathname } = url.parse(parsedRemote);

  if (!host || !pathname) {
    return null;
  }

  const pathRegExp = escapeForRegExp(getInstancePath());
  const pattern = new RegExp(`${pathRegExp}/:?(.+)/(.*?)(?:.git)?$`);
  const match = pattern.exec(pathname);
  if (match && protocol && host) {
    return [protocol, host, ...match.slice(1, 3)];
  }
  return null;
};

function fetchRemoteUrl(name: string, workspaceFolder: string): GitlabRemote | null {
  let remoteUrl: string | undefined | null = null;
  let remoteName: string | undefined = name;
  const path = vscode.Uri.file(workspaceFolder);
  const repository: Repository | null | undefined = git?.getRepository(path);
  const head: Branch | undefined = repository?.state.HEAD;

  if (!remoteName) {
    remoteName = head?.upstream?.remote;
  }
  if (remoteName) {
    const remotes = repository?.state.remotes.filter(remote => {
      return remote.name === remoteName;
    });
    if (remotes && remotes?.length > 0) {
      remoteUrl = remotes[0].fetchUrl;
    }
  }

  if (remoteUrl) {
    const parsedRemote = parseGitRemote(remoteUrl);
    if (parsedRemote) {
      const [schema, host, namespace, project] = parsedRemote;
      return { schema, host, namespace, project };
    }
  }

  return null;
}

export function fetchGitRemote(workspaceFolder: string): GitlabRemote | null {
  const { remoteName } = vscode.workspace.getConfiguration('gitlab');

  return fetchRemoteUrl(remoteName, workspaceFolder);
}

export function fetchGitRemotePipeline(workspaceFolder: string): GitlabRemote | null {
  const { pipelineGitRemoteName } = vscode.workspace.getConfiguration('gitlab');

  return fetchRemoteUrl(pipelineGitRemoteName, workspaceFolder);
}

function onRepositoryChange(repository: Repository) {
  const states: Map<string, string> = new Map<string, string>();

  const repoUri: string = repository.rootUri.toString();
  if (!states.has(repoUri)) {
    if (repository.state.HEAD?.name) {
      states.set(repoUri, repository.state.HEAD?.name);
    }
    gitlabOutputChannel.appendLine(`Add repo ${repoUri}`);
    repository.state.onDidChange(() => {
      const branch: string | undefined = repository.state.HEAD?.name;
      const oldBranch: string | undefined = states.get(repoUri);
      if (branch && oldBranch && branch !== oldBranch) {
        statusBar.refresh();
        sidebar.refresh('CurrentBranchDataProvider');
      }
      if (branch) {
        states.set(repoUri, branch);
      }
    });
  }
}

export function init(): void {
  gitExtension = vscode.extensions.getExtension<GitExtension>('vscode.git')?.exports;
  git = gitExtension?.getAPI(1);

  if (git) {
    git.onDidChangeState((e: APIState) => {
      if (e === 'initialized') {
        const repositories = git?.repositories;

        if (repositories) {
          repositories.forEach(repository => {
            onRepositoryChange(repository);
          });
        }
      }
    });
    git.onDidOpenRepository((repository: Repository) => {
      onRepositoryChange(repository);
    });
  }
}
