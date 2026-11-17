/**
 * Browser half of the personal-digital-team-panel plugin.
 *
 * Registers one first-level sidebar entry ("数字团队") and its matching main
 * panel. The panel reads the team manifest from the host route and renders the
 * roster grouped by role family, with search, filters, and a detail card.
 */

window.__ModuleLoader__.load({
  id: 'personal-digital-team-panel',
  factory: (require) => {
    const module = { exports: {} }
    const exports = module.exports
    const React = require('react')
    const { useCallback, useEffect, useMemo, useRef, useState } = React
    const h = React.createElement

    const NS = 'personal-digital-team-panel'
    const PANEL_ID = 'personal-digital-team'
    const API_PATH = '/api/personal-digital-team/team'
    const LIVE_PATH = '/api/personal-digital-team/live'
    const STYLE_ID = 'personal-digital-team-panel/styles'
    const BRAND = '#6857e8'

    const zh = {
      panel: '数字团队',
      kicker: 'PERSONAL DIGITAL TEAM',
      title: '个人数字团队',
      subtitle:
        '一支按长期职责组织的数字员工队伍：默认由数字总经理接单并路由，职责明确时直接唤起对应岗位。',
      members: '成员',
      groups: '分组',
      online: '在线',
      todayTasks: '今日任务',
      running: '进行中',
      waiting: '待确认',
      todayTokens: '今日 Token',
      sevenDays: '7日',
      times: '次',
      tokens: 'Token',
      activeOnly: '仅活跃',
      sort: '排序',
      sortDefault: '默认顺序',
      sortUsage: '按调用量',
      sortRecent: '按最近活跃',
      statusRunning: '执行中',
      statusWaiting: '待确认',
      statusIdle: '空闲',
      liveData: '运行数据',
      currentTask: '当前任务',
      openTaskBoard: '打开任务看板',
      openRuns: '查看运行记录',
      openTaskBoardFailed: '无法打开任务看板，请检查浏览器或应用设置',
      sevenDayTasks: '7日任务',
      sevenDayTokens: '7日 Token',
      lastActive: '最近活跃',
      model: '最新模型',
      coveragePartial: 'Token 部分采集',
      coverageNone: 'Token 未采集',
      liveOn: '实时数据已连接',
      liveOff: '实时数据未连接',
      liveLoading: '读取实时数据…',
      liveUnavailable: '实时数据暂不可用',
      noActiveTitle: '当前没有执行中的岗位',
      noActiveHint: '任务开始后可在这里看到实时状态。',
      search: '搜索岗位、职责或技能',
      clearSearch: '清空搜索',
      all: '全部',
      refresh: '刷新',
      refreshing: '刷新中…',
      loading: '正在读取团队清单…',
      errorTitle: '团队清单读取失败',
      errorHint:
        '请确认 agents/manifest.json 存在，并检查 DSH 是否已加载本插件。',
      retry: '重试',
      emptyTitle: '没有匹配的岗位',
      emptyHint: '换一个关键词，或清除分组筛选。',
      clearFilters: '清除筛选',
      role: '岗位使命',
      scope: '负责范围',
      trigger: '触发条件',
      skills: '能力与 Skill',
      required: '必需能力',
      optional: '可选能力',
      platforms: '适用平台',
      joinedAt: '加入时间',
      status: '状态',
      group: '分组',
      routing: '协作路由',
      routingEmpty: '暂无专属路由，默认由数字总经理接单。',
      collaborators: '协作岗位',
      call: '复制调用指令',
      path: '复制档案路径',
      copied: '已复制',
      close: '关闭详情',
      overviewKicker: 'HOW IT WORKS',
      overviewTitle: '先找总经理，再找专家',
      overviewBody:
        '未指定岗位的任务交给数字总经理拆解与整合；职责明确时直接唤起对应岗位，减少来回确认。',
      step1: '默认入口：数字总经理负责目标澄清、路由与结果整合。',
      step2: '指定岗位：用 $ 加岗位目录名直接唤起，例如 $software-engineer-agent。',
      step3: '跨岗位任务：按路由矩阵确定一个主责岗位，其余岗位提供专业意见。',
      defaultCall: '复制默认入口',
      sourceLive: '实时清单',
      sourceSnapshot: '内置快照',
      sourceHint: '数据来自 agents/manifest.json',
      routes: '条协作路由',
      skillCount: '项能力',
      details: '岗位档案',
      updated: '更新于',
    }

    const en = {
      panel: 'Digital team',
      kicker: 'PERSONAL DIGITAL TEAM',
      title: 'Personal digital team',
      subtitle:
        'A roster organized by long-lived responsibilities. The main agent routes incoming work; call a specialist directly when the role is clear.',
      members: 'members',
      groups: 'groups',
      online: 'online',
      todayTasks: 'Tasks today',
      running: 'Running',
      waiting: 'Waiting',
      todayTokens: 'Tokens today',
      sevenDays: '7d',
      times: 'runs',
      tokens: 'tokens',
      activeOnly: 'Active only',
      sort: 'Sort',
      sortDefault: 'Default',
      sortUsage: 'By usage',
      sortRecent: 'By recency',
      statusRunning: 'Running',
      statusWaiting: 'Waiting',
      statusIdle: 'Idle',
      liveData: 'Runtime',
      currentTask: 'Current task',
      openTaskBoard: 'Open task board',
      openRuns: 'Open run log',
      openTaskBoardFailed: 'Could not open the task board',
      sevenDayTasks: '7-day tasks',
      sevenDayTokens: '7-day tokens',
      lastActive: 'Last active',
      model: 'Latest model',
      coveragePartial: 'Token coverage is partial',
      coverageNone: 'No token data',
      liveOn: 'Live data connected',
      liveOff: 'Live data unavailable',
      liveLoading: 'Loading live data…',
      liveUnavailable: 'Live data is unavailable',
      noActiveTitle: 'No active roles',
      noActiveHint: 'Live status appears here once a task starts.',
      search: 'Search role, duty, or skill',
      clearSearch: 'Clear search',
      all: 'All',
      refresh: 'Refresh',
      refreshing: 'Refreshing…',
      loading: 'Loading the team roster…',
      errorTitle: 'Could not load the team roster',
      errorHint:
        'Check that agents/manifest.json exists and that DSH loaded this plugin.',
      retry: 'Retry',
      emptyTitle: 'No matching roles',
      emptyHint: 'Try another keyword or clear the group filter.',
      clearFilters: 'Clear filters',
      role: 'Mission',
      scope: 'Scope',
      trigger: 'Trigger',
      skills: 'Skills & capabilities',
      required: 'Required',
      optional: 'Optional',
      platforms: 'Platforms',
      joinedAt: 'Joined',
      status: 'Status',
      group: 'Group',
      routing: 'Collaboration routes',
      routingEmpty:
        'No dedicated route; the main agent takes this work by default.',
      collaborators: 'Collaborators',
      call: 'Copy call command',
      path: 'Copy profile path',
      copied: 'Copied',
      close: 'Close details',
      overviewKicker: 'HOW IT WORKS',
      overviewTitle: 'Start with the main agent',
      overviewBody:
        'Unscoped work goes to the main agent for clarification, routing, and integration. When the role is clear, call the specialist directly.',
      step1:
        'Default entry: the main agent clarifies the goal, routes the work, and integrates the result.',
      step2:
        'Direct call: use $ plus the role directory name, for example $software-engineer-agent.',
      step3:
        'Cross-role work: the routing matrix picks one owner; the others contribute specialist input.',
      defaultCall: 'Copy default entry',
      sourceLive: 'Live manifest',
      sourceSnapshot: 'Bundled snapshot',
      sourceHint: 'Read from agents/manifest.json',
      routes: 'collaboration routes',
      skillCount: 'skills',
      details: 'Role profile',
      updated: 'Updated',
    }

    function accent(color) {
      return { '--pdt-accent': color || BRAND }
    }

    function formatTime(value) {
      if (typeof value !== 'string' || value === '') return ''
      const date = new Date(value)
      if (Number.isNaN(date.getTime())) return ''
      try {
        return new Intl.DateTimeFormat(undefined, {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }).format(date)
      } catch {
        return date.toISOString().slice(0, 16).replace('T', ' ')
      }
    }

    function formatTokens(value) {
      const number = Number(value)
      if (!Number.isFinite(number) || number <= 0) return '0'
      if (number >= 1_000_000_000) return `${(number / 1_000_000_000).toFixed(1)}B`
      if (number >= 1_000_000) return `${(number / 1_000_000).toFixed(1)}M`
      if (number >= 1_000) return `${(number / 1_000).toFixed(1)}k`
      return String(Math.round(number))
    }

    async function copyText(text) {
      try {
        if (navigator.clipboard !== undefined) {
          await navigator.clipboard.writeText(text)
          return true
        }
      } catch {
        // Fall through to the selection-based fallback.
      }
      try {
        const area = document.createElement('textarea')
        area.value = text
        area.setAttribute('readonly', '')
        area.style.position = 'fixed'
        area.style.top = '-1000px'
        area.style.opacity = '0'
        document.body.appendChild(area)
        area.select()
        const copied = document.execCommand('copy')
        document.body.removeChild(area)
        return copied
      } catch {
        return false
      }
    }

    function injectStyles() {
      if (typeof document === 'undefined') return
      if (document.querySelector(`style[data-plugin-css="${STYLE_ID}"]`)) return
      const style = document.createElement('style')
      style.dataset.plugin = 'personal-digital-team-panel'
      style.dataset.pluginCss = STYLE_ID
      style.textContent = `
.pdt-page {
  --pdt-bg: var(--dsw-alias-bg-base, #fafafa);
  --pdt-surface: var(--dsw-alias-bg-layer-1, #ffffff);
  --pdt-surface-2: var(--dsw-alias-bg-layer-2, #f3f3f5);
  --pdt-text: var(--dsw-alias-label-primary, #17171b);
  --pdt-muted: var(--dsw-alias-label-secondary, #66666e);
  --pdt-faint: var(--dsw-alias-label-tertiary, var(--dsw-alias-label-secondary, #9a9aa2));
  --pdt-line: var(--dsw-alias-border-l2, rgba(0, 0, 0, 0.1));
  --pdt-line-soft: var(--dsw-alias-border-l1, rgba(0, 0, 0, 0.06));
  --pdt-hover: var(--dsw-alias-interactive-bg-hover, rgba(0, 0, 0, 0.04));
  --pdt-brand: var(--dsw-alias-brand-primary, ${BRAND});
  --pdt-ok: var(--dsw-alias-state-success-primary, #1f9d63);
  --pdt-code: var(--ds-font-family-code, ui-monospace, SFMono-Regular, Menlo, monospace);
  height: 100%;
  min-height: 100%;
  overflow: hidden;
  background: var(--dsw-specific-sidebar-fill, var(--pdt-bg));
  color: var(--pdt-text);
  font-size: 13px;
  line-height: 1.5;
  container: pdt / inline-size;
}
.pdt-shell {
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  max-width: none;
  margin: 0;
  padding: calc(22px + var(--dsh-frame-top-clearance, 0px)) clamp(16px, 2cqi, 32px) 16px;
}
.pdt-hero {
  display: flex;
  flex: none;
  align-items: flex-end;
  justify-content: space-between;
  gap: 28px;
  padding-bottom: 20px;
  border-bottom: 1px solid var(--pdt-line-soft);
}
.pdt-kicker {
  margin: 0 0 7px;
  color: var(--pdt-faint);
  font-size: 10px;
  font-weight: 650;
  letter-spacing: 0.18em;
}
.pdt-title {
  margin: 0 0 7px;
  font-size: 27px;
  font-weight: 600;
  line-height: 1.2;
  letter-spacing: -0.02em;
}
.pdt-subtitle {
  max-width: 640px;
  margin: 0;
  color: var(--pdt-muted);
  font-size: 12.5px;
  line-height: 1.65;
}
.pdt-stats {
  display: flex;
  flex: none;
  flex-wrap: wrap;
  gap: 8px 22px;
  padding-bottom: 2px;
}
.pdt-stat {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 48px;
}
.pdt-stat + .pdt-stat {
  padding-left: 22px;
  border-left: 1px solid var(--pdt-line-soft);
}
.pdt-stat strong {
  font-size: 21px;
  font-weight: 600;
  line-height: 1.15;
  font-variant-numeric: tabular-nums;
}
.pdt-stat span {
  color: var(--pdt-faint);
  font-size: 10.5px;
  letter-spacing: 0.04em;
}
.pdt-toolbar {
  display: flex;
  flex: none;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px 14px;
  margin-top: 18px;
}
.pdt-search {
  position: relative;
  display: flex;
  flex: 0 1 280px;
  align-items: center;
  min-width: 190px;
}
.pdt-search svg {
  position: absolute;
  left: 10px;
  color: var(--pdt-faint);
  pointer-events: none;
}
.pdt-search input {
  box-sizing: border-box;
  width: 100%;
  padding: 8px 30px 8px 32px;
  border: 1px solid var(--pdt-line);
  border-radius: 9px;
  outline: none;
  background: var(--pdt-surface);
  color: var(--pdt-text);
  font: inherit;
  font-size: 12.5px;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}
.pdt-search input::placeholder {
  color: var(--pdt-faint);
}
.pdt-search input:focus {
  border-color: color-mix(in srgb, var(--pdt-brand) 60%, var(--pdt-line));
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--pdt-brand) 12%, transparent);
}
.pdt-search-clear {
  position: absolute;
  right: 5px;
  display: grid;
  width: 22px;
  height: 22px;
  place-items: center;
  padding: 0;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--pdt-faint);
  font: inherit;
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
}
.pdt-search-clear:hover {
  background: var(--pdt-hover);
  color: var(--pdt-text);
}
.pdt-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  min-width: 0;
}
.pdt-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border: 1px solid var(--pdt-line);
  border-radius: 999px;
  background: transparent;
  color: var(--pdt-muted);
  font: inherit;
  font-size: 11.5px;
  line-height: 1.5;
  white-space: nowrap;
  cursor: pointer;
  transition: border-color 0.15s ease, background-color 0.15s ease, color 0.15s ease;
}
.pdt-chip:hover {
  border-color: color-mix(in srgb, var(--pdt-text) 25%, var(--pdt-line));
  color: var(--pdt-text);
}
.pdt-chip[aria-pressed='true'] {
  border-color: color-mix(in srgb, var(--pdt-brand) 55%, var(--pdt-line));
  background: color-mix(in srgb, var(--pdt-brand) 14%, transparent);
  color: var(--pdt-text);
}
.pdt-chip-count {
  opacity: 0.6;
  font-size: 10.5px;
  font-variant-numeric: tabular-nums;
}
.pdt-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-left: auto;
}
.pdt-ghost {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 10px;
  border: 1px solid var(--pdt-line);
  border-radius: 8px;
  background: var(--pdt-surface);
  color: var(--pdt-muted);
  font: inherit;
  font-size: 11.5px;
  cursor: pointer;
  transition: border-color 0.15s ease, color 0.15s ease, background-color 0.15s ease;
}
.pdt-ghost:hover:enabled {
  border-color: color-mix(in srgb, var(--pdt-text) 25%, var(--pdt-line));
  background: var(--pdt-hover);
  color: var(--pdt-text);
}
.pdt-ghost:disabled {
  opacity: 0.5;
  cursor: default;
}
.pdt-layout {
  display: grid;
  flex: 1;
  grid-template-columns: minmax(0, 1fr) clamp(300px, 24cqi, 420px);
  align-items: stretch;
  gap: 20px;
  min-height: 0;
  margin-top: 18px;
}
.pdt-groups {
  min-width: 0;
  min-height: 0;
  padding-right: 4px;
  padding-bottom: 18px;
  overflow-y: auto;
  scrollbar-width: thin;
}
.pdt-group + .pdt-group {
  margin-top: 30px;
}
.pdt-group-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 12px;
}
.pdt-group-dot {
  flex: none;
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: var(--pdt-accent, var(--pdt-brand));
}
.pdt-group-title {
  margin: 0;
  font-size: 16px;
  font-weight: 650;
  letter-spacing: 0.01em;
}
.pdt-group-count {
  padding: 0 7px;
  border-radius: 999px;
  background: var(--pdt-surface-2);
  color: var(--pdt-faint);
  font-size: 11.5px;
  line-height: 1.7;
  font-variant-numeric: tabular-nums;
}
.pdt-group-line {
  flex: 1;
  height: 1px;
  background: var(--pdt-line-soft);
}
.pdt-cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 10px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.pdt-card {
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  overflow: hidden;
  border: 1px solid var(--pdt-line);
  border-radius: 14px;
  background: var(--pdt-surface);
  color: inherit;
  transition: transform 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease, background-color 0.15s ease;
}
.pdt-card:hover {
  transform: translateY(-1px);
  border-color: color-mix(in srgb, var(--pdt-accent) 45%, var(--pdt-line));
  box-shadow: 0 3px 12px color-mix(in srgb, var(--pdt-text) 8%, transparent);
}
.pdt-card[data-selected='true'] {
  border-color: color-mix(in srgb, var(--pdt-accent) 70%, var(--pdt-line));
  background: color-mix(in srgb, var(--pdt-accent) 5%, var(--pdt-surface));
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--pdt-accent) 16%, transparent);
}
.pdt-card-main {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 10px;
  width: 100%;
  padding: 16px 16px 14px;
  border: 0;
  border-radius: inherit;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}
.pdt-task {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0 12px 12px;
  padding: 7px 9px;
  border: 1px solid var(--pdt-line-soft);
  border-radius: 8px;
  background: var(--pdt-surface-2);
  color: var(--pdt-text);
  font: inherit;
  font-size: 11.5px;
  line-height: 1.4;
  text-align: left;
  cursor: pointer;
}
.pdt-task:hover {
  border-color: color-mix(in srgb, var(--pdt-accent) 55%, var(--pdt-line));
  background: color-mix(in srgb, var(--pdt-accent) 8%, var(--pdt-surface-2));
}
.pdt-task-mark {
  flex: none;
  color: color-mix(in srgb, var(--pdt-accent) 80%, var(--pdt-text));
  font-size: 9px;
}
.pdt-task-title {
  overflow: hidden;
  flex: 1;
  min-width: 0;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.pdt-task-open {
  flex: none;
  color: var(--pdt-faint);
  font-size: 10px;
}
.pdt-active-task {
  margin-top: 10px;
}
.pdt-active-title {
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
}
.pdt-detail-board {
  margin-top: 10px;
}
.pdt-card-top {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  min-width: 0;
}
.pdt-avatar {
  display: grid;
  flex: none;
  place-items: center;
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: color-mix(in srgb, var(--pdt-accent) 13%, transparent);
  color: var(--pdt-accent);
  font-size: 17px;
  line-height: 1;
}
.pdt-avatar-lg {
  width: 40px;
  height: 40px;
  border-radius: 11px;
  font-size: 19px;
}
.pdt-card-heading {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}
.pdt-name {
  overflow: hidden;
  font-size: 15px;
  font-weight: 600;
  line-height: 1.35;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.pdt-en {
  overflow: hidden;
  color: var(--pdt-faint);
  font-size: 11.5px;
  line-height: 1.35;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.pdt-status {
  flex: none;
  width: 10px;
  height: 10px;
  margin-top: 6px;
  border-radius: 50%;
  background: var(--pdt-faint);
}
.pdt-status-running {
  background: var(--pdt-ok);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--pdt-ok) 18%, transparent);
  animation: pdt-pulse 1.8s ease-in-out infinite;
}
.pdt-status-waiting {
  background: var(--dsw-alias-state-warn-primary, #d97706);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--dsw-alias-state-warn-primary, #d97706) 16%, transparent);
}
.pdt-status-idle {
  background: color-mix(in srgb, var(--pdt-faint) 60%, transparent);
}
.pdt-role {
  display: -webkit-box;
  overflow: hidden;
  margin: 0;
  color: var(--pdt-muted);
  font-size: 13px;
  line-height: 1.55;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  min-height: 40px;
}
.pdt-card-foot {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: auto;
  padding-top: 10px;
  border-top: 1px solid var(--pdt-line-soft);
  color: var(--pdt-faint);
  font-size: 11.5px;
}
.pdt-card-usage {
  overflow: hidden;
  min-width: 0;
  color: var(--pdt-faint);
  font-size: 11px;
  line-height: 1.4;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.pdt-usage-sep {
  margin: 0 4px;
  opacity: 0.6;
}
.pdt-card-arrow {
  flex: none;
  margin-left: auto;
  color: var(--pdt-faint);
  font-size: 14px;
  line-height: 1;
}
.pdt-side {
  position: static;
  align-self: stretch;
  min-width: 0;
  height: 100%;
  max-height: none;
  overflow-y: auto;
  scrollbar-width: thin;
}
.pdt-panel {
  box-sizing: border-box;
  padding: 18px;
  border: 1px solid var(--pdt-line);
  border-radius: 14px;
  background: var(--pdt-surface);
}
.pdt-intro {
  display: flex;
  flex-direction: column;
  background:
    radial-gradient(120% 130% at 100% 0%, color-mix(in srgb, var(--pdt-accent) 13%, transparent), transparent 62%),
    var(--pdt-surface);
  border-color: color-mix(in srgb, var(--pdt-accent) 24%, var(--pdt-line));
}
.pdt-intro .pdt-kicker {
  color: color-mix(in srgb, var(--pdt-accent) 78%, var(--pdt-text));
}
.pdt-intro-title {
  margin: 0 0 7px;
  font-size: 17px;
  font-weight: 600;
  letter-spacing: -0.01em;
}
.pdt-intro-body {
  margin: 0 0 13px;
  color: var(--pdt-muted);
  font-size: 12px;
  line-height: 1.65;
}
.pdt-intro .pdt-meta {
  margin-top: auto;
}
.pdt-code-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 8px 7px 11px;
  border: 1px solid var(--pdt-line-soft);
  border-radius: 9px;
  background: var(--pdt-surface-2);
}
.pdt-code {
  overflow: hidden;
  flex: 1;
  color: var(--pdt-text);
  font-family: var(--pdt-code);
  font-size: 11.5px;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.pdt-copy {
  flex: none;
  padding: 4px 9px;
  border: 1px solid color-mix(in srgb, var(--pdt-accent) 45%, var(--pdt-line));
  border-radius: 7px;
  background: var(--pdt-surface);
  color: color-mix(in srgb, var(--pdt-accent) 85%, var(--pdt-text));
  font: inherit;
  font-size: 10.5px;
  white-space: nowrap;
  cursor: pointer;
}
.pdt-copy:hover {
  background: color-mix(in srgb, var(--pdt-accent) 8%, var(--pdt-surface));
}
.pdt-steps {
  display: flex;
  flex-direction: column;
  gap: 9px;
  margin: 14px 0 0;
  padding: 0;
  list-style: none;
}
.pdt-step {
  display: flex;
  gap: 9px;
  color: var(--pdt-muted);
  font-size: 11.5px;
  line-height: 1.55;
}
.pdt-step-n {
  display: grid;
  flex: none;
  place-items: center;
  width: 16px;
  height: 16px;
  margin-top: 1px;
  border-radius: 50%;
  background: color-mix(in srgb, var(--pdt-accent) 14%, transparent);
  color: color-mix(in srgb, var(--pdt-accent) 88%, var(--pdt-text));
  font-size: 9.5px;
  font-weight: 650;
}
.pdt-intro-routes {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
  margin-top: 15px;
  padding-top: 13px;
  border-top: 1px solid var(--pdt-line-soft);
}
.pdt-route-list {
  display: flex;
  flex-direction: column;
  gap: 7px;
  overflow-y: auto;
  min-height: 0;
  margin: 0;
  padding: 0;
  list-style: none;
  scrollbar-width: thin;
}
.pdt-route-item {
  display: flex;
  flex-direction: column;
  gap: 1px;
  padding-left: 8px;
  border-left: 2px solid color-mix(in srgb, var(--pdt-accent) 40%, var(--pdt-line));
}
.pdt-route-item-scenario {
  display: -webkit-box;
  overflow: hidden;
  color: var(--pdt-text);
  font-size: 11px;
  line-height: 1.45;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}
.pdt-route-item-owner {
  color: var(--pdt-faint);
  font-size: 10px;
  line-height: 1.4;
}
.pdt-sort {
  box-sizing: border-box;
  height: 26px;
  padding: 0 6px;
  border: 1px solid var(--pdt-line);
  border-radius: 7px;
  background: var(--pdt-surface);
  color: var(--pdt-muted);
  font: inherit;
  font-size: 11px;
  cursor: pointer;
}
.pdt-sort:focus-visible {
  outline: 2px solid color-mix(in srgb, var(--pdt-brand) 75%, transparent);
  outline-offset: 1px;
}
.pdt-toggle[aria-pressed='true'] {
  border-color: var(--pdt-brand);
  background: color-mix(in srgb, var(--pdt-brand) 20%, transparent);
  color: var(--pdt-text);
  font-weight: 600;
}
.pdt-live-note {
  margin: 6px 0 0;
  color: var(--pdt-faint);
  font-size: 10px;
  line-height: 1.5;
}
.pdt-shell > .pdt-meta {
  flex: none;
  margin: 8px 0 0;
}
.pdt-meta {
  margin: 13px 0 0;
  padding-top: 11px;
  border-top: 1px solid var(--pdt-line-soft);
  color: var(--pdt-faint);
  font-size: 10.5px;
  line-height: 1.55;
}
.pdt-detail-head {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}
.pdt-detail-heading {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.pdt-detail-name {
  margin: 0;
  font-size: 15.5px;
  font-weight: 650;
  line-height: 1.3;
  letter-spacing: -0.01em;
}
.pdt-detail-en {
  color: var(--pdt-faint);
  font-size: 10.5px;
}
.pdt-group-chip {
  display: inline-flex;
  align-self: flex-start;
  align-items: center;
  gap: 4px;
  margin-top: 3px;
  padding: 1px 7px;
  border: 1px solid var(--pdt-line);
  border-radius: 999px;
  color: var(--pdt-muted);
  font-size: 10px;
  line-height: 1.6;
}
.pdt-close {
  display: grid;
  flex: none;
  place-items: center;
  width: 24px;
  height: 24px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: var(--pdt-faint);
  font: inherit;
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
}
.pdt-close:hover {
  background: var(--pdt-hover);
  color: var(--pdt-text);
}
.pdt-detail-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 13px;
}
.pdt-detail-actions .pdt-copy {
  padding: 5px 10px;
  font-size: 11px;
}
.pdt-detail-actions .pdt-ghost {
  padding: 4px 9px;
  font-size: 10.5px;
}
.pdt-section {
  margin-top: 15px;
  padding-top: 13px;
  border-top: 1px solid var(--pdt-line-soft);
}
.pdt-label {
  margin: 0 0 5px;
  color: var(--pdt-faint);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.pdt-text {
  margin: 0;
  color: var(--pdt-muted);
  font-size: 12px;
  line-height: 1.65;
}
.pdt-meta-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px 12px;
}
.pdt-meta-item {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}
.pdt-meta-key {
  color: var(--pdt-faint);
  font-size: 10px;
}
.pdt-meta-value {
  overflow: hidden;
  color: var(--pdt-text);
  font-size: 11.5px;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.pdt-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.pdt-tag {
  padding: 1px 7px;
  border: 1px solid var(--pdt-line-soft);
  border-radius: 6px;
  background: var(--pdt-surface-2);
  color: var(--pdt-muted);
  font-size: 10.5px;
  line-height: 1.7;
}
.pdt-route + .pdt-route {
  margin-top: 9px;
}
.pdt-route {
  padding-left: 9px;
  border-left: 2px solid color-mix(in srgb, var(--pdt-accent) 55%, var(--pdt-line));
}
.pdt-route-title {
  margin: 0;
  font-size: 11.5px;
  font-weight: 600;
  line-height: 1.5;
}
.pdt-route-sub {
  margin: 2px 0 0;
  color: var(--pdt-muted);
  font-size: 11px;
  line-height: 1.55;
}
.pdt-route-handoff {
  margin: 4px 0 0;
  color: var(--pdt-faint);
  font-size: 10.5px;
  line-height: 1.55;
}
.pdt-path {
  overflow-wrap: anywhere;
  color: var(--pdt-faint);
  font-family: var(--pdt-code);
  font-size: 10px;
  line-height: 1.5;
}
.pdt-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 56px 20px;
  border: 1px dashed var(--pdt-line);
  border-radius: 14px;
  text-align: center;
}
.pdt-state-title {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
}
.pdt-state-text {
  max-width: 420px;
  margin: 0;
  color: var(--pdt-muted);
  font-size: 12px;
  line-height: 1.6;
}
.pdt-state code {
  font-family: var(--pdt-code);
  font-size: 11px;
}
.pdt-skeleton {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 10px;
}
.pdt-skel {
  height: 128px;
  border-radius: 12px;
  background: linear-gradient(100deg, var(--pdt-surface-2) 30%, color-mix(in srgb, var(--pdt-text) 7%, var(--pdt-surface-2)) 50%, var(--pdt-surface-2) 70%);
  background-size: 220% 100%;
  animation: pdt-shimmer 1.4s ease-in-out infinite;
}
.pdt-backdrop {
  display: none;
}
.pdt-toast {
  position: fixed;
  bottom: 18px;
  left: 50%;
  z-index: 80;
  padding: 6px 12px;
  border-radius: 999px;
  background: var(--pdt-text);
  color: var(--dsw-alias-label-primary-foreground, #ffffff);
  font-size: 11.5px;
  transform: translateX(-50%);
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.22);
}
.pdt-card-main:focus-visible,
.pdt-task:focus-visible,
.pdt-chip:focus-visible,
.pdt-ghost:focus-visible,
.pdt-copy:focus-visible,
.pdt-close:focus-visible,
.pdt-search input:focus-visible,
.pdt-search-clear:focus-visible {
  outline: 2px solid color-mix(in srgb, var(--pdt-brand) 75%, transparent);
  outline-offset: 1px;
}
@container pdt (max-width: 980px) {
  .pdt-hero {
    align-items: flex-start;
    flex-direction: column;
    gap: 16px;
  }
  .pdt-stats {
    gap: 18px;
  }
  .pdt-stat + .pdt-stat {
    padding-left: 18px;
  }
  .pdt-layout {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: minmax(0, 1fr);
  }
  .pdt-side {
    display: none;
  }
  .pdt-side-open {
    display: block;
    position: fixed;
    top: auto;
    right: 12px;
    bottom: 12px;
    left: 12px;
    z-index: 71;
    height: auto;
    max-height: 72vh;
    overflow-y: auto;
    border-radius: 16px;
    box-shadow: 0 20px 70px rgba(0, 0, 0, 0.32);
    animation: pdt-rise 0.18s ease-out;
  }
  .pdt-backdrop {
    display: block;
    position: fixed;
    inset: 0;
    z-index: 70;
    background: rgba(0, 0, 0, 0.34);
  }
  .pdt-actions {
    margin-left: 0;
  }
}
@container pdt (max-width: 720px) {
  .pdt-title {
    font-size: 24px;
  }
  .pdt-search {
    flex: 1 1 200px;
  }
  .pdt-actions {
    order: 2;
    margin-left: 0;
  }
  .pdt-chips {
    order: 3;
    flex-basis: 100%;
  }
}
@media (prefers-reduced-motion: reduce) {
  .pdt-card,
  .pdt-chip,
  .pdt-ghost,
  .pdt-search input,
  .pdt-side-open,
  .pdt-skel,
  .pdt-status-running {
    transition: none;
    animation: none;
  }
}
@keyframes pdt-pulse {
  0%, 100% { box-shadow: 0 0 0 3px color-mix(in srgb, var(--pdt-ok) 12%, transparent); }
  50% { box-shadow: 0 0 0 5px color-mix(in srgb, var(--pdt-ok) 4%, transparent); }
}
@keyframes pdt-shimmer {
  from { background-position: 120% 0; }
  to { background-position: -120% 0; }
}
@keyframes pdt-rise {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}
`
      document.head.appendChild(style)
    }

    function TeamIcon({ size = 18 }) {
      return h(
        'svg',
        {
          width: size,
          height: size,
          viewBox: '0 0 24 24',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.6,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          'aria-hidden': 'true',
          focusable: 'false',
        },
        h('circle', { cx: 12, cy: 8.2, r: 2.5 }),
        h('path', { d: 'M7.4 19.2c0-2.5 2.1-4.4 4.6-4.4s4.6 1.9 4.6 4.4' }),
        h('circle', { cx: 5.4, cy: 10.8, r: 1.8 }),
        h('path', { d: 'M2.6 18.4c0-1.6 1.3-2.9 2.9-2.9' }),
        h('circle', { cx: 18.6, cy: 10.8, r: 1.8 }),
        h('path', { d: 'M21.4 18.4c0-1.6-1.3-2.9-2.9-2.9' })
      )
    }

    function SearchIcon() {
      return h(
        'svg',
        {
          width: 14,
          height: 14,
          viewBox: '0 0 24 24',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.8,
          strokeLinecap: 'round',
          'aria-hidden': 'true',
          focusable: 'false',
        },
        h('circle', { cx: 11, cy: 11, r: 6.5 }),
        h('path', { d: 'm16 16 4.5 4.5' })
      )
    }

    function useTeamData(initialData, reloadKey) {
      const [state, setState] = useState(() =>
        initialData
          ? { status: 'ready', data: initialData, error: null }
          : { status: 'loading', data: null, error: null }
      )

      useEffect(() => {
        let alive = true
        const controller = new AbortController()
        setState((previous) =>
          previous.data === null
            ? { ...previous, status: 'loading', error: null }
            : { ...previous, status: 'refreshing', error: null }
        )
        fetch(API_PATH, {
          signal: controller.signal,
          credentials: 'same-origin',
          headers: { accept: 'application/json' },
        })
          .then(async (response) => {
            let body = null
            try {
              body = await response.json()
            } catch {
              body = null
            }
            if (!response.ok || body === null || body.ok !== true) {
              const message =
                body?.error?.message || `HTTP ${response.status}`
              throw new Error(message)
            }
            return body.value
          })
          .then((value) => {
            if (!alive) return
            setState({ status: 'ready', data: value, error: null })
          })
          .catch((error) => {
            if (!alive || error?.name === 'AbortError') return
            setState((previous) => ({
              status: 'error',
              data: previous.data,
              error: error instanceof Error ? error.message : String(error),
            }))
          })
        return () => {
          alive = false
          controller.abort()
        }
      }, [reloadKey])

      return state
    }

    function useLiveData(reloadKey) {
      const [state, setState] = useState({
        status: 'loading',
        data: null,
        error: null,
      })

      useEffect(() => {
        let alive = true
        let sequence = 0
        const controller = new AbortController()

        const load = async (force) => {
          const current = ++sequence
          try {
            const response = await fetch(
              force ? `${LIVE_PATH}?refresh=1` : LIVE_PATH,
              {
                signal: controller.signal,
                credentials: 'same-origin',
                headers: { accept: 'application/json' },
              }
            )
            let body = null
            try {
              body = await response.json()
            } catch {
              body = null
            }
            if (!response.ok || body === null || body.ok !== true) {
              throw new Error(body?.error?.message || `HTTP ${response.status}`)
            }
            if (!alive || current !== sequence) return
            setState({ status: 'ready', data: body.value, error: null })
          } catch (error) {
            if (!alive || error?.name === 'AbortError') return
            if (current !== sequence) return
            setState((previous) => ({
              status: previous.data === null ? 'error' : 'stale',
              data: previous.data,
              error: error instanceof Error ? error.message : String(error),
            }))
          }
        }

        load(true)
        const timer = window.setInterval(() => {
          if (document.visibilityState === 'visible') load(false)
        }, 20_000)
        const onVisibility = () => {
          if (document.visibilityState === 'visible') load(false)
        }
        document.addEventListener('visibilitychange', onVisibility)

        return () => {
          alive = false
          window.clearInterval(timer)
          document.removeEventListener('visibilitychange', onVisibility)
          controller.abort()
        }
      }, [reloadKey])

      return state
    }

    function AgentCard({
      agent,
      selected,
      onSelect,
      onOpenRuns,
      liveAgent,
      liveReady,
      t,
    }) {
      const skills = Array.isArray(agent.skills) ? agent.skills : []
      const status =
        liveAgent !== null && liveAgent !== undefined && liveAgent.runningCount > 0
          ? { key: 'running', label: t('statusRunning') }
          : liveAgent !== null &&
              liveAgent !== undefined &&
              liveAgent.waitingCount > 0
            ? { key: 'waiting', label: t('statusWaiting') }
            : liveReady
              ? { key: 'idle', label: t('statusIdle') }
              : null
      const coverage = liveAgent?.weekTokenCoverage
      const tokenText =
        liveAgent === undefined || coverage === 'NONE'
          ? '—'
          : formatTokens(liveAgent.weekTotalTokens)
      const tokenSuffix = coverage === 'PARTIAL' ? '*' : ''
      const activeTask = liveAgent?.activeTask

      return h(
        'li',
        null,
        h(
          'article',
          {
            className: 'pdt-card',
            style: accent(agent.color),
            'data-selected': selected ? 'true' : 'false',
          },
          h(
            'button',
            {
              type: 'button',
              className: 'pdt-card-main',
              'aria-pressed': selected,
              onClick: () => onSelect(selected ? null : agent.slug),
            },
            h(
              'span',
              { className: 'pdt-card-top' },
              h(
                'span',
                { className: 'pdt-avatar', 'aria-hidden': 'true' },
                agent.icon || '◆'
              ),
              h(
                'span',
                { className: 'pdt-card-heading' },
                h('span', { className: 'pdt-name', title: agent.name }, agent.name),
                h(
                  'span',
                  { className: 'pdt-en', title: agent.en || agent.slug },
                  agent.en || agent.slug
                )
              ),
              status === null
                ? null
                : h('span', {
                    className: `pdt-status pdt-status-${status.key}`,
                    title: status.label,
                    'aria-label': status.label,
                  })
            ),
            h(
              'span',
              {
                className: 'pdt-role',
                title: agent.role || agent.scope,
              },
              agent.role || agent.scope
            ),
            h(
              'span',
              { className: 'pdt-card-foot' },
              liveAgent === undefined
                ? h('span', null, `${skills.length} ${t('skillCount')}`)
                : h(
                    'span',
                    {
                      className: 'pdt-card-usage',
                      title:
                        coverage === 'PARTIAL'
                          ? t('coveragePartial')
                          : coverage === 'NONE'
                            ? t('coverageNone')
                            : t('sevenDayTokens'),
                    },
                    `${tokenText}${tokenSuffix} tok`,
                    h('span', { className: 'pdt-usage-sep' }, '·'),
                    `${t('sevenDays')} ${liveAgent.weekTaskCount} ${t('times')}`
                  ),
              h('span', { className: 'pdt-card-arrow', 'aria-hidden': 'true' }, '→')
            )
          ),
          activeTask === null || activeTask === undefined
            ? null
            : h(
                'button',
                {
                  type: 'button',
                  className: 'pdt-task',
                  onClick: (event) => {
                    event.stopPropagation()
                    onOpenRuns(agent.slug)
                  },
                  title: `${activeTask.title} · ${t('openRuns')}`,
                },
                h('span', { className: 'pdt-task-mark', 'aria-hidden': 'true' }, '▸'),
                h('span', { className: 'pdt-task-title' }, activeTask.title),
                h('span', { className: 'pdt-task-open', 'aria-hidden': 'true' }, '↗')
              )
        )
      )
    }

    function TagList({ items }) {
      if (!Array.isArray(items) || items.length === 0) return null
      return h(
        'ul',
        { className: 'pdt-tags' },
        items.map((item, index) =>
          h('li', { className: 'pdt-tag', key: `${item}-${index}` }, item)
        )
      )
    }

    function DetailPanel({
      agent,
      agents,
      routes,
      liveAgent,
      live,
      onOpenRuns,
      onOpenTaskBoard,
      onClose,
      onCopy,
      copied,
      t,
    }) {
      const names = useMemo(() => {
        const map = new Map()
        for (const item of agents) map.set(item.slug, item.name)
        return map
      }, [agents])
      const related = routes.filter((route) => route.primary === agent.slug)
      const requirements = agent.capabilityRequirements || {}
      const required = requirements.requiredSkills || []
      const optional = requirements.optionalSkills || []
      const platforms = requirements.platforms || []
      const meta = [
        [t('group'), agent.group],
        [t('joinedAt'), agent.joinedAt],
      ].filter(([, value]) => value)
      const liveRows =
        liveAgent === undefined || liveAgent === null
          ? []
          : [
              [
                t('sevenDayTasks'),
                `${liveAgent.weekTaskCount} ${t('times')}`,
              ],
              [
                t('sevenDayTokens'),
                liveAgent.weekTokenCoverage === 'NONE'
                  ? t('coverageNone')
                  : `${formatTokens(liveAgent.weekTotalTokens)}${liveAgent.weekTokenCoverage === 'PARTIAL' ? '*' : ''}`,
              ],
              [t('running'), String(liveAgent.runningCount)],
              [t('waiting'), String(liveAgent.waitingCount)],
              [
                t('lastActive'),
                formatTime(liveAgent.lastActiveAt) || '—',
              ],
              [t('model'), liveAgent.latestModelId || '—'],
            ]

      return h(
        'aside',
        {
          className: 'pdt-panel pdt-side pdt-side-open',
          style: accent(agent.color),
          'aria-label': `${t('details')}: ${agent.name}`,
        },
        h(
          'div',
          { className: 'pdt-detail-head' },
          h(
            'span',
            { className: 'pdt-avatar pdt-avatar-lg', 'aria-hidden': 'true' },
            agent.icon || '◆'
          ),
          h(
            'div',
            { className: 'pdt-detail-heading' },
            h('h2', { className: 'pdt-detail-name' }, agent.name),
            h('span', { className: 'pdt-detail-en' }, agent.en || agent.slug),
            h(
              'span',
              { className: 'pdt-group-chip' },
              h('span', {
                className: 'pdt-group-dot',
                'aria-hidden': 'true',
              }),
              agent.group
            )
          ),
          h(
            'button',
            {
              type: 'button',
              className: 'pdt-close',
              onClick: onClose,
              title: t('close'),
              'aria-label': t('close'),
            },
            '×'
          )
        ),
        h(
          'div',
          { className: 'pdt-detail-actions' },
          h(
            'button',
            {
              type: 'button',
              className: 'pdt-copy',
              onClick: () => onCopy(`$${agent.slug}`, 'call'),
            },
            copied === 'call' ? t('copied') : t('call')
          ),
          h(
            'button',
            {
              type: 'button',
              className: 'pdt-ghost',
              onClick: () =>
                onCopy(`agents/${agent.slug}/AGENTS.md`, 'path'),
            },
            copied === 'path' ? t('copied') : t('path')
          )
        ),
        h(
          'section',
          { className: 'pdt-section' },
          h('h3', { className: 'pdt-label' }, t('role')),
          h('p', { className: 'pdt-text' }, agent.role || agent.scope)
        ),
        agent.scope && agent.scope !== agent.role
          ? h(
              'section',
              { className: 'pdt-section' },
              h('h3', { className: 'pdt-label' }, t('scope')),
              h('p', { className: 'pdt-text' }, agent.scope)
            )
          : null,
        meta.length > 0
          ? h(
              'section',
              { className: 'pdt-section' },
              h(
                'div',
                { className: 'pdt-meta-grid' },
                meta.map(([key, value]) =>
                  h(
                    'div',
                    { className: 'pdt-meta-item', key },
                    h('span', { className: 'pdt-meta-key' }, key),
                    h('span', { className: 'pdt-meta-value' }, value)
                  )
                )
              )
            )
          : null,
        agent.trigger
          ? h(
              'section',
              { className: 'pdt-section' },
              h('h3', { className: 'pdt-label' }, t('trigger')),
              h('p', { className: 'pdt-text' }, agent.trigger)
            )
          : null,
        h(
          'section',
          { className: 'pdt-section' },
          h('h3', { className: 'pdt-label' }, t('liveData')),
          liveRows.length === 0
            ? h(
                'p',
                { className: 'pdt-text' },
                live?.status === 'error'
                  ? t('liveUnavailable')
                  : t('liveLoading')
              )
            : h(
                'div',
                { className: 'pdt-meta-grid' },
                liveRows.map(([key, value]) =>
                  h(
                    'div',
                    { className: 'pdt-meta-item', key },
                    h('span', { className: 'pdt-meta-key' }, key),
                    h('span', { className: 'pdt-meta-value' }, value)
                  )
                )
              ),
          liveAgent?.weekTokenCoverage === 'PARTIAL'
            ? h('p', { className: 'pdt-live-note' }, t('coveragePartial'))
            : null,
          liveAgent?.activeTask
            ? h(
                'div',
                { className: 'pdt-active-task' },
                h('h3', { className: 'pdt-label' }, t('currentTask')),
                h(
                  'p',
                  { className: 'pdt-text pdt-active-title' },
                  liveAgent.activeTask.title
                )
              )
            : null,
          liveAgent?.activeTask
            ? h(
                'button',
                {
                  type: 'button',
                  className: 'pdt-ghost pdt-detail-board',
                  onClick: onOpenRuns,
                },
                `${t('openRuns')} →`
              )
            : null,
          liveAgent !== undefined && liveAgent !== null
            ? h(
                'button',
                {
                  type: 'button',
                  className: 'pdt-ghost pdt-detail-board',
                  onClick: onOpenTaskBoard,
                },
                `${t('openTaskBoard')} →`
              )
            : null
        ),
        Array.isArray(agent.skills) && agent.skills.length > 0
          ? h(
              'section',
              { className: 'pdt-section' },
              h('h3', { className: 'pdt-label' }, t('skills')),
              h(TagList, { items: agent.skills })
            )
          : null,
        required.length > 0 || optional.length > 0
          ? h(
              'section',
              { className: 'pdt-section' },
              required.length > 0
                ? h(
                    'div',
                    null,
                    h('h3', { className: 'pdt-label' }, t('required')),
                    h(TagList, { items: required })
                  )
                : null,
              optional.length > 0
                ? h(
                    'div',
                    { style: { marginTop: required.length > 0 ? 9 : 0 } },
                    h('h3', { className: 'pdt-label' }, t('optional')),
                    h(TagList, { items: optional })
                  )
                : null,
              platforms.length > 0
                ? h(
                    'div',
                    { style: { marginTop: 9 } },
                    h('h3', { className: 'pdt-label' }, t('platforms')),
                    h(TagList, { items: platforms })
                  )
                : null
            )
          : null,
        h(
          'section',
          { className: 'pdt-section' },
          h('h3', { className: 'pdt-label' }, t('routing')),
          related.length === 0
            ? h('p', { className: 'pdt-text' }, t('routingEmpty'))
            : related.map((route) =>
                h(
                  'div',
                  { className: 'pdt-route', key: route.id || route.scenario },
                  h('p', { className: 'pdt-route-title' }, route.scenario),
                  route.collaborators.length > 0
                    ? h(
                        'p',
                        { className: 'pdt-route-sub' },
                        `${t('collaborators')}: ${route.collaborators
                          .map((slug) => names.get(slug) || slug)
                          .join(' · ')}`
                      )
                    : null,
                  route.handoff
                    ? h('p', { className: 'pdt-route-handoff' }, route.handoff)
                    : null
                )
              )
        ),
        h(
          'p',
          { className: 'pdt-path', style: { marginTop: 14 } },
          `agents/${agent.slug}/AGENTS.md`
        )
      )
    }

    function OverviewPanel({ data, onCopy, copied, t, live }) {
      const defaultAgent = data.agents.find((agent) => agent.slug === 'main-agent')
      const color = defaultAgent?.color || BRAND
      const names = new Map(data.agents.map((agent) => [agent.slug, agent.name]))
      return h(
        'aside',
        {
          className: 'pdt-panel pdt-side pdt-intro',
          style: accent(color),
          'aria-label': t('overviewTitle'),
        },
        h('p', { className: 'pdt-kicker' }, t('overviewKicker')),
        h('h2', { className: 'pdt-intro-title' }, t('overviewTitle')),
        h('p', { className: 'pdt-intro-body' }, t('overviewBody')),
        h(
          'div',
          { className: 'pdt-code-row' },
          h('code', { className: 'pdt-code' }, '$main-agent'),
          h(
            'button',
            {
              type: 'button',
              className: 'pdt-copy',
              onClick: () => onCopy('$main-agent', 'call'),
            },
            copied === 'call' ? t('copied') : t('defaultCall')
          )
        ),
        h(
          'ol',
          { className: 'pdt-steps' },
          [t('step1'), t('step2'), t('step3')].map((step, index) =>
            h(
              'li',
              { className: 'pdt-step', key: step },
              h(
                'span',
                { className: 'pdt-step-n', 'aria-hidden': 'true' },
                String(index + 1)
              ),
              h('span', null, step)
            )
          )
        ),
        h(
          'div',
          { className: 'pdt-intro-routes' },
          h('h3', { className: 'pdt-label' }, t('routing')),
          h(
            'ul',
            { className: 'pdt-route-list' },
            data.routingMatrix.map((route) =>
              h(
                'li',
                { className: 'pdt-route-item', key: route.id || route.scenario },
                h(
                  'span',
                  { className: 'pdt-route-item-scenario' },
                  route.scenario
                ),
                h(
                  'span',
                  { className: 'pdt-route-item-owner' },
                  names.get(route.primary) || route.primary
                )
              )
            )
          )
        ),
        h(
          'p',
          { className: 'pdt-meta' },
          `${data.routingMatrix.length} ${t('routes')} · `,
          data.meta?.source === 'snapshot' ? t('sourceSnapshot') : t('sourceLive'),
          ' · ',
          live?.status === 'ready' && live.data
            ? t('liveOn')
            : live?.status === 'loading'
              ? t('liveLoading')
              : t('liveOff')
        )
      )
    }

    function LoadingState({ t }) {
      return h(
        'div',
        null,
        h('p', { className: 'pdt-meta', style: { margin: '0 0 12px' } }, t('loading')),
        h(
          'div',
          { className: 'pdt-skeleton', 'aria-hidden': 'true' },
          [0, 1, 2, 3, 4, 5].map((index) =>
            h('div', { className: 'pdt-skel', key: index })
          )
        )
      )
    }

    function EmptyState({ onClear, t, title, hint }) {
      return h(
        'div',
        { className: 'pdt-state' },
        h('p', { className: 'pdt-state-title' }, title || t('emptyTitle')),
        h('p', { className: 'pdt-state-text' }, hint || t('emptyHint')),
        h(
          'button',
          { type: 'button', className: 'pdt-ghost', onClick: onClear },
          t('clearFilters')
        )
      )
    }

    function ErrorState({ error, onRetry, t }) {
      return h(
        'div',
        { className: 'pdt-state' },
        h('p', { className: 'pdt-state-title' }, t('errorTitle')),
        h('p', { className: 'pdt-state-text' }, t('errorHint')),
        error ? h('p', { className: 'pdt-state-text' }, h('code', null, error)) : null,
        h(
          'button',
          { type: 'button', className: 'pdt-ghost', onClick: onRetry },
          t('retry')
        )
      )
    }

    function TeamPage(props) {
      const { t = (key) => key, initialData, openUrl } = props
      const [reloadKey, setReloadKey] = useState(0)
      const state = useTeamData(initialData, reloadKey)
      const liveState = useLiveData(reloadKey)
      const [query, setQuery] = useState('')
      const [group, setGroup] = useState('all')
      const [selected, setSelected] = useState(null)
      const [copied, setCopied] = useState(null)
      const [notice, setNotice] = useState(null)
      const [activeOnly, setActiveOnly] = useState(false)
      const [sort, setSort] = useState('default')
      const timer = useRef(null)
      const noticeTimer = useRef(null)

      const data = state.data
      const agents = Array.isArray(data?.agents) ? data.agents : []
      const groups = Array.isArray(data?.groups) ? data.groups : []
      const routes = Array.isArray(data?.routingMatrix) ? data.routingMatrix : []
      const liveData = liveState.data
      const today = liveData?.today
      const week = liveData?.week
      const liveReady = liveData !== null
      const selectedAgent = agents.find((agent) => agent.slug === selected) || null
      const busy =
        state.status === 'loading' ||
        state.status === 'refreshing' ||
        liveState.status === 'loading'

      const liveByAgent = useMemo(() => {
        const map = new Map()
        for (const item of liveData?.agents || []) map.set(item.agent, item)
        return map
      }, [liveData])

      const liveFor = (slug) => {
        const found = liveByAgent.get(slug)
        if (found !== undefined) return found
        if (!liveReady) return undefined
        return {
          agent: slug,
          weekTaskCount: 0,
          weekInputTokens: 0,
          weekOutputTokens: 0,
          weekCachedTokens: 0,
          weekTotalTokens: 0,
          weekTokenCoverage: 'NONE',
          todayTaskCount: 0,
          todayTotalTokens: 0,
          runningCount: 0,
          waitingCount: 0,
          queuedCount: 0,
          latestModelId: null,
          lastActiveAt: null,
        }
      }

      const openView = (view, agentSlug) => {
        const base = liveData?.appUrl || 'http://127.0.0.1:8900'
        try {
          const url = new URL(base)
          url.searchParams.set('view', view)
          if (typeof agentSlug === 'string' && agentSlug !== '') {
            url.searchParams.set('agent', agentSlug)
          }
          const opened =
            typeof openUrl === 'function'
              ? openUrl(url.toString())
              : window.open(url.toString(), '_blank', 'noopener,noreferrer') !== null
          if (!opened) {
            setNotice(t('openTaskBoardFailed'))
            if (noticeTimer.current !== null) clearTimeout(noticeTimer.current)
            noticeTimer.current = setTimeout(() => setNotice(null), 2600)
          }
        } catch {
          // A malformed app URL leaves the panel usable.
        }
      }
      const openTaskBoard = (agentSlug) => openView('tasks', agentSlug)
      const openRuns = (agentSlug) => openView('runs', agentSlug)

      const reload = useCallback(() => setReloadKey((key) => key + 1), [])

      useEffect(() => {
        if (selectedAgent === null) return undefined
        const onKeyDown = (event) => {
          if (event.key === 'Escape') setSelected(null)
        }
        window.addEventListener('keydown', onKeyDown)
        return () => window.removeEventListener('keydown', onKeyDown)
      }, [selectedAgent])

      useEffect(
        () => () => {
          if (timer.current !== null) clearTimeout(timer.current)
          if (noticeTimer.current !== null) clearTimeout(noticeTimer.current)
        },
        []
      )

      const copy = useCallback(async (text, kind) => {
        const ok = await copyText(text)
        if (!ok) return
        setCopied(kind)
        if (timer.current !== null) clearTimeout(timer.current)
        timer.current = setTimeout(() => setCopied(null), 1800)
      }, [])

      const needle = query.trim().toLowerCase()
      const effectiveActiveOnly = activeOnly && liveReady
      const sections = useMemo(() => {
        const sortAgents = (list) => {
          if (sort === 'usage') {
            return [...list].sort((left, right) => {
              const delta =
                (liveByAgent.get(right.slug)?.weekTaskCount || 0) -
                (liveByAgent.get(left.slug)?.weekTaskCount || 0)
              return delta === 0 ? left.name.localeCompare(right.name) : delta
            })
          }
          if (sort === 'recent') {
            const time = (agent) => {
              const value = liveByAgent.get(agent.slug)?.lastActiveAt
              const parsed = value === undefined ? NaN : Date.parse(value)
              return Number.isFinite(parsed) ? parsed : 0
            }
            return [...list].sort((left, right) => time(right) - time(left))
          }
          return list
        }

        return groups
          .map((name) => ({
            name,
            agents: sortAgents(
              agents.filter((agent) => {
                if (agent.group !== name) return false
                if (group !== 'all' && group !== name) return false
                if (effectiveActiveOnly) {
                  const live = liveByAgent.get(agent.slug)
                  if (
                    live === undefined ||
                    (live.runningCount === 0 && live.waitingCount === 0)
                  ) {
                    return false
                  }
                }
                if (needle === '') return true
                const haystack = [
                  agent.name,
                  agent.en,
                  agent.slug,
                  agent.role,
                  agent.scope,
                  agent.trigger,
                  agent.group,
                  ...(agent.skills || []),
                ]
                  .filter(Boolean)
                  .join(' ')
                  .toLowerCase()
                return haystack.includes(needle)
              })
            ),
          }))
          .filter((section) => section.agents.length > 0)
      }, [
        agents,
        effectiveActiveOnly,
        group,
        groups,
        liveByAgent,
        needle,
        sort,
      ])

      const visibleCount = sections.reduce(
        (total, section) => total + section.agents.length,
        0
      )
      const source =
        data?.meta?.source === 'snapshot' ? t('sourceSnapshot') : t('sourceLive')
      const updated = formatTime(
        data?.meta?.manifestUpdatedAt || data?.meta?.loadedAt || data?.meta?.generatedAt
      )
      const liveMeta =
        liveState.status === 'ready' && liveData
          ? `${t('liveOn')} · ${formatTime(liveData.generatedAt)}`
          : liveState.status === 'loading'
            ? t('liveLoading')
            : t('liveOff')
      const clearFilters = () => {
        setQuery('')
        setGroup('all')
        setActiveOnly(false)
        setSort('default')
      }

      const stats = [
        [agents.length, t('members')],
        [today === undefined ? '—' : today.taskCount, t('todayTasks')],
        [week === undefined ? '—' : week.runningCount, t('running')],
        [week === undefined ? '—' : week.waitingCount, t('waiting')],
        [today === undefined ? '—' : formatTokens(today.totalTokens), t('todayTokens')],
      ]

      return h(
        'div',
        { className: 'pdt-page' },
        h(
          'div',
          { className: 'pdt-shell' },
          h(
            'header',
            { className: 'pdt-hero' },
            h(
              'div',
              null,
              h('p', { className: 'pdt-kicker' }, t('kicker')),
              h('h1', { className: 'pdt-title' }, t('title')),
              h('p', { className: 'pdt-subtitle' }, t('subtitle'))
            ),
            h(
              'div',
              { className: 'pdt-stats' },
              stats.map(([value, label]) =>
                h(
                  'div',
                  { className: 'pdt-stat', key: label },
                  h('strong', null, String(value)),
                  h('span', null, label)
                )
              )
            )
          ),
          h(
            'div',
            { className: 'pdt-toolbar' },
            h(
              'label',
              { className: 'pdt-search' },
              h(SearchIcon, null),
              h('input', {
                type: 'search',
                value: query,
                placeholder: t('search'),
                'aria-label': t('search'),
                onChange: (event) => setQuery(event.target.value),
              }),
              query === ''
                ? null
                : h(
                    'button',
                    {
                      type: 'button',
                      className: 'pdt-search-clear',
                      onClick: () => setQuery(''),
                      title: t('clearSearch'),
                      'aria-label': t('clearSearch'),
                    },
                    '×'
                  )
            ),
            h(
              'div',
              { className: 'pdt-chips', role: 'group' },
              [
                { key: 'all', label: t('all'), count: agents.length },
                ...groups.map((name) => ({
                  key: name,
                  label: name,
                  count: agents.filter((agent) => agent.group === name).length,
                })),
              ].map((chip) =>
                h(
                  'button',
                  {
                    type: 'button',
                    className: 'pdt-chip',
                    key: chip.key,
                    'aria-pressed': group === chip.key,
                    onClick: () => setGroup(chip.key),
                  },
                  chip.label,
                  h('span', { className: 'pdt-chip-count' }, String(chip.count))
                )
              )
            ),
            h(
              'div',
              { className: 'pdt-actions' },
              liveReady
                ? h(
                    'button',
                    {
                      type: 'button',
                      className: 'pdt-ghost pdt-toggle',
                      'aria-pressed': activeOnly,
                      onClick: () => setActiveOnly((value) => !value),
                    },
                    t('activeOnly')
                  )
                : null,
              liveReady
                ? h(
                    'select',
                    {
                      className: 'pdt-sort',
                      value: sort,
                      'aria-label': t('sort'),
                      onChange: (event) => setSort(event.target.value),
                    },
                    h('option', { value: 'default' }, t('sortDefault')),
                    h('option', { value: 'usage' }, t('sortUsage')),
                    h('option', { value: 'recent' }, t('sortRecent'))
                  )
                : null,
              h(
                'button',
                {
                  type: 'button',
                  className: 'pdt-ghost',
                  onClick: reload,
                  disabled: busy,
                },
                busy ? t('refreshing') : t('refresh')
              )
            )
          ),
          h(
            'div',
            { className: 'pdt-layout' },
            h(
              'div',
              { className: 'pdt-groups' },
              state.status === 'loading'
                ? h(LoadingState, { t })
                : state.status === 'error' && data === null
                  ? h(ErrorState, {
                      error: state.error,
                      onRetry: reload,
                      t,
                    })
                  : visibleCount === 0
                    ? h(EmptyState, {
                        onClear: clearFilters,
                        t,
                        title: effectiveActiveOnly
                          ? t('noActiveTitle')
                          : t('emptyTitle'),
                        hint: effectiveActiveOnly
                          ? t('noActiveHint')
                          : t('emptyHint'),
                      })
                    : sections.map((section) =>
                        h(
                          'section',
                          {
                            className: 'pdt-group',
                            key: section.name,
                            style: accent(section.agents[0]?.color),
                          },
                          h(
                            'div',
                            { className: 'pdt-group-head' },
                            h('span', {
                              className: 'pdt-group-dot',
                              'aria-hidden': 'true',
                            }),
                            h(
                              'h2',
                              { className: 'pdt-group-title' },
                              section.name
                            ),
                            h(
                              'span',
                              { className: 'pdt-group-count' },
                              String(section.agents.length)
                            ),
                            h('span', {
                              className: 'pdt-group-line',
                              'aria-hidden': 'true',
                            })
                          ),
                          h(
                            'ul',
                            { className: 'pdt-cards' },
                            section.agents.map((agent) =>
                              h(AgentCard, {
                                key: agent.slug,
                                agent,
                                selected: selected === agent.slug,
                                onSelect: setSelected,
                                onOpenRuns: openRuns,
                                liveAgent: liveFor(agent.slug),
                                liveReady,
                                t,
                              })
                            )
                          )
                        )
                      )
            ),
            data === null
              ? null
              : selectedAgent !== null
                ? h(DetailPanel, {
                    agent: selectedAgent,
                    agents,
                    routes,
                    liveAgent: liveFor(selectedAgent.slug),
                    live: liveState,
                    onOpenRuns: () => openRuns(selectedAgent.slug),
                    onOpenTaskBoard: () => openTaskBoard(selectedAgent.slug),
                    onClose: () => setSelected(null),
                    onCopy: copy,
                    copied,
                    t,
                  })
                : h(OverviewPanel, {
                    data,
                    onCopy: copy,
                    copied,
                    t,
                    live: liveState,
                  })
          ),
          data === null
            ? null
            : h(
                'p',
                { className: 'pdt-meta', title: liveState.error || undefined },
                `${t('sourceHint')} · ${source}`,
                updated === '' ? '' : ` · ${t('updated')} ${updated}`,
                ` · ${liveMeta}`
              )
        ),
        selectedAgent === null
          ? null
          : h('div', {
              className: 'pdt-backdrop',
              onClick: () => setSelected(null),
              'aria-hidden': 'true',
            }),
        copied === null && notice === null
          ? null
          : h(
              'div',
              { className: 'pdt-toast', role: 'status', 'aria-live': 'polite' },
              copied === null ? notice : t('copied')
            )
      )
    }

    const name = 'personal-digital-team-panel'
    const inject = ['slots', 'locale']

    function apply(ctx) {
      ctx.effect(
        () => ctx.locale.register(NS, { zh, en }),
        'personal-digital-team-panel: dictionaries'
      )
      const t = ctx.locale.bind(NS)
      injectStyles()

      const openUrl = (url) => {
        try {
          const sidebarRight =
            typeof ctx.get === 'function'
              ? ctx.get('sidebarRight')
              : ctx.sidebarRight
          if (
            sidebarRight !== undefined &&
            typeof sidebarRight.openTab === 'function'
          ) {
            sidebarRight.openTab('browser', { params: { url } })
            return true
          }
        } catch {
          // Fall back to a normal browser tab when the right Sidebar or its
          // Browser provider is unavailable.
        }
        try {
          return window.open(url, '_blank', 'noopener,noreferrer') !== null
        } catch {
          return false
        }
      }

      ctx.slots.inject('sidebar.panellist', () =>
        ctx.slots.register(
          {
            name: 'sidebar.panellist',
            id: PANEL_ID,
            order: 20,
            locale: NS,
            label: () => t('panel'),
          },
          () => h(TeamIcon, {})
        )
      )

      ctx.slots.inject('main', () =>
        ctx.slots.register(
          {
            name: 'main',
            key: PANEL_ID,
            locale: NS,
          },
          (props) => h(TeamPage, { ...props, openUrl, t: props.t || t })
        )
      )
    }

    Object.assign(module.exports, { name, inject, apply })
    return module.exports
  },
})
