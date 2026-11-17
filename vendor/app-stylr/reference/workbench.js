const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const asset = relativePath => new URL(relativePath, import.meta.url).pathname;
const sections = {
  overview: ['Overview', 'System overview', 'A practical place to inspect, exercise, and reproduce the shared visual system.'],
  colors: ['Colors', 'Color roles', 'Choose an accent and surface tone. Use the active semantic roles below.'],
  typography: ['Typography', 'Type & hierarchy', 'Geist Sans and Geist Mono, with a deliberate scale and quieter weights.'],
  controls: ['Controls', 'Controls & states', 'Real inputs, native choices, and inspectable states. Try changing a value or following the form with Tab.'],
  feedback: ['Feedback', 'Feedback & selection', 'Quiet surfaces, with text and symbols carrying each state’s meaning.'],
  icons: ['Icons', 'Icon construction', 'Neutral graphite tiles, recognizable product glyphs, and exports designed from 16px upward.'],
  layout: ['Layout & motion', 'Rhythm & response', 'Shared scales guide composition. Each product owns its layout.'],
  setup: ['Setup', 'Use the foundation', 'Install a pinned release, choose your theme and accent, and build the interface your product needs.']
};
const aliases = { start: 'setup', privacy: 'setup', palette: 'colors', themes: 'colors' };
const query = new URLSearchParams(location.search);
let canonical;
try {
  const response = await fetch(new URL('tokens/app-stylr.json', import.meta.url));
  if (!response.ok) throw new Error(`Token request failed: ${response.status}`);
  canonical = await response.json();
} catch (error) {
  $('#section-content').textContent = 'The token file could not be loaded. Reload the page or open the source repository linked below.';
  throw error;
}
const accentPresets = canonical.accentPresets;
const accentNames = Object.fromEntries(Object.entries(accentPresets).map(([id, preset]) => [id, preset.name]));
const toneNames = Object.fromEntries(Object.entries(canonical.surfaceTonePresets).map(([id, preset]) => [id, preset.name]));
$('#accent-select').replaceChildren(...Object.entries(accentNames).map(([id, name]) => new Option(name, id)));
$('#tone-select').replaceChildren(...Object.entries(toneNames).map(([id, name]) => new Option(name, id)));
const initialSection = query.get('section') || aliases[location.hash.slice(1)] || location.hash.slice(1);
const state = {
  accent: Object.hasOwn(accentNames, query.get('accent')) ? query.get('accent') : 'mint',
  theme: query.get('theme') === 'light' ? 'light' : 'dark',
  tone: Object.hasOwn(toneNames, query.get('tone')) ? query.get('tone') : 'normal',
  section: Object.hasOwn(sections, initialSection) ? initialSection : 'overview',
  density: query.get('density') === 'compact' ? 'compact' : 'comfortable',
  token: 'themes.dark.accent', name: 'Fieldnotes', view: 'Project swimlanes',
  selected: true, saved: false, loading: false, filter: '', invalid: true, destination: ''
};
state.token = `themes.${state.theme}.accent`;
const esc = text => String(text).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
const kebab = text => text.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
const get = (object, path) => path.split('.').reduce((value, key) => value?.[key], object);
const data = () => ({ ...canonical, themes: Object.fromEntries(['dark', 'light'].map(name => [name, { ...canonical.themes[name], ...canonical.accents[state.accent]?.[name], ...canonical.surfaceTones[state.tone]?.[name] }])) });
const theme = () => data().themes[state.theme];
const token = (path, label) => `<button class="token-chip" type="button" data-token="${path}">${esc(label || path.split('.').at(-1))}<span aria-hidden="true">↗</span></button>`;
function cssName(path) {
  const parts = path.split('.');
  if (parts[0] === 'themes') return `--ui-${kebab(parts[2])}`;
  if (parts[0] === 'spacing') return `--space-${parts[1]}`;
  if (parts[0] === 'typography') return `--type-${kebab(parts[2])}${parts[3] ? '-' + kebab(parts[3]) : ''}`;
  return `--${parts.map(kebab).join('-')}`;
}
let toastTimer;
function toast(message) {
  $('#toast').textContent = message;
  $('#toast').classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $('#toast').classList.remove('visible'), 2400);
}
function updateUrl() {
  const url = new URL(location.href);
  for (const key of ['accent', 'tone', 'section', 'theme', 'density']) url.searchParams.set(key, state[key]);
  history.replaceState(null, '', url);
}
function status(kind, title, copy) {
  const symbols = { success: '✓', warning: '!', danger: '×', info: 'i' };
  return `<div class="feedback-message ${kind}"><span class="feedback-symbol" aria-hidden="true">${symbols[kind]}</span><div><strong>${title}</strong><p>${copy}</p></div></div>`;
}

