import test from 'node:test';
import assert from 'node:assert/strict';
import { toAxiosProxy, fetchProxyGeo } from '../proxy-geo.js';

test('toAxiosProxy maps http proxies with auth and rejects socks', () => {
    assert.deepEqual(toAxiosProxy({ server: 'http://1.2.3.4:8080', username: 'u', password: 'p' }),
        { protocol: 'http', host: '1.2.3.4', port: 8080, auth: { username: 'u', password: 'p' } });
    assert.equal(toAxiosProxy({ server: 'socks5://1.2.3.4:1080' }), null);
    assert.equal(toAxiosProxy(null), null);
});

test('fetchProxyGeo returns normalised geo, null on failure or bad payload', async () => {
    const ok = { get: async () => ({ data: { status: 'success', query: '5.6.7.8', timezone: 'Asia/Tokyo', lat: 35.6, lon: 139.7, countryCode: 'JP' } }) };
    assert.deepEqual(await fetchProxyGeo({ server: 'http://p:1' }, { http: ok }),
        { ip: '5.6.7.8', timezone: 'Asia/Tokyo', latitude: 35.6, longitude: 139.7, country: 'JP' });
    assert.equal(await fetchProxyGeo({ server: 'http://p:1' }, { http: { get: async () => { throw new Error('x'); } } }), null);
    assert.equal(await fetchProxyGeo({ server: 'http://p:1' }, { http: { get: async () => ({ data: { status: 'fail' } }) } }), null);
});
