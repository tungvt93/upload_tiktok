const http = require('http');

http.get('http://localhost:3010/api/profiles', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    try {
      const profiles = JSON.parse(data);
      const alejo = profiles.find(p => p.name.includes('Alejo Igoa28'));
      console.log('Profile Alejo Igoa28:');
      console.log(alejo);
    } catch (e) {
      console.error('Error parsing JSON', e);
    }
  });
}).on('error', err => {
  console.error('HTTP GET Error', err);
});
