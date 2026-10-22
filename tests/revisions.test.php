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
function wp_get_post_revisions($id,$a=array()){return array((object)array('ID'=>101,'post_modified'=>'2026-10-22 17:35:00','post_author'=>1),(object)array('ID'=>100,'post_modified'=>'2026-09-01 10:00:00','post_author'=>1));}
function get_post($id){return in_array($id,array(100,101))?(object)array('ID'=>$id,'post_type'=>'revision','post_parent'=>10,'post_modified'=>'2026-09-01 10:00:00'):null;}
function get_userdata($id){return (object)array('display_name'=>'Matt');}
$orig=array(array('id'=>'s','elType'=>'section','elements'=>array(
 array('id'=>'h','elType'=>'widget','widgetType'=>'heading','settings'=>array('title'=>'8x8 Feature Matrix with Engage Voice','header_size'=>'h2')),
 array('id'=>'pdf','elType'=>'widget','widgetType'=>'html','settings'=>array('html'=>'<iframe src="https://westpiertech.com/m.pdf#navpanes=0&zoom=page-width"></iframe>')))));
$META[10]['_elementor_data']=json_encode($orig);
$META[100]['_elementor_data']=json_encode($orig);
$stripped=$orig; $stripped[0]['elements'][1]['settings']['html']='';
$META[101]['_elementor_data']=json_encode($stripped);
require $argv[1]; foreach($actions['rest_api_init'] as $f)$f();
function ok($c,$m){echo ($c?'PASS ':'FAIL ').$m."\n";}
$edit=$routes['wpt-hub/v1/elementor-edit']['callback']; $undo=$routes['wpt-hub/v1/elementor-undo']['callback']; $rev=$routes['wpt-hub/v1/elementor-revisions'];
$r=$edit(new WP_REST_Request(array('post_id'=>10,'op'=>'h1')));
$now=json_decode($META[10]['_elementor_data'],true);
ok(!is_wp_error($r)&&$now[0]['elements'][0]['settings']['header_size']==='h1','H1 fix changes the heading');
ok($now[0]['elements'][1]['settings']['html']===$orig[0]['elements'][1]['settings']['html'],'the embedded PDF is written back exactly, untouched');
$u=$undo(new WP_REST_Request(array('post_id'=>10,'backup'=>$r['backup'])));
ok(!is_wp_error($u)&&json_decode($META[10]['_elementor_data'],true)==$orig,'undo restores the page exactly, PDF included');
/* Restoring from a revision */
$META[10]['_elementor_data']=json_encode($stripped);
$list=$rev[0]['callback'](new WP_REST_Request(array('post_id'=>10)));
ok($list['current']['embeds']===0&&$list['revisions'][1]['embeds']===1&&$list['revisions'][1]['date']==='2026-09-01 10:00:00','revisions listed with how many embeds each has, so the good one stands out');
$res=$rev[1]['callback'](new WP_REST_Request(array('post_id'=>10,'revision_id'=>100)));
ok(!is_wp_error($res)&&json_decode($META[10]['_elementor_data'],true)==$orig,'restore puts the earlier version back exactly');
$u=$undo(new WP_REST_Request(array('post_id'=>10,'backup'=>$res['backup'])));
ok(!is_wp_error($u)&&json_decode($META[10]['_elementor_data'],true)==$stripped,'a restore can itself be undone');
ok(is_wp_error($rev[1]['callback'](new WP_REST_Request(array('post_id'=>10,'revision_id'=>55)))),'refuses anything that isn\'t a revision of this page');
