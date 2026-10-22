<?php
define('ARRAY_A','ARRAY_A'); $routes=array();$actions=array();$META=array();$PURGED=array();
function add_action($h,$f){global $actions;$actions[$h][]=$f;} function register_rest_route($ns,$r,$a){global $routes;$routes[$ns.$r]=$a;}
function home_url($p=''){return 'https://westpiertech.com'.$p;} function wp_parse_url($u,$c=-1){return $c===-1?parse_url($u):parse_url($u,$c);}
function current_user_can($c,$id=0){return true;} function wp_strip_all_tags($s){return strip_tags($s);} function wp_json_encode($v){return json_encode($v);}
function wp_slash($s){return $s;} function wp_rand($a,$b){return rand($a,$b);} function esc_url_raw($u){return $u;}
function get_post_meta($id,$k,$single){global $META;return isset($META[$id][$k])?$META[$id][$k]:'';}
function update_post_meta($id,$k,$v){global $META;$META[$id][$k]=$v;} function delete_post_meta($id,$k){global $META;unset($META[$id][$k]);}
function get_posts($a){return array(10,20);} function get_post_field($f,$id){return $id==20?'<p>Our team holds BPF approval.</p>':'';}
function get_the_title($id){return $id==10?'Healthcare':'Blog post';} function get_permalink($id){return $id==10?'https://westpiertech.com/healthcare/':'https://westpiertech.com/blog/';}
function get_post_type($id){return $id==10?'page':'post';} function sg_cachepress_purge_cache($u){global $PURGED;$PURGED[]=$u;}
class WP_Error{public $m;function __construct($c,$m,$d=null){$this->m=$m;}} function is_wp_error($x){return $x instanceof WP_Error;}
class WP_REST_Request{public $p;function __construct($p){$this->p=$p;}function get_param($k){return isset($this->p[$k])?$this->p[$k]:null;}}
/* The Contact page: top heading lives inside an HTML widget, the old company name appears twice, and in a map. */
$page=array(
 array('id'=>'s1','elType'=>'section','settings'=>array(),'elements'=>array(array('id'=>'c1','elType'=>'column','elements'=>array(
   array('id'=>'w1','elType'=>'widget','widgetType'=>'html','settings'=>array('html'=>'<div class="box"><h2 class="ct">📞 Contact Us</h2><p><b>West Pier Telecom Ltd</b><br>Mocatta House</p></div>')),
   array('id'=>'h3','elType'=>'widget','widgetType'=>'heading','settings'=>array('title'=>'Office Locations','header_size'=>'h3')),
   array('id'=>'t1','elType'=>'widget','widgetType'=>'text-editor','settings'=>array('editor'=>'<p>Call West Pier Telecom today.</p>')),
   array('id'=>'m1','elType'=>'widget','widgetType'=>'google_maps','settings'=>array('address'=>'West Pier Telecom Brighton')))))),
);
$META[10]['_elementor_data']=json_encode($page);
require $argv[1]; foreach($actions['rest_api_init'] as $f)$f();
function ok($c,$m){echo ($c?'PASS ':'FAIL ').$m."\n";}
$edit=$routes['wpt-hub/v1/elementor-edit']['callback']; $undo=$routes['wpt-hub/v1/elementor-undo']['callback'];
$one=$edit(new WP_REST_Request(array('post_id'=>10,'op'=>'swap','find'=>'West Pier Telecom','replace'=>'West Pier Technologies')));
ok(is_wp_error($one),'plain swap still refuses when the phrase is in several places');
$r=$edit(new WP_REST_Request(array('post_id'=>10,'op'=>'swap','every'=>1,'find'=>'West Pier Telecom','replace'=>'West Pier Technologies')));
$now=json_decode($META[10]['_elementor_data'],true); $els=$now[0]['elements'][0]['elements'];
ok(!is_wp_error($r) && strpos($els[0]['settings']['html'],'<b>West Pier Technologies Ltd</b>')!==false && $els[2]['settings']['editor']==='<p>Call West Pier Technologies today.</p>','swap everywhere: both text spots changed');
ok($els[3]['settings']['address']==='West Pier Telecom Brighton','map address left alone so the pin does not move');
ok(!is_wp_error($r) && strpos($r['before'],'2 places')!==false,'reports how many places changed');
$u=$undo(new WP_REST_Request(array('post_id'=>10,'backup'=>$r['backup'])));
ok(!is_wp_error($u) && json_decode($META[10]['_elementor_data'],true)==$page,'undo puts the old name back');
$h=$edit(new WP_REST_Request(array('post_id'=>10,'op'=>'h1','dry_run'=>1)));
ok(!is_wp_error($h) && $h['text']==='📞 Contact Us','the heading nearest the top wins, even inside an HTML block');
$page[0]['elements'][0]['elements'][1]['settings']['title']='';
$META[10]['_elementor_data']=json_encode($page);
$h=$edit(new WP_REST_Request(array('post_id'=>10,'op'=>'h1')));
$now=json_decode($META[10]['_elementor_data'],true); $html=$now[0]['elements'][0]['elements'][0]['settings']['html'];
ok(!is_wp_error($h) && strpos($html,'<h1 class="ct">📞 Contact Us</h1>')!==false,'no usable heading widget: the heading in the HTML block becomes the H1, class kept');
ok(strpos($html,'<b>West Pier Telecom Ltd</b>')!==false,'the rest of the block is untouched');
$u=$undo(new WP_REST_Request(array('post_id'=>10,'backup'=>$h['backup'])));
ok(!is_wp_error($u) && json_decode($META[10]['_elementor_data'],true)==$page,'undo puts the H2 back');
$META[10]['_elementor_data']=json_encode(array(array('id'=>'s','elType'=>'section','elements'=>array(array('id'=>'ib','elType'=>'widget','widgetType'=>'icon-box','settings'=>array('title_text'=>'Get in touch','title_size'=>'h3'))))));
$h=$edit(new WP_REST_Request(array('post_id'=>10,'op'=>'h1')));
ok(!is_wp_error($h) && json_decode($META[10]['_elementor_data'],true)[0]['elements'][0]['settings']['title_size']==='h1','icon box title can become the H1');
