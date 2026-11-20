// Agent Office icon set: thin line pictograms in the spirit of Apple's SF Symbols (24 px grid, 1.7 stroke,
// round caps, current text colour). One inline SVG sprite; use as <svg class="i"><use href="#i-NAME"/></svg> or ico('NAME').
(function () {
  const P = {
    globe: '<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="3.8" ry="9"/><path d="M3.3 9.5h17.4M3.3 14.5h17.4"/>',
    doc: '<path d="M14 3H7.2A2.2 2.2 0 0 0 5 5.2v13.6A2.2 2.2 0 0 0 7.2 21h9.6a2.2 2.2 0 0 0 2.2-2.2V8z"/><path d="M14 3v5h5M8.8 13h6.4M8.8 16.8h4.2"/>',
    deck: '<rect x="3" y="3.8" width="18" height="12.4" rx="2.2"/><path d="M12 16.2v3.5M8.2 20.2h7.6M8.5 12.6v-2M12 12.6V7.8M15.5 12.6V9.6"/>',
    search: '<circle cx="10.8" cy="10.8" r="6.6"/><path d="M15.6 15.6 20.5 20.5"/>',
    code: '<path d="M8.4 7.6 4 12l4.4 4.4M15.6 7.6 20 12l-4.4 4.4M13.6 5.2l-3.2 13.6"/>',
    megaphone: '<path d="M3.5 10.2v3.6c0 .7.5 1.2 1.2 1.2h2.6l6.2 4V5L7.3 9H4.7c-.7 0-1.2.5-1.2 1.2z"/><path d="M17 9.2a4 4 0 0 1 0 5.6M19.4 7a7 7 0 0 1 0 10M7.6 15l1.3 4.4"/>',
    sparkles: '<path d="M10.5 3.5 12.3 9l5.2 1.8-5.2 1.8-1.8 5.4-1.8-5.4-5.2-1.8L8.7 9z"/><path d="M18 14.5l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z"/>',
    bolt: '<path d="M13.2 2.8 4.8 13.6h6.4l-1 7.6 8.4-10.8h-6.4z"/>',
    lock: '<rect x="4.8" y="10.4" width="14.4" height="10.2" rx="2.6"/><path d="M8.2 10.4V7.6a3.8 3.8 0 0 1 7.6 0v2.8M12 14.6v2"/>',
    display: '<rect x="2.8" y="3.8" width="18.4" height="12.6" rx="2.2"/><path d="M9 20.4h6M12 16.4v4"/>',
    cursor: '<path d="M5.6 3.6v15.2l4.1-4 2.7 5.8 2.5-1.1-2.7-5.8h5.6z"/>',
    wand: '<path d="M4 20 14.4 9.6"/><path d="M14.5 3.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8zM19.2 10.8l.5 1.3 1.3.5-1.3.5-.5 1.3-.5-1.3-1.3-.5 1.3-.5z"/>',
    folder: '<path d="M3 7.2A2.2 2.2 0 0 1 5.2 5h3.9l2.1 2.2h7.6A2.2 2.2 0 0 1 21 9.4v8.4a2.2 2.2 0 0 1-2.2 2.2H5.2A2.2 2.2 0 0 1 3 17.8z"/>',
    book: '<path d="M12 6.4C10.4 5 8 4.4 4 4.6v13.8c4-.2 6.4.4 8 1.8 1.6-1.4 4-2 8-1.8V4.6c-4-.2-6.4.4-8 1.8zM12 6.4v13.8"/>',
    pencil: '<path d="M4.2 19.8 5.2 15.6 15.8 5a2 2 0 0 1 2.9 0l.3.3a2 2 0 0 1 0 2.9L8.4 18.8z"/><path d="M13.8 7l3.2 3.2"/>',
    compose: '<path d="M11 4.2H6.4a2.2 2.2 0 0 0-2.2 2.2v11.2a2.2 2.2 0 0 0 2.2 2.2h11.2a2.2 2.2 0 0 0 2.2-2.2V13"/><path d="M17.4 3.6a1.9 1.9 0 0 1 2.7 2.7L12.6 13.8 9.4 14.6l.8-3.2z"/>',
    stack: '<path d="M12 3.4 21 8.2l-9 4.8-9-4.8z"/><path d="M3 12.4l9 4.8 9-4.8M3 16.4l9 4.8 9-4.8"/>',
    terminal: '<rect x="2.8" y="4" width="18.4" height="16" rx="2.6"/><path d="m7.2 9.4 3 2.6-3 2.6M12.6 15h4.4"/>',
    camera: '<path d="M3.8 8.6a2.2 2.2 0 0 1 2.2-2.2h1.9l1.5-2.2h5.2l1.5 2.2H18a2.2 2.2 0 0 1 2.2 2.2v8.8A2.2 2.2 0 0 1 18 19.6H6a2.2 2.2 0 0 1-2.2-2.2z"/><circle cx="12" cy="12.8" r="3.4"/>',
    warning: '<path d="M10.3 4.6a2 2 0 0 1 3.4 0l7.4 12.8a2 2 0 0 1-1.7 3H4.6a2 2 0 0 1-1.7-3z"/><path d="M12 9.4v4.2M12 16.8h.01"/>',
    star: '<path d="M12 3.6l2.6 5.3 5.8.8-4.2 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z"/>',
    photo: '<rect x="3" y="4.6" width="18" height="14.8" rx="2.4"/><circle cx="8.6" cy="9.8" r="1.6"/><path d="M21 15.4l-4.6-4.6L7.4 19.4"/>',
    table: '<rect x="3" y="4" width="18" height="16" rx="2.4"/><path d="M3 9.6h18M3 14.8h18M9.4 9.6V20"/>',
    external: '<path d="M7 17 17 7M9 7h8v8"/>',
    xmark: '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
    check: '<path d="M5 12.6l4.4 4.4L19 7.4"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    link: '<path d="M10 14a4.2 4.2 0 0 0 6 0l3.2-3.2a4.2 4.2 0 0 0-6-6L12 6"/><path d="M14 10a4.2 4.2 0 0 0-6 0l-3.2 3.2a4.2 4.2 0 0 0 6 6L12 18"/>',
    laptop: '<rect x="4.4" y="4.6" width="15.2" height="10.8" rx="1.8"/><path d="M2.4 19.2h19.2"/>',
    refresh: '<path d="M19.6 12a7.6 7.6 0 1 1-2.2-5.4"/><path d="M19.8 4v4.2h-4.2"/>',
    chart: '<path d="M4 20.5h16"/><path d="M6.5 17V12M11 17V6.5M15.5 17v-7.5M20 17V4" stroke-width="2.1"/>',
    download: '<path d="M12 3.5v11M7.5 10l4.5 4.5 4.5-4.5"/><path d="M4.5 15.5v2.3a2.2 2.2 0 0 0 2.2 2.2h10.6a2.2 2.2 0 0 0 2.2-2.2v-2.3"/>',
    chevron: '<path d="M7 9.5l5 5 5-5"/>',
    arrowUp: '<path d="M12 19V5.5M6 11l6-6 6 6" stroke-width="2.2"/>',
    flag: '<path d="M5.4 21V4.2M5.4 4.6h11.4l-2.2 4 2.2 4H5.4"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M10.6 3.2h2.8l.5 2.3 1.6.7 2-1.3 2 2-1.3 2 .7 1.6 2.3.5v2.8l-2.3.5-.7 1.6 1.3 2-2 2-2-1.3-1.6.7-.5 2.3h-2.8l-.5-2.3-1.6-.7-2 1.3-2-2 1.3-2-.7-1.6-2.3-.5v-2.8l2.3-.5.7-1.6-1.3-2 2-2 2 1.3 1.6-.7z"/>',
    arrowLeft: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
  };
  const sprite = '<svg xmlns="http://www.w3.org/2000/svg" style="position:absolute;width:0;height:0;overflow:hidden" aria-hidden="true">' +
    Object.entries(P).map(([k, v]) => `<symbol id="i-${k}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${v}</symbol>`).join('') + '</svg>';
  const put = () => { if (!document.getElementById('i-globe')) document.body.insertAdjacentHTML('afterbegin', sprite); };
  if (document.body) put(); else document.addEventListener('DOMContentLoaded', put);
  window.ico = (name, cls = '') => `<svg class="i${cls ? ' ' + cls : ''}" aria-hidden="true"><use href="#i-${name}"/></svg>`;
  window.AO_ICONS = Object.keys(P);
})();
