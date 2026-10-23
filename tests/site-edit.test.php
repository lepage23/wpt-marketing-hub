<?php
/* Version 13 site fixes: push, check the result, undo, check it's back exactly. */
$routes=array();$actions=array();$META=array();$OPT=array('page_for_posts'=>30);$POSTS=array();$MENUS=array();
function add_action($h,$f,$p=10){global $actions;$actions[$h][]=$f;} function register_rest_route($ns,$r,$a){global $routes;$routes[$ns.$r]=$a;}
function home_url($p=''){return 'https://westpiertech.com'.$p;} function wp_parse_url($u,$c=-1){return $c===-1?parse_url($u):parse_url($u,$c);}
function current_user_can($c,$id=0){return true;} function wp_strip_all_tags($s){return strip_tags($s);} function wp_json_encode($v){return json_encode($v);}
function wp_slash($s){return $s;} function wp_rand($a,$b){return rand($a,$b);} function esc_url_raw($u){return $u;} function esc_html($s){return htmlspecialchars($s);} function esc_attr($s){return htmlspecialchars($s,ENT_QUOTES);}
function sanitize_text_field($s){return trim($s);} function sanitize_textarea_field($s){return trim($s);} function untrailingslashit($s){return rtrim($s,'/');} function wp_unslash($s){return $s;}
function get_post_meta($id,$k,$single=true){global $META;return isset($META[$id][$k])?$META[$id][$k]:'';}
function update_post_meta($id,$k,$v){global $META;$META[$id][$k]=$v;} function delete_post_meta($id,$k){global $META;unset($META[$id][$k]);}
function get_option($k,$d=false){global $OPT;return array_key_exists($k,$OPT)?$OPT[$k]:$d;} function update_option($k,$v,$a=null){global $OPT;$OPT[$k]=$v;} function delete_option($k){global $OPT;unset($OPT[$k]);}
function get_post_field($f,$id){global $POSTS;return isset($POSTS[$id])?$POSTS[$id]:'';}
function get_the_title($id){return $id==30?'News':'Page '.$id;} function get_permalink($id){return 'https://westpiertech.com/p'.$id.'/';}
function attachment_url_to_postid($u){return strpos($u,'/uploads/team.jpg')!==false?501:(strpos($u,'/uploads/logo.png')!==false?502:0);}
function is_wp_error($x){return $x instanceof WP_Error;} function wp_get_attachment_url($id){return $id==502?'https://westpiertech.com/uploads/logo.png':'';}
function wp_get_nav_menus(){return array((object)array('term_id'=>7,'name'=>'Footer'));}
function wp_get_nav_menu_items($t){global $MENUS;return $MENUS;}
function wp_update_nav_menu_item($m,$i,$a){global $MENUS;$o=(object)array('ID'=>900,'title'=>$a['menu-item-title'],'url'=>$a['menu-item-url'],'menu_order'=>$a['menu-item-position'],'menu_item_parent'=>$a['menu-item-parent-id']);$MENUS[]=$o;return 900;}
function wp_delete_post($id,$f){global $MENUS;$MENUS=array_values(array_filter($MENUS,function($o)use($id){return $o->ID!=$id;}));}
function get_post($id){global $MENUS;foreach($MENUS as $o)if($o->ID==$id)return $o;return null;}
function current_time($t,$g=0){return '2026-10-22 18:00:00';}
class FakeDb{public $posts='wp_posts';public $prefix='wp_';function update($tb,$d,$w){global $POSTS;if($tb==='wp_posts'&&isset($d['post_content']))$POSTS[$w['ID']]=$d['post_content'];}}
$wpdb=new FakeDb();
function wp_update_post($a){if(isset($a['post_content']))throw new Exception('wp_update_post must not be used for page text: it strips backslashes');return $a['ID'];}
class WP_Error{public $m;function __construct($c,$m,$d=null){$this->m=$m;}}
class WP_REST_Request{public $p;function __construct($p){$this->p=$p;}function get_param($k){return isset($this->p[$k])?$this->p[$k]:null;}}
require $argv[1]; foreach($actions['rest_api_init'] as $f)$f();
function ok($c,$m){echo ($c?'PASS ':'FAIL ').$m."\n";}
$E=$routes['wpt-hub/v1/site-edit']['callback']; $U=$routes['wpt-hub/v1/site-undo']['callback'];
function e($p){global $E;return $E(new WP_REST_Request($p));} function u($b,$f=0){global $U;return $U(new WP_REST_Request(array('backup'=>$b,'force'=>$f)));}

