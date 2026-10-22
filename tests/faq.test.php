<?php
define('ARRAY_A','ARRAY_A'); $routes=array();$actions=array();$META=array();$PURGED=array();
function add_action($h,$f){global $actions;$actions[$h][]=$f;} function register_rest_route($ns,$r,$a){global $routes;$routes[$ns.$r]=$a;}
function home_url($p=''){return 'https://westpiertech.com'.$p;} function wp_parse_url($u,$c=-1){return $c===-1?parse_url($u):parse_url($u,$c);}
function current_user_can($c,$id=0){return true;} function wp_strip_all_tags($s){return strip_tags($s);} function wp_json_encode($v){return json_encode($v);}
function wp_slash($s){return $s;} function wp_rand($a,$b){return rand($a,$b);} function esc_url_raw($u){return $u;} function sanitize_text_field($s){return trim(strip_tags($s));} function wp_kses_post($s){return preg_replace('#<script.*?</script>#is','',$s);}
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
$edit=$routes['wpt-hub/v1/elementor-edit']['callback']; $undo=$routes['wpt-hub/v1/elementor-undo']['callback'];
$items=array(array('q'=>'Do you support 8x8 for small businesses?','a'=>'Yes. We set up 8x8 for teams of five upwards.'),array('q'=>'How long does it take to move?','a'=>'Most moves take two to four weeks.<script>x</script>'));
$r=$edit(new WP_REST_Request(array('post_id'=>10,'op'=>'faq','items'=>$items,'heading'=>'8x8 questions','before'=>'NHS BPF Better Purchasing')));
$d=json_decode($META[10]['_elementor_data'],true);
ok(!is_wp_error($r) && count($d)===3 && $d[1]['settings']['css_classes']==='wpt-hub-faq','faq: block added before the section holding the "before" text');
$acc=$d[1]['elements'][0]['elements'][1];
ok($d[1]['elType']==='section' && $acc['widgetType']==='accordion' && $acc['settings']['faq_schema']==='yes','section page gets section > column > accordion with FAQ schema on');
ok($d[1]['elements'][0]['elements'][0]['settings']['title']==='8x8 questions','heading set');
ok(count($acc['settings']['tabs'])===2 && $acc['settings']['tabs'][0]['tab_content']==='<p>Yes. We set up 8x8 for teams of five upwards.</p>','answers wrapped in a paragraph');
ok(strpos(json_encode($acc),'script')===false,'scripts stripped from answers');
ok(strpos($r['after'],'Q: How long does it take to move?')!==false && $r['replaced']===false,'change log shows the questions');
$bk=$r['backup'];
$items[]=array('q'=>'Can I keep my numbers?','a'=>'Yes, we port your existing numbers.');
$r2=$edit(new WP_REST_Request(array('post_id'=>10,'op'=>'faq','items'=>$items)));
$d2=json_decode($META[10]['_elementor_data'],true);
ok(!is_wp_error($r2) && $r2['replaced']===true && count($d2)===3 && $r2['position']===1 && count($d2[1]['elements'][0]['elements'][1]['settings']['tabs'])===3,'second push replaces the hub FAQ in place, no duplicate');
ok(strpos($r2['before'],'How long does it take')!==false,'replace reports the old questions');
$u=$undo(new WP_REST_Request(array('post_id'=>10,'backup'=>$r2['backup'])));
$u=$undo(new WP_REST_Request(array('post_id'=>10,'backup'=>$bk)));
ok(!is_wp_error($u) && json_decode($META[10]['_elementor_data'],true)==$page,'undo takes the FAQ off and restores the page exactly');
$r3=$edit(new WP_REST_Request(array('post_id'=>10,'op'=>'faq','items'=>$items)));
ok(count(json_decode($META[10]['_elementor_data'],true))===3 && $r3['position']===2,'no "before" text: added at the end');
$META[10]['_elementor_data']=json_encode($page);
$one=$edit(new WP_REST_Request(array('post_id'=>10,'op'=>'faq','items'=>array($items[0]))));
ok(is_wp_error($one) && json_decode($META[10]['_elementor_data'],true)==$page,'one question only: refused, nothing changed');
$blank=$edit(new WP_REST_Request(array('post_id'=>10,'op'=>'faq','items'=>array($items[0],array('q'=>'Empty answer?','a'=>'')))));
ok(is_wp_error($blank) && strpos($blank->m,'Question 2')!==false,'blank answer: refused and says which');
$other=$page; $other[0]['elements'][0]['elements'][]=array('id'=>'zz','elType'=>'widget','widgetType'=>'toggle','settings'=>array('faq_schema'=>'yes'));
$META[10]['_elementor_data']=json_encode($other);
$o=$edit(new WP_REST_Request(array('post_id'=>10,'op'=>'faq','items'=>$items)));
ok(is_wp_error($o) && strpos($o->m,'already has an FAQ')!==false,'page with someone else\'s FAQ schema: refused');
$cont=array(array('id'=>'k1','elType'=>'container','settings'=>array(),'elements'=>array(array('id'=>'w1','elType'=>'widget','widgetType'=>'heading','settings'=>array('title'=>'Talk to us today')))));
$META[10]['_elementor_data']=json_encode($cont);
$c=$edit(new WP_REST_Request(array('post_id'=>10,'op'=>'faq','items'=>$items,'before'=>'Talk to us')));
$dc=json_decode($META[10]['_elementor_data'],true);
ok(!is_wp_error($c) && $dc[0]['elType']==='container' && $dc[0]['elements'][1]['widgetType']==='accordion' && $dc[1]['id']==='k1','container page gets a container, placed before the call to action');
$an=$routes['wpt-hub/v1/analytics'];
ok(strpos(file_get_contents($argv[1]),"'version' => 15")!==false,'snippet reports version 15');
$META[10]['_elementor_data']=json_encode($page);
$dry=$edit(new WP_REST_Request(array('post_id'=>10,'op'=>'h1','dry_run'=>1)));
ok($dry['dry_run']===true && $dry['element']==='h1' && $dry['text']==='Our Expertise' && json_decode($META[10]['_elementor_data'],true)==$page,'h1 dry run: names the first heading, changes nothing');
$h=$edit(new WP_REST_Request(array('post_id'=>10,'op'=>'h1')));
$dh=json_decode($META[10]['_elementor_data'],true);
ok(!is_wp_error($h) && $dh[0]['elements'][0]['elements'][0]['settings']['header_size']==='h1' && $h['before']==='H2: Our Expertise','h1: first heading becomes the H1');
ok($dh[1]==$page[1],'h1: rest of the page untouched');
$again=$edit(new WP_REST_Request(array('post_id'=>10,'op'=>'h1')));
ok(is_wp_error($again) && strpos($again->m,'already has an H1')!==false,'h1: refuses if Elementor already has one');
$u=$undo(new WP_REST_Request(array('post_id'=>10,'backup'=>$h['backup'])));
ok(json_decode($META[10]['_elementor_data'],true)==$page,'h1: undo restores the heading');
$h2=$edit(new WP_REST_Request(array('post_id'=>10,'op'=>'h1','element'=>'h2')));
ok(!is_wp_error($h2) && $h2['after']==='H1: NHS BPF Better Purchasing Framework','h1: a named heading can be picked');
