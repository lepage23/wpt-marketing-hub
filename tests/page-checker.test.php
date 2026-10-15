<?php
define('ARRAY_A','ARRAY_A'); $routes = array(); $actions = array();
function add_action($h, $f) { global $actions; $actions[$h][] = $f; }
function register_rest_route($ns, $r, $a) { global $routes; $routes[$ns.$r] = $a; }
function home_url($p = '') { return 'https://westpiertech.com' . $p; }
function wp_parse_url($u, $c = -1) { return $c === -1 ? parse_url($u) : parse_url($u, $c); }
function esc_url_raw($u) { return $u; }
function current_user_can($c) { return true; }
function get_option($o) { return $o === 'blog_public' ? 1 : '/%postname%/'; }
function is_wp_error($x) { return is_array($x) && isset($x['wperr']); }
function maybe_unserialize($s) { return @unserialize($s) ?: $s; }
class WP_REST_Request { public $p; function __construct($p){$this->p=$p;} function get_param($k){return $this->p[$k];} }
$PAGES = array(
 'https://westpiertech.com/8x8/' => array(200, '<html><head><title>8x8 | West Pier</title><meta name="description" content="It&#039;s an 8x8 page"><link rel="canonical" href="https://westpiertech.com/other/"><meta name="robots" content="noindex, follow"><meta property="og:image" content="x.jpg"><meta name="google-site-verification" content="abc"><script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"Organization"},{"@type":["WebPage","Service"]}]}</script></head><body><div id="wpadminbar"><a href="/wp-admin/">admin</a></div><header><nav><a href="/">Home</a><a href="/zoom/">Zoom</a></nav></header><main><h1>8x8 phones</h1><h1>Second</h1><h2>A</h2><p>One two three four five.</p><a href="/3cx/?utm=1#x">3CX</a><a href="https://other.com/">ext</a><a href="mailto:a@b.c">mail</a><a href="sub/page">rel</a><img src="a.png" alt=""><img src="b.png" alt="Fine"><img src="c.png"></main><footer><a href="/privacy-policy/">Privacy</a></footer><script>var x="lots of words here";</script></body></html>'),
 'https://westpiertech.com/3cx-brighton/' => array(301, '', 'https://westpiertech.com/business-phone-systems/3cx/brighton/'),
 'https://westpiertech.com/robots.txt' => array(200, "User-agent: *\nAllow: /\nUser-agent: GPTBot\nDisallow: /\nSitemap: https://westpiertech.com/sitemap_index.xml"),
 'https://westpiertech.com/llms.txt' => array(404, ''),
 'https://westpiertech.com/sitemap_index.xml' => array(200, '<sitemapindex><sitemap><loc>https://westpiertech.com/page-sitemap.xml</loc></sitemap></sitemapindex>'),
 'https://westpiertech.com/page-sitemap.xml' => array(200, '<urlset><url><loc>https://westpiertech.com/8x8/</loc></url><url><loc>https://westpiertech.com/3cx-brighton/</loc></url></urlset>'),
 'http://westpiertech.com/' => array(301, '', 'https://westpiertech.com/'),
 'http://www.westpiertech.com/' => array(301, '', 'https://www.westpiertech.com/'),
 'https://www.westpiertech.com/' => array(302, '', 'https://westpiertech.com/'),
 'https://westpiertech.com/' => array(200, '<html><head><title>Home</title></head><body><h1>Home</h1></body></html>'),
);
function wp_remote_get($u, $a) { global $PAGES; if (!isset($PAGES[$u])) return array('code'=>404,'body'=>'','loc'=>''); $p=$PAGES[$u]; return array('code'=>$p[0],'body'=>$p[1],'loc'=>isset($p[2])?$p[2]:''); }
function wp_remote_retrieve_response_code($r) { return $r['code']; }
function wp_remote_retrieve_body($r) { return $r['body']; }
function wp_remote_retrieve_header($r, $h) { return $r['loc']; }
class FakeDB { public $prefix='wp_'; function prepare($q,$a){return $q;} function get_var($q){return 'wp_rank_math_redirections';}
 function get_results($q,$t){ return array(array('id'=>1,'sources'=>serialize(array(array('pattern'=>'3cx-brighton','comparison'=>'exact'))),'url_to'=>'https://westpiertech.com/business-phone-systems/3cx/brighton/','header_code'=>'302','status'=>'active','hits'=>4)); } }
$wpdb = new FakeDB();
require $argv[1];
foreach ($actions['rest_api_init'] as $f) $f();
$check = $routes['wpt-hub/v1/check']['callback'](new WP_REST_Request(array('urls'=>array('https://westpiertech.com/8x8/','https://westpiertech.com/3cx-brighton/','https://evil.com/'))));
$site = $routes['wpt-hub/v1/site']['callback']();
$p = $check[0];
function ok($c,$m){ echo ($c?'PASS ':'FAIL ').$m."\n"; if(!$c) $GLOBALS['fail']=1; }
ok($p['status']===200 && $p['title']==='8x8 | West Pier', 'reads title');
ok($p['description']==="It's an 8x8 page", 'reads description with apostrophe');
ok($p['canonical']==='https://westpiertech.com/other/' && $p['noindex']===true, 'canonical and noindex');
ok($p['h1']===array('8x8 phones','Second') && $p['h2']===1, 'H1s and H2 count');
ok(in_array('Organization',$p['schema']) && in_array('Service',$p['schema']), 'schema types incl @graph and arrays');
ok($p['og_image']==='x.jpg' && $p['google_verify'] && !$p['bing_verify'], 'og image and verification tags');
ok(in_array('https://westpiertech.com/zoom/',$p['links_all']) && !in_array('https://westpiertech.com/zoom/',$p['links_content']), 'nav links counted for site, not content');
ok(in_array('https://westpiertech.com/3cx/',$p['links_content']) && in_array('https://westpiertech.com/8x8/sub/page',$p['links_content']) && count($p['links_content'])===2, 'content links: query stripped, relative resolved, external and mailto dropped');
ok($p['images']===3 && $p['images_no_alt']===2, 'images and missing alt');
ok($p['words']>=5 && $p['words']<20, 'word count skips header, footer, scripts ('.$p['words'].')');
ok($check[1]['status']===301 && $check[1]['location']==='https://westpiertech.com/business-phone-systems/3cx/brighton/', 'redirect reported');
ok($check[2]['error']==='Not on this site', 'refuses other sites');
ok($site['robots']['status']===200 && strpos($site['robots']['body'],'GPTBot')!==false, 'robots.txt read');
ok($site['sitemap_urls']===array('https://westpiertech.com/8x8/','https://westpiertech.com/3cx-brighton/'), 'sitemap index followed to page URLs');
ok($site['llms']===404 && $site['blog_public']===1, 'llms.txt and indexing setting');
ok(count($site['variants'])===4 && $site['variants'][2]['status']===302, 'http/www variants');
ok($site['redirections'][0]['sources'][0]['pattern']==='3cx-brighton' && $site['redirections'][0]['header_code']==='302', 'Rank Math redirects read');
echo json_encode(array('check'=>$check,'site'=>$site));
