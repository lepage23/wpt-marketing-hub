<?php
// Version 16: an H1 the hub makes keeps the colour it had as an H2.
$src = file_get_contents( $argv[1] );
preg_match( '#function wpt_hub_keep_look.*?\n}\nfunction wpt_hub_keep_class.*?\n}\n#s', $src, $m );
eval( $m[0] );
function ok( $c, $msg ) { echo ( $c ? 'PASS ' : 'FAIL ' ) . $msg . "\n"; if ( ! $c ) { $GLOBALS['bad'] = 1; } }
ok( wpt_hub_keep_look( '<h1>', 2 ) === '<h1 class="wpt-was-h2">', 'plain H1 gets the keep-look class' );
ok( wpt_hub_keep_look( '<h1 class="intro" style="x">', 3 ) === '<h1 class="wpt-was-h3 intro" style="x">', 'existing class and style are kept' );
ok( wpt_hub_keep_look( '<h1 class="wpt-was-h2">', 2 ) === '<h1 class="wpt-was-h2">', 'no double class' );
ok( wpt_hub_keep_class( '', 2 ) === 'wpt-was-h2' && wpt_hub_keep_class( 'hero', 2 ) === 'hero wpt-was-h2', 'Elementor widget classes' );
ok( false !== strpos( $src, "'h1_look' === \$op" ) && false !== strpos( $src, 'wpt-hub-h1-look' ), 'repair op and style rule are in the snippet' );
ok( false !== strpos( $src, "'version' => 16" ), 'reports version 16' );
exit( empty( $GLOBALS['bad'] ) ? 0 : 1 );
