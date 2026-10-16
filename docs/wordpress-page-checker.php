<?php
/**
 * WPT Marketing Hub: page checker (version 7, adds image style fixes such as unsquashing photos).
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

/* Search performance from Rank Math Analytics (version 3).
 * Reads the Search Console (and, if present, Google Analytics and index status)
 * data Rank Math has already imported into WordPress. Read-only. */
add_action( 'rest_api_init', function () {
	register_rest_route( 'wpt-hub/v1', '/analytics', array(
		'methods'             => 'GET',
		'permission_callback' => function () {
			return current_user_can( 'edit_pages' );
		},
		'callback'            => function ( WP_REST_Request $req ) {
			global $wpdb;
			$pre    = $wpdb->prefix . 'rank_math_analytics_';
			$days   = (int) $req->get_param( 'days' );
			$days   = $days >= 7 && $days <= 90 ? $days : 28;
			$out    = array( 'version' => 7, 'days' => $days, 'home' => home_url( '/' ), 'tables' => array() );
			$tables = (array) $wpdb->get_col( $wpdb->prepare( 'SHOW TABLES LIKE %s', $wpdb->esc_like( $pre ) . '%' ) );
			foreach ( $tables as $t ) {
				$out['tables'][ substr( $t, strlen( $pre ) ) ] = (array) $wpdb->get_col( "DESCRIBE `{$t}`", 0 );
			}
			$has = function ( $name, $cols ) use ( $out ) {
				return isset( $out['tables'][ $name ] ) && ! array_diff( $cols, $out['tables'][ $name ] );
			};
			if ( $has( 'gsc', array( 'created', 'page', 'query', 'clicks', 'impressions', 'position' ) ) ) {
				$g   = $pre . 'gsc';
				$max = $wpdb->get_var( "SELECT MAX(created) FROM `{$g}`" );
				if ( $max ) {
					$end   = gmdate( 'Y-m-d 23:59:59', strtotime( $max ) );
					$start = gmdate( 'Y-m-d 00:00:00', strtotime( $max ) - ( $days - 1 ) * DAY_IN_SECONDS );
					$prev  = gmdate( 'Y-m-d 00:00:00', strtotime( $start ) - $days * DAY_IN_SECONDS );
					$out['from']   = substr( $start, 0, 10 );
					$out['to']     = substr( $end, 0, 10 );
					$sum           = 'SUM(clicks) AS clicks, SUM(impressions) AS impressions, SUM(position*impressions)/NULLIF(SUM(impressions),0) AS position';
					$out['totals'] = $wpdb->get_row( $wpdb->prepare( "SELECT {$sum} FROM `{$g}` WHERE created BETWEEN %s AND %s", $start, $end ), ARRAY_A );
					$out['prev']   = $wpdb->get_row( $wpdb->prepare( "SELECT {$sum} FROM `{$g}` WHERE created >= %s AND created < %s", $prev, $start ), ARRAY_A );
					$out['daily']  = $wpdb->get_results( $wpdb->prepare( "SELECT DATE(created) AS d, SUM(clicks) AS clicks, SUM(impressions) AS impressions FROM `{$g}` WHERE created BETWEEN %s AND %s GROUP BY DATE(created) ORDER BY d", $start, $end ), ARRAY_A );
					$out['pages']  = $wpdb->get_results( $wpdb->prepare( "SELECT page, {$sum} FROM `{$g}` WHERE created BETWEEN %s AND %s GROUP BY page ORDER BY impressions DESC LIMIT 500", $start, $end ), ARRAY_A );
					$out['pages_prev'] = $wpdb->get_results( $wpdb->prepare( "SELECT page, SUM(clicks) AS clicks, SUM(impressions) AS impressions FROM `{$g}` WHERE created >= %s AND created < %s GROUP BY page", $prev, $start ), ARRAY_A );
					$out['queries'] = $wpdb->get_results( $wpdb->prepare( "SELECT query, page, {$sum} FROM `{$g}` WHERE created BETWEEN %s AND %s GROUP BY query, page ORDER BY impressions DESC LIMIT 1500", $start, $end ), ARRAY_A );
				}
			}
			if ( $has( 'ga', array( 'created', 'page', 'pageviews' ) ) && ! empty( $out['from'] ) ) {
				$a           = $pre . 'ga';
				$vis         = in_array( 'visitors', $out['tables']['ga'], true ) ? ', SUM(visitors) AS visitors' : '';
				$out['ga']   = $wpdb->get_results( $wpdb->prepare( "SELECT page, SUM(pageviews) AS pageviews{$vis} FROM `{$a}` WHERE created BETWEEN %s AND %s GROUP BY page ORDER BY pageviews DESC LIMIT 500", $out['from'] . ' 00:00:00', $out['to'] . ' 23:59:59' ), ARRAY_A );
				$out['ga_daily'] = $wpdb->get_results( $wpdb->prepare( "SELECT DATE(created) AS d, SUM(pageviews) AS pageviews FROM `{$a}` WHERE created BETWEEN %s AND %s GROUP BY DATE(created) ORDER BY d", $out['from'] . ' 00:00:00', $out['to'] . ' 23:59:59' ), ARRAY_A );
			}
			if ( isset( $out['tables']['inspections'] ) && in_array( 'page', $out['tables']['inspections'], true ) ) {
				$i = $pre . 'inspections';
				$out['inspections'] = $wpdb->get_results( "SELECT * FROM `{$i}` ORDER BY id DESC LIMIT 1000", ARRAY_A );
			}
			return $out;
		},
	) );
} );

