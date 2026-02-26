import { describe, expect, it, vi } from 'vitest';
import { TopicGroup } from '../../../core/data/quiz.data';
import { TopicGroupSelectorComponent } from './topic-group-selector.component';

describe('TopicGroupSelectorComponent', () => {
  const groups: TopicGroup[] = [
    {
      id: 'tema-3',
      name: 'Tema 3',
      description: 'Con hijos',
      hasChildren: true,
      topicIds: ['topic-1', 'topic-2'],
      children: [
        { id: 'topic-1', name: 'Test 1', description: 'd1' },
        { id: 'topic-2', name: 'Test 2', description: 'd2' },
      ],
    },
    {
      id: 'tema-prueba',
      name: 'Tema Prueba: Sin hijos',
      description: 'Sin hijos',
      hasChildren: false,
      topicIds: ['topic-3'],
      children: [{ id: 'topic-3', name: 'Standalone', description: 'd3' }],
    },
  ];

  function createComponent(): TopicGroupSelectorComponent {
    const component = new TopicGroupSelectorComponent();
    component.groups = groups;
    return component;
  }

  it('selects and deselects all child topics when parent is toggled', () => {
    const component = createComponent();
    const emitSpy = vi.fn();
    component.selectedTopicIdsChange.subscribe(emitSpy);

    component.selectedTopicIds = [];
    component.toggleGroupSelection(groups[0]);
    expect(emitSpy).toHaveBeenLastCalledWith(['topic-1', 'topic-2']);

    component.selectedTopicIds = ['topic-1', 'topic-2'];
    component.toggleGroupSelection(groups[0]);
    expect(emitSpy).toHaveBeenLastCalledWith([]);
  });

  it('allows granular child selection for grouped parent', () => {
    const component = createComponent();
    const emitSpy = vi.fn();
    component.selectedTopicIdsChange.subscribe(emitSpy);

    component.selectedTopicIds = ['topic-1', 'topic-2'];
    component.toggleChildTopic('topic-2');
    expect(emitSpy).toHaveBeenLastCalledWith(['topic-1']);
  });

  it('toggles standalone topic when parent has no children', () => {
    const component = createComponent();
    const emitSpy = vi.fn();
    component.selectedTopicIdsChange.subscribe(emitSpy);

    component.selectedTopicIds = [];
    component.toggleGroupSelection(groups[1]);
    expect(emitSpy).toHaveBeenLastCalledWith(['topic-3']);
  });

  it('tracks expanded state independently for each group', () => {
    const component = createComponent();

    expect(component.isGroupExpanded('tema-3')).toBe(false);
    component.toggleGroupExpanded('tema-3');
    expect(component.isGroupExpanded('tema-3')).toBe(true);
    expect(component.isGroupExpanded('tema-prueba')).toBe(false);
  });
});
