<?php
define('ARRAY_A','ARRAY_A'); $routes=array();$actions=array();$META=array();$PURGED=array();
function add_action($h,$f){global $actions;$actions[$h][]=$f;} function register_rest_route($ns,$r,$a){global $routes;$routes[$ns.$r]=$a;}
function home_url($p=''){return 'https://westpiertech.com'.$p;} function wp_parse_url($u,$c=-1){return $c===-1?parse_url($u):parse_url($u,$c);}
function current_user_can($c,$id=0){return true;} function wp_strip_all_tags($s){return strip_tags($s);} function wp_json_encode($v){return json_encode($v);}
function wp_slash($s){return is_array($s)?array_map('wp_slash',$s):(is_string($s)?addslashes($s):$s);} function wp_rand($a,$b){return rand($a,$b);} function esc_url_raw($u){return $u;}
function get_post_meta($id,$k,$single){global $META;return isset($META[$id][$k])?$META[$id][$k]:'';}
function wp_unslash($s){return is_array($s)?array_map('wp_unslash',$s):(is_string($s)?stripslashes($s):$s);} function update_post_meta($id,$k,$v){global $META;$META[$id][$k]=wp_unslash($v);} function delete_post_meta($id,$k){global $META;unset($META[$id][$k]);}
function get_posts($a){return array(10,20);} function get_post_field($f,$id){return $id==20?'<p>Our team holds BPF approval.</p>':'';}
function get_the_title($id){return $id==10?'Healthcare':'Blog post';} function get_permalink($id){return $id==10?'https://westpiertech.com/healthcare/':'https://westpiertech.com/blog/';}
function get_post_type($id){return $id==10?'page':'post';} function sg_cachepress_purge_cache($u){global $PURGED;$PURGED[]=$u;}
class WP_Error{public $m;function __construct($c,$m,$d=null){$this->m=$m;}} function is_wp_error($x){return $x instanceof WP_Error;}
class WP_REST_Request{public $p;function __construct($p){$this->p=$p;}function get_param($k){return isset($this->p[$k])?$this->p[$k]:null;}}
// Version 18: WordPress strips backslashes from post meta. Undo copies must survive that exactly.
$embed = '<iframe src="https://westpiertech.com/x.pdf" style="width:100%"></iframe><script>var r = /\d+/;</script>';
$page=array(array('id'=>'s1','elType'=>'container','settings'=>array(),'elements'=>array(
  array('id'=>'h','elType'=>'widget','widgetType'=>'heading','settings'=>array('title'=>'8x8 Feature Matrix × Voice','header_size'=>'h1')),
  array('id'=>'e','elType'=>'widget','widgetType'=>'html','settings'=>array('html'=>$embed)))));
$META[10]['_elementor_data']=wp_slash(json_encode($page)); $META[10]['_elementor_data']=json_encode($page);
require $argv[1]; foreach($actions['rest_api_init'] as $f)$f();
function ok($c,$m){echo ($c?'PASS ':'FAIL ').$m."\n"; if(!$c) $GLOBALS['bad']=1;}
$edit=$routes['wpt-hub/v1/elementor-edit']['callback']; $undo=$routes['wpt-hub/v1/elementor-undo']['callback'];
$before=$META[10]['_elementor_data'];
$r=$edit(new WP_REST_Request(array('post_id'=>10,'op'=>'h1_look','find'=>'8x8 Feature Matrix','level'=>2)));
ok(!is_wp_error($r),'repair pushes');
$u=$undo(new WP_REST_Request(array('post_id'=>10,'backup'=>$r['backup'])));
$now=json_decode($META[10]['_elementor_data'],true);
ok(!is_wp_error($u) && is_array($now) && $now[0]['elements'][1]['settings']['html']===$embed && $now[0]['elements'][0]['settings']['title']==='8x8 Feature Matrix × Voice','undo puts the page back exactly, embed code and symbols intact');
// An Undo copy saved the old way (before version 18) is damaged: undo must refuse, not blank the page.
$META[10]['_wpt_hub_bk_old']=wp_unslash(array('data'=>json_encode($page),'after'=>md5(json_encode($now)),'time'=>1));
$keep=$META[10]['_elementor_data'];
$u2=$undo(new WP_REST_Request(array('post_id'=>10,'backup'=>'old')));
ok(is_wp_error($u2) && $META[10]['_elementor_data']===$keep,'damaged old Undo copy is refused and the page is left alone');
ok(false===wpt_hub_write_elementor(10,null) && $META[10]['_elementor_data']===$keep,'a layout that is not valid is never written');
exit(empty($GLOBALS['bad'])?0:1);
