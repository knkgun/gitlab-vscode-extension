import * as vscode from 'vscode';
import * as execa from 'execa';
import * as url from 'url';
import { gitlabOutputChannel } from '../extension';

export interface GitlabRemote {
  schema: string;
  host: string;
  namespace: string;
  project: string;
}

const currentInstanceUrl = () => vscode.workspace.getConfiguration('gitlab').instanceUrl;

async function fetch(cmd: string, workspaceFolder: string): Promise<string | null> {
  const [git, ...args] = cmd.split(' ');
  let currentWorkspaceFolder = workspaceFolder;

  if (currentWorkspaceFolder == null) {
    currentWorkspaceFolder = '';
  }
  let output: string | null = null;
  try {
    output = await execa.stdout(git, args, {
      cwd: currentWorkspaceFolder,
    });
  } catch (ex) {
    gitlabOutputChannel.appendLine(
      `ERROR: Exception executing git command: ${ex.name} - ${ex.message}\n${ex.stack}`,
    );
  }

  return output;
}

export async function fetchBranchName(workspaceFolder: string): Promise<string | null> {
  const cmd = 'git rev-parse --abbrev-ref HEAD';
  const output = await fetch(cmd, workspaceFolder);

  return output;
}

/**
 * Fetches remote tracking branch name of current branch.
 * This should be used in link openers.
 *
 * Fixes #1 where local branch name is renamed and doesn't exists on remote but
 * local branch still tracks another branch on remote.
 */
export async function fetchTrackingBranchName(workspaceFolder: string): Promise<string | null> {
  const branchName = await fetchBranchName(workspaceFolder);

  try {
    const cmd = `git config --get branch.${branchName}.merge`;
    const ref = await fetch(cmd, workspaceFolder);

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

export async function fetchLastCommitId(workspaceFolder: string): Promise<string | null> {
  const cmd = 'git log --format=%H -n 1';
  const output: string | null = await fetch(cmd, workspaceFolder);

  return output;
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

async function fetchRemoteUrl(name: string, workspaceFolder: string): Promise<GitlabRemote | null> {
  let remoteUrl: string | null = null;
  let remoteName: string | null = name;

  try {
    const branchName: string | null = await fetchBranchName(workspaceFolder);
    if (!remoteName) {
      remoteName = await fetch(`git config --get branch.${branchName}.remote`, workspaceFolder);
    }
    remoteUrl = await fetch(`git ls-remote --get-url ${remoteName}`, workspaceFolder);
  } catch (err) {
    try {
      remoteUrl = await fetch('git ls-remote --get-url', workspaceFolder);
    } catch (e) {
      const remote: string | null = await fetch('git remote', workspaceFolder);

      remoteUrl = await fetch(`git ls-remote --get-url ${remote}`, workspaceFolder);
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

export async function fetchGitRemote(workspaceFolder: string): Promise<GitlabRemote | null> {
  const { remoteName } = vscode.workspace.getConfiguration('gitlab');

  return fetchRemoteUrl(remoteName, workspaceFolder);
}

export async function fetchGitRemotePipeline(
  workspaceFolder: string,
): Promise<GitlabRemote | null> {
  const { pipelineGitRemoteName } = vscode.workspace.getConfiguration('gitlab');

  return fetchRemoteUrl(pipelineGitRemoteName, workspaceFolder);
}
