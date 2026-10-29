import { isIPv4, isIPv6 } from 'node:net';

const IPV4_MAPPED_PREFIX = '::ffff:';

/**
 * Keeps the network an address belongs to, not the machine: the last byte of
 * an IPv4 address, everything after the first 48 bits of an IPv6 one. Enough
 * to tell a burst from one provider apart from a spread of attempts, without
 * keeping an identifier of the person behind it for a year.
 *
 * Express reports IPv4 clients of a dual-stack socket as `::ffff:a.b.c.d`; they
 * are truncated as the IPv4 addresses they are. Anything that is not an IP is
 * dropped rather than stored as given.
 */
export function truncateIp(ip: string | undefined): string | null {
  if (!ip) {
    return null;
  }

  const v4 = ip.toLowerCase().startsWith(IPV4_MAPPED_PREFIX)
    ? ip.slice(IPV4_MAPPED_PREFIX.length)
    : ip;
  if (isIPv4(v4)) {
    return `${v4.split('.').slice(0, 3).join('.')}.0`;
  }

  if (isIPv6(ip)) {
    return `${expandIpv6(ip).slice(0, 3).join(':')}::`;
  }

  return null;
}

function expandIpv6(ip: string): string[] {
  const [head, tail = ''] = ip.split('::');
  const left = head ? head.split(':') : [];
  const right = tail ? tail.split(':') : [];
  const missing = ip.includes('::') ? 8 - left.length - right.length : 0;

  return [...left, ...Array<string>(missing).fill('0'), ...right].map((group) =>
    group.toLowerCase().replace(/^0+(?=.)/, ''),
  );
}
