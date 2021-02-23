import { getRestIdFromGraphQLId } from '../utils/get_rest_id_from_graphql_id';

interface GqlGroup {
  id: string;
}
export interface GqlProject {
  id: string;
  name: string;
  description: string;
  httpUrlToRepo: string;
  sshUrlToRepo: string;
  fullPath: string;
  webUrl: string;
  group?: GqlGroup;
}

export class GitLabProject {
  constructor(private readonly gqlProject: GqlProject) {}

  get gqlId(): string {
    return this.gqlProject.id;
  }

  get restId(): number {
    return getRestIdFromGraphQLId(this.gqlProject.id);
  }

  get name(): string {
    return this.gqlProject.name;
  }

  get description(): string {
    return this.gqlProject.description;
  }

  get httpUrlToRepo(): string {
    return this.gqlProject.httpUrlToRepo;
  }

  get sshUrlToRepo(): string {
    return this.gqlProject.sshUrlToRepo;
  }

  get fullPath(): string {
    return this.gqlProject.fullPath;
  }

  get webUrl(): string {
    return this.gqlProject.webUrl;
  }

  get groupRestId(): number | undefined {
    return this.gqlProject.group && getRestIdFromGraphQLId(this.gqlProject.group.id);
  }
}
