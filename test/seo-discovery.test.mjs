import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const root = new URL('../public/', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');
const host = 'https://sync.jussco.company';
test('SYNC discovery metadata uses the approved public hostname, not workers.dev', () => {
  const files = ['robots.txt','sitemap.xml','llms.txt','crawlers.json','index.html','chat/index.html'];
  for (const file of files) {
    const content = read(file);
    assert.doesNotMatch(content, /sync-party-game\.mcgill-raylene\.workers\.dev/i, file);
  }
  assert.match(read('robots.txt'), /Sitemap: https:\/\/sync\.jussco\.company\/sitemap\.xml/);
  for (const path of ['/', '/chat/']) assert.ok(read('sitemap.xml').includes('<loc>'+host+path+'</loc>'));
  for (const [file,path] of [['index.html','/'],['chat/index.html','/chat/']]) {
    assert.ok(read(file).includes('rel="canonical" href="'+host+path+'"'), file);
    assert.match(read(file), /<meta name="description" content="[^"]{30,}"/, file);
  }
  const contract = JSON.parse(read('crawlers.json'));
  assert.equal(contract.site, host+'/');
  assert.deepEqual(contract.private_or_operator_paths, ['/api/', '/control-room', '/control-room.html', '/usage', '/usage.html']);
  assert.match(read('robots.txt'), /Disallow: \/api\//);
  assert.match(read('robots.txt'), /User-agent: GPTBot\nDisallow: \//);
});
