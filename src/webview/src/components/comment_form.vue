<script lang="ts">
import { Component, Vue, Prop } from 'vue-property-decorator';
import App from '../app.vue';
import { Issuable, GitlabCustomQueryParametersTypes } from '../../../types/gitlab';
import { WebViewMessage } from '../../../types/webview';

@Component({
  name: 'CommentForm',
})
export default class CommentForm extends Vue {
  isSaving = false;

  isFailed = false;

  command = 'saveNote';

  note = '';

  @Prop({ required: true })
  issuable!: Issuable;

  get buttonTitle(): string {
    return this.isSaving ? 'Saving...' : 'Comment';
  }

  getNoteType(): GitlabCustomQueryParametersTypes {
    return this.issuable.sha
      ? GitlabCustomQueryParametersTypes.mergeRequests
      : GitlabCustomQueryParametersTypes.issues;
  }

  addComment(): void {
    const { issuable, note, command } = this;

    this.isSaving = true;
    this.isFailed = false;
    const noteType: GitlabCustomQueryParametersTypes = this.getNoteType();
    App.vsCode.postMessage({ command, issuable, note, noteType });
  }

  mounted(): void {
    window.addEventListener('message', event => {
      const { data }: { data: WebViewMessage } = event;
      if (data.type === 'noteSaved') {
        if (data.status !== false) {
          this.note = '';
        } else {
          this.isFailed = true;
        }

        this.isSaving = false;
      }
    });
  }
}
</script>

<template>
  <div class="main-comment-form">
    <textarea v-model="note" placeholder="Write a comment..."></textarea>
    <button :disabled="isSaving || !note.length" @click="addComment">
      {{ buttonTitle }}
    </button>
    <span v-if="isFailed">Failed to save your comment. Please try again.</span>
  </div>
</template>

<style lang="scss">
.main-comment-form {
  margin: 20px 0 30px 0;

  textarea {
    width: 100%;
    min-height: 140px;
    border-radius: 4px;
    padding: 16px;
    font-size: 13px;
    box-sizing: border-box;
    border: 1px solid var(--vscode-input-border);
    resize: vertical;
    margin-bottom: 8px;

    &:focus {
      outline: 0;
      border-color: var(--vscode-focusBorder);
      box-shadow: 0 0 0 0.2rem var(--vscode-widget-shadow);
    }
  }

  button {
    background-color: var(--vscode-button-background);
    color: var(--vscode-button-foreground);
    border-color: var(--vscode-button-background);
    border-radius: 3px;
    padding: 6px 10px;
    font-size: 14px;
    outline: 0;
    margin-right: 10px;
    cursor: pointer;

    &:disabled {
      opacity: 0.9;
      cursor: default;
    }

    &:hover {
      background-color: var(--vscode-button-hoverBackground);
      border-color: var(--vscode-button-hoverBackground);
    }
  }
}
</style>