function form(id='overview'){return`<form class="specimen-form" data-demo-form>
<div class="field-grid">
<label class="field-label">Workspace name<input name="workspace" value="${esc(state.name)}" required maxlength="64" autocomplete="off">
<small>Keep the label visible after entering a value.</small>
</label>
<label class="field-label">Default view<select name="view">${['Project swimlanes','Kanban','Ranked queue'].map(v=>`<option${v===state.view?' selected':''}>${v}</option>`).join('')}</select>
<small>Native keyboard behavior stays intact.</small>
</label>
</div>
<div class="form-actions">
<button class="btn btn--primary" type="submit">Save changes <span aria-hidden="true">↗</span>
</button>
<button class="btn btn--secondary" type="button" data-reset>Reset values</button>
<span class="form-status" role="status">${state.saved?'Changes applied to this specimen':''}</span>
</div>
</form>`;}
function preview(){return`<div class="context-specimen specimen">
<div class="context-header">
<div class="mini-identity">
<img src="${asset('assets/example-app-icon.svg')}" width="32" height="32" alt="">
<span>Daily Flow <small>Project workspace</small>
</span>
</div>
<span class="context-state">${state.theme==='dark'?'Dark by default':'Optional light theme'}</span>
</div>
<div class="context-body">
<h3>Clear hierarchy, quiet surfaces.</h3>
<p>Manage the details and preferences for your project workspace.</p>${form()}<div class="selection-specimen">
<button class="selection-row ${state.selected?'is-selected':''}" type="button" data-select-row aria-pressed="${state.selected}">
<span class="selection-check" aria-hidden="true">${state.selected?'✓':''}</span>
<span>Review the latest design<small>Today</small>
</span>
<span class="selection-label">${state.selected?'Selected':'Select'}</span>
</button>
<div class="secondary-row">
<span class="open-circle" aria-hidden="true">
</span>
<span>Prepare the next release</span>
<small>Next</small>
</div>
</div>
</div>
</div>`;}
function summaryRows() {
  const t = data();
  return [
    ['Display weight', t.typography.styles.display.weight, 'typography.styles.display.weight'],
    ['Control / button', `${t.radius.control} / ${t.radius.button}px`, 'radius.button'],
    ['Card / dialog', `${t.radius.card} / ${t.radius.dialog}px`, 'radius.card'],
    ['Control motion', `${t.motion.control}ms`, 'motion.control']
  ].map(([name, value, path]) => `<div class="change-row">
<span>${name}</span>
<button type="button" data-token="${path}">${value} <span aria-hidden="true">↗</span>
</button>
</div>`).join('');
}
function overview(){return`<div class="overview-layout">
<section class="demo-region">
<div class="region-heading">
<h2>The system in use</h2>
<span>Interactive specimen</span>
</div>${preview()}</section>
<section class="change-region">
<div class="region-heading">
<h2>Shared foundation</h2>
<span>Inspect a value</span>
</div>
<div class="changes">${summaryRows()}</div>
<p class="region-note">Sharper geometry and a deliberate type scale over the charcoal foundation.</p>
<a class="text-link" href="?accent=${state.accent}&section=typography&theme=${state.theme}&density=${state.density}&tone=${state.tone}" data-section="typography">Inspect the complete type scale <span aria-hidden="true">↗</span>
</a>
</section>
</div>
<section class="role-section">
<div class="region-heading">
<h2>Semantic roles</h2>
<span>Click a role to inspect</span>
</div>${swatches(['canvas','surface','surfaceRaised','text','accent','selected'])}</section>
<div class="overview-bottom">
<section>
<div class="region-heading">
<h2>Feedback</h2>${token(`themes.${state.theme}.success`,'Success')}</div>${status('success','Icons generated','The new files are ready in your chosen folder.')}</section>
<section>
<div class="region-heading">
<h2>One master, every size</h2>
<a class="text-link" href="?accent=${state.accent}&section=icons&theme=${state.theme}&density=${state.density}&tone=${state.tone}" data-section="icons">Inspect icons ↗</a>
</div>
<div class="inline-icons">${[16,32,48].map(s=>`<div>
<span>${s}px</span>
<img src="${asset(`assets/platform-icons/reference/chrome/icon-${s}.png`)}" width="${s}" height="${s}" alt="Example icon at ${s} pixels">
</div>`).join('')}<p>Start at 16px.<br>Keep the identifying glyph.</p>
</div>
</section>
</div>`;}
function swatches(roles){const t=theme();return`<div class="role-swatches${roles.length===8?' eight-roles':''}">${roles.map(role=>`<button type="button" class="role-swatch" data-token="themes.${state.theme}.${role}">
<i style="background:${t[role]}">
</i>
<span>${role.replace(/([A-Z])/g,' $1').toLowerCase()}</span>
<code>${t[role]}</code>
</button>`).join('')}</div>`;}
function paletteAppPreview(){return`<section class="palette-app-region" aria-labelledby="palette-app-title">
<div class="region-heading"><h2 id="palette-app-title">App preview</h2><span>${accentNames[state.accent]} · ${toneNames[state.tone]} · ${state.theme}</span></div>
<div class="palette-app">
<aside class="palette-app-sidebar" aria-label="Example workspace sidebar">
<span class="palette-app-sidebar-label">Workspace</span>
<div class="palette-app-navigation"><span class="is-active">Project settings</span><span>Members</span><span>Activity</span></div>
<span class="palette-app-sidebar-note">Personal workspace</span>
</aside>
${preview()}
</div>
</section>`;}
function colors(){return`<div class="palette-workbench">
<section class="palette-picker" aria-labelledby="accent-palettes-title"><div class="region-heading"><h2 id="accent-palettes-title">Accent palettes</h2><span>Choose a palette</span></div><div class="palette-grid">${Object.entries(accentPresets).map(([id,preset])=>{const colors=id==='mint'?canonical.themes:canonical.accents[id];return `<button type="button" class="palette-card" data-accent="${id}" aria-pressed="${state.accent===id}" style="--palette-accent:${colors[state.theme].focus}"><span class="palette-preview" aria-hidden="true"><i style="background:${colors.dark.accent}"></i><i style="background:${colors.light.accent}"></i></span><span><strong>${esc(preset.name)}</strong><small>${esc(preset.description)}</small></span></button>`;}).join('')}</div></section>${paletteAppPreview()}</div><section class="specimen-section">
<div class="region-heading">
<h2>Surfaces & hierarchy</h2>
<span>${toneNames[state.tone]} surfaces · ${state.theme}</span>
</div>${swatches(['canvas','sidebar','surface','surfaceRaised','border','borderStrong'])}</section>
<section class="specimen-section">
<div class="region-heading">
<h2>Text & interaction</h2>
<span>Active: ${accentNames[state.accent]} · ${state.theme}</span>
</div>${swatches(['text','textMuted','accent','accentText','link','focus','selected','selectedText'])}</section>
<section class="brand-reference" aria-labelledby="brand-reference-title">
<div class="region-heading"><h2 id="brand-reference-title">Brand reference</h2><span>Reference only</span></div>
<p>Original Sage colors, kept separately for reference. Use the active semantic roles above for the selected palette.</p>
<details class="reference-details brand-reference-details">
<summary>View original Sage brand colors</summary>
<div class="brand-swatches">${Object.entries(canonical.brand).map(([name,hex])=>`<div>
<i style="background:${hex}">
</i>
<span>${name}</span>
<code>${hex}</code>
</div>`).join('')}</div>
</details>
</section>`;}
function typography(){const samples={display:'Calm tools for daily work.',heading1:'Clear hierarchy, quiet surfaces.',heading2:'Progress without noise.',heading3:'Project workspace',body:'App Stylr keeps product decisions recognizable across apps while leaving room for each tool to solve its own problem.',small:'Manage the details and preferences for your project workspace.',label:'Workspace name',monoMetadata:`APP-STYLR@${canonical.version}`};return`<div class="type-table">${Object.entries(data().typography.styles).map(([key,s])=>`<section class="type-row">
<div class="type-description">
<h2>${key.replace(/([A-Z])/g,' $1').replace(/([a-z])(\d)/g,'$1 $2').replace(/^./,c=>c.toUpperCase())}</h2>
<span>${s.size}/${s.lineHeight} · ${s.weight}</span>${token(`typography.styles.${key}`,'Inspect style')}</div>
<p class="type-preview ${key==='monoMetadata'?'mono':''}" style="font-size:${s.size}px;line-height:${s.lineHeight}px;font-weight:${s.weight};letter-spacing:${s.letterSpacing}px">${samples[key]}</p>
</section>`).join('')}</div>
<div class="type-footer">
<span>Geist Sans</span>
<span>Geist Mono</span>
<span>Aa Bb Gg Kk Rr 0123456789 & @ #</span>
</div>`;}
function controls(){return`<div class="controls-layout">
<section class="specimen settings-specimen">
<div class="region-heading">
<h2>Project workspace</h2>
<span>Interactive form</span>
</div>${form('controls')}</section>
<section class="anatomy-panel">
<div class="region-heading">
<h2>Control anatomy</h2>${token('size.control','Height')}</div>
<div class="anatomy-row">
<span>Minimum height</span>
<strong id="height-value">${state.density==='compact'&&!matchMedia('(pointer:coarse)').matches?data().size.controlCompact:data().size.control}px</strong>
</div>
<div class="anatomy-row">
<span>Corner radius</span>
<strong>${data().radius.control}px</strong>
</div>
<div class="anatomy-row">
<span>Focus outline</span>
<strong>2px / 3px offset</strong>
</div>
<div class="anatomy-row">
<span>Label</span>
<strong>${data().typography.styles.label.size}px / ${data().typography.styles.label.weight}</strong>
</div>
<p class="region-note">Use Tab to inspect real focus. Touch controls retain a 44px minimum. Native open-menu presentation remains platform-owned where a themed picker is unavailable.</p>
</section>
</div>
<section class="specimen-section">
<div class="region-heading">
<h2>State inventory</h2>
<span>Appearance specimens + live controls</span>
</div>
<div class="state-grid">
<article class="state-card">
<div class="state-heading">
<h3>Default</h3>
<code>surface-raised</code>
</div>
<label class="field-label">Workspace name<input value="Fieldnotes" aria-label="Default workspace name">
</label>
</article>
<article class="state-card">
<div class="state-heading">
<h3>Hover</h3>
<code>accent border</code>
</div>
<label class="field-label">Workspace name<input value="Fieldnotes" class="force-hover" aria-label="Hover appearance workspace name">
</label>
</article>
<article class="state-card">
<div class="state-heading">
<h3>Focus</h3>
<code>focus role</code>
</div>
<label class="field-label">Workspace name<input value="Fieldnotes" class="force-focus" aria-label="Focus appearance workspace name">
</label>
</article>
<article class="state-card">
<div class="state-heading">
<h3>Disabled</h3>
<code>native disabled</code>
</div>
<label class="field-label">Unavailable setting<select disabled>
<option>Connection unavailable</option>
</select>
</label>
</article>
<article class="state-card">
<div class="state-heading">
<h3>Invalid</h3>
<code>danger role</code>
</div>
<label class="field-label">Required choice<select id="required-choice" aria-invalid="${state.invalid}" aria-describedby="choice-error">
<option value="">Choose a destination</option>
<option${state.destination==='Fieldnotes'?' selected':''}>Fieldnotes</option>
</select>
<small id="choice-error" class="${state.invalid?'invalid-help':''}">${state.invalid?'Choose a destination before continuing.':'Destination selected.'}</small>
</label>
</article>
<article class="state-card">
<div class="state-heading">
<h3>Loading</h3>
<code>aria-busy</code>
</div>
<p class="state-copy">A short, user-triggered state.</p>
<button type="button" class="btn btn--secondary" data-loading aria-busy="${state.loading}"${state.loading?' disabled':''}>${state.loading?'Saving changes…':'Try loading state'}</button>
</article>
<article class="state-card">
<div class="state-heading">
<h3>Selected</h3>
<code>selected role</code>
</div>
<button type="button" class="selection-row ${state.selected?'is-selected':''}" data-select-row aria-pressed="${state.selected}">
<span class="selection-check" aria-hidden="true">${state.selected?'✓':''}</span>
<span>Review the latest design</span>
</button>
</article>
<article class="state-card">
<div class="state-heading">
<h3>Long & grouped</h3>
<code>native select</code>
</div>
<label class="field-label">Default view<select>
<optgroup label="Active">
<option>Design systems and interface implementation</option>
<option>Release preparation</option>
</optgroup>
<optgroup label="Archived">
<option disabled>Earlier research</option>
</optgroup>
</select>
</label>
</article>
</div>
</section>`;}
function feedback(){return`<div class="feedback-grid">${status('success','Icons generated','The new files are ready in your chosen folder.')}${status('warning','Unsupported image','Choose a square SVG or PNG and try again.')}${status('danger','Cannot write to this folder','Choose a folder you can edit, then run the command again.')}${status('info','Local files only','Your selected files stay on this device.')}</div>
<section class="specimen-section">
<div class="region-heading">
<h2>Selection & empty results</h2>
<span>Try a search that has no match</span>
</div>
<div class="empty-lab specimen">
<label class="field-label">Search the specimen<input id="feedback-search" type="search" value="${esc(state.filter)}" placeholder="Search tasks" autocomplete="off">
</label>
<div id="search-results">${searchResults()}</div>
</div>
</section>`;}
function searchResults(){const names=['Review the latest design','Prepare the next release'];const matches=names.filter(n=>n.toLowerCase().includes(state.filter.toLowerCase()));return matches.length?matches.map(n=>`<div class="search-result">
<span class="open-circle" aria-hidden="true">
</span>${n}</div>`).join(''):`<div class="empty-result">
<h3>No matching tasks</h3>
<p>Try another search or clear the current filter.</p>
<button class="btn btn--secondary" type="button" data-clear-search>Clear search</button>
</div>`;}
function icons() {
  return `<div class="icon-layout">
    <section class="icon-construction specimen">
      <div class="region-heading">
<h2>Monochrome icon construction</h2>
<span>Example glyph</span>
</div>
      <div class="master-icons">
        <div>
<span>Example symbol</span>
<img src="${asset('assets/example-app-icon.svg')}" alt="Light example checkmark on a graphite tile" width="192" height="192">
</div>
        <div>
<span>Reusable base</span>
<img src="${asset('assets/app-icon-monochrome-base.svg')}" alt="Monochrome graphite icon base" width="192" height="192">
</div>
      </div>
      <div class="icon-measures">${[['Canvas', canonical.icon.canvas], ['Square', canonical.icon.square], ['Radius', canonical.icon.radius], ['Inset', canonical.icon.inset]].map(([name, value]) => `<div>
<span>${name}</span>
<strong>${value}px</strong>
</div>`).join('')}</div>
    </section>
    <section class="icon-size-panel">
      <div class="region-heading">
<h2>Actual export sizes</h2>
<span>Start at 16px</span>
</div>
      <div class="actual-sizes">${[16,32,48,128].map(size => `<div>
<span>${size}px</span>
<img src="${asset(`assets/platform-icons/reference/chrome/icon-${size}.png`)}" width="${size}" height="${size}" alt="Example icon at ${size} pixels">
</div>`).join('')}</div>
      <p class="region-note">Keep your product's identifying glyph. Use a restrained graphite gradient and a light foreground, with a dedicated 16px drawing when needed. Accent palettes do not recolor the icon. The checkmark demonstrates the recipe.</p>
      <a class="text-link" href="${asset('assets/app-icon-monochrome-base.svg')}" download>Download monochrome base ↓</a>
    </section>
  </div>
  <section class="specimen-section">
    <div class="region-heading">
<h2>Browser chrome</h2>
<span>Illustrative backgrounds, actual 16px icons</span>
</div>
    <div class="browser-chrome-grid">${['dark','light'].map(theme => `<div class="browser-chrome ${theme}-chrome">
<span>${theme === 'dark' ? 'Dark' : 'Light'}</span>
<div class="browser-tab">
<img src="${asset('assets/platform-icons/reference/chrome/icon-16.png')}" width="16" height="16" alt="">
<span>App Stylr specimen</span>
<span aria-hidden="true">×</span>
</div>
</div>`).join('')}</div>
  </section>
  <details class="reference-details">
<summary>Platform exports &amp; generation</summary>
    <p>Use a square master for web, extension, touch, and installable-site exports. A compact source can supply the 16px export. Check actual browser and installed-app presentation separately.</p>
    <pre>npx app-stylr-icons --source assets/app-icon.svg --source-16 assets/app-icon-16.svg --output public/icons</pre>
    <a class="text-link" href="https://github.com/kylbutlr/app-stylr/blob/main/docs/platform-icons.md">Platform icon guidance ↗</a>
  </details>`;
}
function layout(){return`<section class="specimen-section">
<div class="region-heading">
<h2>Spacing scale</h2>
<span>Named values retain their pixel meaning</span>
</div>
<div class="spacing-scale">${Object.entries(data().spacing).map(([key,value])=>`<button type="button" data-token="spacing.${key}">
<code>${key}</code>
<i style="width:${value}px">
</i>
<span>${value}px</span>
</button>`).join('')}</div>
</section>
<div class="layout-grid">
<section>
<div class="region-heading">
<h2>Radius family</h2>
<span>Token-driven geometry</span>
</div>
<div class="radius-grid">${Object.entries(data().radius).map(([key,value])=>`<button type="button" data-token="radius.${key}">
<i style="border-radius:${value}px">
</i>
<span>${key}</span>
<code>${value}px</code>
</button>`).join('')}</div>
</section>
<section class="motion-specimen">
<div class="region-heading">
<h2>Motion</h2>
<span>User-triggered, with reduced motion</span>
</div>
<div class="anatomy-row">
<span>Control</span>
<strong>${data().motion.control}ms</strong>
</div>
<div class="anatomy-row">
<span>Panel</span>
<strong>${data().motion.panel}ms</strong>
</div>
<button type="button" class="btn btn--secondary" data-motion-demo>Try control feedback <span aria-hidden="true">↗</span>
</button>
<p class="region-note">Hover and press the button. Motion rests when reduced motion is requested.</p>
</section>
</div>
<section class="specimen-section">
<div class="region-heading">
<h2>Responsive composition</h2>
<span>Product-owned, not a fixed shared shell</span>
</div>
<div class="responsive-specimens">
<article>
<h3>Wide</h3>
<div class="responsive-diagram wide">
<i>
</i>
<i>
</i>
<i>
</i>
</div>
<p>Navigation, workspace, and detail can sit alongside one another.</p>
</article>
<article>
<h3>Compact</h3>
<div class="responsive-diagram compact">
<i>
</i>
<i>
</i>
</div>
<p>Prioritize the current step. Open detail when it is needed.</p>
</article>
</div>
</section>`;}
function setup() {
  return `<section class="setup-panel" id="start">
    <h2>Install the foundation</h2>
    <p>Pin a release and upgrade deliberately. Shared values belong to App Stylr; your product owns its layout and behavior.</p>
    <pre>npm install "github:kylbutlr/app-stylr#v${canonical.version}"</pre>
    <pre>@import "app-stylr/fonts.css";
@import "app-stylr/css";
@import "app-stylr/controls.css";</pre>
    <pre>&lt;html lang="en" data-app-stylr-theme="${state.theme}" data-app-stylr-accent="${state.accent}" data-app-stylr-tone="${state.tone}" data-app-stylr-controls&gt;</pre>
    <p>Choose an accent, then a surface tone: Lighter, Normal, or Darker. Normal keeps the original surfaces. Set all three appearance attributes on the same root, including independently themed islands.</p>
    <a class="text-link" href="https://github.com/kylbutlr/app-stylr#quick-start">Read the package setup ↗</a>
  </section>
  <section class="specimen-section">
    <div class="region-heading">
<h2>Tokens &amp; adapters</h2>
<span>One canonical source</span>
</div>
    <div class="download-links">
<a class="btn btn--secondary" href="${asset('tokens/app-stylr.json')}" download>Download tokens ↓</a>
<a class="btn btn--secondary" href="${asset('adapters/css/app-stylr.css')}" download>Download CSS ↓</a>
</div>
    <p class="region-note">Both downloads include every accent and surface tone. Native apps can combine them with AppStylrTokens.theme(appearance: .dark, accent: .royal, tone: .lighter).</p>
  </section>
  <section class="specimen-section" id="privacy">
    <div class="region-heading">
<h2>Local files. Shared rules.</h2>
<span>Scope &amp; privacy</span>
</div>
    <div class="scope-grid">
<div>
<h3>Foundation</h3>
<p>Color roles, type, spacing, radii, motion, and reusable assets.</p>
</div>
<div>
<h3>Product</h3>
<p>Navigation, composition, application behavior, and platform conventions.</p>
</div>
<div>
<h3>Privacy</h3>
<p>No account, upload, telemetry, or saved preferences. Specimen values stay in this tab. Theme, accent, surface tone, density, and section are reflected in the URL.</p>
</div>
</div>
    <a class="text-link" href="https://github.com/kylbutlr/app-stylr/blob/main/docs/privacy.md">Privacy details ↗</a>
  </section>`;
}


