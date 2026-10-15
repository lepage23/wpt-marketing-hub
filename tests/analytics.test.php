<?php
define('ARRAY_A','ARRAY_A'); define('DAY_IN_SECONDS',86400);
$routes=array(); $actions=array();
function add_action($h,$f){global $actions;$actions[$h][]=$f;}
function register_rest_route($ns,$r,$a){global $routes;$routes[$ns.$r]=$a;}
function home_url($p=''){return 'https://westpiertech.com'.$p;}
function wp_parse_url($u,$c=-1){return $c===-1?parse_url($u):parse_url($u,$c);}
function current_user_can($c){return true;}
class WP_REST_Request{public $p;function __construct($p){$this->p=$p;}function get_param($k){return isset($this->p[$k])?$this->p[$k]:null;}}
class FakeDB{ public $prefix='wp_'; public $db;
 function __construct(){ $this->db=new PDO('sqlite::memory:'); $this->db->exec('CREATE TABLE wp_rank_math_analytics_gsc (id INTEGER PRIMARY KEY, created TEXT, query TEXT, page TEXT, clicks INT, impressions INT, position REAL, ctr REAL)');
  $this->db->exec('CREATE TABLE wp_rank_math_analytics_objects (id INTEGER PRIMARY KEY, page TEXT, object_id INT)');
  $ins=$this->db->prepare('INSERT INTO wp_rank_math_analytics_gsc (created,query,page,clicks,impressions,position,ctr) VALUES (?,?,?,?,?,?,0)');
  for($d=0;$d<56;$d++){ $day=date('Y-m-d 00:00:00', strtotime('2026-10-12') - $d*86400);
   $ins->execute(array($day,'8x8 partner uk','/8x8/', $d<28?2:1, 50, $d<28?8:12));
   $ins->execute(array($day,'3cx brighton','/3cx/', 0, 10, 15)); } }
 function esc_like($s){return $s;}
 function prepare($q){$a=func_get_args();array_shift($a);foreach($a as $v){$q=preg_replace('/%s/',"'".str_replace("'","''",$v)."'",$q,1);}return $q;}
 function get_col($q,$i=0){ if(preg_match('/SHOW TABLES LIKE \'(.*)%\'/',$q,$m)){return $this->db->query("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '".$m[1]."%'")->fetchAll(PDO::FETCH_COLUMN);}
   if(preg_match('/DESCRIBE `(.*)`/',$q,$m)){return array_map(function($r){return $r['name'];},$this->db->query("PRAGMA table_info(".$m[1].")")->fetchAll(PDO::FETCH_ASSOC));} }
 function get_var($q){return $this->db->query($q)->fetchColumn();}
 function get_row($q,$t){return $this->db->query($q)->fetch(PDO::FETCH_ASSOC);}
 function get_results($q,$t=null){$r=$this->db->query($q); if(!$r){echo "SQL ERROR: $q\n".print_r($this->db->errorInfo(),1);exit(1);} return $r->fetchAll(PDO::FETCH_ASSOC);} }
$wpdb=new FakeDB();
require $argv[1];
foreach($actions['rest_api_init'] as $f)$f();
$o=$routes['wpt-hub/v1/analytics']['callback'](new WP_REST_Request(array('days'=>28)));
function ok($c,$m){echo ($c?'PASS ':'FAIL ').$m."\n";}
ok(isset($o['tables']['gsc']) && in_array('impressions',$o['tables']['gsc']),'finds Rank Math tables and columns');
ok($o['from']==='2026-09-15' && $o['to']==='2026-10-12','28-day window ends on latest data ('.$o['from'].' to '.$o['to'].')');
ok((int)$o['totals']['clicks']===56 && (int)$o['totals']['impressions']===1680,'current totals (clicks '.$o['totals']['clicks'].', impr '.$o['totals']['impressions'].')');
ok((int)$o['prev']['clicks']===28,'previous period totals ('.$o['prev']['clicks'].')');
ok(abs($o['totals']['position'] - ((8*50+15*10)/60))<0.01,'impression-weighted position ('.round($o['totals']['position'],2).')');
ok(count($o['daily'])===28,'28 daily rows');
ok($o['pages'][0]['page']==='/8x8/' && (int)$o['pages'][0]['clicks']===56,'top page');
ok(count($o['queries'])===2 && $o['queries'][0]['query']==='8x8 partner uk','queries with their page');
ok(!isset($o['ga']) && !isset($o['inspections']),'no GA or index tables, nothing invented');
file_put_contents($argv[2], json_encode($o));