/* H1 on a block editor page */
$POSTS[40]=$orig="<!-- wp:paragraph --><p>Intro</p><!-- /wp:paragraph -->\n<!-- wp:heading --><h2 class=\"wp-block-heading\">Feature table</h2><!-- /wp:heading -->";
$r=e(array('op'=>'h1','post_id'=>40));
ok(!is_wp_error($r)&&strpos($POSTS[40],'<!-- wp:heading {"level":1} --><h1 class="wpt-was-h2 wp-block-heading">Feature table</h1>')!==false,'h1: block heading becomes H1, block comment kept valid');
u($r['backup']); ok($POSTS[40]===$orig,'h1: undo puts it back exactly');
/* H1 on the blog page */
$r=e(array('op'=>'h1','post_id'=>30));
ok(!is_wp_error($r)&&$OPT['wpt_hub_blog_h1']==='News','h1: blog page gets its name as the H1');
u($r['backup']); ok(!isset($OPT['wpt_hub_blog_h1']),'h1: undo removes it from the blog page');
/* H1 on a page with no heading at all */
$POSTS[41]='<p>Just text</p>'; $r=e(array('op'=>'h1','post_id'=>41));
ok(strpos($POSTS[41],'<h1>Page 41</h1>')===0,'h1: no heading at all, adds the page name as the H1 at the top');
/* Elementor page refused here */
$META[42]['_elementor_data']=json_encode(array(array('id'=>'a','elType'=>'section','elements'=>array())));
ok(is_wp_error(e(array('op'=>'h1','post_id'=>42))),'h1: Elementor pages use the Elementor fix');

/* One H1: Elementor */
$el=array(array('id'=>'s','elType'=>'section','elements'=>array(
 array('id'=>'h','elType'=>'widget','widgetType'=>'heading','settings'=>array('title'=>'Main','header_size'=>'h1')),
 array('id'=>'t','elType'=>'widget','widgetType'=>'text-editor','settings'=>array('editor'=>'<h1>Second</h1><p>x</p>')),
 array('id'=>'h2','elType'=>'widget','widgetType'=>'heading','settings'=>array('title'=>'Third','header_size'=>'h1')))));
$META[43]['_elementor_data']=json_encode($el);
$r=e(array('op'=>'h1_one','post_id'=>43)); $now=json_decode($META[43]['_elementor_data'],true)[0]['elements'];
ok(!is_wp_error($r)&&$now[0]['settings']['header_size']==='h1'&&$now[1]['settings']['editor']==='<h2>Second</h2><p>x</p>'&&$now[2]['settings']['header_size']==='h2','h1_one: first H1 kept, the rest become H2 (widgets and text blocks)');
u($r['backup']); ok(json_decode($META[43]['_elementor_data'],true)==$el,'h1_one: undo restores the Elementor page');
$META[44]['_elementor_data']=json_encode(array(array('id'=>'s','elType'=>'section','elements'=>array(array('id'=>'h','elType'=>'widget','widgetType'=>'heading','settings'=>array('title'=>'Only','header_size'=>'h1'))))));
$r=e(array('op'=>'h1_one','post_id'=>44)); ok(is_wp_error($r)&&strpos($r->m,'theme')!==false,'h1_one: only one H1 in the page, says the other is the theme title');
/* One H1: block content */
$POSTS[45]=$orig45='<h1>A</h1><p>x</p><!-- wp:heading {"level":1} --><h1 class="wp-block-heading">B</h1><!-- /wp:heading -->';
$r=e(array('op'=>'h1_one','post_id'=>45));
ok(!is_wp_error($r)&&$POSTS[45]==='<h1>A</h1><p>x</p><!-- wp:heading --><h2 class="wp-block-heading">B</h2><!-- /wp:heading -->','h1_one: block H1 becomes a plain H2 block');
u($r['backup']); ok($POSTS[45]===$orig45,'h1_one: undo restores the text');

