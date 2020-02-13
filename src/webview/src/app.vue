<script lang="ts">
import { Component, Vue } from 'vue-property-decorator';
import IssuableDetails from './components/issuable_details.vue';
import IssuableDiscussions from './components/issuable_discussions.vue';
import CommentForm from './components/comment_form.vue';
import { WebViewMessage } from '../../types/webview';
import { Issuable, DiscussionElement } from '../../types/gitlab';

interface Vscode {
  postMessage(message: WebViewMessage): void;
}

declare function acquireVsCodeApi(): Vscode;

@Component({
  name: 'App',
  components: {
    IssuableDetails,
    IssuableDiscussions,
    CommentForm,
  },
  data: {
    isLoading: false,
    issuable: {},
    discussions: [],
  },
})
export default class App extends Vue {
  isLoading = false;

  issuable: Issuable = {};

  discussions: DiscussionElement[] = [];

  public static vsCode: Vscode = acquireVsCodeApi();

  created(): void {
    this.isLoading = true;

    window.addEventListener('message', (event: MessageEvent) => {
      const { data }: { data: WebViewMessage } = event;
      if (data.type === 'issuableFetch') {
        this.issuable = event.data.issuable;
        this.discussions = event.data.discussions;
        this.isLoading = false;
      }
    });

    App.vsCode.postMessage({
      command: 'appReady',
    });
  }
}
</script>

<template>
  <div id="app">
    <p v-if="isLoading" class="loading">
      Fetching issuable details and discussions. This may take a while.
      <br />
      If it doesn't work, please
      <a href="https://gitlab.com/fatihacet/gitlab-vscode-extension/issues/new">create an issue.</a>
    </p>
    <template v-else>
      <issuable-details :issuable="issuable" />
      <issuable-discussions :discussions="discussions" />
      <comment-form :issuable="issuable" />
    </template>
  </div>
</template>

<style lang="scss">
.issuable-details .state {
  color: var(--vscode-foreground);
}

.capitalize {
  text-transform: capitalize;
}

.code {
  padding: 2px 4px;
  color: var(--vscode-editor-foreground);
  background-color: var(--vscode-textCodeBlock-background);
  border-radius: 4px;
  border-color: var(--vscode-textBlockQuote-border);
  font-family: var(--vscode-editor-font-family);
  font-weight: var(--vscode-editor-font-weight);
  font-size: var(--vscode-editor-font-size);
}

.idiff.deletion {
  background: var(--vscode-diffEditor-removedTextBackground);
  border-color: var(--vscode-diffEditor-removedTextBorder);
}

.idiff.addition {
  background: var(--vscode-diffEditor-insertedTextBackground);
  border-color: var(--vscode-diffEditor-insertedTextBorder);
}

#app {
  margin-bottom: 600px; // to give editor scroll past end effect

  .loading {
    text-align: center;
    font-size: 14px;
    line-height: 30px;
  }
}
</style>
