/** The only names the panel answers to: it runs on this machine for one person (spec section 2) */
const LOCAL_NAMES = ['127.0.0.1', 'localhost'];

/**
 * Whether a request's Host header names this machine (and the panel's port, when known). A web
 * page elsewhere can point its own domain at 127.0.0.1 (DNS rebinding) and make the browser call
 * the panel; its requests still carry that domain in Host, so they are refused.
 */
export function isAllowedHost(host: string | null, port?: string): boolean {
  if (!host) return false;
  const match = /^([^:]+)(?::(\d{1,5}))?$/.exec(host.trim().toLowerCase());
  if (!match) return false;
  const [, name, hostPort] = match;
  if (!LOCAL_NAMES.includes(name!)) return false;
  return !port || hostPort === port;
}
