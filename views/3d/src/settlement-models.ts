export const SETTLEMENT_MODELS: Record<string, {
  width: number;
  depth: number;
  scale: number;
  frontAngle: number;
  centerX?: number;
  centerZ?: number;
}> = {
  house_timber: { width: 5.48, depth: 4.28, scale: 0.48, frontAngle: 0 },
  house_plaster: { width: 5.46, depth: 4.73, scale: 0.48, frontAngle: 0 },
  townhouse: { width: 4.64, depth: 5.87, scale: 0.48, frontAngle: 0 },
  barn: { width: 6.48, depth: 4.66, scale: 0.38, frontAngle: 0 },
  shed: { width: 3.32, depth: 2.42, scale: 0.48, frontAngle: 0 },
  well: { width: 2.595, depth: 2.01, scale: 0.55, frontAngle: 0 },
  church: { width: 9.471, depth: 5.742, scale: 0.38, frontAngle: Math.PI / 2, centerX: -0.885 },
  church_gothic: { width: 7.52, depth: 11.67, scale: 0.3, frontAngle: 0 },
  fence_gate: { width: 6, depth: 1.815, scale: 0.46, frontAngle: 0 },
  haystack: { width: 1.901, depth: 1.92, scale: 0.65, frontAngle: 0 },
  timber_pile: { width: 0.899, depth: 1.994, scale: 0.65, frontAngle: 0 },
};
