'use strict';
/* GaronchiHisaab — line icons, drawn on a 24px grid with a 2px stroke. icon('home') returns an inline SVG string. */

const ICONS = {
  /* navigation and controls */
  home: '<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13"/><path d="M3.5 6h.01M3.5 12h.01M3.5 18h.01"/>',
  pie: '<circle cx="12" cy="12" r="9"/><path d="M12 3v9h9"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  chart: '<path d="M3 21h18"/><path d="M6 17v-6M12 17V5M18 17V9"/>',
  sliders: '<path d="M4 6h10M18 6h2M4 12h2M10 12h10M4 18h8M16 18h4"/><circle cx="16" cy="6" r="2"/><circle cx="8" cy="12" r="2"/><circle cx="14" cy="18" r="2"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  left: '<path d="M15 5l-7 7 7 7"/>',
  right: '<path d="M9 5l7 7-7 7"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7"/>',
  alert: '<path d="M12 4l9.5 16h-19z"/><path d="M12 10v4M12 17h.01"/>',
  /* categories */
  cart: '<path d="M3 4h2.5l2.2 10.5h10.6L20.5 7H6.6"/><circle cx="9" cy="19" r="1.5"/><circle cx="17" cy="19" r="1.5"/>',
  bus: '<rect x="5" y="3" width="14" height="14" rx="2"/><path d="M5 11h14M8 17v3M16 17v3M8.5 14h.01M15.5 14h.01"/>',
  wifi: '<path d="M2.5 9a14 14 0 0 1 19 0M5.5 12.5a9.5 9.5 0 0 1 13 0M8.5 16a5 5 0 0 1 7 0M12 19.5h.01"/>',
  heart: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
  book: '<path d="M5 4h12a2 2 0 0 1 2 2v14H7a2 2 0 0 1-2-2z"/><path d="M5 18a2 2 0 0 1 2-2h12M9 8h6"/>',
  users: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><path d="M16 5.2a3.2 3.2 0 0 1 0 5.6M18 14.5c1.8.9 3 2.9 3 5.5"/>',
  food: '<path d="M6 3v7a2 2 0 0 0 4 0V3M8 3v18"/><path d="M17 21V3c-2.2 1-3.5 3.5-3.5 7 0 1.700 1.500 3 3.500 3"/>',
  bag: '<path d="M5 8h14l-1 12H6z"/><path d="M9 8V7a3 3 0 0 1 6 0v1"/>',
  play: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M10 9.500v5l4.500-2.500z"/>',
  repeat: '<path d="M17 3l3 3-3 3"/><path d="M4 11V9a3 3 0 0 1 3-3h13"/><path d="M7 21l-3-3 3-3"/><path d="M20 13v2a3 3 0 0 1-3 3H4"/>',
  box: '<path d="M3.500 7.500L12 3l8.500 4.500v9L12 21l-8.500-4.500z"/><path d="M3.500 7.500L12 12l8.500-4.500M12 12v9"/>',
  briefcase: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 13h18"/>',
  laptop: '<rect x="5" y="5" width="14" height="10" rx="1.500"/><path d="M2.500 19h19"/>',
  wallet: '<path d="M4 7a2 2 0 0 1 2-2h11v3"/><rect x="4" y="8" width="17" height="11" rx="2"/><path d="M16.500 13.500h.01M4 7v10"/>',
  gift: '<rect x="4" y="9" width="16" height="11" rx="1.500"/><path d="M3 9h18M12 9v11"/><path d="M12 9c-1.500-4-6-4-5-1.500.500 1.200 2.500 1.500 5 1.500zM12 9c1.500-4 6-4 5-1.500-.500 1.200-2.500 1.500-5 1.500z"/>',
  undo: '<path d="M8 5L4 9l4 4"/><path d="M4 9h10a5 5 0 0 1 0 10H9"/>',
  pluscircle: '<circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/>',
  tag: '<path d="M4 4h7.500L21 13.500 13.500 21 4 11.500z"/><path d="M8 8h.01"/>',
  cup: '<path d="M5 9h12v5a5 5 0 0 1-5 5h-2a5 5 0 0 1-5-5z"/><path d="M17 10h1.500a2.500 2.500 0 0 1 0 5H17M8 3v3M12 3v3"/>',
  star: '<path d="M12 3.500l2.600 5.400 5.900.800-4.300 4.100 1 5.900L12 16.900l-5.200 2.800 1-5.900-4.300-4.100 5.900-.800z"/>',
};

/* icons offered when you add your own category, with the name a screen reader says */
const PICKABLE = {
  tag: 'Tag', star: 'Star', cup: 'Cup', heart: 'Heart', cart: 'Cart', bag: 'Bag', food: 'Food', bus: 'Bus', book: 'Book',
  play: 'Screen', wifi: 'Wifi', users: 'People', gift: 'Gift', wallet: 'Wallet', laptop: 'Laptop', briefcase: 'Briefcase', box: 'Box',
};

/* size: '' for 20px, 's' for 16px */
function icon(name, size) {
  return `<svg class="i${size ? ' ' + size : ''}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ICONS.tag}</svg>`;
}
