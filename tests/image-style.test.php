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
function sanitize_key($k){return strtolower(preg_replace('/[^a-z0-9_\-]/i','',$k));}
$page[1]['elements'][0]['elements'][0]['settings']['image']['url']='https://westpiertech.com/wp-content/uploads/2026/03/Engineer-new-logo-WPT-edit-with-cert-number-Underneath-1024x1024.png';
$page[1]['elements'][0]['elements'][0]['settings']['height']=array('unit'=>'px','size'=>600);
$page[0]['elements'][0]['elements'][]=array('id'=>'st1','elType'=>'widget','widgetType'=>'image','settings'=>array('image'=>array('url'=>'https://westpiertech.com/wp-content/uploads/2025/04/5-stars.png')));
$page[0]['elements'][0]['elements'][]=array('id'=>'st2','elType'=>'widget','widgetType'=>'image','settings'=>array('image'=>array('url'=>'https://westpiertech.com/wp-content/uploads/2025/04/5-stars.png')));
$page[0]['elements'][0]['elements'][]=array('id'=>'mc','elType'=>'widget','widgetType'=>'media-carousel','settings'=>array('slides'=>array(array('image'=>array('url'=>'https://westpiertech.com/x/teams.png'),'image_link_to'=>array('url'=>'https://westpiertech.com/msteams/')))));
$META[10]['_elementor_data']=json_encode($page);
require $argv[1]; foreach($actions['rest_api_init'] as $f)$f();
function ok($c,$m){echo ($c?'PASS ':'FAIL ').$m."\n";}
$edit=$routes['wpt-hub/v1/elementor-edit']['callback']; $undo=$routes['wpt-hub/v1/elementor-undo']['callback'];
$set=array('object-fit'=>'contain','object-fit_mobile'=>'contain');
$r=$edit(new WP_REST_Request(array('post_id'=>10,'op'=>'style','find'=>'engineer-new-logo-wpt-edit-with-cert-number-underneath','set'=>$set)));
$now=json_decode($META[10]['_elementor_data'],true); $img=$now[1]['elements'][0]['elements'][0]['settings'];
ok(!is_wp_error($r) && $img['object-fit']==='contain' && $img['object-fit_mobile']==='contain' && $img['height']['size']===600,'style: image set to contain, height kept');
$other=$now; $other[1]['elements'][0]['elements'][0]['settings']=array_diff_key($img,$set); $orig=$page;
ok(json_encode($other)===json_encode($orig),'style: nothing else on the page changed');
$u=$undo(new WP_REST_Request(array('post_id'=>10,'backup'=>$r['backup'])));
ok(!is_wp_error($u) && json_decode($META[10]['_elementor_data'],true)==$page,'style: undo restores exactly');
$bad=$edit(new WP_REST_Request(array('post_id'=>10,'op'=>'style','find'=>'engineer-new-logo','set'=>array('_css_classes'=>'x'))));
ok(is_wp_error($bad) && json_decode($META[10]['_elementor_data'],true)==$page,'style: only size and cropping settings allowed');
$miss=$edit(new WP_REST_Request(array('post_id'=>10,'op'=>'style','find'=>'not-on-page-image','set'=>$set)));
ok(is_wp_error($miss) && strpos($miss->m,"isn't on the page")!==false,'style: missing image refused');
$META[10]['_elementor_data']=json_encode($page);
$two=$edit(new WP_REST_Request(array('post_id'=>10,'op'=>'style','find'=>'5-stars','set'=>$set)));
ok(is_wp_error($two) && strpos($two->m,'2 times')!==false,'style: repeated image refused unless all is asked for');
$all=$edit(new WP_REST_Request(array('post_id'=>10,'op'=>'style','find'=>'5-stars','set'=>$set,'all'=>1)));
$n=json_decode($META[10]['_elementor_data'],true);
ok(!is_wp_error($all) && $all['count']===2 && $n[0]['elements'][0]['elements'][2]['settings']['object-fit']==='contain' && $n[0]['elements'][0]['elements'][3]['settings']['object-fit']==='contain','style: all copies of the stars fixed together');
$undo(new WP_REST_Request(array('post_id'=>10,'backup'=>$all['backup'])));
$mc=$edit(new WP_REST_Request(array('post_id'=>10,'op'=>'style','widget'=>'media-carousel','find'=>'/msteams/','set'=>array('image_fit'=>'contain'))));
$n=json_decode($META[10]['_elementor_data'],true);
ok(!is_wp_error($mc) && $n[0]['elements'][0]['elements'][4]['settings']['image_fit']==='contain','style: logo carousel set to fit logos, not crop them');
$undo(new WP_REST_Request(array('post_id'=>10,'backup'=>$mc['backup'])));
$wrong=$edit(new WP_REST_Request(array('post_id'=>10,'op'=>'style','widget'=>'image-carousel','find'=>'/msteams/','set'=>array('image_fit'=>'contain'))));
ok(is_wp_error($wrong) && strpos($wrong->m,'media-carousel')!==false && json_decode($META[10]['_elementor_data'],true)==$page,'style: wrong widget type refused, says what it found');
$META[10]['_elementor_data']=json_encode($page);
$byid=$edit(new WP_REST_Request(array('post_id'=>10,'op'=>'style','widget'=>'media-carousel','element'=>'mc','set'=>array('image_fit'=>'contain'))));
$n=json_decode($META[10]['_elementor_data'],true);
ok(!is_wp_error($byid) && $n[0]['elements'][0]['elements'][4]['settings']['image_fit']==='contain','style: element found by its Elementor id (from the display check)');
