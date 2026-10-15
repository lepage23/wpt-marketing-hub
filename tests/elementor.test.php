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
require $argv[1]; foreach($actions['rest_api_init'] as $f)$f();
function ok($c,$m){echo ($c?'PASS ':'FAIL ').$m."\n";}
$find=$routes['wpt-hub/v1/find']['callback']; $edit=$routes['wpt-hub/v1/elementor-edit']['callback']; $undo=$routes['wpt-hub/v1/elementor-undo']['callback'];
$f=$find(new WP_REST_Request(array('q'=>'Better Purchasing')));
ok(count($f)===1 && $f[0]['title']==='Healthcare' && count($f[0]['hits'])===2,'find: Healthcare page, heading and paragraph');
$f2=$find(new WP_REST_Request(array('q'=>'BPF')));
ok(count($f2)===2 && $f2[1]['hits'][0]['widget']==='content','find also searches normal (non-Elementor) posts');
$f3=$find(new WP_REST_Request(array('q'=>"We're proud")));
ok(count($f3)===1,'find matches curly apostrophes and HTML entities');
$r=$edit(new WP_REST_Request(array('post_id'=>10,'op'=>'set','find'=>'Read more','replace'=>'Talk to us')));
ok(!is_wp_error($r) && json_decode($META[10]['_elementor_data'],true)[1]['elements'][0]['elements'][3]['settings']['text']==='Talk to us','set: changes the one widget');
ok($PURGED===array('https://westpiertech.com/healthcare/'),'SiteGround cache purged for that page');
$bk1=$r['backup'];
$gone=$edit(new WP_REST_Request(array('post_id'=>10,'op'=>'set','find'=>'Text not on page','replace'=>'x')));
ok(is_wp_error($gone) && strpos($gone->m,"isn't on the page")!==false,'missing text: refused, nothing changed');
$u=$undo(new WP_REST_Request(array('post_id'=>10,'backup'=>$bk1)));
ok(!is_wp_error($u) && json_decode($META[10]['_elementor_data'],true)==$page,'undo restores the page exactly');
$r=$edit(new WP_REST_Request(array('post_id'=>10,'op'=>'remove','scope'=>'section','find'=>'NHS BPF Better Purchasing Framework')));
$now=json_decode($META[10]['_elementor_data'],true);
ok(!is_wp_error($r) && count($now)===1 && $now[0]['id']==='s1','remove section: BPF section gone, rest untouched');
ok(strpos($r['before'],'approved suppliers')!==false,'removed text reported back for the change log');
$META[10]['_elementor_data']=json_encode(array_merge($now,array(array('id'=>'s9','elType'=>'section','settings'=>array('x'=>'Later edit by Connor')))));
$u2=$undo(new WP_REST_Request(array('post_id'=>10,'backup'=>$r['backup'])));
ok(is_wp_error($u2) && strpos($u2->m,'edited since')!==false,'undo refuses if the page changed since, unless forced');
$u3=$undo(new WP_REST_Request(array('post_id'=>10,'backup'=>$r['backup'],'force'=>1)));
ok(!is_wp_error($u3) && json_decode($META[10]['_elementor_data'],true)==$page,'forced undo restores the original');
$two=$edit(new WP_REST_Request(array('post_id'=>10,'op'=>'remove','scope'=>'section','find'=>'Healthcare')));
ok(is_wp_error($two)===false,'(Healthcare text only in section 1)');
$META[10]['_elementor_data']=json_encode($page);
$amb2=$edit(new WP_REST_Request(array('post_id'=>10,'op'=>'remove','scope'=>'widget','find'=>'West Pier')));
ok(!is_wp_error($amb2),'(one widget mentions West Pier)');
$META[10]['_elementor_data']=json_encode($page);
$amb3=$edit(new WP_REST_Request(array('post_id'=>10,'op'=>'remove','scope'=>'section','find'=>'e')));
ok(is_wp_error($amb3),'vague text in two sections: refused');
$no=$edit(new WP_REST_Request(array('post_id'=>20,'op'=>'set','find'=>'BPF approval','replace'=>'x')));
ok(is_wp_error($no) && strpos($no->m,"isn't built with Elementor")!==false,'non-Elementor page: clear refusal');
