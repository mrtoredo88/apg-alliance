export const WORKSPACE_MODES = {
  mobile: 'mobile',
  tablet: 'tablet',
  desktop: 'desktop',
};

export const WORKSPACE_BREAKPOINTS = {
  mobile: 0,
  tablet: 768,
  desktop: 1180,
};

export const WORKSPACE_REGIONS = {
  header: 'header',
  leftSidebar: 'leftSidebar',
  content: 'content',
  rightSidebar: 'rightSidebar',
  statusBar: 'statusBar',
  bottomBar: 'bottomBar',
  floatingPanels: 'floatingPanels',
};

export const WORKSPACE_MODULES = {
  navigation: 'navigation',
  workArea: 'workArea',
  contextPanel: 'contextPanel',
  loki: 'loki',
  notifications: 'notifications',
  quickActions: 'quickActions',
};

export const WORKSPACE_NAV_ITEMS = [
  {
    id: 'home',
    panelId: 'home',
    label: 'Главная',
    iconKey: 'home',
    regions: [WORKSPACE_REGIONS.leftSidebar, WORKSPACE_REGIONS.bottomBar],
    roles: ['user', 'partner', 'expert', 'admin', 'owner'],
  },
  {
    id: 'offers',
    panelId: 'offers',
    label: 'Партнёры',
    iconKey: 'partners',
    regions: [WORKSPACE_REGIONS.leftSidebar, WORKSPACE_REGIONS.bottomBar],
    roles: ['user', 'partner', 'expert', 'admin', 'owner'],
  },
  {
    id: 'scan',
    panelId: null,
    label: 'Скан',
    iconKey: 'scan',
    isPrimaryAction: true,
    regions: [WORKSPACE_REGIONS.bottomBar, WORKSPACE_REGIONS.floatingPanels],
    roles: ['user', 'partner', 'expert', 'admin', 'owner'],
  },
  {
    id: 'experts',
    panelId: 'experts',
    label: 'Эксперты',
    iconKey: 'experts',
    regions: [WORKSPACE_REGIONS.leftSidebar, WORKSPACE_REGIONS.bottomBar],
    roles: ['user', 'partner', 'expert', 'admin', 'owner'],
  },
  {
    id: 'profile',
    panelId: 'profile',
    label: 'Профиль',
    iconKey: 'profile',
    regions: [WORKSPACE_REGIONS.leftSidebar, WORKSPACE_REGIONS.bottomBar],
    roles: ['user', 'partner', 'expert', 'admin', 'owner'],
  },
  {
    id: 'cabinet',
    panelId: 'cabinet',
    label: 'Кабинет',
    iconKey: 'cabinet',
    regions: [WORKSPACE_REGIONS.leftSidebar],
    roles: ['partner', 'expert', 'admin', 'owner'],
  },
  {
    id: 'business-hub',
    panelId: 'business-hub',
    label: 'Мой бизнес',
    iconKey: 'business',
    regions: [WORKSPACE_REGIONS.leftSidebar],
    roles: ['partner', 'expert', 'admin', 'owner'],
  },
  {
    id: 'loki',
    panelId: 'loki',
    label: 'Локи',
    iconKey: 'loki',
    regions: [WORKSPACE_REGIONS.rightSidebar, WORKSPACE_REGIONS.floatingPanels],
    roles: ['user', 'partner', 'expert', 'admin', 'owner'],
  },
];

const DEFAULT_ENABLED_MODULES = {
  [WORKSPACE_MODULES.navigation]: true,
  [WORKSPACE_MODULES.workArea]: true,
  [WORKSPACE_MODULES.contextPanel]: false,
  [WORKSPACE_MODULES.loki]: true,
  [WORKSPACE_MODULES.notifications]: true,
  [WORKSPACE_MODULES.quickActions]: true,
};

export function getWorkspaceMode(width = 0) {
  const safeWidth = Number.isFinite(Number(width)) ? Number(width) : 0;
  if (safeWidth >= WORKSPACE_BREAKPOINTS.desktop) return WORKSPACE_MODES.desktop;
  if (safeWidth >= WORKSPACE_BREAKPOINTS.tablet) return WORKSPACE_MODES.tablet;
  return WORKSPACE_MODES.mobile;
}

export function getWorkspaceModeFromWindow(targetWindow = globalThis.window) {
  if (!targetWindow) return WORKSPACE_MODES.mobile;
  return getWorkspaceMode(targetWindow.innerWidth || 0);
}

export function normalizeWorkspaceModules(modules = {}) {
  return { ...DEFAULT_ENABLED_MODULES, ...modules };
}

