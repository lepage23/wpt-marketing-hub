<?php
/**
 * WPT Marketing Hub: page checker.
 *
 * Lets the hub ask the site what a visitor actually gets at an address on
 * westpiertech.com: whether it redirects (and where to), and for live pages the
 * title, meta description, canonical, noindex, headings and a rough word count.
 *
 * Why: some pages are redirected or built outside the normal page list, and
 * Elementor content doesn't always show up in the WordPress API. This checks
 * the real page instead.
 *
 * Safety:
 * - Only logged-in users who can edit pages can use it (the hub's account).
 * - It only checks addresses on this site, never anywhere else.
 * - It reads pages. It changes nothing.
 * - Max 10 addresses per request.
 *
 * Add it as a second snippet in Code Snippets: Snippets > Add New, title
 * "WPT Hub page checker", type PHP, paste everything below this comment block,
 * Run everywhere, Save and Activate.
 */

add_action( 'rest_api_init', function () {
	register_rest_route( 'wpt-hub/v1', '/check', array(
		'methods'             => 'POST',
		'permission_callback' => function () {
			return current_user_can( 'edit_pages' );
		},
		'callback'            => function ( WP_REST_Request $req ) {
			$urls = (array) $req->get_param( 'urls' );
			$host = wp_parse_url( home_url(), PHP_URL_HOST );
			$out  = array();
			foreach ( array_slice( $urls, 0, 10 ) as $url ) {
				$url = esc_url_raw( (string) $url );
				if ( wp_parse_url( $url, PHP_URL_HOST ) !== $host ) {
					$out[] = array( 'url' => $url, 'error' => 'Not on this site' );
					continue;
				}
				$res = wp_remote_get( $url, array(
					'redirection' => 0,
					'timeout'     => 15,
					'headers'     => array( 'Cache-Control' => 'no-cache' ),
				) );
				if ( is_wp_error( $res ) ) {
					$out[] = array( 'url' => $url, 'error' => $res->get_error_message() );
					continue;
				}
				$code = (int) wp_remote_retrieve_response_code( $res );
				$row  = array(
					'url'      => $url,
					'status'   => $code,
					'location' => (string) wp_remote_retrieve_header( $res, 'location' ),
				);
				if ( 200 === $code ) {
					$html = wp_remote_retrieve_body( $res );
					$row['title']       = preg_match( '#<title[^>]*>(.*?)</title>#is', $html, $m ) ? html_entity_decode( trim( $m[1] ), ENT_QUOTES ) : '';
					$row['description'] = preg_match( '#<meta\s+name=["\']description["\']\s+content=(["\'])(.*?)\1#is', $html, $m ) ? html_entity_decode( $m[2], ENT_QUOTES ) : '';
					$row['canonical']   = preg_match( '#<link\s+rel=["\']canonical["\']\s+href=(["\'])(.*?)\1#is', $html, $m ) ? $m[2] : '';
					$row['noindex']     = (bool) preg_match( '#<meta\s+name=["\']robots["\']\s+content=["\'][^"\']*noindex#i', $html );
					$row['h1']          = preg_match_all( '#<h1[\s>]#i', $html );
					$row['h2']          = preg_match_all( '#<h2[\s>]#i', $html );
					$body = preg_replace( '#<(script|style|noscript|header|footer|nav|svg)\b.*?</\1>#is', ' ', $html );
					$text = trim( preg_replace( '/\s+/u', ' ', wp_strip_all_tags( $body ) ) );
					$row['words'] = '' === $text ? 0 : count( explode( ' ', $text ) );
				}
				$out[] = $row;
			}
			return $out;
		},
	) );
} );
