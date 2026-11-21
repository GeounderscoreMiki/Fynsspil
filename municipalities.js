// Kommuner med koordinater (grader + decimalminutter). Cirkel-id = kommunens id.
const dm = (d, m) => d + m / 60;

const municipalities = [
  { id: 'langeland', lat: dm(54, 56.94), lng: dm(10, 47.7) },
  { id: 'kerteminde', lat: dm(55, 27.18), lng: dm(10, 36.24) },
  { id: 'assens', lat: dm(55, 19.14), lng: dm(10, 2.28) },
  { id: 'svendborg', lat: dm(55, 6.18), lng: dm(10, 36.66) },
  { id: 'nordfyns', lat: dm(55, 31.86), lng: dm(10, 14.82) },
  { id: 'aeroe', lat: dm(54, 53.46), lng: dm(10, 24.42) },
  { id: 'middelfart', lat: dm(55, 27.36), lng: dm(9, 56.7) },
  { id: 'faaborg', lat: dm(55, 13.62), lng: dm(10, 24.42) },
  { id: 'nyborg', lat: dm(55, 19.14), lng: dm(10, 41.4) },
  { id: 'odense', lat: dm(55, 23.34), lng: dm(10, 21.42) },
];

export { municipalities };
