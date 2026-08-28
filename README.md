# GOV.UK Prototype Kit Changes

Annotate meaningful design changes directly in GOV.UK Prototype Kit v13 pages so developers can see what changed without manually comparing every page.

This v0.1 release deliberately does not include a global change index or source/build-time scanning. All behaviour is page-local.

## What it provides

- `prototypeChange()` wrapper macro for changed or new content
- `prototypeChangeRemoved()` marker for removed content
- `?changes` annotation mode
- automatic "Show changes" switch injected into the footer feature toggles panel (a matching panel is created when the prototype does not already have one)
- numbered highlights drawn over the rendered page without wrapping elements in layout-changing blocks
- side drawer containing all annotations on the current page
- filtering by change type
- deep links such as `?changes#agreement-reference`
- automatic version detection for URLs containing segments such as `/v5/`
- explicit `version` override when needed
- supported semantic types: `content`, `component`, `layout`, `behaviour`, `validation`, `journey`, `accessibility`, `new`, `removed`

## Install

This package is published to [npmjs.com](https://www.npmjs.com) under the Defra
organisation scope. From your Prototype Kit project:

```sh
npm install @defra/govuk-prototype-kit-changes
npm run dev
```

### Install locally (from a checkout)

To try unreleased changes, install directly from a local checkout:

```sh
npm install ../govuk-prototype-kit-changes
npm run dev
```

The Prototype Kit v13 plugin system reads `govuk-prototype-kit.config.json`; plugin Sass and JavaScript are loaded on every page and the macros are made available to normal Prototype Kit templates.

## Annotate a change

```njk
{% call prototypeChange({
  id: "agreement-reference",
  type: "content",
  title: "Agreement reference",
  description: "Changed 'agreement number' to 'agreement reference'."
}) %}
  {{ govukInput({
    name: "agreementReference",
    label: {
      text: "What is the agreement reference?",
      classes: "govuk-label--l",
      isPageHeading: true
    }
  }) }}
{% endcall %}
```

`id` and `title` are optional. A missing id is generated as `change-1`, `change-2` and so on for the current page. For stable links, supply an id.

## Mark something as removed

Put the removal marker approximately where the removed content used to appear:

```njk
{{ prototypeChangeRemoved({
  id: "save-return",
  title: "Save and return",
  description: "Removed the 'Save and come back later' link."
}) }}
```

It renders nothing in normal mode. In annotation mode it becomes a dashed placeholder which can be highlighted and linked like any other change.

## Change types

Use a semantic type describing the implementation-relevant nature of the change:

```text
content
component
layout
behaviour
validation
journey
accessibility
new
removed
```

Unknown values safely fall back to `content` in the browser UI.

## View annotations

Normal prototype:

```text
/v5/agreement-details
```

Open annotation mode directly:

```text
/v5/agreement-details?changes
```

Or use the **Show changes** switch in the footer feature toggles panel (see below).

The query string is changed with `history.replaceState`, so turning annotations on or off does not reload the prototype or lose entered form state.

## Footer feature toggle

Some prototypes expose their own "Feature toggles" panel in the footer. This is
not a built-in GOV.UK Prototype Kit feature; it is a common bespoke pattern, for
example a details panel like:

```html
<details id="prototype-toggles">
  <summary>Feature toggles</summary>
  <div class="app-footer-prototype-toggles">
    <!-- prototype switches -->
  </div>
</details>
```

When such a panel is present, the plugin automatically injects a **Show changes**
switch into it, so there is no need to add `?changes` to the URL by hand. When no
panel is present, the plugin creates one in the footer, reusing the same
`Feature toggles` details/`app-prototype-switch` markup and styling as the
example panel in `fcp-future-rps`, so prototypes without their own panel get the
same footer UI/UX. The switch is added on every page, not only pages that happen
to contain annotations, so the control is always in the same place as you move
around the prototype. Turning the switch on enables annotation mode; turning it
off disables it again.

The on/off state is remembered in `sessionStorage`, so once you turn changes on
it stays on as you navigate between pages (and highlights appear automatically on
any page that has annotations), until you turn it off again or start a new
browser session.

The injected switch reuses the `app-prototype-switch` markup so it inherits the
host prototype's toggle styling when a panel already exists. When the plugin
creates the panel itself, it ships the matching styling (scoped so it never
overrides a prototype that already styles `app-prototype-switch`). The `?changes`
query string continues to work in every case, and the panel is only created when
the footer has somewhere to attach it.

## Deep links

Give important changes stable ids:

```njk
{% call prototypeChange({
  id: "agreement-reference",
  type: "content",
  description: "Changed the question wording."
}) %}
```

Then link directly to:

```text
/v5/agreement-details?changes#agreement-reference
```

Opening the URL enables annotations, scrolls to the relevant part of the page and emphasises its highlight.

## Version detection

If no version is specified, the browser infers a version from the URL path:

```text
/v5/agreement-details       -> v5
/service/v12/start          -> v12
/sfi-grasslands-v3          -> v3
/sfi-grasslands-v3/task-list -> v3
```

The version can either be its own path segment (`/v5/`) or appended to the
root path segment after a dash (`/sfi-grasslands-v3`).

You can override it on an annotation:

```njk
{% call prototypeChange({
  version: "iteration-5",
  type: "journey",
  description: "Added a new eligibility step."
}) %}
```

## Accessibility and prototype behaviour

The annotation UI is supplementary prototype tooling, not service UI. Annotation mode is opt-in.

Normal mode leaves changed content in its original position. The wrapper uses `display: contents`, while highlight rectangles are drawn in an overlay using the rendered child element bounds. This avoids introducing an extra block box around GOV.UK components just to highlight them.

Removed annotations are the exception: they deliberately insert a visible dashed placeholder only while change mode is enabled.

## Browser API

For debugging, the active instance is exposed as:

```js
window.PROTOTYPE_CHANGES
```

Utility functions are exposed as:

```js
window.GOVUKPrototypeChanges
```

The public surface is intentionally tiny in v0.1 and should not yet be treated as a stable integration API.

## Development

Run the small package integrity test suite with:

```sh
npm test
```

For realistic testing, install the package into a GOV.UK Prototype Kit v13 prototype using a local path and use `examples/example-page.njk` as sample page content.
