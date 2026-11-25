// Styles inside the shadow roots, so YouTube's CSS can't reach in and ours can't leak out.
// The few rules that must live on YouTube's page are in entrypoints/content/page.css.

const EASE = 'cubic-bezier(.2, 0, 0, 1)';

export const CHEVRON_CSS = `
  :host {
    display: inline-flex !important;
    height: 100%;
    vertical-align: top;
    flex-shrink: 0;
  }
  button {
    all: unset;
    box-sizing: border-box;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 100%;
    margin-left: -6px;
    color: #fff;
    cursor: pointer;
    opacity: .9;
    -webkit-tap-highlight-color: transparent;
  }
  button:hover { opacity: 1; }
  button:focus-visible { outline: 2px solid #3ea6ff; outline-offset: -6px; border-radius: 8px; }
  svg {
    width: 14px;
    height: 14px;
    filter: drop-shadow(0 0 2px rgba(0, 0, 0, .5));
    transition: transform .22s ${EASE};
  }
  button[aria-expanded="true"] svg { transform: rotate(180deg); }
  @media (prefers-reduced-motion: reduce) { svg { transition: none; } }
`;

export const PANEL_CSS = `
  :host {
    all: initial;
    position: absolute;
    z-index: 75;
    right: 12px;
    bottom: 60px;
    font: 14px/1.35 "YouTube Sans", Roboto, Arial, sans-serif;
    color: #f1f1f1;
    -webkit-font-smoothing: antialiased;
    /* The host keeps the panel's size while it's closed: without this it would catch the video's
       clicks there (and picker.ts stops those from reaching the player). Only the open panel takes them. */
    pointer-events: none;
  }
  * { box-sizing: border-box; }

  .panel {
    display: flex;
    flex-direction: column;
    width: 300px;
    max-width: calc(100vw - 24px);
    max-height: var(--max-height, 420px);
    overflow: hidden;
    border-radius: 12px;
    background: rgba(28, 28, 28, .92);
    backdrop-filter: blur(16px) saturate(1.4);
    box-shadow: 0 10px 36px rgba(0, 0, 0, .5), inset 0 0 0 1px rgba(255, 255, 255, .08);
    color-scheme: dark;
    transform-origin: calc(100% - var(--anchor-offset, 20px)) 100%;
    opacity: 0;
    visibility: hidden;
    transform: translateY(8px) scale(.97);
    transition: opacity .12s ease, transform .12s ${EASE}, visibility 0s linear .12s;
  }
  .panel.open {
    pointer-events: auto;
    opacity: 1;
    visibility: visible;
    transform: none;
    transition: opacity .16s ease, transform .2s ${EASE}, visibility 0s;
  }

  .view {
    display: flex;
    flex-direction: column;
    min-height: 0;
    padding: 6px;
  }
  .view.forward { animation: in-forward .2s ${EASE}; }
  .view.backward { animation: in-backward .2s ${EASE}; }
  @keyframes in-forward { from { opacity: 0; transform: translateX(14px); } }
  @keyframes in-backward { from { opacity: 0; transform: translateX(-14px); } }

  header {
    display: flex;
    align-items: center;
    gap: 4px;
    min-height: 38px;
    padding: 0 6px 0 10px;
    font-weight: 600;
    font-size: 15px;
  }
  header.with-back { padding-left: 0; }
  header h2 { flex: 1; margin: 0; font: inherit; }

  .list {
    min-height: 0;
    overflow-y: auto;
    overscroll-behavior: contain;
    scrollbar-width: thin;
    scrollbar-color: rgba(255, 255, 255, .25) transparent;
  }
  .separator { height: 1px; margin: 6px 4px; background: rgba(255, 255, 255, .1); flex-shrink: 0; }

  button {
    all: unset;
    box-sizing: border-box;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
  }
  button:focus-visible, input:focus-visible { outline: 2px solid #3ea6ff; outline-offset: -2px; }

  .row {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    min-height: 40px;
    padding: 0 10px;
    border-radius: 8px;
    transition: background-color .12s ease;
  }
  .row:hover:not([aria-disabled="true"]) { background: rgba(255, 255, 255, .1); }
  .row[aria-disabled="true"] { cursor: default; }
  .row[aria-disabled="true"] .name { color: rgba(255, 255, 255, .45); }

  .check { width: 18px; flex-shrink: 0; display: flex; justify-content: center; }
  .check svg { width: 18px; height: 18px; opacity: 0; transform: scale(.6); transition: opacity .14s, transform .18s ${EASE}; }
  [aria-pressed="true"] > .check svg, [aria-checked="true"] > .check svg { opacity: 1; transform: none; }

  .label { flex: 1; min-width: 0; display: flex; align-items: baseline; gap: 8px; }
  .name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .local { flex-shrink: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #aaa; font-size: 12px; }
  .detail { flex-shrink: 0; color: #aaa; font-size: 12px; white-space: nowrap; }
  .detail.loading { width: 64px; height: 10px; border-radius: 5px; background: rgba(255, 255, 255, .12); animation: pulse 1s ease-in-out infinite alternate; }
  @keyframes pulse { to { opacity: .4; } }

  .switch {
    position: relative;
    flex-shrink: 0;
    width: 32px;
    height: 18px;
    border-radius: 9px;
    background: rgba(255, 255, 255, .25);
    transition: background-color .16s ease;
  }
  .switch::after {
    content: '';
    position: absolute;
    top: 2px;
    left: 2px;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: #fff;
    transition: transform .18s ${EASE};
  }
  [aria-checked="true"] > .switch { background: #3ea6ff; }
  [aria-checked="true"] > .switch::after { transform: translateX(14px); }
  /* Rows with a fixed icon in the check column (Original audio, Edit languages). */
  .check.icon svg { opacity: .9; transform: none; }

  /* Dual subtitles: the language of the second line, one of the user's. */
  .chips {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
    padding: 2px 10px 8px 38px;
    flex-shrink: 0;
  }
  .chips-label { width: 100%; color: #aaa; font-size: 12px; }
  .chip {
    display: inline-flex;
    align-items: center;
    max-width: 100%;
    height: 26px;
    padding: 0 10px;
    border-radius: 13px;
    background: rgba(255, 255, 255, .1);
    font-size: 13px;
    white-space: nowrap;
    transition: background-color .12s ease, color .12s ease;
  }
  .chip:hover:not([aria-disabled="true"]) { background: rgba(255, 255, 255, .2); }
  .chip[aria-checked="true"] { background: #f1f1f1; color: #0f0f0f; font-weight: 500; }
  .chip[aria-disabled="true"] { opacity: .4; cursor: default; }

  .icon { display: flex; flex-shrink: 0; }
  .icon svg { width: 18px; height: 18px; }

  .note { padding: 6px 10px 8px; color: #aaa; font-size: 12px; }
  .note button { color: #3ea6ff; font-weight: 600; margin-left: 4px; }

  .back, .tool {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    flex-shrink: 0;
  }
  .back:hover, .tool:hover:not(:disabled) { background: rgba(255, 255, 255, .1); }
  .tool:disabled { opacity: .3; cursor: default; }
  .back svg, .tool svg { width: 18px; height: 18px; }

  .search {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 2px 4px 6px;
    padding: 0 10px;
    height: 38px;
    border-radius: 19px;
    background: rgba(255, 255, 255, .08);
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, .12);
    flex-shrink: 0;
  }
  .search:focus-within { box-shadow: inset 0 0 0 1px #3ea6ff; }
  .search svg { width: 18px; height: 18px; flex-shrink: 0; color: #aaa; }
  input {
    all: unset;
    flex: 1;
    min-width: 0;
    height: 100%;
    color: #fff;
    font: inherit;
  }
  input::placeholder { color: #909090; }
  input:focus-visible { outline: none; }

  .edit-row { display: flex; align-items: center; gap: 2px; min-height: 40px; padding-left: 10px; border-radius: 8px; }
  .edit-row:hover { background: rgba(255, 255, 255, .06); }
  .edit-row .label { padding-right: 4px; }

  .status { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }

  @media (prefers-reduced-motion: reduce) {
    .panel, .panel.open { transition: opacity .1s ease, visibility 0s; transform: none; }
    .view.forward, .view.backward { animation: none; }
    .check svg, .switch, .switch::after, .chip { transition: none; }
  }
`;

