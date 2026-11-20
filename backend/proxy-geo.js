// Resolve the exit location of a proxy so a GPM-core profile can present a
// timezone / geolocation / WebRTC IP that agree with the IP websites will see.
//
// The lookup goes THROUGH the proxy (so it reports the proxy's exit IP, not ours)
// and is cached per profile: it only runs again when the proxy changes.
// Every failure resolves to null — geo is an enhancement, never a launch blocker.

import fs from 'node:fs';
import path from 'node:path';
import axios from 'axios';

export const GEO_CACHE_RELATIVE = path.join('Default', 'GPMSoft', 'proxy_geo.json');
const GEO_URL = 'http://ip-api.com/json/?fields=status,query,timezone,lat,lon,countryCode';

/** Playwright proxy config → axios proxy config. Only http(s) proxies are supported. */
export function toAxiosProxy(proxy) {
    if (!proxy || !proxy.server) return null;
    let u;
    try { u = new URL(proxy.server); } catch { return null; }
    if (!/^https?:$/.test(u.protocol)) return null; // socks5 etc. → skip
    const cfg = {
        protocol: u.protocol.replace(':', ''),
        host: u.hostname,
        port: Number(u.port) || (u.protocol === 'https:' ? 443 : 80)
    };
    if (proxy.username) cfg.auth = { username: proxy.username, password: proxy.password || '' };
    return cfg;
}

export async function fetchProxyGeo(proxy, { http = axios, timeoutMs = 8000 } = {}) {
    const axiosProxy = toAxiosProxy(proxy);
    if (!axiosProxy) return null;
    try {
        const { data } = await http.get(GEO_URL, { proxy: axiosProxy, timeout: timeoutMs });
        if (!data || data.status !== 'success' || !data.timezone) return null;
        return { ip: data.query, timezone: data.timezone, latitude: data.lat, longitude: data.lon, country: data.countryCode };
    } catch {
        return null;
    }
}

const proxyKey = (proxy) => (proxy ? `${proxy.server}|${proxy.username || ''}` : '');

export function readGeoCache(userDataDir) {
    try { return JSON.parse(fs.readFileSync(path.join(userDataDir, GEO_CACHE_RELATIVE), 'utf8')); } catch { return null; }
}

export function writeGeoCache(userDataDir, key, geo) {
    const file = path.join(userDataDir, GEO_CACHE_RELATIVE);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify({ key, geo }));
}

/** Geo for this proxy: from cache when the proxy is unchanged, otherwise looked up. */
export async function resolveProxyGeo(userDataDir, proxy, deps = {}) {
    const key = proxyKey(proxy);
    if (!key) return null;
    const cached = readGeoCache(userDataDir);
    if (cached && cached.key === key && cached.geo) return cached.geo;
    const geo = await (deps.fetch || fetchProxyGeo)(proxy);
    if (geo) writeGeoCache(userDataDir, key, geo);
    return geo;
}
