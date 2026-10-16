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
$INSERTED=array();
function get_option($k){return $k==='elementor_active_kit'?99:'';}
function sanitize_text_field($s){return trim(strip_tags($s));} function sanitize_title($s){return strtolower(preg_replace('/[^a-z0-9]+/i','-',$s));}
function wp_insert_post($a,$e=false){global $INSERTED;$INSERTED[]=$a;return 500+count($INSERTED);}
function get_post_status($id){global $INSERTED;return $INSERTED[$id-501]['post_status'];}
function get_preview_post_link($id){return 'https://westpiertech.com/?page_id='.$id.'&preview=true';}
function admin_url($p){return 'https://westpiertech.com/wp-admin/'.$p;}
$page[0]['elements'][0]['elements'][0]['settings']['__globals__']=array('typography_typography'=>'globals/typography?id=primary','title_color'=>'globals/colors?id=accent');
$page[0]['settings']['background_color']='#12334A';
$META[10]['_elementor_data']=json_encode($page);
$META[10]['_wp_page_template']='elementor_header_footer';
$META[99]['_elementor_page_settings']=array('system_colors'=>array(array('_id'=>'accent','title'=>'Accent','color'=>'#E30613')),
 'system_typography'=>array(array('_id'=>'primary','title'=>'Primary','typography_font_family'=>'Poppins','typography_font_size'=>array('unit'=>'px','size'=>40),'typography_font_weight'=>'600')));
require $argv[1]; foreach($actions['rest_api_init'] as $f)$f();
function ok($c,$m){echo ($c?'PASS ':'FAIL ').$m."\n";}
$style=$routes['wpt-hub/v1/page-style']['callback']; $build=$routes['wpt-hub/v1/page-build']['callback'];
$s=$style(new WP_REST_Request(array('template_id'=>10)));
$h=null; foreach($s['layout'] as $row) if($row['widget']==='heading'){$h=$row;break;}
ok($s['fonts'][0]['family']==='Poppins' && $s['colors'][0]['color']==='#E30613','style: site fonts and colours read from the Elementor kit');
ok($h && $h['font']['family']==='Poppins' && $h['font']['size']==='40px' && strpos($h['color'],'#E30613')===0 && $h['tag']==='h2','style: heading font, size, colour and tag resolved');
ok($s['layout'][0]['widget']==='section' && $s['layout'][0]['background']==='#12334A','style: section background colour');
$before=$META[10]['_elementor_data'];
$r=$build(new WP_REST_Request(array('template_id'=>10,'parent_id'=>10,'title'=>'NHS telephony','slug'=>'NHS telephony','seo_title'=>'NHS telephony | WPT','edits'=>array(
 array('op'=>'set','find'=>'Our Expertise','replace'=>'NHS telephony through Mitel'),
 array('op'=>'swap','find'=>'20 years','replace'=>'over 20 years'),
 array('op'=>'remove','find'=>'NHS BPF Better Purchasing Framework','level'=>2)))));
ok(!is_wp_error($r) && $r['status']==='draft' && $INSERTED[0]['post_status']==='draft' && $INSERTED[0]['post_parent']===10 && $INSERTED[0]['post_name']==='nhs-telephony','build: new page made as a draft under Healthcare');
$new=json_decode($META[$r['id']]['_elementor_data'],true);
ok($new[0]['elements'][0]['elements'][0]['settings']['title']==='NHS telephony through Mitel' && strpos($new[0]['elements'][0]['elements'][1]['settings']['editor'],'over 20 years')!==false,'build: new text swapped in, design settings kept');
ok($new[0]['elements'][0]['elements'][0]['settings']['__globals__']['typography_typography']==='globals/typography?id=primary','build: global font and colour links copied');
ok(count($new)===1,'build: unwanted section removed');
ok($new[0]['id']!=='s1','build: fresh element ids so the copy never clashes with the original');
ok($META[10]['_elementor_data']===$before,'build: the page it copies from is untouched');
ok($META[$r['id']]['_wp_page_template']==='elementor_header_footer' && $META[$r['id']]['rank_math_title']==='NHS telephony | WPT','build: page template and SEO title copied');
ok(strpos($r['preview'],'preview=true')!==false,'build: preview link returned');
$n=count($INSERTED);
$bad=$build(new WP_REST_Request(array('template_id'=>10,'title'=>'X page','edits'=>array(array('op'=>'set','find'=>'Text not there','replace'=>'y')))));
ok(is_wp_error($bad) && count($INSERTED)===$n,'build: missing text refused before any page is made');
$amb=$build(new WP_REST_Request(array('template_id'=>10,'title'=>'X page','edits'=>array(array('op'=>'set','find'=>'NHS','replace'=>'y')))));
ok(is_wp_error($amb) && strpos($amb->m,'places')!==false,'build: text in two places refused');
$ne=$style(new WP_REST_Request(array('template_id'=>20)));
ok(is_wp_error($ne),'style: non-Elementor page refused');
