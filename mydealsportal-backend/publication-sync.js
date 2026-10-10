// Server-only publication synchronization draft.
export function desiredPublication({paid, suspended}) {
  return paid === true && suspended !== true;
}