/* Page editing for Elementor pages (version 4).
 * /wpt-hub/v1/find          GET  ?q=  Find text across published pages and posts (read-only).
 * /wpt-hub/v1/elementor-edit POST Change one widget's text, or remove a widget or whole section,
 *                                 on one page. Only for users who can edit that page.
 * /wpt-hub/v1/elementor-undo POST Put a page back exactly as it was before a hub edit.
 * Every edit keeps a full copy of the page first (and Elementor adds its own revision). */
add_action( 'rest_api_init', function () {
	$plain = function ( $s ) {
		$s = html_entity_decode( wp_strip_all_tags( (string) $s ), ENT_QUOTES | ENT_HTML5, 'UTF-8' );
		$s = str_replace( array( "\xE2\x80\x98", "\xE2\x80\x99", "\xE2\x80\x9C", "\xE2\x80\x9D", "\xC2\xA0" ), array( "'", "'", '"', '"', ' ' ), $s );
		return trim( preg_replace( '/\s+/u', ' ', $s ) );
	};
	$load = function ( $id ) {
		$raw = get_post_meta( $id, '_elementor_data', true );
		if ( ! $raw ) {
			return null;
		}
		$d = is_array( $raw ) ? $raw : json_decode( $raw, true );
		return is_array( $d ) ? $d : null;
	};
	/* Every text setting in the page: element path, element id, widget type, setting path, value. */
	$texts = function ( $elements ) use ( &$texts ) {
		$out  = array();
		$walk = function ( $els, $path ) use ( &$walk, &$out ) {
			foreach ( $els as $i => $el ) {
				$p = array_merge( $path, array( $i ) );
				$scan = function ( $v, $keys ) use ( &$scan, &$out, $p, $el ) {
					if ( is_string( $v ) ) {
						if ( preg_match( '/[a-z]{3}/i', wp_strip_all_tags( $v ) ) && ! preg_match( '#^(https?:|\#|[a-z_-]+$)#i', trim( $v ) ) ) {
							$out[] = array( 'path' => $p, 'id' => isset( $el['id'] ) ? $el['id'] : '', 'widget' => isset( $el['widgetType'] ) ? $el['widgetType'] : ( isset( $el['elType'] ) ? $el['elType'] : '' ), 'keys' => $keys, 'value' => $v );
						}
					} elseif ( is_array( $v ) ) {
						foreach ( $v as $k => $vv ) {
							if ( '__globals__' === $k || '__dynamic__' === $k ) {
								continue;
							}
							$scan( $vv, array_merge( $keys, array( $k ) ) );
						}
					}
				};
				if ( isset( $el['settings'] ) && is_array( $el['settings'] ) ) {
					$scan( $el['settings'], array() );
				}
				if ( ! empty( $el['elements'] ) ) {
					$walk( $el['elements'], array_merge( $p, array( 'elements' ) ) );
				}
			}
		};
		$walk( $elements, array() );
		return $out;
	};
	$save = function ( $id, $data ) {
		if ( class_exists( '\Elementor\Plugin' ) && isset( \Elementor\Plugin::$instance->documents ) ) {
			$doc = \Elementor\Plugin::$instance->documents->get( $id, false );
			if ( $doc ) {
				$doc->save( array( 'elements' => $data ) );
				if ( function_exists( 'sg_cachepress_purge_cache' ) ) {
					sg_cachepress_purge_cache( get_permalink( $id ) );
				}
				return;
			}
		}
		update_post_meta( $id, '_elementor_data', wp_slash( wp_json_encode( $data ) ) );
		if ( class_exists( '\Elementor\Plugin' ) && isset( \Elementor\Plugin::$instance->files_manager ) ) {
			\Elementor\Plugin::$instance->files_manager->clear_cache();
		}
		if ( function_exists( 'sg_cachepress_purge_cache' ) ) {
			sg_cachepress_purge_cache( get_permalink( $id ) );
		}
	};
	$at_level = function ( $path, $level, $scope ) {
		if ( 'section' === $scope ) {
			return array( $path[0] );
		}
		$level = max( 0, (int) $level );
		$keep  = count( $path ) - 2 * $level;
		return array_slice( $path, 0, max( 1, $keep ) );
	};
	$can_post = function ( WP_REST_Request $r ) {
		$id = (int) $r->get_param( 'post_id' );
		return $id > 0 && current_user_can( 'edit_post', $id );
	};

	register_rest_route( 'wpt-hub/v1', '/find', array(
		'methods'             => 'GET',
		'permission_callback' => function () {
			return current_user_can( 'edit_pages' );
		},
		'callback'            => function ( WP_REST_Request $r ) use ( $plain, $load, $texts ) {
			$q = $plain( (string) $r->get_param( 'q' ) );
			if ( strlen( $q ) < 2 ) {
				return new WP_Error( 'wpt_find', 'Search for at least two characters.', array( 'status' => 400 ) );
			}
			$ids = get_posts( array( 'post_type' => array( 'page', 'post' ), 'post_status' => 'publish', 'numberposts' => -1, 'fields' => 'ids' ) );
			$out = array();
			foreach ( $ids as $id ) {
				$data = $load( $id );
				$hits = array();
				if ( $data ) {
					foreach ( $texts( $data ) as $t ) {
						$p = $plain( $t['value'] );
						$at = stripos( $p, $q );
						if ( false !== $at ) {
							$hits[] = array( 'id' => $t['id'], 'widget' => $t['widget'], 'field' => implode( '.', $t['keys'] ), 'snippet' => substr( $p, max( 0, $at - 80 ), strlen( $q ) + 160 ) );
						}
					}
				} else {
					$p  = $plain( get_post_field( 'post_content', $id ) );
					$at = stripos( $p, $q );
					if ( false !== $at ) {
						$hits[] = array( 'id' => '', 'widget' => 'content', 'field' => 'post_content', 'snippet' => substr( $p, max( 0, $at - 80 ), strlen( $q ) + 160 ) );
					}
				}
				$title = $plain( get_the_title( $id ) );
				if ( false !== stripos( $title, $q ) ) {
					$hits[] = array( 'id' => '', 'widget' => 'page title', 'field' => 'title', 'snippet' => $title );
				}
				if ( $hits ) {
					$out[] = array( 'post_id' => $id, 'title' => $title, 'link' => get_permalink( $id ), 'type' => get_post_type( $id ), 'elementor' => (bool) $data, 'hits' => array_slice( $hits, 0, 20 ) );
				}
				if ( count( $out ) >= 200 ) {
					break;
				}
			}
			return $out;
		},
	) );

	register_rest_route( 'wpt-hub/v1', '/elementor-edit', array(
		'methods'             => 'POST',
		'permission_callback' => $can_post,
		'callback'            => function ( WP_REST_Request $r ) use ( $plain, $load, $texts, $save, $at_level ) {
			$id   = (int) $r->get_param( 'post_id' );
			$op   = (string) $r->get_param( 'op' );
			$level = (int) $r->get_param( 'level' );
			$scope = (string) $r->get_param( 'scope' );
			$find = $plain( (string) $r->get_param( 'find' ) );
			$data = $load( $id );
			if ( ! $data ) {
				return new WP_Error( 'wpt_edit', 'This page isn\'t built with Elementor, so this kind of fix can\'t be used on it.', array( 'status' => 400 ) );
			}
			if ( 'style' === $op ) {
				/* Change how one image widget is displayed (version 7). Finds it by its image file name.
				 * Only these display settings can be changed, nothing else. */
				$file    = strtolower( (string) $r->get_param( 'find' ) );
				$allowed = array( 'object-fit', 'object-fit_tablet', 'object-fit_mobile', 'object-position', 'object-position_tablet', 'object-position_mobile', 'height', 'height_tablet', 'height_mobile' );
				$set     = (array) $r->get_param( 'set' );
				if ( strlen( $file ) < 5 || ! $set ) {
					return new WP_Error( 'wpt_edit', 'The fix doesn\'t say which image or what to change.', array( 'status' => 400 ) );
				}
				foreach ( $set as $k => $v ) {
					if ( ! in_array( $k, $allowed, true ) ) {
						return new WP_Error( 'wpt_edit', 'The hub can only change image size and cropping settings. Nothing was changed.', array( 'status' => 400 ) );
					}
				}
				$hits = array();
				$walk = function ( $els, $path ) use ( &$walk, &$hits, $file ) {
					foreach ( $els as $i => $el ) {
						$p = array_merge( $path, array( $i ) );
						if ( isset( $el['widgetType'] ) && 'image' === $el['widgetType'] && isset( $el['settings']['image']['url'] ) && false !== strpos( strtolower( $el['settings']['image']['url'] ), $file ) ) {
							$hits[] = $p;
						}
						if ( ! empty( $el['elements'] ) ) {
							$walk( $el['elements'], array_merge( $p, array( 'elements' ) ) );
						}
					}
				};
				$walk( $data, array() );
				if ( 1 !== count( $hits ) ) {
					return new WP_Error( 'wpt_edit', $hits ? 'That image is used ' . count( $hits ) . ' times on the page, so the hub won\'t guess which one. Nothing was changed.' : 'That image isn\'t on the page any more, so someone may have changed it. Nothing was changed.', array( 'status' => 409 ) );
				}
				$before = wp_json_encode( $data );
				$node   = &$data;
				foreach ( $hits[0] as $k ) {
					$node = &$node[ $k ];
				}
				$was = array();
				foreach ( $set as $k => $v ) {
					$was[ $k ] = isset( $node['settings'][ $k ] ) ? $node['settings'][ $k ] : '';
					if ( '' === $v || null === $v ) {
						unset( $node['settings'][ $k ] );
					} else {
						$node['settings'][ $k ] = $v;
					}
				}
				$eid = isset( $node['id'] ) ? $node['id'] : '';
				unset( $node );
				$bid = 'b' . time() . wp_rand( 100, 999 );
				update_post_meta( $id, '_wpt_hub_bk_' . $bid, array( 'data' => $before, 'after' => md5( wp_json_encode( $data ) ), 'time' => time() ) );
				$save( $id, $data );
				return array( 'ok' => true, 'backup' => $bid, 'element' => $eid, 'widget' => 'image', 'before' => wp_json_encode( $was ), 'after' => wp_json_encode( $set ) );
			}
			if ( strlen( $find ) < 3 ) {
				return new WP_Error( 'wpt_edit', 'The fix doesn\'t say which text to look for.', array( 'status' => 400 ) );
			}
			$matches = array();
			foreach ( $texts( $data ) as $t ) {
				if ( false !== stripos( $plain( $t['value'] ), $find ) ) {
					$matches[] = $t;
				}
			}
			$seen = array();
			foreach ( $matches as $m ) {
				$seen[ $m['id'] . '|' . implode( '.', $m['keys'] ) ] = 1;
			}
			if ( ! $matches ) {
				return new WP_Error( 'wpt_edit', 'The text this fix looks for isn\'t on the page any more, so someone may have changed it. Nothing was changed.', array( 'status' => 409 ) );
			}
			if ( count( $seen ) > 1 && ( 'set' === $op || 'swap' === $op ) ) {
				return new WP_Error( 'wpt_edit', 'That text appears in more than one place on the page, so the hub can\'t tell which to change. Nothing was changed.', array( 'status' => 409 ) );
			}
			if ( 'remove' === $op ) {
				$targets = array();
				foreach ( $matches as $mm ) {
					$targets[ wp_json_encode( $at_level( $mm['path'], $level, $scope ) ) ] = 1;
				}
				if ( count( $targets ) > 1 ) {
					return new WP_Error( 'wpt_edit', 'That text appears in more than one block at this level, so the hub won\'t guess which to remove. Nothing was changed.', array( 'status' => 409 ) );
				}
			}
			$m      = $matches[0];
			if ( $r->get_param( 'dry_run' ) && 'remove' === $op ) {
				$options = array();
				$depth   = (int) floor( ( count( $m['path'] ) - 1 ) / 2 );
				for ( $lv = 0; $lv <= $depth; $lv++ ) {
					$pp = $at_level( $m['path'], $lv, '' );
					$el = $data;
					foreach ( $pp as $k ) {
						$el = $el[ $k ];
					}
					$targets = array();
					foreach ( $matches as $mm ) {
						$targets[ wp_json_encode( $at_level( $mm['path'], $lv, '' ) ) ] = 1;
					}
					$options[] = array(
						'level'  => $lv,
						'kind'   => isset( $el['widgetType'] ) ? $el['widgetType'] : ( isset( $el['elType'] ) ? $el['elType'] : 'block' ),
						'unique' => 1 === count( $targets ),
						'images' => substr_count( wp_json_encode( $el ), '"url"' ),
						'text'   => implode( "\n", array_map( function ( $t ) use ( $plain ) {
							return $plain( $t['value'] );
						}, $texts( array( $el ) ) ) ),
					);
				}
				return array( 'ok' => true, 'dry_run' => true, 'options' => $options );
			}
			$before = wp_json_encode( $data );
			$detail = array();
			if ( 'set' === $op ) {
				$node = &$data;
				foreach ( $m['path'] as $k ) {
					$node = &$node[ $k ];
				}
				$cell = &$node['settings'];
				foreach ( $m['keys'] as $k ) {
					$cell = &$cell[ $k ];
				}
				$detail = array( 'before' => $cell, 'after' => (string) $r->get_param( 'replace' ) );
				$cell   = (string) $r->get_param( 'replace' );
				unset( $cell, $node );
			} elseif ( 'swap' === $op ) {
				/* Swap one phrase inside a widget's text, leaving the rest of it untouched. */
				$node = &$data;
				foreach ( $m['path'] as $k ) {
					$node = &$node[ $k ];
				}
				$cell = &$node['settings'];
				foreach ( $m['keys'] as $k ) {
					$cell = &$cell[ $k ];
				}
				$old    = (string) $cell;
				$phrase = (string) $r->get_param( 'find' );
				$new    = (string) $r->get_param( 'replace' );
				if ( 1 !== substr_count( $old, $phrase ) ) {
					$alt = str_replace( array( '&nbsp;', "\xC2\xA0" ), ' ', $old );
					if ( 1 !== substr_count( $alt, $phrase ) ) {
						return new WP_Error( 'wpt_edit', 'Found the text, but formatting inside it (bold, a link or similar) stops a clean swap. Nothing was changed. Ask Claude to rewrite this fix as a full text change.', array( 'status' => 409 ) );
					}
					$old = $alt;
				}
				$cell   = str_replace( $phrase, $new, $old );
				$detail = array( 'before' => $phrase, 'after' => $new );
				unset( $cell, $node );
			} elseif ( 'remove' === $op ) {
				$path  = $at_level( $m['path'], $level, $scope );
				$last  = array_pop( $path );
				$node  = &$data;
				foreach ( $path as $k ) {
					$node = &$node[ $k ];
				}
				$gone   = $node[ $last ];
				$all    = $texts( array( $gone ) );
				$detail = array( 'before' => implode( "\n", array_map( function ( $t ) use ( $plain ) {
					return $plain( $t['value'] );
				}, $all ) ), 'after' => '' );
				array_splice( $node, $last, 1 );
				unset( $node );
			} else {
				return new WP_Error( 'wpt_edit', 'Unknown edit type.', array( 'status' => 400 ) );
			}
			$bid = 'b' . time() . wp_rand( 100, 999 );
			update_post_meta( $id, '_wpt_hub_bk_' . $bid, array( 'data' => $before, 'after' => md5( wp_json_encode( $data ) ), 'time' => time() ) );
			$save( $id, $data );
			return array( 'ok' => true, 'backup' => $bid, 'element' => $m['id'], 'widget' => $m['widget'], 'before' => $detail['before'], 'after' => $detail['after'] );
		},
	) );

	register_rest_route( 'wpt-hub/v1', '/elementor-undo', array(
		'methods'             => 'POST',
		'permission_callback' => $can_post,
		'callback'            => function ( WP_REST_Request $r ) use ( $load, $save ) {
			$id  = (int) $r->get_param( 'post_id' );
			$bid = preg_replace( '/[^a-z0-9]/i', '', (string) $r->get_param( 'backup' ) );
			$bk  = get_post_meta( $id, '_wpt_hub_bk_' . $bid, true );
			if ( ! $bk || empty( $bk['data'] ) ) {
				return new WP_Error( 'wpt_undo', 'The saved copy of this page wasn\'t found. Use Revisions in Elementor to roll back.', array( 'status' => 404 ) );
			}
			$now = $load( $id );
			if ( md5( wp_json_encode( $now ) ) !== $bk['after'] && ! $r->get_param( 'force' ) ) {
				return new WP_Error( 'wpt_undo_changed', 'The page has been edited since this fix went live. Undoing would also wipe those later edits. Use Revisions in Elementor instead, or undo anyway from the hub.', array( 'status' => 409 ) );
			}
			$save( $id, json_decode( $bk['data'], true ) );
			delete_post_meta( $id, '_wpt_hub_bk_' . $bid );
			return array( 'ok' => true );
		},
	) );
} );


