import { truncateIp } from './truncate-ip';

describe('truncateIp', () => {
  it('drops the last byte of an IPv4 address', () => {
    expect(truncateIp('203.0.113.42')).toBe('203.0.113.0');
  });

  it('treats an IPv4-mapped IPv6 address as the IPv4 address it is', () => {
    expect(truncateIp('::ffff:203.0.113.42')).toBe('203.0.113.0');
  });

  it('keeps the first 48 bits of an IPv6 address', () => {
    expect(truncateIp('2001:db8:85a3:8d3:1319:8a2e:370:7348')).toBe(
      '2001:db8:85a3::',
    );
  });

  it('expands a compressed IPv6 address before cutting it', () => {
    expect(truncateIp('2001:db8::1')).toBe('2001:db8:0::');
  });

  it('stores nothing for a missing or malformed address', () => {
    expect(truncateIp(undefined)).toBeNull();
    expect(truncateIp('')).toBeNull();
    expect(truncateIp('not-an-ip')).toBeNull();
  });
});