const renderers = { overview, colors, typography, controls, feedback, icons, layout, setup };
function renderInspector() {
  const value = get(data(), state.token);
  const parts = state.token.split('.');
  const isAccent = parts[0] === 'themes' && Object.hasOwn(canonical.accents[state.accent]?.[parts[1]] || {}, parts[2]);
  const isTone = parts[0] === 'themes' && Object.hasOwn(canonical.surfaceTones[state.tone]?.[parts[1]] || {}, parts[2]);
  const sourcePath = isTone ? `surfaceTones.${state.tone}.${parts[1]}.${parts[2]}` : isAccent ? `accents.${state.accent}.${parts[1]}.${parts[2]}` : state.token;
  const raw = typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value ?? '');
  $('#dialog-inspector').innerHTML = `
    <p class="inspector-context">${esc(state.theme)} · ${accentNames[state.accent]} · ${toneNames[state.tone]} surfaces</p>
    <h3>${esc(parts.at(-1))}</h3>
    ${/^#[a-f\d]{6}$/i.test(raw) ? `<div class="inspector-color" style="background:${raw}"></div>` : ''}
    <code class="inspector-path">${esc(sourcePath)}</code>
    <pre class="inspector-value">${esc(raw)}</pre>
    <div class="inspector-label">CSS property</div>
    <code class="inspector-property">${esc(cssName(state.token))}${typeof value === 'object' ? '*' : ''}</code>
    <button type="button" class="btn btn--secondary inspector-copy" data-copy="${esc(typeof value === 'object' ? raw : `var(${cssName(state.token)})`)}">Copy ${typeof value === 'object' ? 'style' : 'CSS value'}</button>
    <div class="inspector-source"><span>Canonical source</span><a class="text-link" href="${asset('tokens/app-stylr.json')}">tokens/app-stylr.json ↗</a></div>`;
  $$('[data-token]').forEach(element => element.classList.toggle('inspected', element.dataset.token === state.token));
}
function render() {
  const html = document.documentElement;
  html.dataset.appStylrTheme = state.theme;
  html.dataset.appStylrAccent = state.accent;
  html.dataset.appStylrTone = state.tone;
  html.dataset.appStylrDensity = state.density;
  html.dataset.density = state.density;
  $('#theme-label').textContent = state.theme === 'dark' ? 'Dark' : 'Light';
  $('#theme-toggle').setAttribute('aria-label', `Switch to ${state.theme === 'dark' ? 'light' : 'dark'} theme`);
  $('#density-select').value = state.density;
  $('#accent-select').value = state.accent;
  $('#tone-select').value = state.tone;
  $('#section-nav').innerHTML = Object.entries(sections).map(([key, [name]], index) => `<a href="?accent=${state.accent}&section=${key}&theme=${state.theme}&density=${state.density}&tone=${state.tone}" data-section="${key}"${key === state.section ? ' aria-current="page"' : ''}><span class="nav-number">${String(index + 1).padStart(2, '0')}</span>${name}</a>`).join('');
  const navigation = $('#section-nav');
  const activeLink = navigation.querySelector('[aria-current]');
  const navBounds = navigation.getBoundingClientRect();
  const activeBounds = activeLink.getBoundingClientRect();
  if (activeBounds.left < navBounds.left) navigation.scrollLeft -= navBounds.left - activeBounds.left;
  else if (activeBounds.right > navBounds.right) navigation.scrollLeft += activeBounds.right - navBounds.right;
  const [label, title, description] = sections[state.section];
  $('#section-path-label').textContent = label;
  $('#section-title').textContent = title;
  $('#section-description').textContent = description;
  $('#section-content').innerHTML = renderers[state.section]();
  $('#reference-version').textContent = `v${canonical.version}`;
  $('#current-palette').textContent = `${accentNames[state.accent]} · ${toneNames[state.tone]} · ${state.theme}`;
  $('#json-download').href = asset('tokens/app-stylr.json');
  renderInspector();
  updateUrl();
}
function setSection(section, push = true) {
  if (!Object.hasOwn(sections, section)) return;
  if (push && state.section !== section) {
    const url = new URL(location.href);
    url.searchParams.set('section', section);
    history.pushState(null, '', url);
  }
  state.section = section;
  render();
  window.scrollTo({ top: 0, behavior: 'instant' });
  $('#section-title').focus({ preventScroll: true });
}
function inspect(path) {
  state.token = path;
  renderInspector();
  if (!$('#token-dialog').open) $('#token-dialog').showModal();
}
document.addEventListener('click', async event => {
  const sectionLink = event.target.closest('[data-section]');
  if (sectionLink && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
    event.preventDefault();
    setSection(sectionLink.dataset.section);
    return;
  }
  const button = event.target.closest('button');
  if (!button) return;
  if (button.dataset.token) inspect(button.dataset.token);
  if (button.dataset.accent) {
    state.accent = button.dataset.accent;
    render();
    $(`[data-accent="${state.accent}"]`)?.focus({ preventScroll: true });
    return;
  }
  if (button.hasAttribute('data-select-row')) { state.selected = !state.selected; render(); }
  if (button.hasAttribute('data-reset')) { state.name = 'Fieldnotes'; state.view = 'Project swimlanes'; state.saved = false; render(); }
  if (button.hasAttribute('data-loading') && !state.loading) {
    state.loading = true;
    render();
    setTimeout(() => { state.loading = false; render(); toast('Loading specimen finished'); }, 1200);
  }
  if (button.hasAttribute('data-clear-search')) { state.filter = ''; render(); $('#feedback-search')?.focus(); }
  if (button.hasAttribute('data-motion-demo')) toast('Control feedback uses the current motion tokens');
  if (button.hasAttribute('data-copy')) {
    try { await navigator.clipboard.writeText(button.dataset.copy); toast('Copied token value'); }
    catch { toast('Select the displayed value to copy it manually'); }
  }
});
document.addEventListener('submit', event => {
  if (!event.target.matches('[data-demo-form]')) return;
  event.preventDefault();
  const formData = new FormData(event.target);
  const name = String(formData.get('workspace')).trim();
  if (!name) {
    const field = event.target.elements.workspace;
    field.setCustomValidity('Enter a workspace name.');
    field.reportValidity();
    return;
  }
  state.name = name;
  state.view = String(formData.get('view'));
  state.saved = true;
  render();
  toast('Values applied to this specimen');
});
document.addEventListener('input', event => {
  if (event.target.name === 'workspace') event.target.setCustomValidity('');
  if (event.target.id === 'feedback-search') { state.filter = event.target.value; $('#search-results').innerHTML = searchResults(); }
});
document.addEventListener('change', event => {
  if (event.target.id === 'required-choice') {
    state.destination = event.target.value;
    state.invalid = !state.destination;
    event.target.setAttribute('aria-invalid', String(state.invalid));
    $('#choice-error').textContent = state.invalid ? 'Choose a destination before continuing.' : 'Destination selected.';
    $('#choice-error').classList.toggle('invalid-help', state.invalid);
  }
  if (event.target.id === 'accent-select') { state.accent = event.target.value; render(); }
  if (event.target.id === 'tone-select') { state.tone = event.target.value; render(); }
  if (event.target.id === 'density-select') { state.density = event.target.value; render(); }
});
$('#theme-toggle').addEventListener('click', () => {
  const old = state.theme;
  state.theme = old === 'dark' ? 'light' : 'dark';
  state.token = state.token.replace(`themes.${old}.`, `themes.${state.theme}.`);
  render();
});
$('#inspect-toggle').addEventListener('click', () => inspect(state.token));
$('#close-token-dialog').addEventListener('click', () => $('#token-dialog').close());
window.addEventListener('popstate', () => {
  const url = new URLSearchParams(location.search);
  state.theme = url.get('theme') === 'light' ? 'light' : 'dark';
  state.accent = Object.hasOwn(accentNames, url.get('accent')) ? url.get('accent') : 'mint';
  state.tone = Object.hasOwn(toneNames, url.get('tone')) ? url.get('tone') : 'normal';
  state.density = url.get('density') === 'compact' ? 'compact' : 'comfortable';
  setSection(url.get('section') || 'overview', false);
});
render();
await document.fonts.ready;
document.documentElement.dataset.ready = '1';