/** Dual subtitles on the video (src/ui/lines.ts). Sizes and colours come from YouTube's captions. */
export const LINES_CSS = `
  :host {
    all: initial;
    position: absolute;
    z-index: 40;
    left: 0;
    right: 0;
    bottom: calc(2% + var(--lift, 0px));
    display: none;
    flex-direction: column;
    align-items: center;
    pointer-events: none;
    font: calc(var(--size, 16px) * var(--scale, 1))/1.36 "YouTube Noto", Roboto, Arial, Helvetica, Verdana, "PT Sans Caption", sans-serif;
    text-align: center;
    transition: bottom .25s cubic-bezier(0, 0, .2, 1);
  }
  :host([data-on]) { display: flex; }

  .row { max-width: 92%; text-wrap: balance; }
  .row[hidden] { display: none; }
  /* The second language: set apart, smaller and in another colour, so it never reads as a second
     line of the first. */
  .row.bottom { margin-top: .32em; font-size: .86em; }
  .row.bottom .line { color: var(--second, #ffe066); }
  .line {
    padding: .09em .3em;
    color: var(--color, #fff);
    background: var(--background, rgba(8, 8, 8, .75));
    white-space: pre-wrap;
    -webkit-box-decoration-break: clone;
    box-decoration-break: clone;
  }

  @media (prefers-reduced-motion: reduce) { :host { transition: none; } }
`;
