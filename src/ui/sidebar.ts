import { GitlabDataProvider } from '../data_providers/gitlab_data_provider';

const sidebarDataProviders: GitlabDataProvider[] = [];

export const refresh = (): void => {
  sidebarDataProviders.forEach(provider => {
    provider.refresh();
  });
};

export const addDataProvider = (provider: GitlabDataProvider): void => {
  sidebarDataProviders.push(provider);
};