/* Alt text */
$POSTS[46]=$o46='<p><img class="wp-image-501" src="https://westpiertech.com/uploads/team-300x200.jpg" alt=""></p><img src="https://cdn.other.com/x.png">';
$r=e(array('op'=>'alt','post_id'=>46,'items'=>array(array('src'=>'https://westpiertech.com/uploads/team-300x200.jpg','alt'=>'WPT engineers in Brighton'),array('src'=>'https://cdn.other.com/x.png','alt'=>'Other image'))));
ok(!is_wp_error($r)&&$META[501]['_wp_attachment_image_alt']==='WPT engineers in Brighton','alt: set in the Media Library (resized copy matched to the original)');
ok(strpos($POSTS[46],'alt="WPT engineers in Brighton"')!==false,'alt: set on the page text too');
ok($r['skipped']===array('https://cdn.other.com/x.png'),'alt: images not in the Media Library are reported, not guessed');
u($r['backup']); ok($POSTS[46]===$o46&&$META[501]['_wp_attachment_image_alt']==='','alt: undo clears both');

/* Relink */
$POSTS[47]=$o47='<a href="https://westpiertech.com/old-page/">x</a> <a href="/old-page">y</a> <a href="https://westpiertech.com/old-page-two/">z</a>';
$r=e(array('op'=>'relink','post_id'=>47,'from'=>'https://westpiertech.com/old-page/','to'=>'https://westpiertech.com/new-page/'));
ok(!is_wp_error($r)&&substr_count($POSTS[47],'/new-page/')===2&&strpos($POSTS[47],'old-page-two')!==false,'relink: both forms of the old link changed, a similar address left alone');
u($r['backup']); ok($POSTS[47]===$o47,'relink: undo');
$META[48]['_elementor_data']=json_encode(array(array('id'=>'b','elType'=>'widget','widgetType'=>'button','settings'=>array('link'=>array('url'=>'https://westpiertech.com/old-page/')))));
$r=e(array('op'=>'relink','post_id'=>48,'from'=>'https://westpiertech.com/old-page/','to'=>'https://westpiertech.com/new-page/'));
ok(!is_wp_error($r)&&json_decode($META[48]['_elementor_data'],true)[0]['settings']['link']['url']==='https://westpiertech.com/new-page/','relink: Elementor button links too');

/* Menu */
$MENUS=array((object)array('ID'=>1,'title'=>'Connectivity','url'=>'/c/','menu_order'=>1,'menu_item_parent'=>0),(object)array('ID'=>2,'title'=>'Maintenance &amp; Support','url'=>'/m/','menu_order'=>2,'menu_item_parent'=>0),(object)array('ID'=>3,'title'=>'Cyber','url'=>'/cy/','menu_order'=>3,'menu_item_parent'=>0));
$r=e(array('op'=>'menu_add','after'=>'Maintenance','title'=>'Business Telecoms Training','url'=>'https://westpiertech.com/business-telecoms-training/'));
ok(!is_wp_error($r)&&count($MENUS)===4&&$MENUS[3]->menu_order===3,'menu_add: added straight after Maintenance & Support');
u($r['backup']); ok(count($MENUS)===3,'menu_add: undo removes it');
ok(is_wp_error(e(array('op'=>'menu_add','after'=>'Nothing like this','title'=>'X','url'=>'https://westpiertech.com/x/'))),'menu_add: no matching menu item, refused');

