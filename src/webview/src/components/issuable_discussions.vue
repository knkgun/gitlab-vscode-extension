<script lang="ts">
/* eslint-disable class-methods-use-this */
import { Component, Vue, Prop } from 'vue-property-decorator';
import Note from './note.vue';
import Discussion from './discussion.vue';
import SystemNote from './system_note.vue';
import LabelNote from './label_note.vue';
import { DiscussionElement, Noteable } from '../../../types/gitlab';

@Component({
  name: 'IssuableDiscussion',
  components: {
    Note,
    Discussion,
    SystemNote,
    LabelNote,
  },
})
export default class IssuableDiscussion extends Vue {
  @Prop({ required: true })
  discussions!: DiscussionElement[];

  getComponentName(discussion: DiscussionElement): typeof Note | typeof Discussion {
    if (discussion && discussion.individual_note) {
      const { notes } = discussion;
      if (notes && notes.length > 0 && notes[0].system) {
        return SystemNote;
      }

      return Note;
    }
    if (discussion.label) {
      return LabelNote;
    }

    return Discussion;
  }

  getComponentData(discussion: DiscussionElement): DiscussionElement | Noteable | null {
    if (discussion.label) {
      return discussion;
    }
    if (discussion.individual_note) {
      const { notes } = discussion;
      if (notes && notes.length > 0 && notes[0]) {
        return notes[0];
      }
      return null;
    }
    return discussion;
  }
}
</script>

<template>
  <ul class="issuable-discussions">
    <component
      :is="getComponentName(discussion)"
      v-for="discussion in discussions"
      :key="discussion.id"
      :noteable="getComponentData(discussion)"
    />
  </ul>
</template>

<style lang="scss">
* {
  box-sizing: border-box;
}

.issuable-discussions {
  position: relative;
  display: block;
  list-style: none;
  margin: 0;
  padding: 0;
  position: relative;
  text-align: left;

  &::before {
    content: '';
    border-left: 2px solid;
    border-color: var(--vscode-panel-border);
    position: absolute;
    left: 36px;
    top: 0px;
    bottom: 0;
    width: 2px;
    box-sizing: border-box;
    z-index: 4px;
  }
}
</style>
