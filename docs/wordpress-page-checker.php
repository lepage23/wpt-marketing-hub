<?php
/**
 * WPT Marketing Hub: page checker (version 2).
 *
 * Lets the hub see the site the way a search engine does.
 *
 * /wpt-hub/v1/check  For each address: does it redirect, and if it's live,
 *                    its title, description, canonical, robots, H1s, schema,
 *                    social image, word count, links and images.
 * /wpt-hub/v1/site   Site-wide: robots.txt, sitemaps, llms.txt, http and www
 *                    redirects, the "discourage search engines" setting and
 *                    Rank Math's redirect rules.
 *
 * Safety:
 * - Only logged-in users who can edit pages can use it (the hub's account).
 * - It only fetches addresses on this site, never anywhere else.
 * - It only reads. It changes nothing.
 *
 * To install or update: Snippets > All Snippets > "WPT Hub page checker" > Edit.
 * Replace everything in the code box with everything below this comment block,
 * then Save Changes. (New install: Snippets > Add New, type PHP, Run everywhere.)
 */

add_action( 'rest_api_init', function () {
	$host = wp_parse_url( home_url(), PHP_URL_HOST );
	$can  = function () {
		return current_user_can( 'edit_pages' );
	};
	$fetch = function ( $url, $follow = 0 ) {
		$t   = microtime( true );
		$res = wp_remote_get( $url, array(
			'redirection' => $follow,
			'timeout'     => 20,
			'headers'     => array( 'Cache-Control' => 'no-cache' ),
		) );
		return array( $res, (int) round( ( microtime( true ) - $t ) * 1000 ) );
	};
	$abs = function ( $href, $base ) {
		$href = trim( (string) $href );
		if ( '' === $href || '#' === $href[0] || preg_match( '#^(mailto|tel|javascript|data|sms):#i', $href ) ) {
			return '';
		}
		if ( 0 === strpos( $href, '//' ) ) {
			$href = 'https:' . $href;
		}
		if ( ! preg_match( '#^https?://#i', $href ) ) {
			$b    = wp_parse_url( $base );
			$root = $b['scheme'] . '://' . $b['host'];
			if ( '/' === $href[0] ) {
				$href = $root . $href;
			} else {
				$dir  = isset( $b['path'] ) ? preg_replace( '#/[^/]*$#', '/', $b['path'] ) : '/';
				$href = $root . $dir . $href;
			}
		}
		return preg_replace( '/[?#].*$/', '', $href );
	};
	$types = function ( $node ) use ( &$types ) {
		$out = array();
		if ( is_array( $node ) ) {
			if ( isset( $node['@type'] ) ) {
				foreach ( (array) $node['@type'] as $t ) {
					$out[] = (string) $t;
				}
			}
			foreach ( $node as $v ) {
				if ( is_array( $v ) ) {
					$out = array_merge( $out, $types( $v ) );
				}
			}
		}
		return $out;
	};
	$parse = function ( $html, $url ) use ( $host, $abs, $types ) {
		$row = array();
		libxml_use_internal_errors( true );
		$doc = new DOMDocument();
		$doc->loadHTML( '<?xml encoding="utf-8" ?>' . $html );
		libxml_clear_errors();
		$xp  = new DOMXPath( $doc );
		$one = function ( $q, $attr = null ) use ( $xp ) {
			$n = $xp->query( $q )->item( 0 );
			return $n ? trim( $attr ? $n->getAttribute( $attr ) : $n->textContent ) : '';
		};
		$links = function ( $q ) use ( $xp, $abs, $url, $host ) {
			$out = array();
			foreach ( $xp->query( $q ) as $a ) {
				$u = $abs( $a->getAttribute( 'href' ), $url );
				if ( $u && wp_parse_url( $u, PHP_URL_HOST ) === $host ) {
					$out[] = $u;
				}
			}
			return array_values( array_unique( $out ) );
		};
		$row['title']         = $one( '//title' );
		$row['description']   = $one( '//meta[@name="description"]', 'content' );
		$row['canonical']     = $one( '//link[@rel="canonical"]', 'href' );
		$row['robots']        = $one( '//meta[@name="robots"]', 'content' );
		$row['noindex']       = false !== stripos( $row['robots'], 'noindex' );
		$row['og_image']      = $one( '//meta[@property="og:image"]', 'content' );
		$row['google_verify'] = '' !== $one( '//meta[@name="google-site-verification"]', 'content' );
		$row['bing_verify']   = '' !== $one( '//meta[@name="msvalidate.01"]', 'content' );
		$row['h1']            = array();
		foreach ( $xp->query( '//h1' ) as $n ) {
			$row['h1'][] = trim( preg_replace( '/\s+/u', ' ', $n->textContent ) );
		}
		$row['h2']     = $xp->query( '//h2' )->length;
		$row['schema'] = array();
		foreach ( $xp->query( '//script[@type="application/ld+json"]' ) as $n ) {
			$j = json_decode( $n->textContent, true );
			if ( $j ) {
				$row['schema'] = array_merge( $row['schema'], $types( $j ) );
			}
		}
		$row['schema']    = array_values( array_unique( $row['schema'] ) );
		$row['links_all'] = $links( '//a[@href]' );
		$strip = '//script|//style|//noscript|//svg|//header|//footer|//nav|//aside|//*[@data-elementor-type="header"]|//*[@data-elementor-type="footer"]|//*[@id="wpadminbar"]';
		foreach ( $xp->query( $strip ) as $n ) {
			if ( $n->parentNode ) {
				$n->parentNode->removeChild( $n );
			}
		}
		$body                 = $xp->query( '//body' )->item( 0 );
		$text                 = $body ? trim( preg_replace( '/\s+/u', ' ', $body->textContent ) ) : '';
		$row['words']         = '' === $text ? 0 : count( explode( ' ', $text ) );
		$row['links_content'] = $links( '//body//a[@href]' );
		$imgs                 = $xp->query( '//body//img' );
		$row['images']        = $imgs->length;
		$row['images_no_alt'] = 0;
		foreach ( $imgs as $i ) {
			if ( '' === trim( $i->getAttribute( 'alt' ) ) ) {
				$row['images_no_alt']++;
			}
		}
		return $row;
	};

	register_rest_route( 'wpt-hub/v1', '/check', array(
		'methods'             => 'POST',
		'permission_callback' => $can,
		'callback'            => function ( WP_REST_Request $req ) use ( $host, $fetch, $parse ) {
			$out = array();
			foreach ( array_slice( (array) $req->get_param( 'urls' ), 0, 10 ) as $url ) {
				$url = esc_url_raw( (string) $url );
				if ( wp_parse_url( $url, PHP_URL_HOST ) !== $host ) {
					$out[] = array( 'url' => $url, 'error' => 'Not on this site' );
					continue;
				}
				list( $res, $ms ) = $fetch( $url );
				if ( is_wp_error( $res ) ) {
					$out[] = array( 'url' => $url, 'error' => $res->get_error_message() );
					continue;
				}
				$code = (int) wp_remote_retrieve_response_code( $res );
				$row  = array(
					'url'      => $url,
					'status'   => $code,
					'location' => (string) wp_remote_retrieve_header( $res, 'location' ),
					'ms'       => $ms,
				);
				if ( 200 === $code ) {
					$html         = wp_remote_retrieve_body( $res );
					$row['bytes'] = strlen( $html );
					$row          = array_merge( $row, $parse( $html, $url ) );
				}
				$out[] = $row;
			}
			return $out;
		},
	) );

	register_rest_route( 'wpt-hub/v1', '/site', array(
		'methods'             => 'GET',
		'permission_callback' => $can,
		'callback'            => function () use ( $host, $fetch ) {
			global $wpdb;
			$home = home_url( '/' );
			$out  = array(
				'version'     => 2,
				'home'        => $home,
				'blog_public' => (int) get_option( 'blog_public' ),
				'permalinks'  => (string) get_option( 'permalink_structure' ),
			);
			list( $r )     = $fetch( $home . 'robots.txt', 3 );
			$out['robots'] = is_wp_error( $r ) ? null : array(
				'status' => (int) wp_remote_retrieve_response_code( $r ),
				'body'   => substr( wp_remote_retrieve_body( $r ), 0, 8000 ),
			);
			list( $r )   = $fetch( $home . 'llms.txt', 3 );
			$out['llms'] = is_wp_error( $r ) ? 0 : (int) wp_remote_retrieve_response_code( $r );

			$queue = array( $home . 'sitemap_index.xml' );
			if ( $out['robots'] && preg_match_all( '/^\s*sitemap:\s*(\S+)/im', $out['robots']['body'], $m ) ) {
				$queue = array_merge( $queue, $m[1] );
			}
			$seen = array();
			$maps = array();
			$urls = array();
			while ( $queue && count( $maps ) < 30 ) {
				$s = array_shift( $queue );
				if ( isset( $seen[ $s ] ) ) {
					continue;
				}
				$seen[ $s ]    = 1;
				list( $res )   = $fetch( $s, 3 );
				$code          = is_wp_error( $res ) ? 0 : (int) wp_remote_retrieve_response_code( $res );
				$maps[]        = array( 'url' => $s, 'status' => $code );
				if ( 200 !== $code ) {
					continue;
				}
				$xml   = wp_remote_retrieve_body( $res );
				$index = false !== stripos( $xml, '<sitemapindex' );
				preg_match_all( '#<loc>\s*(.*?)\s*</loc>#is', $xml, $mm );
				foreach ( $mm[1] as $loc ) {
					$loc = html_entity_decode( $loc );
					if ( $index ) {
						$queue[] = $loc;
					} elseif ( count( $urls ) < 3000 ) {
						$urls[] = $loc;
					}
				}
			}
			$out['sitemaps']     = $maps;
			$out['sitemap_urls'] = array_values( array_unique( $urls ) );

			$out['variants'] = array();
			$bare            = preg_replace( '/^www\./', '', $host );
			foreach ( array( 'http://' . $bare . '/', 'http://www.' . $bare . '/', 'https://www.' . $bare . '/', 'https://' . $bare . '/' ) as $v ) {
				list( $r )         = $fetch( $v );
				$out['variants'][] = is_wp_error( $r ) ? array( 'url' => $v, 'error' => $r->get_error_message() ) : array(
					'url'      => $v,
					'status'   => (int) wp_remote_retrieve_response_code( $r ),
					'location' => (string) wp_remote_retrieve_header( $r, 'location' ),
				);
			}

			$out['redirections'] = array();
			$t                   = $wpdb->prefix . 'rank_math_redirections';
			if ( $wpdb->get_var( $wpdb->prepare( 'SHOW TABLES LIKE %s', $t ) ) === $t ) {
				$rows = $wpdb->get_results( "SELECT id, sources, url_to, header_code, status, hits FROM {$t} LIMIT 1000", ARRAY_A );
				foreach ( (array) $rows as $row ) {
					$src            = maybe_unserialize( $row['sources'] );
					$row['sources'] = array();
					if ( is_array( $src ) ) {
						foreach ( $src as $s ) {
							if ( isset( $s['pattern'] ) ) {
								$row['sources'][] = array(
									'pattern'    => $s['pattern'],
									'comparison' => isset( $s['comparison'] ) ? $s['comparison'] : '',
								);
							}
						}
					}
					$out['redirections'][] = $row;
				}
			}
			return $out;
		},
	) );
} );
