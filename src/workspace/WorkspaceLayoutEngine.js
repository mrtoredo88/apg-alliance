export const WORKSPACE_Z = {
  base: 0,
  content: 1,
  sticky: 10,
  sidebar: 15,
  header: 20,
  drawer: 50,
  popover: 70,
  modal: 80,
};

export const WORKSPACE_LAYOUT = {
  pagePadding: 18,
  gap: 18,
  headerHeight: 72,
  statusHeight: 42,
  expandedSidebar: 232,
  collapsedSidebar: 76,
  aiWide: 390,
  aiNarrow: 354,
  aiMin: 330,
  drawerBelow: 1180,
  forceCollapsedBelow: 1366,
  wideAiFrom: 1512,
  minReadableContent: 430,
};

export function getDesktopWorkspaceLayoutPlan(width = 1440, height = 900, sidebarCollapsed = false) {
  const aiAsDrawer = width < WORKSPACE_LAYOUT.drawerBelow;
  const forceCollapsedSidebar = width < WORKSPACE_LAYOUT.forceCollapsedBelow;
  const effectiveSidebarCollapsed = forceCollapsedSidebar || sidebarCollapsed;
  const sidebarWidth = effectiveSidebarCollapsed ? WORKSPACE_LAYOUT.collapsedSidebar : WORKSPACE_LAYOUT.expandedSidebar;
  const aiPanelWidth = width >= WORKSPACE_LAYOUT.wideAiFrom ? WORKSPACE_LAYOUT.aiWide : WORKSPACE_LAYOUT.aiNarrow;
  const horizontalPadding = WORKSPACE_LAYOUT.pagePadding * 2;
  const gapCount = aiAsDrawer ? 1 : 2;
  const reserved = horizontalPadding + sidebarWidth + (WORKSPACE_LAYOUT.gap * gapCount) + (aiAsDrawer ? 0 : aiPanelWidth);
  const contentWidth = Math.max(0, width - reserved);
  const workAreaHeight = Math.max(
    0,
    height - horizontalPadding - WORKSPACE_LAYOUT.headerHeight - WORKSPACE_LAYOUT.statusHeight - (WORKSPACE_LAYOUT.gap * 2)
  );

  return {
    aiAsDrawer,
    forceCollapsedSidebar,
    effectiveSidebarCollapsed,
    sidebarWidth,
    aiPanelWidth,
    contentWidth,
    workAreaHeight,
    hasHorizontalOverflow: reserved + contentWidth > width,
    contentReadable: contentWidth >= WORKSPACE_LAYOUT.minReadableContent,
    gridTemplateColumns: aiAsDrawer
      ? `${sidebarWidth}px minmax(0, 1fr)`
      : `${sidebarWidth}px minmax(0, 1fr) minmax(${WORKSPACE_LAYOUT.aiMin}px, ${aiPanelWidth}px)`,
  };
}
