import * as vscode from 'vscode';
import { GraphQLClient, gql } from 'graphql-request';
import crossFetch from 'cross-fetch';
import { URL } from 'url';
import * as createHttpProxyAgent from 'https-proxy-agent';
import { tokenService } from '../services/token_service';
import { FetchError } from '../errors/fetch_error';

interface Node<T> {
  nodes: T[];
}

interface GraphQLProjectResult {
  project?: {
    id: string;
    snippets: Node<GraphQLSnippet>;
  };
}

export interface GraphQLSnippet {
  id: string;
  projectId: string;
  title: string;
  description: string;
  blobs: Node<GraphQLBlob>;
}

export interface GraphQLBlob {
  name: string;
  path: string;
}

const queryGetSnippets = gql`
  query GetSnippets($projectPath: ID!) {
    project(fullPath: $projectPath) {
      id
      snippets {
        nodes {
          id
          title
          description
          blobs {
            nodes {
              name
              path
            }
          }
        }
      }
    }
  }
`;

const getUserAgent = () => {
  const extension = vscode.extensions.getExtension('GitLab.gitlab-workflow');
  const packageJson: Record<string, string | undefined> = extension?.packageJSON;
  return `vs-code-gitlab-workflow/${packageJson.version}`;
};

export class GitLabNewService {
  client: GraphQLClient;

  instanceUrl: string;

  constructor(instanceUrl: string) {
    this.instanceUrl = instanceUrl;
    const endpoint = new URL('/api/graphql', this.instanceUrl).href;
    this.client = new GraphQLClient(endpoint, this.fetchOptions);
  }

  private get fetchOptions() {
    const token = tokenService.getToken(this.instanceUrl);
    const { proxy } = vscode.workspace.getConfiguration('http');
    const agent = proxy ? createHttpProxyAgent(proxy) : undefined;
    return {
      headers: {
        Authorization: `Bearer ${token}`,
        'User-Agent': getUserAgent(),
      },
      agent,
    };
  }

  async getSnippets(projectPath: string): Promise<GraphQLSnippet[]> {
    const result = await this.client.request<GraphQLProjectResult>(queryGetSnippets, {
      projectPath,
    });

    const { project } = result;
    // this can mean three things: project doesn't exist, user doesn't have access, or user credentials are wrong
    // https://gitlab.com/gitlab-org/gitlab/-/issues/270055
    if (!project) {
      throw new Error(
        `Project ${projectPath} was not found. You might not have permissions to see it.`,
      );
    }
    const snippets = project.snippets.nodes;
    // each snippet has to contain projectId so we can make REST API call for the content
    return snippets.map(sn => ({
      ...sn,
      projectId: project.id,
    }));
  }

  // TODO change this method to use GraphQL when https://gitlab.com/gitlab-org/gitlab/-/issues/260316 is done
  async getSnippetContent(snippet: GraphQLSnippet, blob: GraphQLBlob): Promise<string> {
    const projectId = snippet.projectId.replace('gid://gitlab/Project/', '');
    const snippetId = snippet.id.replace('gid://gitlab/ProjectSnippet/', '');
    const url = `${this.instanceUrl}/api/v4/projects/${projectId}/snippets/${snippetId}/files/master/${blob.path}/raw`;
    const result = await crossFetch(url, this.fetchOptions);
    if (!result.ok) {
      throw new FetchError(`Fetching snippet from ${url} failed`, result);
    }
    return result.text();
  }
}