export function buildWorkspaceLayout({ width, mode, modules, contextOpen = false, pinnedContext = false } = {}) {
  const resolvedMode = mode || getWorkspaceMode(width);
  const enabled = normalizeWorkspaceModules(modules);
  const desktop = resolvedMode === WORKSPACE_MODES.desktop;
  const tablet = resolvedMode === WORKSPACE_MODES.tablet;
  const contextEnabled = enabled[WORKSPACE_MODULES.contextPanel] || enabled[WORKSPACE_MODULES.loki] || contextOpen;
  const rightSidebarVisible = desktop && contextEnabled && (contextOpen || pinnedContext);

  const regions = {
    [WORKSPACE_REGIONS.header]: {
      id: WORKSPACE_REGIONS.header,
      visible: true,
      mode: resolvedMode,
      role: 'persistent',
    },
    [WORKSPACE_REGIONS.leftSidebar]: {
      id: WORKSPACE_REGIONS.leftSidebar,
      visible: desktop && enabled[WORKSPACE_MODULES.navigation],
      compact: tablet,
      mode: resolvedMode,
      role: 'navigation',
    },
    [WORKSPACE_REGIONS.content]: {
      id: WORKSPACE_REGIONS.content,
      visible: true,
      mode: resolvedMode,
      role: 'workArea',
    },
    [WORKSPACE_REGIONS.rightSidebar]: {
      id: WORKSPACE_REGIONS.rightSidebar,
      visible: rightSidebarVisible,
      overlay: !desktop,
      mode: resolvedMode,
      role: 'context',
    },
    [WORKSPACE_REGIONS.statusBar]: {
      id: WORKSPACE_REGIONS.statusBar,
      visible: desktop,
      mode: resolvedMode,
      role: 'status',
    },
    [WORKSPACE_REGIONS.bottomBar]: {
      id: WORKSPACE_REGIONS.bottomBar,
      visible: !desktop && enabled[WORKSPACE_MODULES.navigation],
      mode: resolvedMode,
      role: 'navigation',
    },
    [WORKSPACE_REGIONS.floatingPanels]: {
      id: WORKSPACE_REGIONS.floatingPanels,
      visible: enabled[WORKSPACE_MODULES.quickActions] || contextEnabled,
      overlay: !desktop || !rightSidebarVisible,
      mode: resolvedMode,
      role: 'floating',
    },
  };

  return {
    mode: resolvedMode,
    modules: enabled,
    regions,
    contextPresentation: rightSidebarVisible ? 'docked' : 'overlay',
    density: desktop ? 'comfortable' : tablet ? 'balanced' : 'compact',
    columns: desktop ? 12 : tablet ? 8 : 4,
    maxContentWidth: desktop ? 1440 : tablet ? 960 : 480,
  };
}

export function getWorkspaceNavigation({ mode = WORKSPACE_MODES.mobile, role = 'user', items = WORKSPACE_NAV_ITEMS, includeSecondary = false } = {}) {
  const placement = mode === WORKSPACE_MODES.desktop ? 'sidebar' : mode === WORKSPACE_MODES.tablet ? 'rail' : 'bottom';
  const primaryRegion = placement === 'sidebar' || placement === 'rail' ? WORKSPACE_REGIONS.leftSidebar : WORKSPACE_REGIONS.bottomBar;
  const visibleItems = items.filter(item => {
    const roleAllowed = !item.roles || item.roles.includes(role) || role === 'owner';
    const regionAllowed = item.regions?.includes(primaryRegion) || (includeSecondary && item.regions?.length);
    return roleAllowed && regionAllowed;
  });
  const primary = visibleItems.filter(item => item.id !== 'loki' || includeSecondary);
  const secondary = items.filter(item => {
    if (!item.regions?.includes(WORKSPACE_REGIONS.rightSidebar) && !item.regions?.includes(WORKSPACE_REGIONS.floatingPanels)) return false;
    return !item.roles || item.roles.includes(role) || role === 'owner';
  });

  return {
    mode,
    placement,
    primary,
    secondary,
    ids: primary.map(item => item.id),
  };
}

export function createWorkspaceCache({ ttl = 30000, max = 60 } = {}) {
  const store = new Map();
  return {
    get(key) {
      const hit = store.get(key);
      if (!hit) return undefined;
      if (Date.now() - hit.ts > ttl) {
        store.delete(key);
        return undefined;
      }
      return hit.value;
    },
    set(key, value) {
      if (store.size >= max) {
        const firstKey = store.keys().next().value;
        if (firstKey !== undefined) store.delete(firstKey);
      }
      store.set(key, { value, ts: Date.now() });
      return value;
    },
    clear() {
      store.clear();
    },
    size() {
      return store.size;
    },
  };
}

export function makeVirtualWindow({ total = 0, scrollTop = 0, itemHeight = 72, viewportHeight = 640, overscan = 4 } = {}) {
  const safeTotal = Math.max(0, Number(total) || 0);
  const safeItemHeight = Math.max(1, Number(itemHeight) || 72);
  const start = Math.max(0, Math.floor((Number(scrollTop) || 0) / safeItemHeight) - overscan);
  const visibleCount = Math.ceil((Number(viewportHeight) || 640) / safeItemHeight) + overscan * 2;
  const end = Math.min(safeTotal, start + visibleCount);
  return {
    start,
    end,
    count: Math.max(0, end - start),
    offsetTop: start * safeItemHeight,
    totalHeight: safeTotal * safeItemHeight,
  };
}

export function lazyWorkspaceModule(loader) {
  return {
    kind: 'workspace-lazy-module',
    load: loader,
  };
}
