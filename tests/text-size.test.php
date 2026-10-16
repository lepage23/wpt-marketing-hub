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
function get_option($k){return $k==='elementor_active_kit'?99:'';}
function sanitize_key($k){return strtolower(preg_replace('/[^a-z0-9_\-]/i','',$k));}
$page[0]['elements'][0]['elements'][0]['settings']['__globals__']=array('typography_typography'=>'globals/typography?id=primary');
$META[10]['_elementor_data']=json_encode($page);
$META[99]['_elementor_page_settings']=array('system_typography'=>array(array('_id'=>'primary','title'=>'Primary','typography_typography'=>'custom','typography_font_family'=>'Montserrat','typography_font_weight'=>'700','typography_font_size'=>array('unit'=>'px','size'=>50),'typography_line_height'=>array('unit'=>'em','size'=>1.5))));
require $argv[1]; foreach($actions['rest_api_init'] as $f)$f();
function ok($c,$m){echo ($c?'PASS ':'FAIL ').$m."\n";}
$edit=$routes['wpt-hub/v1/elementor-edit']['callback']; $undo=$routes['wpt-hub/v1/elementor-undo']['callback'];
$g=function(){global $META;return json_decode($META[10]['_elementor_data'],true);};
$r=$edit(new WP_REST_Request(array('post_id'=>10,'op'=>'type','element'=>'h1','set'=>array('typography_font_size'=>array('unit'=>'px','size'=>40),'typography_font_size_tablet'=>array('unit'=>'px','size'=>27)))));
$st=$g()[0]['elements'][0]['elements'][0]['settings'];
ok(!is_wp_error($r) && $st['typography_font_size']['size']==40 && $st['typography_font_size_tablet']['size']==27,'type: font size set for desktop and tablet');
ok($st['typography_font_family']==='Montserrat' && $st['typography_font_weight']==='700' && $st['typography_line_height']['size']==1.5 && empty($st['__globals__']['typography_typography']) && $st['typography_typography']==='custom','type: global font copied on so only the size changes');
$u=$undo(new WP_REST_Request(array('post_id'=>10,'backup'=>$r['backup'])));
ok(!is_wp_error($u) && $g()==$page,'type: undo restores the global font link exactly');
$l=$edit(new WP_REST_Request(array('post_id'=>10,'op'=>'type','element'=>'h1','set'=>array('typography_line_height'=>array('unit'=>'em','size'=>1.2)))));
ok(!is_wp_error($l) && $g()[0]['elements'][0]['elements'][0]['settings']['typography_line_height']['size']==1.2,'type: line spacing tightened');
$META[10]['_elementor_data']=json_encode($page);
$bad=$edit(new WP_REST_Request(array('post_id'=>10,'op'=>'type','element'=>'h1','set'=>array('typography_font_family'=>array('size'=>1)))));
ok(is_wp_error($bad) && $g()==$page,'type: only font size and line spacing allowed');
