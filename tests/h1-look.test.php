<?php
// Version 16: an H1 the hub makes keeps the colour it had as an H2.
$src = file_get_contents( $argv[1] );
preg_match( "#if \\( ! function_exists\\( 'wpt_hub_keep_look' \\) \\) \\{.*?\\n\\}\\n#s", $src, $m );
eval( $m[0] );
function ok( $c, $msg ) { echo ( $c ? 'PASS ' : 'FAIL ' ) . $msg . "\n"; if ( ! $c ) { $GLOBALS['bad'] = 1; } }
ok( wpt_hub_keep_look( '<h1>', 2 ) === '<h1 class="wpt-was-h2">', 'plain H1 gets the keep-look class' );
ok( wpt_hub_keep_look( '<h1 class="intro" style="x">', 3 ) === '<h1 class="wpt-was-h3 intro" style="x">', 'existing class and style are kept' );
ok( wpt_hub_keep_look( '<h1 class="wpt-was-h2">', 2 ) === '<h1 class="wpt-was-h2">', 'no double class' );
ok( wpt_hub_keep_class( '', 2 ) === 'wpt-was-h2' && wpt_hub_keep_class( 'hero', 2 ) === 'hero wpt-was-h2', 'Elementor widget classes' );
ok( false !== strpos( $src, "'h1_look' === \$op" ) && false !== strpos( $src, 'wpt-hub-h1-look' ), 'repair op and style rule are in the snippet' );
$w = array( 'title' => 'x', 'css_classes' => 'wpt-was-h2' );
ok( wpt_hub_keep_widget( $w, 2 ) && 'wpt-was-h2' === $w['_css_classes'] && ! isset( $w['css_classes'] ), 'widget class goes in _css_classes, the version 16 slip is tidied' );
$w2 = array( '_css_classes' => 'hero wpt-was-h2' );
ok( ! wpt_hub_keep_widget( $w2, 2 ), 'already repaired widget counts as no change' );
ok( false !== strpos( $src, "'version' => 21" ) && false !== strpos( $src, '.wpt-hub-blog-h1 { grid-column: 1 / -1;' ), 'reports version 21, blog H1 spans the grid' );
// Version 20: Code Snippets refuses a function that already exists unless that exact name is guarded.
preg_match_all( '#^\s*function (wpt_\w+)\(#m', $src, $fn );
$unguarded = array_filter( $fn[1], function ( $n ) use ( $src ) { return false === strpos( $src, "function_exists( '" . $n . "' )" ); } );
ok( count( $fn[1] ) >= 6 && ! $unguarded, 'every function has its own function_exists guard' );
// Version 19: print the head style with a Blocksy-like theme setting and check the sizes.
$GLOBALS['mods'] = array( 'h3Typography' => array( 'size' => array( 'desktop' => '30px', 'tablet' => '26px', 'mobile' => 'bad;}' ) ) );
if ( ! function_exists( 'get_theme_mod' ) ) { function get_theme_mod( $k ) { return isset( $GLOBALS['mods'][ $k ] ) ? $GLOBALS['mods'][ $k ] : null; } }
if ( ! function_exists( 'add_action' ) ) { function add_action( $h, $f ) { $GLOBALS['acts'][ $h ][] = $f; } }
preg_match( "#add_action\( 'wp_head', function \(\) \{\n\t/\* Version 16.*?\n\}, 99 \);#s", $src, $hm );
$code = str_replace( array( "\$css = get_option( 'wpt_hub_css', '' );" ), array( "\$css = '';" ), $hm[0] );
eval( $code ); ob_start(); foreach ( $GLOBALS['acts']['wp_head'] as $f ) { $f(); } $out = ob_get_clean();
ok( false !== strpos( $out, ':where(body) h1.wpt-was-h3' ) && preg_match( '#wpt-was-h3[^{]*\{ font-size: 30px; \}#', $out ), 'H3 turned H1 keeps 30px' );
ok( false !== strpos( $out, '(max-width: 999.98px)' ) && false !== strpos( $out, 'font-size: 26px' ), 'tablet size from the theme setting' );
ok( false === strpos( $out, 'bad;' ), 'a bad size in the theme setting is ignored' );
ok( preg_match( '#wpt-was-h2[^{]*\{ font-size: 35px; \}#', $out ), 'falls back to the site size for H2' );
exit( empty( $GLOBALS['bad'] ) ? 0 : 1 );
