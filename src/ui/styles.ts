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
    .check svg { transition: none; }
  }
`;
