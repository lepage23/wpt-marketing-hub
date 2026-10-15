<?php
define('MINUTE_IN_SECONDS',60); define('HOUR_IN_SECONDS',3600);
$routes=array();$actions=array();$opts=array();$tr=array();$posts=array();$CAN_ADMIN=true;
function add_action($h,$f){global $actions;$actions[$h][]=$f;}
function register_rest_route($ns,$r,$a){global $routes;$routes[$ns.$r]=$a;}
function current_user_can($c){global $CAN_ADMIN; return $c==='manage_options'?$CAN_ADMIN:true;}
function get_option($k){global $opts;return isset($opts[$k])?$opts[$k]:false;}
function update_option($k,$v,$a=null){global $opts;$opts[$k]=$v;}
function delete_option($k){global $opts;unset($opts[$k]);}
function get_transient($k){global $tr;return isset($tr[$k])?$tr[$k]:false;}
function set_transient($k,$v,$t){global $tr;$tr[$k]=$v;}
function delete_transient($k){global $tr;unset($tr[$k]);}
function wp_json_encode($v){return json_encode($v);}
class WP_Error{public $m;function __construct($c,$m,$d=null){$this->m=$m;}function get_error_message(){return $this->m;}}
function is_wp_error($x){return $x instanceof WP_Error;}
class WP_REST_Request{public $p;function __construct($p){$this->p=$p;}function get_param($k){return isset($this->p[$k])?$this->p[$k]:null;}}
$k=openssl_pkey_new(array('private_key_bits'=>2048));openssl_pkey_export($k,$PRIV);$PUB=openssl_pkey_get_details($k)['key'];
$GOOGLE_DENY=false;
function wp_remote_post($url,$a){ global $posts,$PUB,$GOOGLE_DENY; $posts[]=array($url,$a);
 if(strpos($url,'oauth2')!==false){ list($h,$c,$s)=explode('.',$a['body']['assertion']); $sig=base64_decode(strtr($s,'-_','+/'));
   $okSig=openssl_verify("$h.$c",$sig,$PUB,'sha256WithRSAEncryption')===1; $claim=json_decode(base64_decode(strtr($c,'-_','+/')),true);
   $GLOBALS['claim']=$claim; $GLOBALS['sigok']=$okSig;
   return array('code'=>$okSig?200:400,'body'=>json_encode($okSig?array('access_token'=>'tok123'):array('error'=>'invalid_grant','error_description'=>'Invalid JWT Signature.')));}
 if($GOOGLE_DENY) return array('code'=>403,'body'=>json_encode(array('error'=>array('message'=>'User does not have sufficient permissions for this property.'))));
 $req=json_decode($a['body'],true)['requests']; $reports=array();
 foreach($req as $r){ $dims=isset($r['dimensions'])?$r['dimensions']:array(); $rep=array('dimensionHeaders'=>array_map(function($d){return array('name'=>$d['name']);},$dims),'metricHeaders'=>array_map(function($m){return array('name'=>$m['name']);},$r['metrics']));
   $row=array('dimensionValues'=>array_map(function($d){return array('value'=>$d['name']==='date'?'20261010':($d['name']==='sessionSource'?'chatgpt.com':'/8x8/'));},$dims),'metricValues'=>array_map(function($m){return array('value'=>$m['name']==='engagementRate'?'0.42':'12');},$r['metrics']));
   $rep['rows']=array($row); $reports[]=$rep; }
 return array('code'=>200,'body'=>json_encode(array('reports'=>$reports))); }
function wp_remote_retrieve_body($r){return $r['body'];}
function wp_remote_retrieve_response_code($r){return $r['code'];}
function gmdate_($f){return gmdate($f);}
require $argv[1];
foreach($actions['rest_api_init'] as $f)$f();
function ok($c,$m){echo ($c?'PASS ':'FAIL ').$m."\n";}
$setup=$routes['wpt-hub/v1/ga4-setup'][0]['callback']; $ga=$routes['wpt-hub/v1/ga4']['callback'];
ok($ga(new WP_REST_Request(array()))===array('configured'=>false),'not configured until set up');
$bad=$setup(new WP_REST_Request(array('property'=>'123','key'=>'{"foo":1}'))); ok(is_wp_error($bad)&&strpos($bad->m,"isn't a service account key")!==false,'rejects a file that is not a key');
$keyjson=json_encode(array('type'=>'service_account','client_email'=>'wpt-hub@proj.iam.gserviceaccount.com','private_key'=>$PRIV));
$GOOGLE_DENY=true; $r=$setup(new WP_REST_Request(array('property'=>'properties/4567','key'=>$keyjson)));
ok(is_wp_error($r)&&strpos($r->m,'Viewer')!==false&&!get_option('wpt_hub_ga4'),'no GA4 access: clear message, nothing saved');
$GOOGLE_DENY=false; $r=$setup(new WP_REST_Request(array('property'=>'properties/4567','key'=>$keyjson)));
ok(!is_wp_error($r)&&$r['ok']&&$r['property']==='4567','setup succeeds, property ID cleaned to digits');
ok($GLOBALS['sigok']===true,'signed login request verifies against the key pair');
ok($GLOBALS['claim']['scope']==='https://www.googleapis.com/auth/analytics.readonly'&&$GLOBALS['claim']['iss']==='wpt-hub@proj.iam.gserviceaccount.com','read-only scope, correct account');
ok(!isset($r['private_key'])&&strpos(json_encode($r),'PRIVATE')===false,'key never sent back');
$o=$ga(new WP_REST_Request(array('days'=>28)));
ok($o['configured']&&$o['totals']['sessions']==12&&$o['totals']['keyEvents']==12,'totals parsed');
ok($o['daily'][0]['date']==='20261010'&&$o['sources'][0]['sessionSource']==='chatgpt.com','daily and sources parsed');
ok(strpos(json_encode($o),'PRIVATE')===false,'reports never include the key');
$last=end($posts); $body=json_decode($last[1]['body'],true); ok($body['requests'][2]['dimensionFilter']['filter']['stringFilter']['value']==='Organic Search','organic landing filter sent');
$n=count($posts); $ga(new WP_REST_Request(array('days'=>28))); ok(count($posts)===$n,'second load comes from the 1-hour cache');
$CAN_ADMIN=false; ok(call_user_func($routes['wpt-hub/v1/ga4-setup'][0]['permission_callback'])===false,'only admins can set the key');
$CAN_ADMIN=true; $routes['wpt-hub/v1/ga4-setup'][1]['callback'](); ok(!get_option('wpt_hub_ga4'),'disconnect removes it');
file_put_contents($argv[2],json_encode($o));
