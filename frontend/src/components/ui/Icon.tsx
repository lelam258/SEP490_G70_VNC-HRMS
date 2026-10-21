const paths = {
  users: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M16 3a4 4 0 0 1 0 8 M22 21v-2a4 4 0 0 0-3-3.87 M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
  search: 'M21 21l-4.35-4.35 M19 11a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
  plus: 'M12 5v14 M5 12h14', arrow: 'M19 12H5 M12 19l-7-7 7-7', chevron: 'M9 5l7 7-7 7', check: 'M20 6L9 17l-5-5',
  lock: 'M5 10h14v11H5z M8 10V7a4 4 0 0 1 8 0v3',
  eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12 M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
  edit: 'M12 20H4V4h8 M16 3l5 5-9 9-5 1 1-5z',
  building: 'M4 21V3h12v18 M16 9h4v12 M2 21h20 M8 7h4 M8 11h4 M8 15h4 M9 21v-3h2v3',
  logout: 'M9 21H3V3h6 M9 12h12 M17 8l4 4-4 4',
  shield: 'M12 3l8 3v6c0 5-8 9-8 9s-8-4-8-9V6z M8 12l3 3 5-6', close: 'M6 6l12 12 M6 18L18 6',
  mail: 'M3 5h18v14H3z M3 5l9 8 9-8', clock: 'M12 8v4l3 2 M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
};
export default function Icon({ name, size = 20 }: { name: keyof typeof paths; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>;
}
