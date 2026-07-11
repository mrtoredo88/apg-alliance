export const WORKSPACE_WIDGETS = [
  {
    id: 'welcome',
    title: 'Добро пожаловать',
    size: 'wide',
    locked: true,
  },
  {
    id: 'today',
    title: 'Сегодня',
    size: 'medium',
  },
  {
    id: 'attention',
    title: 'Требует внимания',
    size: 'medium',
  },
  {
    id: 'latest-news',
    title: 'Последние новости',
    size: 'medium',
  },
  {
    id: 'upcoming-events',
    title: 'Ближайшие мероприятия',
    size: 'medium',
  },
  {
    id: 'recent-actions',
    title: 'Последние действия',
    size: 'medium',
  },
  {
    id: 'stats',
    title: 'Статистика',
    size: 'medium',
  },
  {
    id: 'business',
    title: 'Бизнес',
    size: 'medium',
  },
  {
    id: 'profile-status',
    title: 'Статус профиля',
    size: 'medium',
  },
  {
    id: 'tasks',
    title: 'Задачи',
    size: 'medium',
  },
  {
    id: 'quick-actions',
    title: 'Быстрые действия',
    size: 'wide',
  },
];

export function getWorkspaceWidgetLayout(savedLayout = []) {
  const savedIds = Array.isArray(savedLayout) ? savedLayout.map(item => item?.id || item).filter(Boolean) : [];
  const ordered = [
    ...savedIds.map(id => WORKSPACE_WIDGETS.find(widget => widget.id === id)).filter(Boolean),
    ...WORKSPACE_WIDGETS.filter(widget => !savedIds.includes(widget.id)),
  ];
  return ordered.map((widget, index) => ({
    ...widget,
    order: index,
    draggable: widget.locked !== true,
    dragHandleId: `workspace-widget-${widget.id}`,
  }));
}

export function moveWorkspaceWidget(layout, sourceId, targetId) {
  const items = getWorkspaceWidgetLayout(layout);
  const sourceIndex = items.findIndex(item => item.id === sourceId);
  const targetIndex = items.findIndex(item => item.id === targetId);
  if (sourceIndex < 0 || targetIndex < 0 || items[sourceIndex]?.locked) return items;
  const next = [...items];
  const [source] = next.splice(sourceIndex, 1);
  next.splice(targetIndex, 0, source);
  return next.map((item, index) => ({ ...item, order: index }));
}
