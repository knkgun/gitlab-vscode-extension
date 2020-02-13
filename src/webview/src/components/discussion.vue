<script lang="ts">
import { Component, Vue, Prop } from 'vue-property-decorator';
import Note from './note.vue';
import Icon from './icon.vue';
import { DiscussionElement, Noteable } from '../../../types/gitlab';

@Component({
  name: 'Discussion',
  components: {
    Note,
    Icon,
  },
})
export default class Discussion extends Vue {
  isRepliesVisible = true;

  @Prop({ required: true })
  noteable!: DiscussionElement;

  get initialDiscussion(): Noteable | null {
    if (this.noteable?.notes && this.noteable.notes.length > 0) {
      return this.noteable.notes[0];
    }
    return null;
  }

  get replies(): Noteable[] | null {
    if (this.noteable?.notes && this.noteable.notes.length > 0) {
      return this.noteable.notes.slice(1);
    }
    return null;
  }

  get hasReplies(): boolean {
    return this.replies ? this.replies.length > 0 : false;
  }

  get toggleRepliesText(): string {
    return this.isRepliesVisible ? 'Collapse replies' : 'Expand replies';
  }

  toggleReplies(): void {
    this.isRepliesVisible = !this.isRepliesVisible;
  }
}
</script>

<template>
  <div :class="{ collapsed: !isRepliesVisible }" class="discussion">
    <note :noteable="initialDiscussion" />
    <div v-if="hasReplies" class="toggle-widget" @click="toggleReplies">
      <span class="chevron">
        <icon v-if="isRepliesVisible" :icon="'chevronDown'" />
        <icon v-if="!isRepliesVisible" :icon="'chevronRight'" />
      </span>
      {{ toggleRepliesText }}
    </div>
    <template v-if="isRepliesVisible">
      <note v-for="note in replies" :key="note.id" :noteable="note" />
    </template>
  </div>
</template>

<style lang="scss">
.discussion {
  position: relative;
  margin-top: 16px;
  border: 1px solid;
  border-color: var(--vscode-panel-border);
  border-radius: 4px;
  background: var(--vscode-editor-background);

  &.collapsed {
    .toggle-widget {
      border-radius: 0 0 4px 4px;
    }
  }

  > .note {
    border: none;
    margin: 0;
  }

  .toggle-widget {
    background: var(--vscode-activityBar-dropBackground);
    padding: 8px 16px;
    cursor: pointer;
    user-select: none;
    position: relative;
  }

  .chevron svg {
    width: 10px;
    height: 10px;
  }
}
</style>
