(function () {
  'use strict'

  const SELECTOR = '[data-prototype-change]'
  const TOGGLE_PANEL_SELECTOR = '#prototype-toggles'
  const TOGGLE_CONTAINER_SELECTOR = '.app-footer-prototype-toggles'
  const CREATED_PANEL_CLASS = 'prototype-changes__toggle-panel'
  const STORAGE_KEY = 'govukPrototypeChangesEnabled'
  const VALID_TYPES = new Set([
    'content',
    'component',
    'layout',
    'behaviour',
    'validation',
    'journey',
    'accessibility',
    'new',
    'removed'
  ])

  function escapeHtml(value) {
    return String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;')
  }

  function slugify(value) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
  }

  function inferVersion(pathname) {
    // Match a version segment that starts a path segment (for example "/v5/")
    // or that is appended to a path segment after a dash (for example
    // "/sfi-grasslands-v3"). A leading "/" or "-" marks the start of the
    // version and it must end at a "/", "-" or the end of the path.
    const match = pathname.match(/(?:^|[\/-])(v\d+(?:[._-]\d+)*)(?=$|[\/-])/i)
    return match ? match[1] : ''
  }

  function hasChangesQuery(search) {
    const params = new URLSearchParams(search)
    return params.has('changes')
  }

  function normaliseChange(element, index, inferredVersion, seenIds) {
    const rawType = (element.dataset.changeType || 'content').toLowerCase()
    const type = VALID_TYPES.has(rawType) ? rawType : 'content'
    const description = element.dataset.changeDescription || 'Change'
    const title = element.dataset.changeTitle || ''
    const version = element.dataset.changeVersion || inferredVersion
    const removed = element.dataset.changeRemoved === 'true'

    let id = slugify(element.dataset.changeId)
    if (!id) id = `change-${index + 1}`

    const baseId = id
    let duplicate = 2
    while (seenIds.has(id)) {
      id = `${baseId}-${duplicate}`
      duplicate += 1
    }
    seenIds.add(id)

    element.dataset.changeResolvedId = id

    return {
      element,
      id,
      index,
      number: index + 1,
      type,
      description,
      title,
      version,
      removed
    }
  }

  function getTargetElements(change) {
    if (change.removed) return [change.element]

    const children = Array.from(change.element.children)
      .filter((element) => !element.hasAttribute('hidden'))

    if (children.length) return children

    return []
  }

  function rectForChange(change) {
    const targets = getTargetElements(change)
    if (!targets.length) return null

    const rects = targets
      .map((element) => element.getBoundingClientRect())
      .filter((rect) => rect.width > 0 || rect.height > 0)

    if (!rects.length) return null

    return {
      left: Math.min(...rects.map((rect) => rect.left)) + window.scrollX,
      top: Math.min(...rects.map((rect) => rect.top)) + window.scrollY,
      right: Math.max(...rects.map((rect) => rect.right)) + window.scrollX,
      bottom: Math.max(...rects.map((rect) => rect.bottom)) + window.scrollY
    }
  }

  function createElement(tag, className, html) {
    const element = document.createElement(tag)
    if (className) element.className = className
    if (html !== undefined) element.innerHTML = html
    return element
  }

  class PrototypeChanges {
    constructor() {
      this.inferredVersion = inferVersion(window.location.pathname)
      this.changes = []
      this.enabled = this.readStoredState()
      this.filter = 'all'
      this.focusedId = null
      this.overlayRoot = null
      this.drawer = null
      this.footerSwitch = null
      this.resizeObserver = null
      this.raf = null
    }

    init() {
      const seenIds = new Set()
      this.changes = Array.from(document.querySelectorAll(SELECTOR))
        .map((element, index) => normaliseChange(element, index, this.inferredVersion, seenIds))

      // The footer toggle is injected on every page that has the panel, even
      // when the page itself has no annotations, so the control (and its
      // remembered state) is available across the whole prototype.
      this.createFooterToggle()
      this.bindFooterToggle()

      if (!this.changes.length) {
        if (this.footerSwitch) this.footerSwitch.checked = this.enabled
        return
      }

      this.createDrawer()
      this.createOverlayRoot()
      this.bindEvents()

      if (this.enabled) this.enable({ updateUrl: false, updateStorage: false })

      const requestedId = window.location.hash.replace(/^#/, '')
      if (requestedId) {
        const change = this.changes.find((item) => item.id === requestedId)
        if (change) {
          this.enable({ updateUrl: false, updateStorage: false })
          window.setTimeout(() => this.focusChange(change, { updateHash: false }), 0)
        }
      }
    }

    readStoredState() {
      if (hasChangesQuery(window.location.search)) return true
      try {
        return window.sessionStorage.getItem(STORAGE_KEY) === '1'
      } catch (error) {
        return false
      }
    }

    setStoredState(enabled) {
      try {
        if (enabled) window.sessionStorage.setItem(STORAGE_KEY, '1')
        else window.sessionStorage.removeItem(STORAGE_KEY)
      } catch (error) {
        // Ignore storage errors (for example in private browsing).
      }
    }

    createFooterToggle() {
      const container = this.resolveToggleContainer()
      if (!container) return

      const label = this.changes.length ? `Show changes (${this.changes.length})` : 'Show changes'
      const wrapper = createElement('div', 'app-prototype-switch app-prototype-switch--footer prototype-changes__switch')
      wrapper.id = 'prototype-show-changes-toggle'
      wrapper.innerHTML = `
        <label class="app-prototype-switch__label" for="prototype-changes-toggle">
          <span class="app-prototype-switch__control">
            <input class="app-prototype-switch__input" id="prototype-changes-toggle" name="showPrototypeChanges" type="checkbox" value="true" role="switch">
            <span class="app-prototype-switch__slider" aria-hidden="true"></span>
          </span>
          <span class="app-prototype-switch__text">
            <span class="app-prototype-switch__title">${escapeHtml(label)}</span>
          </span>
        </label>
      `
      container.appendChild(wrapper)
      this.footerSwitch = wrapper.querySelector('#prototype-changes-toggle')
    }

    // Return the element the "Show changes" switch should be appended to. When a
    // host prototype already exposes a "#prototype-toggles" feature toggles
    // panel the switch is injected into it; otherwise a matching panel is
    // created in the footer so prototypes without one still get the same control
    // in the same place.
    resolveToggleContainer() {
      const existingPanel = document.querySelector(TOGGLE_PANEL_SELECTOR)
      if (existingPanel) {
        return existingPanel.querySelector(TOGGLE_CONTAINER_SELECTOR) ||
          existingPanel.querySelector('.govuk-details__text') ||
          existingPanel
      }
      return this.createTogglePanel()
    }

    // Build a "Feature toggles" panel that mirrors the bespoke pattern used by
    // prototypes such as fcp-future-rps, so a prototype without its own panel
    // gets the same footer UI/UX. Returns the container the switch lives in, or
    // null when there is no footer to attach to.
    createTogglePanel() {
      const host = this.findFooterHost()
      if (!host) return null

      const tools = createElement('div', `app-footer-prototype-tools ${CREATED_PANEL_CLASS}`)
      tools.innerHTML = `
        <details class="govuk-details govuk-!-margin-bottom-0" data-module="govuk-details" id="prototype-toggles">
          <summary class="govuk-details__summary">
            <span class="govuk-details__summary-text">Feature toggles</span>
          </summary>
          <div class="govuk-details__text app-footer-prototype-toggles"></div>
        </details>
      `
      host.appendChild(tools)
      return tools.querySelector(TOGGLE_CONTAINER_SELECTOR)
    }

    // Prefer the footer's licence area (where fcp-future-rps places its panel),
    // then fall back to the footer container and finally the footer element.
    findFooterHost() {
      return document.querySelector('.govuk-footer__meta-item--grow') ||
        document.querySelector('.govuk-footer .govuk-width-container') ||
        document.querySelector('.govuk-footer') ||
        null
    }

    bindFooterToggle() {
      if (!this.footerSwitch) return
      this.footerSwitch.addEventListener('change', () => {
        if (this.footerSwitch.checked) this.enable()
        else this.disable()
      })
    }

    createDrawer() {
      const types = [...new Set(this.changes.map((change) => change.type))]
      const versionText = this.inferredVersion ? `Version ${escapeHtml(this.inferredVersion)}` : 'This page'

      const drawer = createElement('aside', 'prototype-changes__drawer')
      drawer.hidden = true
      drawer.setAttribute('aria-label', 'Prototype changes')
      drawer.innerHTML = `
        <div class="prototype-changes__drawer-header">
          <div>
            <h2>Prototype changes</h2>
            <p class="prototype-changes__meta">${versionText} - ${this.changes.length} change${this.changes.length === 1 ? '' : 's'}</p>
          </div>
          <button type="button" class="prototype-changes__close" data-prototype-changes-close>Close</button>
        </div>
        <div class="prototype-changes__filters" aria-label="Filter changes">
          <button type="button" class="prototype-changes__filter" data-change-filter="all" aria-pressed="true">All</button>
          ${types.map((type) => `<button type="button" class="prototype-changes__filter" data-change-filter="${escapeHtml(type)}" aria-pressed="false">${escapeHtml(type)}</button>`).join('')}
        </div>
        <ol class="prototype-changes__list">
          ${this.changes.map((change) => `
            <li class="prototype-changes__item" data-change-list-item="${escapeHtml(change.id)}" data-change-list-type="${escapeHtml(change.type)}">
              <button type="button" class="prototype-changes__item-button" data-change-focus="${escapeHtml(change.id)}">
                <span class="prototype-changes__item-heading">
                  <span class="prototype-changes__item-number">${change.number}</span>
                  <span class="prototype-changes__item-type">${escapeHtml(change.type)}</span>
                </span>
                ${change.title ? `<p class="prototype-changes__item-title">${escapeHtml(change.title)}</p>` : ''}
                <p class="prototype-changes__item-description">${escapeHtml(change.description)}</p>
              </button>
            </li>
          `).join('')}
        </ol>
        <p class="prototype-changes__empty" data-prototype-changes-empty hidden>No changes match this filter.</p>
      `
      document.body.appendChild(drawer)
      this.drawer = drawer
    }

    createOverlayRoot() {
      this.overlayRoot = createElement('div', 'prototype-changes__overlay-root')
          document.body.appendChild(this.overlayRoot)
    }

    bindEvents() {
      this.drawer.querySelector('[data-prototype-changes-close]').addEventListener('click', () => {
        this.drawer.hidden = true
      })

      this.drawer.addEventListener('click', (event) => {
        const filterButton = event.target.closest('[data-change-filter]')
        if (filterButton) {
          this.setFilter(filterButton.dataset.changeFilter)
          return
        }

        const focusButton = event.target.closest('[data-change-focus]')
        if (focusButton) {
          const change = this.changes.find((item) => item.id === focusButton.dataset.changeFocus)
          if (change) this.focusChange(change)
        }
      })

      this.overlayRoot.addEventListener('click', (event) => {
        const badge = event.target.closest('[data-change-badge]')
        if (!badge) return
        const change = this.changes.find((item) => item.id === badge.dataset.changeBadge)
        if (change) {
          this.drawer.hidden = false
          this.focusChange(change)
        }
      })

      const schedule = () => this.scheduleRender()
      window.addEventListener('resize', schedule)
      window.addEventListener('scroll', schedule, { passive: true })

      if ('ResizeObserver' in window) {
        this.resizeObserver = new ResizeObserver(schedule)
        this.resizeObserver.observe(document.body)
      }
    }

    enable(options = {}) {
      this.enabled = true
      document.documentElement.classList.add('prototype-changes-visible')

      this.changes.filter((change) => change.removed).forEach((change) => {
        change.element.hidden = false
        change.element.setAttribute('aria-label', `Removed: ${change.description}`)
      })

      if (this.footerSwitch) this.footerSwitch.checked = true
      if (this.drawer) this.drawer.hidden = false
      if (this.overlayRoot) this.renderOverlays()

      if (options.updateStorage !== false) this.setStoredState(true)
      if (options.updateUrl !== false) this.updateChangesQuery(true)
    }

    disable(options = {}) {
      this.enabled = false
      document.documentElement.classList.remove('prototype-changes-visible')
      if (this.overlayRoot) this.overlayRoot.replaceChildren()
      if (this.drawer) this.drawer.hidden = true
      this.focusedId = null

      this.changes.filter((change) => change.removed).forEach((change) => {
        change.element.hidden = true
        change.element.removeAttribute('aria-label')
      })

      if (this.footerSwitch) this.footerSwitch.checked = false

      if (options.updateStorage !== false) this.setStoredState(false)
      if (options.updateUrl !== false) this.updateChangesQuery(false)
    }

    updateChangesQuery(enabled) {
      const url = new URL(window.location.href)
      if (enabled) url.searchParams.set('changes', '')
      else url.searchParams.delete('changes')
      window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`)
    }

    setFilter(type) {
      this.filter = type

      this.drawer.querySelectorAll('[data-change-filter]').forEach((button) => {
        button.setAttribute('aria-pressed', String(button.dataset.changeFilter === type))
      })

      let visibleCount = 0
      this.drawer.querySelectorAll('[data-change-list-item]').forEach((item) => {
        const visible = type === 'all' || item.dataset.changeListType === type
        item.hidden = !visible
        if (visible) visibleCount += 1
      })

      this.drawer.querySelector('[data-prototype-changes-empty]').hidden = visibleCount !== 0
      this.renderOverlays()
    }

    scheduleRender() {
      if (!this.enabled || this.raf) return
      this.raf = window.requestAnimationFrame(() => {
        this.raf = null
        this.renderOverlays()
      })
    }

    renderOverlays() {
      if (!this.enabled) return
      this.overlayRoot.replaceChildren()

      const filtered = this.changes.filter((change) => this.filter === 'all' || change.type === this.filter)

      filtered.forEach((change) => {
        const rect = rectForChange(change)
        if (!rect) return

        const box = createElement('div', 'prototype-changes__box')
        if (this.focusedId === change.id) box.classList.add('prototype-changes__box--focused')
        box.style.left = `${rect.left - 5}px`
        box.style.top = `${rect.top - 5}px`
        box.style.width = `${Math.max(10, rect.right - rect.left + 10)}px`
        box.style.height = `${Math.max(10, rect.bottom - rect.top + 10)}px`

        const badge = createElement('button', 'prototype-changes__badge', String(change.number))
        badge.type = 'button'
        badge.dataset.changeBadge = change.id
        badge.setAttribute('aria-label', `Change ${change.number}: ${change.description}`)
        badge.style.left = `${rect.left - 5}px`
        badge.style.top = `${rect.top - 5}px`

        this.overlayRoot.append(box, badge)
      })
    }

    focusChange(change, options = {}) {
      this.focusedId = change.id
      this.setFilter(this.filter)

      const targets = getTargetElements(change)
      const target = targets[0] || change.element
      target.scrollIntoView({ behavior: 'smooth', block: 'center' })

      this.drawer.querySelectorAll('[data-change-list-item]').forEach((item) => {
        item.removeAttribute('aria-current')
      })
      const listItem = this.drawer.querySelector(`[data-change-list-item="${CSS.escape(change.id)}"]`)
      if (listItem) listItem.setAttribute('aria-current', 'true')

      if (options.updateHash !== false) {
        const url = new URL(window.location.href)
        url.hash = change.id
        window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`)
      }

      window.setTimeout(() => this.renderOverlays(), 350)
    }
  }

  function boot() {
    const plugin = new PrototypeChanges()
    plugin.init()
    window.PROTOTYPE_CHANGES = plugin
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot)
  } else {
    boot()
  }

  window.GOVUKPrototypeChanges = {
    inferVersion,
    hasChangesQuery,
    slugify
  }
})()