/* Options and site text */
$r=e(array('op'=>'llms','value'=>"# West Pier Technologies\n> Telecoms"));
ok($OPT['wpt_hub_llms']==="# West Pier Technologies\n> Telecoms",'llms: saved'); u($r['backup']); ok(!isset($OPT['wpt_hub_llms']),'llms: undo');
$r=e(array('op'=>'option','key'=>'bing_verify','value'=>'<meta name="msvalidate.01" content="ABCDEF1234567890" />'));
ok($OPT['rank-math-options-general']['bing_verify']==='ABCDEF1234567890','option: Bing code pulled out of the pasted meta tag');
u($r['backup']); ok($OPT['rank-math-options-general']===array(),'option: undo');
$r=e(array('op'=>'option','key'=>'og_image','value'=>array('id'=>502)));
ok($OPT['rank-math-options-titles']['open_graph_image_id']===502,'option: default social image set');
ok(is_wp_error(e(array('op'=>'option','key'=>'admin_email','value'=>'x'))),'option: anything not on the list is refused');
$r=e(array('op'=>'css','value'=>'h1{color:red}</style><script>x</script>'));
ok(strpos($OPT['wpt_hub_css'],'<script')===false,'css: tags stripped');
/* Meta */
$META[49]['rank_math_robots']=array('noindex','nofollow');
$r=e(array('op'=>'meta','post_id'=>49,'key'=>'rank_math_robots'));
ok($META[49]['rank_math_robots']===array('nofollow','index'),'meta: noindex removed, other robots settings kept');
u($r['backup']); ok($META[49]['rank_math_robots']===array('noindex','nofollow'),'meta: undo');
/* Changed since */
$POSTS[50]='<p>a</p>'; $r=e(array('op'=>'h1','post_id'=>50)); $POSTS[50].='<p>later</p>';
ok(is_wp_error(u($r['backup'])),'undo refuses if the page changed since'); ok(!is_wp_error(u($r['backup'],1)),'unless forced');
$r=e(array('op'=>'option','key'=>'og_image','value'=>' https://westpiertech.com/uploads/logo.png'));
ok(!is_wp_error($r)&&$OPT['rank-math-options-titles']['open_graph_image_id']===502,'option: social image can be given as its Media Library address');

/* The Feature Comparison case: code with backslashes must come through untouched */
$POSTS[60]=$o60="<h2>Feature Comparison</h2>\n<script>var re=/\\d+/; var s=\"a\\nb\"; document.querySelector('select');</script>";
$r=e(array('op'=>'h1','post_id'=>60));
ok(!is_wp_error($r)&&strpos($POSTS[60],'<h1 class="wpt-was-h2">Feature Comparison</h1>')===0&&strpos($POSTS[60],'/\\d+/')!==false&&strpos($POSTS[60],'"a\\nb"')!==false,'h1: page code keeps every backslash');
u($r['backup']); ok($POSTS[60]===$o60,'undo: page code back exactly');
/* Repairing a page: the whole text goes back exactly, checked, and can be undone */
$POSTS[61]=$broken='<script>html += "<th class="tpfc">";</script>';
$good="<!-- wp:html -->\n<script>html += \"<th class=\\\"tpfc\\\">\";</script>\n<!-- /wp:html -->";
$r=e(array('op'=>'content_set','post_id'=>61,'content'=>$good));
ok(!is_wp_error($r)&&$POSTS[61]===$good,'content_set: page text put back exactly, backslashes and all');
u($r['backup']); ok($POSTS[61]===$broken,'content_set: undo');
// Version 22: add a block of text to the end of a page that isn't built with Elementor, exactly.
if(!function_exists('wp_kses_post')){function wp_kses_post($s){return preg_replace('#<script.*?</script>#is','',$s);}}
$POSTS[62]=$o62="<!-- wp:html -->\n<script>var re=/\\d+/;</script>\n<!-- /wp:html -->";
$faq='<h2>How to choose</h2><h3>Which is best?</h3><p>There is no single best system, only the best fit for how your team works every day.</p><script>bad()</script>';
$r=e(array('op'=>'content_append','post_id'=>62,'key'=>'faq','html'=>$faq));
ok(!is_wp_error($r)&&strpos($POSTS[62],$o62)===0&&strpos($POSTS[62],'<h3>Which is best?</h3>')!==false&&strpos($POSTS[62],'bad()')===false,'content_append: text added after the page code, code untouched, scripts stripped from the new block');
$once=$POSTS[62];
$r2=e(array('op'=>'content_append','post_id'=>62,'key'=>'faq','html'=>str_replace('Which is best?','Which system is best?',$faq)));
ok(!is_wp_error($r2)&&substr_count($POSTS[62],'<!-- wpt-hub-append:faq -->')===1&&strpos($POSTS[62],'Which system is best?')!==false,'content_append: pushing again replaces the block, no second copy');
u($r2['backup']); ok($POSTS[62]===$once,'content_append: undo');
