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
$page=array(
 array('id'=>'s1','elType'=>'section','settings'=>array(),'elements'=>array(array('id'=>'c1','elType'=>'column','elements'=>array(
   array('id'=>'h1','elType'=>'widget','widgetType'=>'heading','settings'=>array('title'=>'Our Expertise','header_size'=>'h2')),
   array('id'=>'t1','elType'=>'widget','widgetType'=>'text-editor','settings'=>array('editor'=>'<p>West Pier has been providing services to the Healthcare sector for 20 years.</p>')))))),
 array('id'=>'s2','elType'=>'section','settings'=>array(),'elements'=>array(array('id'=>'c2','elType'=>'column','elements'=>array(
   array('id'=>'img','elType'=>'widget','widgetType'=>'image','settings'=>array('image'=>array('url'=>'https://westpiertech.com/nhs.png'))),
   array('id'=>'h2','elType'=>'widget','widgetType'=>'heading','settings'=>array('title'=>'NHS BPF Better Purchasing Framework')),
   array('id'=>'t2','elType'=>'widget','widgetType'=>'text-editor','settings'=>array('editor'=>'<p>We&rsquo;re proud to be one of only 30 approved suppliers on the NHS Advanced Telephony Better Purchasing framework.</p>')),
   array('id'=>'b2','elType'=>'widget','widgetType'=>'button','settings'=>array('text'=>'Read more','link'=>array('url'=>'/nhs-better-purchasing-framework/'))))))),
);
$META[10]['_elementor_data']=json_encode($page);
$page[1]['elements'][0]['elements'][1]['settings']['title']='What is Unified Communications ?';
$page[1]['elements'][0]['elements'][1]['settings']['header_size']='h2';
$page[0]['elements'][0]['elements'][0]['settings']['title']='One solution for all your business communications<br>.';
$page[1]['elements'][0]['elements'][3]['settings']['_margin']=array('unit'=>'px','top'=>'10','right'=>'0','bottom'=>'10','left'=>'21','isLinked'=>false);
$page[1]['settings']['padding']=array('unit'=>'px','top'=>'60','right'=>'0','bottom'=>'200','left'=>'0','isLinked'=>false);
$page[1]['elements'][0]['elements'][0]['settings']['_margin']=array('unit'=>'px','top'=>'0','right'=>'-60','bottom'=>'0','left'=>'0','isLinked'=>false);
$META[10]['_elementor_data']=json_encode($page);
require $argv[1]; foreach($actions['rest_api_init'] as $f)$f();
function ok($c,$m){echo ($c?'PASS ':'FAIL ').$m."\n";}
$edit=$routes['wpt-hub/v1/elementor-edit']['callback']; $undo=$routes['wpt-hub/v1/elementor-undo']['callback'];
$g=function(){global $META;return json_decode($META[10]['_elementor_data'],true);};
$r=$edit(new WP_REST_Request(array('post_id'=>10,'op'=>'tidy','element'=>'h2')));
ok(!is_wp_error($r) && $g()[1]['elements'][0]['elements'][1]['settings']['title']==='What is Unified Communications?','tidy: space before ? removed, words unchanged');
$r2=$edit(new WP_REST_Request(array('post_id'=>10,'op'=>'tidy','element'=>'h1')));
ok(!is_wp_error($r2) && $g()[0]['elements'][0]['elements'][0]['settings']['title']==='One solution for all your business communications.','tidy: line break before the full stop removed');
$none=$edit(new WP_REST_Request(array('post_id'=>10,'op'=>'tidy','element'=>'h2')));
ok(is_wp_error($none) && strpos($none->m,'Nothing was changed')!==false,'tidy: nothing to tidy says so and changes nothing');
$u=$undo(new WP_REST_Request(array('post_id'=>10,'backup'=>$r2['backup'])));
ok(!is_wp_error($u) && $g()[0]['elements'][0]['elements'][0]['settings']['title']==='One solution for all your business communications<br>.','tidy: undo puts the text back exactly');
$META[10]['_elementor_data']=json_encode($page);
$l=$edit(new WP_REST_Request(array('post_id'=>10,'op'=>'layout','element'=>'b2','set'=>array('_margin'=>array('left'=>'0')))));
$m=$g()[1]['elements'][0]['elements'][3]['settings']['_margin'];
ok(!is_wp_error($l) && $m['left']==='0' && $m['top']==='10' && $m['bottom']==='10','layout: button left margin set to 0, other sides kept');
$u=$undo(new WP_REST_Request(array('post_id'=>10,'backup'=>$l['backup'])));
ok(!is_wp_error($u) && $g()==$page,'layout: undo restores exactly');
$sp=$edit(new WP_REST_Request(array('post_id'=>10,'op'=>'layout','element'=>'s2','set'=>array('padding'=>array('bottom'=>'60')))));
$pd=$g()[1]['settings']['padding'];
ok(!is_wp_error($sp) && $pd['bottom']==='60' && $pd['top']==='60','layout: section bottom padding matched to the top');
$META[10]['_elementor_data']=json_encode($page);
$im=$edit(new WP_REST_Request(array('post_id'=>10,'op'=>'layout','element'=>'img','set'=>array('max_width'=>array('unit'=>'%','size'=>100)),'clear_negative_margin'=>1)));
$s=$g()[1]['elements'][0]['elements'][0]['settings'];
ok(!is_wp_error($im) && $s['max_width']['size']===100 && $s['_margin']['right']==='0','layout: image capped at 100% and negative margin removed');
$META[10]['_elementor_data']=json_encode($page);
$bad=$edit(new WP_REST_Request(array('post_id'=>10,'op'=>'layout','element'=>'b2','set'=>array('custom_css'=>'x'))));
ok(is_wp_error($bad) && $g()==$page,'layout: only margin, padding and width allowed');
$gone=$edit(new WP_REST_Request(array('post_id'=>10,'op'=>'layout','element'=>'zzz','set'=>array('_margin'=>array('left'=>'0')))));
ok(is_wp_error($gone) && strpos($gone->m,"isn't there any more")!==false,'layout: missing element refused');
