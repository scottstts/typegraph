export function isLocalHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  return (
    normalized === "localhost" ||
    normalized === "127.0.0.1" ||
    normalized === "::1" ||
    normalized === "[::1]"
  );
}

export function isLocalOrigin(location: Pick<Location, "hostname">): boolean {
  return isLocalHostname(location.hostname);
}
