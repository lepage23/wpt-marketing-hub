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
function get_option($k){return '';} function sanitize_key($k){return strtolower(preg_replace('/[^a-z0-9_\-]/i','',$k));}
/* The police page case-study row: text box, logo, spacer, then a nested box with text and two logos. */
$page=array(array('id'=>'row','elType'=>'container','settings'=>array('flex_direction'=>'row'),'elements'=>array(
  array('id'=>'txt1','elType'=>'container','settings'=>array('width'=>array('unit'=>'%','size'=>23.95)),'elements'=>array(
    array('id'=>'hd1','elType'=>'widget','widgetType'=>'heading','settings'=>array('title'=>'Warwickshire<br>Police','header_size'=>'h3','typography_typography'=>'custom','typography_font_size'=>array('unit'=>'px','size'=>30))))),
  array('id'=>'logo1','elType'=>'widget','widgetType'=>'image','settings'=>array('image'=>array('url'=>'https://westpiertech.com/w.png'))),
  array('id'=>'gap','elType'=>'container','settings'=>array(),'elements'=>array()),
  array('id'=>'pair','elType'=>'container','settings'=>array('flex_direction'=>'row'),'elements'=>array(
    array('id'=>'txt2','elType'=>'container','settings'=>array(),'elements'=>array(
      array('id'=>'hd2','elType'=>'widget','widgetType'=>'heading','settings'=>array('title'=>'Sussex and Surrey Police','header_size'=>'h3')))),
    array('id'=>'logos','elType'=>'container','settings'=>array(),'elements'=>array()))))));
$META[10]['_elementor_data']=json_encode($page);
require $argv[1]; foreach($actions['rest_api_init'] as $f)$f();
function ok($c,$m){echo ($c?'PASS ':'FAIL ').$m."\n";}
$edit=$routes['wpt-hub/v1/elementor-edit']['callback']; $undo=$routes['wpt-hub/v1/elementor-undo']['callback'];
$g=function(){global $META;return json_decode($META[10]['_elementor_data'],true);};
$pct=function($n){return array('unit'=>'%','size'=>$n);};
$items=array(
  array('element'=>'row','set'=>array('flex_wrap'=>'wrap','flex_wrap_mobile'=>'wrap')),
  array('element'=>'txt1','set'=>array('width'=>$pct(55),'width_mobile'=>$pct(100))),
  array('element'=>'gap','set'=>array('width'=>$pct(100),'width_mobile'=>$pct(100))),
  array('element'=>'pair','set'=>array('width'=>$pct(100),'width_mobile'=>$pct(100))),
  array('element'=>'pair','set'=>array('flex_wrap'=>'wrap')),
  array('element'=>'txt2','set'=>array('width'=>$pct(55),'width_mobile'=>$pct(100))),
  array('element'=>'logos','set'=>array('width'=>$pct(45),'width_mobile'=>$pct(100))));
$r=$edit(new WP_REST_Request(array('post_id'=>10,'op'=>'arrange','items'=>$items)));
$d=$g(); $row=$d[0]; $pair=$row['elements'][3];
ok(!is_wp_error($r) && $row['settings']['flex_wrap']==='wrap' && $row['settings']['flex_direction']==='row','arrange: row may wrap, its other settings kept');
ok($row['elements'][0]['settings']['width']['size']==55 && $row['elements'][0]['settings']['width_mobile']['size']==100,'arrange: text box 55% wide, full width on phones');
ok($pair['settings']['width']['size']==100 && $pair['settings']['flex_wrap']==='wrap','arrange: the same box named twice keeps both changes');
ok($pair['elements'][1]['settings']['width']['size']==45 && count($r['elements'])===6,'arrange: nested logos 45%, six boxes changed in one save');
ok($row['elements'][0]['elements'][0]['settings']['title']==='Warwickshire<br>Police' && !isset($row['elements'][1]['settings']['width']),'arrange: words and the logo widget untouched');
$u=$undo(new WP_REST_Request(array('post_id'=>10,'backup'=>$r['backup'])));
ok(!is_wp_error($u) && $g()==$page,'arrange: one undo puts the whole row back exactly');
$gone=$edit(new WP_REST_Request(array('post_id'=>10,'op'=>'arrange','items'=>array(array('element'=>'txt1','set'=>array('width'=>$pct(55))),array('element'=>'nothere','set'=>array('width'=>$pct(45)))))));
ok(is_wp_error($gone) && $g()==$page,'arrange: a box that has gone means nothing changes at all');
$bad=$edit(new WP_REST_Request(array('post_id'=>10,'op'=>'arrange','items'=>array(array('element'=>'txt1','set'=>array('custom_css'=>'x'))))));
ok(is_wp_error($bad) && $g()==$page,'arrange: only widths and wrapping allowed');
$big=$edit(new WP_REST_Request(array('post_id'=>10,'op'=>'arrange','items'=>array(array('element'=>'txt1','set'=>array('width'=>array('unit'=>'px','size'=>900),'flex_wrap'=>'evil'))))));
$s=$g()[0]['elements'][0]['settings'];
ok(!is_wp_error($big) && $s['width']['unit']==='%' && $s['width']['size']==100 && $s['flex_wrap']==='wrap','arrange: widths kept to 0 to 100%, wrapping only wrap or nowrap');
$META[10]['_elementor_data']=json_encode($page);
/* Matching headings resized together */
$t=$edit(new WP_REST_Request(array('post_id'=>10,'op'=>'type','element'=>'hd1','also'=>array('hd2','hd2'),'set'=>array('typography_font_size'=>array('unit'=>'px','size'=>24)))));
$d=$g();
ok(!is_wp_error($t) && $t['elements']===array('hd1','hd2'),'type with also: both headings named once each');
ok($d[0]['elements'][0]['elements'][0]['settings']['typography_font_size']['size']==24 && $d[0]['elements'][3]['elements'][0]['elements'][0]['settings']['typography_font_size']['size']==24,'type with also: both headings 24px');
$u=$undo(new WP_REST_Request(array('post_id'=>10,'backup'=>$t['backup'])));
ok(!is_wp_error($u) && $g()==$page,'type with also: one undo puts both back');
$t2=$edit(new WP_REST_Request(array('post_id'=>10,'op'=>'type','element'=>'hd1','also'=>array('nothere'),'set'=>array('typography_font_size'=>array('unit'=>'px','size'=>24)))));
ok(is_wp_error($t2) && $g()==$page,'type with also: a missing heading means nothing changes');
$t3=$edit(new WP_REST_Request(array('post_id'=>10,'op'=>'type','element'=>'hd1','set'=>array('typography_font_size'=>array('unit'=>'px','size'=>26)))));
ok(!is_wp_error($t3) && $g()[0]['elements'][0]['elements'][0]['settings']['typography_font_size']['size']==26 && isset(json_decode($t3['before'],true)['typography_font_size']),'type on its own: works as before');
