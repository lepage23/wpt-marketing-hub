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

function current_time($t,$g=0){return '2026-10-22 18:00:00';}
class FakeDb{public $posts='wp_posts';public $prefix='wp_';function update($tb,$d,$w){global $POSTS;if($tb==='wp_posts'&&isset($d['post_content']))$POSTS[$w['ID']]=$d['post_content'];}}
$wpdb=new FakeDb();
function wp_update_post($a){if(isset($a['post_content']))throw new Exception('wp_update_post must not be used for page text: it strips backslashes');return $a['ID'];}
class WP_Error{public $m;function __construct($c,$m,$d=null){$this->m=$m;}}
class WP_REST_Request{public $p;function __construct($p){$this->p=$p;}function get_param($k){return isset($this->p[$k])?$this->p[$k]:null;}}
function wp_get_post_revisions($id,$a=array()){return array((object)array('ID'=>201,'post_modified'=>'2026-10-22 17:30:00','post_author'=>1,'post_content'=>'<h1>x</h1><script>var re=/d/;</script>'),(object)array('ID'=>200,'post_modified'=>'2026-08-01 09:00:00','post_author'=>1,'post_content'=>"<h2>Feature Comparison</h2><script>var re=/\\d+/;</script>"));}
function get_post($id){foreach(wp_get_post_revisions(0) as $r){if($r->ID==$id){$r->post_type='revision';$r->post_parent=80;return $r;}}return null;}
function get_userdata($id){return (object)array('display_name'=>'Matt');}
require $argv[1]; foreach($actions['rest_api_init'] as $f)$f();
function ok($c,$m){echo ($c?'PASS ':'FAIL ').$m."\n";}
$POSTS[80]='<h1>x</h1><script>var re=/d/;</script>';
$rev=$routes['wpt-hub/v1/elementor-revisions']; $undo=$routes['wpt-hub/v1/elementor-undo']['callback'];
$l=$rev[0]['callback'](new WP_REST_Request(array('post_id'=>80)));
ok($l['mode']==='content'&&$l['current']['slashes']===0&&$l['revisions'][1]['slashes']===1,'page text revisions listed, flagging the one with its code intact');
$res=$rev[1]['callback'](new WP_REST_Request(array('post_id'=>80,'revision_id'=>200)));
ok(!is_wp_error($res)&&$POSTS[80]==="<h2>Feature Comparison</h2><script>var re=/\\d+/;</script>",'restore puts the page text back exactly, backslashes included');
$u=$undo(new WP_REST_Request(array('post_id'=>80,'backup'=>$res['backup'])));
ok(!is_wp_error($u)&&$POSTS[80]==='<h1>x</h1><script>var re=/d/;</script>','the restore can be undone');