/* New page builds (version 6).
 * /wpt-hub/v1/page-style GET  ?template_id=  Read-only. The site's global fonts and colours (Elementor kit)
 *                             and the layout of one page: each block in order, its font, size, weight,
 *                             colour and a preview of its text.
 * /wpt-hub/v1/page-build POST Make a NEW page as a DRAFT by copying an existing page's design
 *                             (sections, widgets, fonts, colours, page settings), then swapping in the
 *                             new text and removing blocks that aren't needed. Never publishes. Never
 *                             touches the page it copies from. Returns preview and edit links. */
add_action( 'rest_api_init', function () {
	$plain = function ( $s ) {
		$s = html_entity_decode( wp_strip_all_tags( (string) $s ), ENT_QUOTES | ENT_HTML5, 'UTF-8' );
		$s = str_replace( array( "\xE2\x80\x98", "\xE2\x80\x99", "\xE2\x80\x9C", "\xE2\x80\x9D", "\xC2\xA0" ), array( "'", "'", '"', '"', ' ' ), $s );
		return trim( preg_replace( '/\s+/u', ' ', $s ) );
	};
	$load = function ( $id ) {
		$raw = get_post_meta( $id, '_elementor_data', true );
		if ( ! $raw ) {
			return null;
		}
		$d = is_array( $raw ) ? $raw : json_decode( $raw, true );
		return is_array( $d ) ? $d : null;
	};
	/* Global fonts and colours from the active Elementor kit, keyed by their id. */
	$kit = function () {
		$out = array( 'colors' => array(), 'fonts' => array() );
		$id  = (int) get_option( 'elementor_active_kit' );
		$s   = $id ? get_post_meta( $id, '_elementor_page_settings', true ) : array();
		if ( ! is_array( $s ) ) {
			return $out;
		}
		foreach ( array( 'system_colors', 'custom_colors' ) as $k ) {
			foreach ( isset( $s[ $k ] ) ? (array) $s[ $k ] : array() as $c ) {
				if ( ! empty( $c['_id'] ) ) {
					$out['colors'][ $c['_id'] ] = array( 'name' => isset( $c['title'] ) ? $c['title'] : $c['_id'], 'color' => isset( $c['color'] ) ? $c['color'] : '' );
				}
			}
		}
		foreach ( array( 'system_typography', 'custom_typography' ) as $k ) {
			foreach ( isset( $s[ $k ] ) ? (array) $s[ $k ] : array() as $t ) {
				if ( ! empty( $t['_id'] ) ) {
					$out['fonts'][ $t['_id'] ] = array(
						'name'   => isset( $t['title'] ) ? $t['title'] : $t['_id'],
						'family' => isset( $t['typography_font_family'] ) ? $t['typography_font_family'] : '',
						'size'   => isset( $t['typography_font_size']['size'] ) && '' !== $t['typography_font_size']['size'] ? $t['typography_font_size']['size'] . ( isset( $t['typography_font_size']['unit'] ) ? $t['typography_font_size']['unit'] : 'px' ) : '',
						'weight' => isset( $t['typography_font_weight'] ) ? $t['typography_font_weight'] : '',
					);
				}
			}
		}
		return $out;
	};
	$gid = function ( $ref ) {
		return preg_match( '/[?&]id=([a-z0-9_-]+)/i', (string) $ref, $m ) ? $m[1] : '';
	};
	/* One row per widget: what it is, how it looks, what it says. */
	$outline = function ( $elements, $k ) use ( $plain, $gid ) {
		$rows = array();
		$walk = function ( $els, $depth ) use ( &$walk, &$rows, $plain, $gid, $k ) {
			foreach ( $els as $el ) {
				$s = isset( $el['settings'] ) && is_array( $el['settings'] ) ? $el['settings'] : array();
				$g = isset( $s['__globals__'] ) && is_array( $s['__globals__'] ) ? $s['__globals__'] : array();
				if ( isset( $el['widgetType'] ) ) {
					$font = array( 'family' => '', 'size' => '', 'weight' => '', 'global' => '' );
					foreach ( $s as $key => $v ) {
						if ( preg_match( '/typography_font_family$/', $key ) && $v ) {
							$font['family'] = $v;
						} elseif ( preg_match( '/typography_font_size$/', $key ) && is_array( $v ) && isset( $v['size'] ) && '' !== $v['size'] ) {
							$font['size'] = $v['size'] . ( isset( $v['unit'] ) ? $v['unit'] : 'px' );
						} elseif ( preg_match( '/typography_font_weight$/', $key ) && $v ) {
							$font['weight'] = $v;
						}
					}
					foreach ( $g as $key => $ref ) {
						if ( preg_match( '/typography_typography$/', $key ) ) {
							$id = $gid( $ref );
							if ( isset( $k['fonts'][ $id ] ) ) {
								$font['global'] = $k['fonts'][ $id ]['name'];
								foreach ( array( 'family', 'size', 'weight' ) as $f ) {
									if ( ! $font[ $f ] ) {
										$font[ $f ] = $k['fonts'][ $id ][ $f ];
									}
								}
							}
						}
					}
					$color = '';
					foreach ( array( 'title_color', 'text_color', 'button_text_color', 'color' ) as $ck ) {
						if ( ! empty( $s[ $ck ] ) ) {
							$color = $s[ $ck ];
							break;
						}
						if ( ! empty( $g[ $ck ] ) && isset( $k['colors'][ $gid( $g[ $ck ] ) ] ) ) {
							$c     = $k['colors'][ $gid( $g[ $ck ] ) ];
							$color = $c['color'] . ' (' . $c['name'] . ')';
							break;
						}
					}
					$text = '';
					foreach ( array( 'title', 'editor', 'text', 'description_text', 'title_text', 'testimonial_content' ) as $tk ) {
						if ( ! empty( $s[ $tk ] ) && is_string( $s[ $tk ] ) ) {
							$text = $plain( $s[ $tk ] );
							break;
						}
					}
					$rows[] = array(
						'depth'  => $depth,
						'widget' => $el['widgetType'],
						'tag'    => isset( $s['header_size'] ) ? $s['header_size'] : '',
						'font'   => $font,
						'color'  => $color,
						'text'   => substr( $text, 0, 160 ),
						'image'  => isset( $s['image']['url'] ) ? $s['image']['url'] : '',
					);
				} elseif ( isset( $el['elType'] ) && ( 'section' === $el['elType'] || ( 'container' === $el['elType'] && 0 === $depth ) ) ) {
					$bg = '';
					if ( ! empty( $s['background_color'] ) ) {
						$bg = $s['background_color'];
					} elseif ( ! empty( $g['background_color'] ) && isset( $k['colors'][ $gid( $g['background_color'] ) ] ) ) {
						$bg = $k['colors'][ $gid( $g['background_color'] ) ]['color'];
					}
					$rows[] = array( 'depth' => $depth, 'widget' => 'section', 'background' => $bg, 'bg_image' => ! empty( $s['background_image']['url'] ) );
				}
				if ( ! empty( $el['elements'] ) ) {
					$walk( $el['elements'], $depth + 1 );
				}
			}
		};
		$walk( $elements, 0 );
		return $rows;
	};
	/* Every text setting: element path, widget type, setting path, value (same as the page editor). */
	$texts = function ( $elements ) {
		$out  = array();
		$walk = function ( $els, $path ) use ( &$walk, &$out ) {
			foreach ( $els as $i => $el ) {
				$p    = array_merge( $path, array( $i ) );
				$scan = function ( $v, $keys ) use ( &$scan, &$out, $p, $el ) {
					if ( is_string( $v ) ) {
						if ( preg_match( '/[a-z]{3}/i', wp_strip_all_tags( $v ) ) && ! preg_match( '#^(https?:|\#|[a-z_-]+$)#i', trim( $v ) ) ) {
							$out[] = array( 'path' => $p, 'keys' => $keys, 'value' => $v, 'widget' => isset( $el['widgetType'] ) ? $el['widgetType'] : '' );
						}
					} elseif ( is_array( $v ) ) {
						foreach ( $v as $k => $vv ) {
							if ( '__globals__' !== $k && '__dynamic__' !== $k ) {
								$scan( $vv, array_merge( $keys, array( $k ) ) );
							}
						}
					}
				};
				if ( isset( $el['settings'] ) && is_array( $el['settings'] ) ) {
					$scan( $el['settings'], array() );
				}
				if ( ! empty( $el['elements'] ) ) {
					$walk( $el['elements'], array_merge( $p, array( 'elements' ) ) );
				}
			}
		};
		$walk( $elements, array() );
		return $out;
	};
	$fresh_ids = function ( &$els ) use ( &$fresh_ids ) {
		foreach ( $els as &$el ) {
			if ( isset( $el['id'] ) ) {
				$el['id'] = substr( md5( uniqid( '', true ) . wp_rand( 0, 999999 ) ), 0, 7 );
			}
			if ( ! empty( $el['elements'] ) ) {
				$fresh_ids( $el['elements'] );
			}
		}
	};

	register_rest_route( 'wpt-hub/v1', '/page-style', array(
		'methods'             => 'GET',
		'permission_callback' => function () {
			return current_user_can( 'edit_pages' );
		},
		'callback'            => function ( WP_REST_Request $r ) use ( $load, $kit, $outline ) {
			$id   = (int) $r->get_param( 'template_id' );
			$data = $id ? $load( $id ) : null;
			if ( ! $data ) {
				return new WP_Error( 'wpt_style', 'That page isn\'t built with Elementor, so its design can\'t be read or copied.', array( 'status' => 400 ) );
			}
			$k = $kit();
			return array(
				'ok'     => true,
				'title'  => get_the_title( $id ),
				'link'   => get_permalink( $id ),
				'colors' => array_values( $k['colors'] ),
				'fonts'  => array_values( $k['fonts'] ),
				'layout' => $outline( $data, $k ),
			);
		},
	) );

	register_rest_route( 'wpt-hub/v1', '/page-build', array(
		'methods'             => 'POST',
		'permission_callback' => function ( WP_REST_Request $r ) {
			$id = (int) $r->get_param( 'template_id' );
			return $id > 0 && current_user_can( 'edit_pages' ) && current_user_can( 'edit_post', $id );
		},
		'callback'            => function ( WP_REST_Request $r ) use ( $plain, $load, $texts, $fresh_ids ) {
			$tid   = (int) $r->get_param( 'template_id' );
			$title = sanitize_text_field( (string) $r->get_param( 'title' ) );
			$slug  = sanitize_title( (string) $r->get_param( 'slug' ) );
			$data  = $load( $tid );
			if ( ! $data ) {
				return new WP_Error( 'wpt_build', 'The page to copy the design from isn\'t built with Elementor. Nothing was made.', array( 'status' => 400 ) );
			}
			if ( strlen( $title ) < 3 ) {
				return new WP_Error( 'wpt_build', 'The new page needs a title. Nothing was made.', array( 'status' => 400 ) );
			}
			$report = array();
			foreach ( (array) $r->get_param( 'edits' ) as $n => $e ) {
				$op    = isset( $e['op'] ) ? (string) $e['op'] : 'set';
				$find  = $plain( isset( $e['find'] ) ? $e['find'] : '' );
				$label = 'Change ' . ( $n + 1 ) . ' ("' . substr( $find, 0, 50 ) . '")';
				if ( strlen( $find ) < 3 ) {
					return new WP_Error( 'wpt_build', $label . ' doesn\'t say which text to look for. Nothing was made.', array( 'status' => 400 ) );
				}
				$hits = array();
				foreach ( $texts( $data ) as $t ) {
					if ( false !== stripos( $plain( $t['value'] ), $find ) ) {
						$hits[] = $t;
					}
				}
				if ( 1 !== count( $hits ) ) {
					return new WP_Error( 'wpt_build', $label . ( $hits ? ' matches ' . count( $hits ) . ' places on the page being copied, so the hub won\'t guess.' : ' isn\'t on the page being copied any more. It may have been edited.' ) . ' Nothing was made. Ask Claude to update the build.', array( 'status' => 409 ) );
				}
				$m = $hits[0];
				if ( 'remove' === $op ) {
					$lv   = max( 0, isset( $e['level'] ) ? (int) $e['level'] : 0 );
					$path = array_slice( $m['path'], 0, max( 1, count( $m['path'] ) - 2 * $lv ) );
					$last = array_pop( $path );
					$node = &$data;
					foreach ( $path as $k ) {
						$node = &$node[ $k ];
					}
					array_splice( $node, $last, 1 );
					unset( $node );
					$report[] = array( 'op' => 'remove', 'find' => $find );
				} else {
					$node = &$data;
					foreach ( $m['path'] as $k ) {
						$node = &$node[ $k ];
					}
					$cell = &$node['settings'];
					foreach ( $m['keys'] as $k ) {
						$cell = &$cell[ $k ];
					}
					$cell = 'swap' === $op ? str_replace( (string) $e['find'], (string) $e['replace'], str_replace( array( '&nbsp;', "\xC2\xA0" ), ' ', (string) $cell ) ) : (string) $e['replace'];
					unset( $cell, $node );
					$report[] = array( 'op' => $op, 'find' => $find, 'widget' => $m['widget'] );
				}
			}
			$fresh_ids( $data );
			$new = wp_insert_post( wp_slash( array(
				'post_type'    => 'page',
				'post_status'  => 'draft',
				'post_title'   => $title,
				'post_name'    => $slug,
				'post_parent'  => (int) $r->get_param( 'parent_id' ),
				'post_content' => '',
			) ), true );
			if ( is_wp_error( $new ) ) {
				return $new;
			}
			foreach ( array( '_elementor_edit_mode', '_elementor_template_type', '_elementor_version', '_elementor_pro_version', '_elementor_page_settings', '_wp_page_template' ) as $mk ) {
				$v = get_post_meta( $tid, $mk, true );
				if ( '' !== $v && null !== $v ) {
					update_post_meta( $new, $mk, wp_slash( $v ) );
				}
			}
			update_post_meta( $new, '_elementor_data', wp_slash( wp_json_encode( $data ) ) );
			if ( class_exists( '\Elementor\Plugin' ) && isset( \Elementor\Plugin::$instance->documents ) ) {
				$doc = \Elementor\Plugin::$instance->documents->get( $new, false );
				if ( $doc ) {
					$doc->save( array( 'elements' => $data ) );
				}
			}
			$seo_t = sanitize_text_field( (string) $r->get_param( 'seo_title' ) );
			$seo_d = sanitize_text_field( (string) $r->get_param( 'seo_description' ) );
			if ( $seo_t ) {
				update_post_meta( $new, 'rank_math_title', $seo_t );
			}
			if ( $seo_d ) {
				update_post_meta( $new, 'rank_math_description', $seo_d );
			}
			update_post_meta( $new, '_wpt_hub_build', array( 'from' => $tid, 'time' => time() ) );
			return array(
				'ok'      => true,
				'id'      => $new,
				'status'  => get_post_status( $new ),
				'preview' => get_preview_post_link( $new ),
				'edit'    => admin_url( 'post.php?post=' . $new . '&action=elementor' ),
				'from'    => get_the_title( $tid ),
				'changes' => $report,
			);
		},
	) );
} );
