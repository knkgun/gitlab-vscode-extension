import { GitlabDataProvider } from '../data_providers/gitlab_data_provider';

const sidebarDataProviders: GitlabDataProvider[] = [];

export const refresh = (type: string | null = null): void => {
  sidebarDataProviders.forEach(provider => {
    if (type === null || provider.constructor.name === type) {
      provider.refresh();
    }
  });
};

export const addDataProvider = (provider: GitlabDataProvider): void => {
  sidebarDataProviders.push(provider);
};
