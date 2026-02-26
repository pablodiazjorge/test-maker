import { Component, EventEmitter, Input, Output } from '@angular/core';
import { TopicGroup } from '../../../core/data/quiz.data';

type GroupSelectionState = 'none' | 'partial' | 'all';

@Component({
  selector: 'app-topic-group-selector',
  standalone: true,
  templateUrl: './topic-group-selector.component.html',
})
export class TopicGroupSelectorComponent {
  @Input({ required: true }) groups: readonly TopicGroup[] = [];
  @Input() selectedTopicIds: readonly string[] = [];

  @Output() selectedTopicIdsChange = new EventEmitter<string[]>();

  private readonly expandedGroupIds = new Set<string>();

  isGroupExpanded(groupId: string): boolean {
    return this.expandedGroupIds.has(groupId);
  }

  toggleGroupExpanded(groupId: string, event?: Event): void {
    event?.stopPropagation();
    if (this.expandedGroupIds.has(groupId)) {
      this.expandedGroupIds.delete(groupId);
      return;
    }
    this.expandedGroupIds.add(groupId);
  }

  toggleGroupSelection(group: TopicGroup, event?: Event): void {
    event?.stopPropagation();
    const selectedTopicIds = new Set(this.selectedTopicIds);
    const allSelected = group.topicIds.every((topicId) => selectedTopicIds.has(topicId));

    for (const topicId of group.topicIds) {
      if (allSelected) {
        selectedTopicIds.delete(topicId);
      } else {
        selectedTopicIds.add(topicId);
      }
    }

    this.emitSelection(selectedTopicIds);
  }

  toggleChildTopic(topicId: string, event?: Event): void {
    event?.stopPropagation();
    const selectedTopicIds = new Set(this.selectedTopicIds);
    if (selectedTopicIds.has(topicId)) {
      selectedTopicIds.delete(topicId);
    } else {
      selectedTopicIds.add(topicId);
    }

    this.emitSelection(selectedTopicIds);
  }

  isChildTopicSelected(topicId: string): boolean {
    return this.selectedTopicIds.includes(topicId);
  }

  groupCardClasses(group: TopicGroup): string {
    if (this.groupSelectionState(group) === 'all') {
      return 'bg-white dark:bg-card-dark rounded-xl border border-primary dark:border-primary ring-1 ring-primary/20 shadow-md shadow-primary/5';
    }
    return 'bg-white dark:bg-card-dark rounded-xl border border-slate-200 dark:border-border-dark shadow-sm';
  }

  groupNameClasses(group: TopicGroup): string {
    if (this.groupSelectionState(group) === 'all') {
      return 'block text-sm font-semibold text-primary';
    }
    return 'block text-sm font-semibold text-slate-900 dark:text-white';
  }

  groupIndicatorClasses(group: TopicGroup): string {
    const state = this.groupSelectionState(group);
    if (state === 'all') {
      return 'w-5 h-5 shrink-0 aspect-square rounded-full border-2 border-primary flex items-center justify-center bg-primary/10';
    }
    if (state === 'partial') {
      return 'w-5 h-5 shrink-0 aspect-square rounded-full border-2 border-primary/70 flex items-center justify-center bg-primary/10';
    }
    return 'w-5 h-5 shrink-0 aspect-square rounded-full border-2 border-slate-300 dark:border-slate-600 flex items-center justify-center';
  }

  showGroupIndicatorDot(group: TopicGroup): boolean {
    return this.groupSelectionState(group) === 'all';
  }

  showGroupIndicatorDash(group: TopicGroup): boolean {
    return this.groupSelectionState(group) === 'partial';
  }

  childButtonClasses(topicId: string): string {
    if (this.isChildTopicSelected(topicId)) {
      return 'w-full flex items-center justify-between gap-3 p-3 rounded-lg border border-primary/70 bg-primary/5 text-left';
    }
    return 'w-full flex items-center justify-between gap-3 p-3 rounded-lg border border-slate-200 dark:border-border-dark bg-white dark:bg-card-dark text-left';
  }

  childNameClasses(topicId: string): string {
    if (this.isChildTopicSelected(topicId)) {
      return 'block text-sm font-medium text-primary';
    }
    return 'block text-sm font-medium text-slate-900 dark:text-white';
  }

  childIndicatorClasses(topicId: string): string {
    if (this.isChildTopicSelected(topicId)) {
      return 'w-4 h-4 shrink-0 rounded-full border border-primary bg-primary/80';
    }
    return 'w-4 h-4 shrink-0 rounded-full border border-slate-300 dark:border-slate-600';
  }

  groupSelectionSummary(group: TopicGroup): string {
    const total = group.topicIds.length;
    const selected = group.topicIds.filter((topicId) => this.selectedTopicIds.includes(topicId)).length;
    return `${selected}/${total}`;
  }

  private groupSelectionState(group: TopicGroup): GroupSelectionState {
    const selectedCount = group.topicIds.filter((topicId) => this.selectedTopicIds.includes(topicId)).length;
    if (selectedCount === 0) {
      return 'none';
    }
    if (selectedCount === group.topicIds.length) {
      return 'all';
    }
    return 'partial';
  }

  private emitSelection(selectedTopicSet: Set<string>): void {
    const orderedTopicIds = this.groups.flatMap((group) => group.topicIds);
    const dedupedOrderedTopicIds = [...new Set(orderedTopicIds)];
    const selectedTopicIds = dedupedOrderedTopicIds.filter((topicId) => selectedTopicSet.has(topicId));
    this.selectedTopicIdsChange.emit(selectedTopicIds);
  }
}
