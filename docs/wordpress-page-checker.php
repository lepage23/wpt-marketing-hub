<?php
/**
 * WPT Marketing Hub: page checker (version 12: H1 fixes also work when the top heading sits in a text or HTML block, and wrong phrases can be swapped everywhere on a page).
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
			$out    = array( 'version' => 12, 'days' => $days, 'home' => home_url( '/' ), 'tables' => array() );
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

/* Page editing for Elementor pages (version 4; FAQ blocks added in version 11).
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
			/* Find one element (widget, column, section or container) by its Elementor id. */
			$by_id = function ( $data, $elid ) {
				$found = null;
				$walk  = function ( $els, $path ) use ( &$walk, &$found, $elid ) {
					foreach ( $els as $i => $el ) {
						$p = array_merge( $path, array( $i ) );
						if ( isset( $el['id'] ) && $el['id'] === $elid ) {
							$found = $p;
							return;
						}
						if ( ! empty( $el['elements'] ) ) {
							$walk( $el['elements'], array_merge( $p, array( 'elements' ) ) );
						}
					}
				};
				$walk( $data, array() );
				return $found;
			};
			if ( 'type' === $op ) {
				/* Change one element's font size or line spacing (version 10). If it uses a global font from the
				 * site kit, the kit's settings are copied onto the element first so only the size or spacing changes. */
				$elid = preg_replace( '/[^a-z0-9]/i', '', (string) $r->get_param( 'element' ) );
				$path = $elid ? $by_id( $data, $elid ) : null;
				if ( ! $path ) {
					return new WP_Error( 'wpt_edit', 'That part of the page isn\'t there any more, so someone may have changed it. Nothing was changed.', array( 'status' => 409 ) );
				}
				$allowed = array();
				foreach ( array( 'typography_font_size', 'typography_line_height' ) as $b ) {
					foreach ( array( '', '_tablet', '_mobile' ) as $sfx ) {
						$allowed[] = $b . $sfx;
					}
				}
				$set = (array) $r->get_param( 'set' );
				foreach ( $set as $k => $v ) {
					if ( ! in_array( $k, $allowed, true ) || ! is_array( $v ) || ! isset( $v['size'] ) ) {
						return new WP_Error( 'wpt_edit', 'The hub can only change font size and line spacing here. Nothing was changed.', array( 'status' => 400 ) );
					}
				}
				$before = wp_json_encode( $data );
				$node   = &$data;
				foreach ( $path as $k ) {
					$node = &$node[ $k ];
				}
				if ( ! isset( $node['settings'] ) || ! is_array( $node['settings'] ) ) {
					$node['settings'] = array();
				}
				$was  = array();
				$glob = isset( $node['settings']['__globals__']['typography_typography'] ) ? (string) $node['settings']['__globals__']['typography_typography'] : '';
				if ( $glob && preg_match( '/[?&]id=([a-z0-9_-]+)/i', $glob, $gm ) ) {
					$kid = (int) get_option( 'elementor_active_kit' );
					$ks  = $kid ? get_post_meta( $kid, '_elementor_page_settings', true ) : array();
					foreach ( array( 'system_typography', 'custom_typography' ) as $kk ) {
						foreach ( ( is_array( $ks ) && isset( $ks[ $kk ] ) ) ? (array) $ks[ $kk ] : array() as $t ) {
							if ( isset( $t['_id'] ) && $t['_id'] === $gm[1] ) {
								foreach ( $t as $tk => $tv ) {
									if ( 0 === strpos( $tk, 'typography_' ) && ! isset( $node['settings'][ $tk ] ) ) {
										$node['settings'][ $tk ] = $tv;
									}
								}
							}
						}
					}
					$was['__globals__.typography_typography'] = $glob;
					unset( $node['settings']['__globals__']['typography_typography'] );
				}
				$node['settings']['typography_typography'] = 'custom';
				foreach ( $set as $k => $v ) {
					$was[ $k ]              = isset( $node['settings'][ $k ] ) ? $node['settings'][ $k ] : '';
					$node['settings'][ $k ] = array( 'unit' => isset( $v['unit'] ) ? sanitize_key( $v['unit'] ) : 'px', 'size' => (float) $v['size'], 'sizes' => array() );
				}
				$type = isset( $node['widgetType'] ) ? $node['widgetType'] : '';
				unset( $node );
				$bid = 'b' . time() . wp_rand( 100, 999 );
				update_post_meta( $id, '_wpt_hub_bk_' . $bid, array( 'data' => $before, 'after' => md5( wp_json_encode( $data ) ), 'time' => time() ) );
				$save( $id, $data );
				return array( 'ok' => true, 'backup' => $bid, 'element' => $elid, 'widget' => $type, 'before' => wp_json_encode( $was ), 'after' => wp_json_encode( $set ) );
			}
			if ( 'h1' === $op ) {
				/* h1: make one heading widget the page's H1 (version 11). Without "element" it picks the first
				 * heading on the page. dry_run says which heading it would change, and changes nothing. */
				$heads = array();
				$walk  = function ( $els, $path ) use ( &$walk, &$heads ) {
					foreach ( $els as $i => $el ) {
						$p = array_merge( $path, array( $i ) );
						if ( isset( $el['widgetType'] ) && 'heading' === $el['widgetType'] ) {
							$heads[] = array( 'path' => $p, 'id' => isset( $el['id'] ) ? $el['id'] : '', 'tag' => isset( $el['settings']['header_size'] ) ? (string) $el['settings']['header_size'] : 'h2', 'text' => isset( $el['settings']['title'] ) ? (string) $el['settings']['title'] : '' );
						}
						if ( ! empty( $el['elements'] ) ) {
							$walk( $el['elements'], array_merge( $p, array( 'elements' ) ) );
						}
					}
				};
				$walk( $data, array() );
				foreach ( $heads as $h ) {
					if ( 'h1' === $h['tag'] ) {
						return new WP_Error( 'wpt_edit', 'Elementor already has an H1 on this page ("' . $plain( $h['text'] ) . '"), but it isn\'t showing to visitors. It may be hidden on some screens. Nothing was changed. Tell Claude and it will look into it.', array( 'status' => 409 ) );
					}
				}
				$elid = preg_replace( '/[^a-z0-9]/i', '', (string) $r->get_param( 'element' ) );
				$pick = null;
				foreach ( $heads as $h ) {
					if ( ( $elid && $h['id'] === $elid ) || ( ! $elid && strlen( $plain( $h['text'] ) ) >= 3 ) ) {
						$pick = $h;
						break;
					}
				}
				if ( ! $elid ) {
					/* Version 12: many pages put their top heading inside a text or HTML widget, or use an icon box.
					 * Whichever comes first on the page wins, so the H1 is the heading visitors see at the top. */
					$alt   = null;
					$walk2 = function ( $els, $path ) use ( &$walk2, &$alt, $plain ) {
						foreach ( $els as $i => $el ) {
							if ( $alt ) {
								return;
							}
							$p = array_merge( $path, array( $i ) );
							$w = isset( $el['widgetType'] ) ? $el['widgetType'] : '';
							$st = isset( $el['settings'] ) && is_array( $el['settings'] ) ? $el['settings'] : array();
							foreach ( array( 'editor', 'html' ) as $key ) {
								if ( ( 'text-editor' === $w || 'html' === $w ) && isset( $st[ $key ] ) && preg_match( '#<h([1-6])(\s[^>]*)?>(.*?)</h\1>#is', (string) $st[ $key ], $m, PREG_OFFSET_CAPTURE ) && strlen( $plain( $m[3][0] ) ) >= 3 ) {
									$alt = array( 'path' => $p, 'id' => isset( $el['id'] ) ? $el['id'] : '', 'kind' => 'html', 'key' => $key, 'tag' => 'h' . $m[1][0], 'text' => $m[3][0], 'at' => $m[0][1], 'whole' => $m[0][0] );
									return;
								}
							}
							if ( ( 'icon-box' === $w || 'image-box' === $w ) && isset( $st['title_text'] ) && strlen( $plain( $st['title_text'] ) ) >= 3 ) {
								$alt = array( 'path' => $p, 'id' => isset( $el['id'] ) ? $el['id'] : '', 'kind' => 'box', 'tag' => isset( $st['title_size'] ) ? (string) $st['title_size'] : 'h3', 'text' => $st['title_text'] );
								return;
							}
							if ( ! empty( $el['elements'] ) ) {
								$walk2( $el['elements'], array_merge( $p, array( 'elements' ) ) );
							}
						}
					};
					$walk2( $data, array() );
					if ( $alt && 'h1' === $alt['tag'] ) {
						return new WP_Error( 'wpt_edit', 'This page already has an H1 inside a text block ("' . $plain( $alt['text'] ) . '"), but it isn\'t showing to visitors. Nothing was changed. Tell Claude and it will look into it.', array( 'status' => 409 ) );
					}
					$first = function ( $a, $b ) {
						for ( $i = 0; $i < min( count( $a ), count( $b ) ); $i++ ) {
							if ( $a[ $i ] !== $b[ $i ] ) {
								return (int) $a[ $i ] < (int) $b[ $i ];
							}
						}
						return count( $a ) <= count( $b );
					};
					if ( $alt && ( ! $pick || $first( $alt['path'], $pick['path'] ) ) ) {
						$pick = $alt;
					}
				}
				if ( ! $pick ) {
					return new WP_Error( 'wpt_edit', $elid ? 'That heading isn\'t on the page any more, so someone may have changed it. Nothing was changed.' : 'This page has no heading at all to turn into the H1, so the hub would have to add one. Nothing was changed.', array( 'status' => 409 ) );
				}
				$label = strtoupper( $pick['tag'] ) . ': ' . $plain( $pick['text'] );
				if ( $r->get_param( 'dry_run' ) ) {
					return array( 'ok' => true, 'dry_run' => true, 'element' => $pick['id'], 'tag' => $pick['tag'], 'text' => $plain( $pick['text'] ), 'kind' => isset( $pick['kind'] ) ? $pick['kind'] : 'heading' );
				}
				$before = wp_json_encode( $data );
				$node   = &$data;
				foreach ( $pick['path'] as $k ) {
					$node = &$node[ $k ];
				}
				if ( isset( $pick['kind'] ) && 'html' === $pick['kind'] ) {
					/* Only the tag changes. Keep any class or style on it, so it looks the same. */
					$h1 = preg_replace( '#^<h[1-6]#i', '<h1', preg_replace( '#</h[1-6]>$#i', '</h1>', $pick['whole'] ) );
					$node['settings'][ $pick['key'] ] = substr_replace( (string) $node['settings'][ $pick['key'] ], $h1, $pick['at'], strlen( $pick['whole'] ) );
				} elseif ( isset( $pick['kind'] ) && 'box' === $pick['kind'] ) {
					$node['settings']['title_size'] = 'h1';
				} else {
					$node['settings']['header_size'] = 'h1';
				}
				$wtype = isset( $node['widgetType'] ) ? $node['widgetType'] : 'heading';
				unset( $node );
				$bid = 'b' . time() . wp_rand( 100, 999 );
				update_post_meta( $id, '_wpt_hub_bk_' . $bid, array( 'data' => $before, 'after' => md5( wp_json_encode( $data ) ), 'time' => time() ) );
				$save( $id, $data );
				return array( 'ok' => true, 'backup' => $bid, 'element' => $pick['id'], 'widget' => $wtype, 'before' => $label, 'after' => 'H1: ' . $plain( $pick['text'] ) );
			}
			if ( 'faq' === $op ) {
				/* faq: add an FAQ block to the page, or replace the one the hub added before (version 11).
				 * A heading plus Elementor's accordion with its "FAQ Schema" switched on, so Google and AI tools
				 * get FAQPage schema. Goes before the block containing "before" text (e.g. the closing call to
				 * action), or at the end of the page. A block the hub added is replaced where it sits. */
				$items = array();
				foreach ( (array) $r->get_param( 'items' ) as $it ) {
					$q = isset( $it['q'] ) ? sanitize_text_field( (string) $it['q'] ) : '';
					$a = isset( $it['a'] ) ? trim( wp_kses_post( (string) $it['a'] ) ) : '';
					if ( strlen( $q ) < 5 || strlen( wp_strip_all_tags( $a ) ) < 10 ) {
						return new WP_Error( 'wpt_edit', 'Question ' . ( count( $items ) + 1 ) . ' needs both a question and an answer. Nothing was changed.', array( 'status' => 400 ) );
					}
					$items[] = array( 'q' => $q, 'a' => $a );
				}
				if ( count( $items ) < 2 || count( $items ) > 12 ) {
					return new WP_Error( 'wpt_edit', 'An FAQ block needs between 2 and 12 questions. Nothing was changed.', array( 'status' => 400 ) );
				}
				$heading = sanitize_text_field( (string) $r->get_param( 'heading' ) );
				$heading = $heading ? $heading : 'Frequently asked questions';
				$mine = null;
				foreach ( $data as $i => $el ) {
					if ( isset( $el['settings']['css_classes'] ) && false !== strpos( (string) $el['settings']['css_classes'], 'wpt-hub-faq' ) ) {
						$mine = $i;
					}
				}
				/* Two FAQ schemas on one page confuse Google, so refuse if someone else already added one. */
				$other = false;
				$scan  = function ( $els ) use ( &$scan, &$other ) {
					foreach ( $els as $el ) {
						if ( isset( $el['settings']['faq_schema'] ) && 'yes' === $el['settings']['faq_schema'] ) {
							$other = true;
						}
						if ( ! empty( $el['elements'] ) ) {
							$scan( $el['elements'] );
						}
					}
				};
				foreach ( $data as $i => $el ) {
					if ( $i !== $mine ) {
						$scan( array( $el ) );
					}
				}
				if ( $other ) {
					return new WP_Error( 'wpt_edit', 'This page already has an FAQ with schema that the hub didn\'t add. Nothing was changed. Tell Claude and it will rewrite this fix to update that one instead.', array( 'status' => 409 ) );
				}
				$nid  = function () {
					return substr( md5( wp_rand( 0, PHP_INT_MAX ) . microtime() ), 0, 7 );
				};
				$tabs = array();
				foreach ( $items as $it ) {
					$ans    = preg_match( '#^\s*<(p|ul|ol|div)[\s>]#i', $it['a'] ) ? $it['a'] : '<p>' . $it['a'] . '</p>';
					$tabs[] = array( '_id' => $nid(), 'tab_title' => $it['q'], 'tab_content' => $ans );
				}
				$widgets = array(
					array( 'id' => $nid(), 'elType' => 'widget', 'widgetType' => 'heading', 'settings' => array( 'title' => $heading, 'header_size' => 'h2' ), 'elements' => array() ),
					array( 'id' => $nid(), 'elType' => 'widget', 'widgetType' => 'accordion', 'settings' => array( 'tabs' => $tabs, 'faq_schema' => 'yes', 'title_html_tag' => 'h3' ), 'elements' => array() ),
				);
				$containers = false;
				foreach ( $data as $el ) {
					if ( isset( $el['elType'] ) && 'container' === $el['elType'] ) {
						$containers = true;
					}
				}
				$pad = array( 'unit' => 'px', 'top' => '40', 'right' => '20', 'bottom' => '40', 'left' => '20', 'isLinked' => false );
				if ( $containers ) {
					$block = array( 'id' => $nid(), 'elType' => 'container', 'isInner' => false, 'settings' => array( 'content_width' => 'boxed', 'flex_direction' => 'column', 'padding' => $pad, 'css_classes' => 'wpt-hub-faq' ), 'elements' => $widgets );
				} else {
					$block = array( 'id' => $nid(), 'elType' => 'section', 'isInner' => false, 'settings' => array( 'padding' => $pad, 'css_classes' => 'wpt-hub-faq' ), 'elements' => array(
						array( 'id' => $nid(), 'elType' => 'column', 'isInner' => false, 'settings' => array( '_column_size' => 100, '_inline_size' => null ), 'elements' => $widgets ),
					) );
				}
				$before_txt = '';
				$where      = count( $data );
				if ( null !== $mine ) {
					$was   = $data[ $mine ];
					$where = $mine;
					foreach ( $texts( array( $was ) ) as $t ) {
						$before_txt .= $plain( $t['value'] ) . "\n";
					}
				} else {
					$anchor = $plain( (string) $r->get_param( 'before' ) );
					if ( strlen( $anchor ) >= 3 ) {
						$at = array();
						foreach ( $texts( $data ) as $t ) {
							if ( false !== stripos( $plain( $t['value'] ), $anchor ) ) {
								$at[ $t['path'][0] ] = 1;
							}
						}
						if ( 1 === count( $at ) ) {
							$where = (int) key( $at );
						}
					}
				}
				$before = wp_json_encode( $data );
				array_splice( $data, $where, null !== $mine ? 1 : 0, array( $block ) );
				$after = $heading;
				foreach ( $items as $it ) {
					$after .= "\n\nQ: " . $it['q'] . "\nA: " . $plain( $it['a'] );
				}
				$bid = 'b' . time() . wp_rand( 100, 999 );
				update_post_meta( $id, '_wpt_hub_bk_' . $bid, array( 'data' => $before, 'after' => md5( wp_json_encode( $data ) ), 'time' => time() ) );
				$save( $id, $data );
				return array( 'ok' => true, 'backup' => $bid, 'element' => $block['id'], 'widget' => 'accordion', 'replaced' => null !== $mine, 'position' => $where, 'before' => trim( $before_txt ), 'after' => $after );
			}
			if ( 'tidy' === $op || 'layout' === $op ) {
				/* tidy:   remove the space or line break before . , ? ! : ; in one element's text (version 9).
				 * layout: change one element's margin, padding or max width (version 9). Sides not named are kept. */
				$elid = preg_replace( '/[^a-z0-9]/i', '', (string) $r->get_param( 'element' ) );
				$path = $elid ? $by_id( $data, $elid ) : null;
				if ( ! $path ) {
					return new WP_Error( 'wpt_edit', 'That part of the page isn\'t there any more, so someone may have changed it. Nothing was changed.', array( 'status' => 409 ) );
				}
				$before = wp_json_encode( $data );
				$node   = &$data;
				foreach ( $path as $k ) {
					$node = &$node[ $k ];
				}
				if ( ! isset( $node['settings'] ) || ! is_array( $node['settings'] ) ) {
					$node['settings'] = array();
				}
				$was = array();
				$now = array();
				if ( 'tidy' === $op ) {
					foreach ( array( 'title', 'editor', 'text', 'before_text', 'after_text', 'highlighted_text', 'rotating_text', 'description_text', 'title_text' ) as $k ) {
						if ( empty( $node['settings'][ $k ] ) || ! is_string( $node['settings'][ $k ] ) ) {
							continue;
						}
						$v = $node['settings'][ $k ];
						$n = preg_replace( '/(?:\s|&nbsp;|\xC2\xA0|<br\s*\/?>)+([.,?!:;])(?=\s|<|&nbsp;|$)/iu', '$1', $v );
						if ( $n !== $v ) {
							$was[ $k ] = $v;
							$now[ $k ] = $n;
							$node['settings'][ $k ] = $n;
						}
					}
					if ( ! $now ) {
						unset( $node );
						return new WP_Error( 'wpt_edit', 'There\'s no space or line break before the punctuation in the text itself. It\'s probably the widget layout (for example the full stop is in a separate part of an animated headline). Nothing was changed. Tell Claude and it will write a different fix.', array( 'status' => 409 ) );
					}
				} else {
					$allowed = array();
					foreach ( array( 'margin', '_margin', 'padding', '_padding', 'max_width', 'width' ) as $b ) {
						foreach ( array( '', '_tablet', '_mobile' ) as $sfx ) {
							$allowed[] = $b . $sfx;
						}
					}
					foreach ( (array) $r->get_param( 'set' ) as $k => $v ) {
						if ( ! in_array( $k, $allowed, true ) ) {
							unset( $node );
							return new WP_Error( 'wpt_edit', 'The hub can only change margin, padding and width here. Nothing was changed.', array( 'status' => 400 ) );
						}
						$cur        = isset( $node['settings'][ $k ] ) ? $node['settings'][ $k ] : '';
						$was[ $k ]  = $cur;
						if ( is_array( $v ) && in_array( preg_replace( '/_(tablet|mobile)$/', '', $k ), array( 'margin', '_margin', 'padding', '_padding' ), true ) ) {
							$base = is_array( $cur ) ? $cur : array( 'unit' => 'px', 'top' => '', 'right' => '', 'bottom' => '', 'left' => '', 'isLinked' => false );
							foreach ( array( 'top', 'right', 'bottom', 'left', 'unit' ) as $side ) {
								if ( isset( $v[ $side ] ) ) {
									$base[ $side ] = (string) $v[ $side ];
								}
							}
							$base['isLinked'] = false;
							$v                = $base;
						}
						$node['settings'][ $k ] = $v;
						$now[ $k ]              = $v;
					}
					if ( $r->get_param( 'clear_negative_margin' ) ) {
						foreach ( array( '_margin', '_margin_tablet', '_margin_mobile' ) as $k ) {
							if ( isset( $node['settings'][ $k ] ) && is_array( $node['settings'][ $k ] ) ) {
								foreach ( array( 'top', 'right', 'bottom', 'left' ) as $side ) {
									if ( isset( $node['settings'][ $k ][ $side ] ) && (float) $node['settings'][ $k ][ $side ] < 0 ) {
										$was[ $k ]                         = isset( $was[ $k ] ) ? $was[ $k ] : $node['settings'][ $k ];
										$node['settings'][ $k ][ $side ]   = '0';
										$node['settings'][ $k ]['isLinked'] = false;
										$now[ $k ]                         = $node['settings'][ $k ];
									}
								}
							}
						}
					}
					if ( ! $now ) {
						unset( $node );
						return new WP_Error( 'wpt_edit', 'Nothing to change.', array( 'status' => 400 ) );
					}
				}
				$type = isset( $node['widgetType'] ) ? $node['widgetType'] : ( isset( $node['elType'] ) ? $node['elType'] : '' );
				unset( $node );
				$bid = 'b' . time() . wp_rand( 100, 999 );
				update_post_meta( $id, '_wpt_hub_bk_' . $bid, array( 'data' => $before, 'after' => md5( wp_json_encode( $data ) ), 'time' => time() ) );
				$save( $id, $data );
				return array( 'ok' => true, 'backup' => $bid, 'element' => $elid, 'widget' => $type, 'before' => wp_json_encode( $was ), 'after' => wp_json_encode( $now ) );
			}
			if ( 'style' === $op ) {
				/* Change how one image widget is displayed (version 7). Finds it by its image file name.
				 * Only these display settings can be changed, nothing else. */
				$file    = strtolower( (string) $r->get_param( 'find' ) );
				$allowed = array( 'object-fit', 'object-fit_tablet', 'object-fit_mobile', 'object-position', 'object-position_tablet', 'object-position_mobile', 'height', 'height_tablet', 'height_mobile', 'image_fit', 'image_fit_tablet', 'image_fit_mobile' );
				$want    = sanitize_key( (string) $r->get_param( 'widget' ) );
				$want    = $want ? $want : 'image';
				$every   = (bool) $r->get_param( 'all' );
				$set     = (array) $r->get_param( 'set' );
				$elid = preg_replace( '/[^a-z0-9]/i', '', (string) $r->get_param( 'element' ) );
				if ( ( strlen( $file ) < 5 && ! $elid ) || ! $set ) {
					return new WP_Error( 'wpt_edit', 'The fix doesn\'t say which image or what to change.', array( 'status' => 400 ) );
				}
				foreach ( $set as $k => $v ) {
					if ( ! in_array( $k, $allowed, true ) ) {
						return new WP_Error( 'wpt_edit', 'The hub can only change image size and cropping settings. Nothing was changed.', array( 'status' => 400 ) );
					}
				}
				$hits = array();
				$walk = function ( $els, $path ) use ( &$walk, &$hits, $file, $elid ) {
					foreach ( $els as $i => $el ) {
						$p = array_merge( $path, array( $i ) );
						if ( $elid ) {
							if ( isset( $el['id'] ) && $el['id'] === $elid && isset( $el['widgetType'] ) ) {
								$hits[] = array( 'path' => $p, 'type' => $el['widgetType'] );
							}
						} elseif ( isset( $el['widgetType'] ) && isset( $el['settings'] ) ) {
							$hay = 'image' === $el['widgetType'] ? ( isset( $el['settings']['image']['url'] ) ? $el['settings']['image']['url'] : '' ) : wp_json_encode( $el['settings'] );
							if ( false !== strpos( strtolower( str_replace( '\\/', '/', $hay ) ), $file ) ) {
								$hits[] = array( 'path' => $p, 'type' => $el['widgetType'] );
							}
						}
						if ( ! empty( $el['elements'] ) ) {
							$walk( $el['elements'], array_merge( $p, array( 'elements' ) ) );
						}
					}
				};
				$walk( $data, array() );
				if ( ! $hits ) {
					return new WP_Error( 'wpt_edit', 'That image isn\'t on the page any more, so someone may have changed it. Nothing was changed.', array( 'status' => 409 ) );
				}
				foreach ( $hits as $h ) {
					if ( $h['type'] !== $want ) {
						return new WP_Error( 'wpt_edit', 'Found it, but it\'s built with a different Elementor widget (' . $h['type'] . ') than this fix expects (' . $want . '). Nothing was changed. Tell Claude and it will rewrite the fix for that widget.', array( 'status' => 409 ) );
					}
				}
				if ( count( $hits ) > 1 && ! $every ) {
					return new WP_Error( 'wpt_edit', 'That image is used ' . count( $hits ) . ' times on the page, so the hub won\'t guess which one. Nothing was changed.', array( 'status' => 409 ) );
				}
				$before = wp_json_encode( $data );
				$was    = array();
				$eid    = array();
				foreach ( $hits as $h ) {
					$node = &$data;
					foreach ( $h['path'] as $k ) {
						$node = &$node[ $k ];
					}
					foreach ( $set as $k => $v ) {
						$was[ $k ] = isset( $node['settings'][ $k ] ) ? $node['settings'][ $k ] : '';
						if ( '' === $v || null === $v ) {
							unset( $node['settings'][ $k ] );
						} else {
							$node['settings'][ $k ] = $v;
						}
					}
					$eid[] = isset( $node['id'] ) ? $node['id'] : '';
					unset( $node );
				}
				$eid = implode( ',', $eid );
				$bid = 'b' . time() . wp_rand( 100, 999 );
				update_post_meta( $id, '_wpt_hub_bk_' . $bid, array( 'data' => $before, 'after' => md5( wp_json_encode( $data ) ), 'time' => time() ) );
				$save( $id, $data );
				return array( 'ok' => true, 'backup' => $bid, 'element' => $eid, 'widget' => $want, 'count' => count( $hits ), 'before' => wp_json_encode( $was ), 'after' => wp_json_encode( $set ) );
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
			$every = 'swap' === $op && $r->get_param( 'every' );
			if ( count( $seen ) > 1 && ( 'set' === $op || ( 'swap' === $op && ! $every ) ) ) {
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
			} elseif ( $every ) {
				/* Swap a wrong phrase everywhere it appears on the page (version 12). Map addresses are left
				 * alone, as changing them would move the pin. Each spot must swap cleanly or nothing changes. */
				$phrase = (string) $r->get_param( 'find' );
				$new    = (string) $r->get_param( 'replace' );
				$done   = array();
				$n      = 0;
				foreach ( $matches as $mm ) {
					$k = $mm['id'] . '|' . implode( '.', $mm['keys'] );
					if ( isset( $done[ $k ] ) || ( 'google_maps' === $mm['widget'] && in_array( 'address', $mm['keys'], true ) ) ) {
						continue;
					}
					$done[ $k ] = 1;
					$node = &$data;
					foreach ( $mm['path'] as $kk ) {
						$node = &$node[ $kk ];
					}
					$cell = &$node['settings'];
					foreach ( $mm['keys'] as $kk ) {
						$cell = &$cell[ $kk ];
					}
					$old = str_replace( array( '&nbsp;', "\xC2\xA0" ), ' ', (string) $cell );
					if ( false === strpos( $old, $phrase ) ) {
						unset( $cell, $node );
						return new WP_Error( 'wpt_edit', 'Found the text, but formatting inside it (bold, a link or similar) stops a clean swap in one spot. Nothing was changed. Ask Claude to rewrite this fix as a full text change.', array( 'status' => 409 ) );
					}
					$n   += substr_count( $old, $phrase );
					$cell = str_replace( $phrase, $new, $old );
					unset( $cell, $node );
				}
				if ( ! $n ) {
					return new WP_Error( 'wpt_edit', 'The text only appears in the map address, which the hub leaves alone. Nothing was changed.', array( 'status' => 409 ) );
				}
				$detail = array( 'before' => $phrase . ( $n > 1 ? ' (' . $n . ' places)' : '' ), 'after' => $new );
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
				/* Adding a link: refuse if the words already sit inside a link, as a link in a link breaks both. */
				if ( false !== stripos( $new, '<a ' ) ) {
					$pos  = strpos( $old, $phrase );
					$open = strripos( substr( $old, 0, $pos ), '<a ' );
					if ( false !== $open && false === stripos( substr( $old, $open, $pos - $open ), '</a>' ) ) {
						return new WP_Error( 'wpt_edit', 'Those words are already part of a link on this page. Nothing was changed. Click Skip and the hub will find another spot.', array( 'status' => 409 ) );
					}
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


/* Display check (version 8).
 * When the hub opens a page with ?wpt_check=1 it adds a small read-only script to the end of that one page
 * view. The script measures what's drawn (images, buttons, text) and sends the problems back to the hub
 * window. It changes nothing and visitors never get it. The page isn't cached for that view. */
add_action( 'template_redirect', function () {
	if ( isset( $_GET['wpt_check'] ) ) {
		if ( ! defined( 'DONOTCACHEPAGE' ) ) {
			define( 'DONOTCACHEPAGE', true );
		}
		nocache_headers();
		/* Let the hub show this one check view in its preview frame. Normal page views are untouched. */
		add_action( 'send_headers', function () {
			header_remove( 'X-Frame-Options' );
		}, 999 );
		header_remove( 'X-Frame-Options' );
	}
} );
add_action( 'wp_footer', function () {
	if ( ! isset( $_GET['wpt_check'] ) ) {
		return;
	}
	echo "<script>\n";
	echo <<<'WPTJS'
/*DISPLAY_CHECK_START*/
/* WPT Hub display check. Runs inside a live page only when the hub opens it with ?wpt_check=1.
   Reads the page as it's drawn and reports display problems back to the hub window. Changes nothing. */
(function () {
  "use strict";
  var LOGO = /logo|badge|cert|partner|icon|stars?\b|5-stars|award|accredit|brand|8x8|gamma|3cx|zoom|teams|avaya|mitel|cyber|ukas|iso/i;
  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function file(u) { return String(u || "").split("?")[0].split("/").pop(); }
  function widgetOf(el) {
    var w = el.closest(".elementor-element[data-id]");
    if (!w) return { id: "", type: "" };
    return { id: w.getAttribute("data-id"), type: String(w.getAttribute("data-widget_type") || w.getAttribute("data-element_type") || "").split(".")[0] };
  }
  function shown(el) {
    var r = el.getBoundingClientRect(), cs = getComputedStyle(el);
    return r.width > 6 && r.height > 6 && cs.visibility !== "hidden" && cs.display !== "none" && +cs.opacity > 0.05;
  }
  function inHiddenSlide(el) { return !!el.closest(".swiper-slide-duplicate, [aria-hidden='true']"); }
  var HEADS = null;
  function where(el) {
    if (!HEADS) HEADS = Array.prototype.map.call(document.querySelectorAll("h1,h2,h3,h4"), function (h) { return { y: h.getBoundingClientRect().top + scrollY, t: h.textContent.trim().slice(0, 60) }; });
    var y = el.getBoundingClientRect().top + scrollY, near = "";
    HEADS.forEach(function (h) { if (h.y <= y + 5 && h.t) near = h.t; });
    return { y: Math.round(y), near: near };
  }
  function loadImg(url) {
    return new Promise(function (res) { var i = new Image(); i.onload = function () { res(i); }; i.onerror = function () { res(null); }; i.src = url; setTimeout(function () { res(null); }, 6000); });
  }
  async function scrollAll() {
    var h = document.documentElement.scrollHeight;
    for (var y = 0; y < h; y += Math.max(300, innerHeight * 0.8)) { scrollTo(0, y); await wait(200); h = document.documentElement.scrollHeight; }
    scrollTo(0, 0); await wait(900);
  }
  async function run() {
    await wait(1500); await scrollAll();
    await check();
  }
  /* The hub resizes the frame to other screen widths and asks for the check again, without reloading. */
  addEventListener("message", function (e) {
    if (e.data && e.data.wpt === "display-rerun") { HEADS = null; setTimeout(check, 700); }
  });
  async function check() {
    var out = [], seen = {};
    function add(o) { var k = o.kind + "|" + (o.widget.id || "") + "|" + (o.file || o.text || ""); if (seen[k]) return; seen[k] = 1; out.push(o); }
    var W = innerWidth;

    /* Images drawn with <img> */
    Array.prototype.forEach.call(document.images, function (img) {
      if (inHiddenSlide(img)) return;
      var src = img.currentSrc || img.src || "";
      if (img.complete && img.naturalWidth === 0 && src && !/^data:/.test(src)) { add({ kind: "broken", file: file(src), widget: widgetOf(img), at: where(img) }); return; }
      if (!img.naturalWidth || !shown(img)) return;
      var cs = getComputedStyle(img), r = img.getBoundingClientRect();
      var bw = r.width - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) - parseFloat(cs.borderLeftWidth) - parseFloat(cs.borderRightWidth);
      var bh = r.height - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom) - parseFloat(cs.borderTopWidth) - parseFloat(cs.borderBottomWidth);
      if (bw < 12 || bh < 12) return;
      var nr = img.naturalWidth / img.naturalHeight, br = bw / bh, fit = cs.objectFit || "fill";
      var label = src + " " + (img.alt || "");
      if (fit === "fill") {
        var diff = Math.abs(br / nr - 1);
        if (diff > 0.05) add({ kind: "distorted", file: file(src), widget: widgetOf(img), at: where(img), detail: (br > nr ? "stretched wide" : "squeezed thin") + " by " + Math.round(diff * 100) + "%", logo: LOGO.test(label) });
      } else if (fit === "cover") {
        var lost = 1 - Math.min(br / nr, nr / br);
        if (lost > 0.12 && LOGO.test(label)) add({ kind: "cropped", file: file(src), widget: widgetOf(img), at: where(img), detail: Math.round(lost * 100) + "% of it is cut off", logo: true });
      }
      if (!img.hasAttribute("alt") && bw > 60) add({ kind: "no_alt", file: file(src), widget: widgetOf(img), at: where(img) });
    });

    /* Images drawn as backgrounds (carousels, sections, boxes) */
    var bgs = [];
    Array.prototype.forEach.call(document.querySelectorAll("body *"), function (el) {
      if (el.children.length > 40) return;
      var cs = getComputedStyle(el), m = (cs.backgroundImage || "").match(/url\(["']?([^"')]+)["']?\)/);
      if (!m) return;
      if (inHiddenSlide(el) || !shown(el)) return;
      bgs.push({ el: el, url: m[1], size: cs.backgroundSize });
    });
    for (var i = 0; i < bgs.length && i < 120; i++) {
      var b = bgs[i], r = b.el.getBoundingClientRect();
      var inCarousel = !!b.el.closest(".swiper, .elementor-carousel-image, .elementor-image-carousel, [class*='carousel']");
      if (!(LOGO.test(b.url) || inCarousel)) continue;
      var im = await loadImg(b.url); if (!im || !im.naturalWidth) continue;
      var nr2 = im.naturalWidth / im.naturalHeight, br2 = r.width / r.height;
      if (b.size === "cover") {
        var lost2 = 1 - Math.min(br2 / nr2, nr2 / br2);
        if (lost2 > 0.12) add({ kind: "cropped", file: file(b.url), widget: widgetOf(b.el), at: where(b.el), detail: Math.round(lost2 * 100) + "% of it is cut off", logo: LOGO.test(b.url) || inCarousel, bg: true });
      } else if (/100% 100%/.test(b.size)) {
        var d2 = Math.abs(br2 / nr2 - 1);
        if (d2 > 0.05) add({ kind: "distorted", file: file(b.url), widget: widgetOf(b.el), at: where(b.el), detail: "stretched by " + Math.round(d2 * 100) + "%", bg: true });
      }
    }

    /* Buttons side by side where one wraps onto two lines and its neighbour doesn't */
    var btns = Array.prototype.filter.call(document.querySelectorAll(".elementor-button, a.button, button"), function (b) { return shown(b) && !inHiddenSlide(b) && b.textContent.trim(); });
    btns.forEach(function (b) {
      var t = b.querySelector(".elementor-button-text") || b, cs = getComputedStyle(t);
      var lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.3;
      var lines = Math.round(t.getBoundingClientRect().height / lh);
      if (lines < 2) return;
      var r = b.getBoundingClientRect();
      var twin = btns.some(function (o) { if (o === b) return false; var q = o.getBoundingClientRect(); var tt = o.querySelector(".elementor-button-text") || o; return Math.abs(q.top - r.top) < 30 && Math.abs(q.left - r.left) < 700 && Math.round(tt.getBoundingClientRect().height / (parseFloat(getComputedStyle(tt).lineHeight) || 20)) < 2; });
      add({ kind: "button_wrap", text: b.textContent.trim().slice(0, 50), widget: widgetOf(b), at: where(b), detail: twin ? "wraps onto " + lines + " lines next to a button that doesn't" : "wraps onto " + lines + " lines" });
    });

    /* Text cut off by its box */
    Array.prototype.forEach.call(document.querySelectorAll("h1,h2,h3,h4,h5,h6,p,li,.elementor-button-text,.elementor-heading-title"), function (el) {
      if (!shown(el) || inHiddenSlide(el)) return;
      var cs = getComputedStyle(el);
      if ((cs.overflow === "hidden" || cs.overflowX === "hidden" || cs.textOverflow === "ellipsis") && el.scrollWidth > el.clientWidth + 2)
        add({ kind: "text_clipped", text: el.textContent.trim().slice(0, 60), widget: widgetOf(el), at: where(el) });
    });

    /* Anything wider than the screen (sideways scrolling on phones) */
    if (document.documentElement.scrollWidth > W + 2) {
      var worst = [];
      Array.prototype.forEach.call(document.querySelectorAll("body *"), function (el) {
        var r = el.getBoundingClientRect();
        if (r.right > W + 2 && r.width > 0 && shown(el) && !el.closest(".swiper, [class*='carousel'], .elementor-hidden-mobile")) {
          var p = el.parentElement, pr = p && p.getBoundingClientRect();
          if (!p || pr.right <= W + 2) worst.push(el);
        }
      });
      worst.slice(0, 4).forEach(function (el) { add({ kind: "overflow", text: (el.textContent || el.tagName).trim().slice(0, 50), widget: widgetOf(el), at: where(el), detail: "sticks out " + Math.round(el.getBoundingClientRect().right - W) + "px past the edge" }); });
    }

    /* Punctuation stranded on its own line, like "communications" then "." underneath */
    Array.prototype.forEach.call(document.querySelectorAll("h1,h2,h3,h4,h5,h6,.elementor-heading-title,p,li,.elementor-button-text"), function (el) {
      if (!shown(el) || inHiddenSlide(el) || el.querySelector("h1,h2,h3,h4,h5,h6,p,li")) return;
      var chars = [], tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT), tn;
      while ((tn = tw.nextNode())) for (var ci = 0; ci < tn.data.length; ci++) chars.push({ n: tn, i: ci, c: tn.data[ci] });
      function rectOf(x) { var rg = document.createRange(); rg.setStart(x.n, x.i); rg.setEnd(x.n, x.i + 1); var rs = rg.getClientRects(); return rs.length ? rs[rs.length - 1] : null; }
      for (var k = 0; k < chars.length; k++) {
        if (!/[.,?!:;]/.test(chars[k].c)) continue;
        var after = chars[k + 1]; if (after && /\S/.test(after.c) && !/[.,?!:;"')\]]/.test(after.c)) continue;
        var j = k - 1; while (j >= 0 && /\s/.test(chars[j].c)) j--;
        if (j < 0) continue;
        var a = rectOf(chars[k]), b = rectOf(chars[j]);
        if (a && b && a.top > b.top + b.height * 0.6) {
          add({ kind: "stranded_punct", text: el.textContent.replace(/\s+/g, " ").trim().slice(0, 80), punct: chars[k].c, gap: k - j > 1, widget: widgetOf(el), at: where(el) });
          break;
        }
      }
    });

    /* Images spilling out of the coloured box they sit in */
    function panelOf(el) {
      var n = el.parentElement;
      while (n && n !== document.body) {
        var cs = getComputedStyle(n);
        var bg = cs.backgroundColor, hasBg = (bg && !/rgba\(0, 0, 0, 0\)|transparent/.test(bg)) || (cs.backgroundImage && cs.backgroundImage !== "none");
        if (hasBg && n.getBoundingClientRect().width < document.documentElement.clientWidth - 8) return n;
        n = n.parentElement;
      }
      return null;
    }
    Array.prototype.forEach.call(document.images, function (img) {
      if (!img.naturalWidth || !shown(img) || inHiddenSlide(img)) return;
      var pn = panelOf(img); if (!pn) return;
      var r = img.getBoundingClientRect(), q = pn.getBoundingClientRect();
      var out = Math.max(r.right - q.right, q.left - r.left, 0);
      if (out > 4 && getComputedStyle(pn).overflow === "visible") {
        var wEl = img.closest(".elementor-element[data-id]");
        var mL = wEl ? parseFloat(getComputedStyle(wEl).marginLeft) : 0, mR = wEl ? parseFloat(getComputedStyle(wEl).marginRight) : 0;
        add({ kind: "overflow_box", file: file(img.currentSrc || img.src), widget: widgetOf(img), at: where(img), detail: "hangs " + Math.round(out) + "px outside its box", negMargin: mL < 0 || mR < 0 });
      }
    });

    /* The same word twice in a short heading */
    var STOP = /^(the|and|for|with|your|our|you|are|that|this|from|all|into|more|what|how|why|who|its|it's|a|an|of|to|in|on|is|by|at|or|be|we|us)$/i;
    Array.prototype.forEach.call(document.querySelectorAll("h1,h2,h3,h4,h5,h6,.elementor-heading-title"), function (el) {
      if (!shown(el) || inHiddenSlide(el) || el.querySelector("h1,h2,h3,h4,h5,h6")) return;
      var t = el.textContent.replace(/\s+/g, " ").trim(), words = t.split(" ");
      if (words.length < 3 || words.length > 16) return;
      var stems = {};
      for (var wi = 0; wi < words.length; wi++) {
        var w = words[wi].toLowerCase().replace(/[^a-z0-9']/g, "");
        if (w.length < 4 || STOP.test(w)) continue;
        var st = w.replace(/(ions|ion|ings|ing|ers|er|es|s|ed)$/, "");
        if (stems[st]) { add({ kind: "repeat_word", text: t, word: words[wi].replace(/[^A-Za-z0-9']/g, ""), widget: widgetOf(el), at: where(el) }); return; }
        stems[st] = 1;
      }
    });

    /* Things in the same column that nearly, but don't quite, line up (a button indented past the text above it) */
    var cols = {};
    Array.prototype.forEach.call(document.querySelectorAll(".elementor-widget[data-id]"), function (wEl) {
      if (!shown(wEl) || inHiddenSlide(wEl)) return;
      var col = wEl.parentElement && wEl.parentElement.closest(".elementor-column[data-id], .e-con[data-id]");
      if (!col) return;
      var target = wEl.querySelector(".elementor-button") || wEl.querySelector(".elementor-heading-title, p, h1, h2, h3, h4");
      if (!target) return;
      var cs = getComputedStyle(target);
      if (cs.textAlign === "center" || getComputedStyle(wEl).textAlign === "center") return;
      var rg = document.createRange(); rg.selectNodeContents(target);
      var left = target.classList.contains("elementor-button") ? target.getBoundingClientRect().left : rg.getBoundingClientRect().left;
      (cols[col.getAttribute("data-id")] = cols[col.getAttribute("data-id")] || []).push({ w: wEl, left: left, btn: target.classList.contains("elementor-button") });
    });
    Object.keys(cols).forEach(function (cid) {
      var list = cols[cid]; if (list.length < 2) return;
      var counts = {};
      list.forEach(function (x) { var k = Math.round(x.left); counts[k] = (counts[k] || 0) + 1; });
      var main = +Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a]; })[0];
      list.forEach(function (x) {
        var d = x.left - main;
        if (Math.abs(d) >= 6 && Math.abs(d) <= 60) {
          var ml = parseFloat(getComputedStyle(x.w).marginLeft) || 0;
          var inner = x.w.querySelector(".elementor-widget-container"), pl = inner ? parseFloat(getComputedStyle(inner).paddingLeft) || 0 : 0;
          add({ kind: "misaligned", text: x.w.textContent.replace(/\s+/g, " ").trim().slice(0, 40), widget: widgetOf(x.w), at: where(x.w),
            detail: (d > 0 ? "starts " + Math.round(d) + "px to the right of" : "starts " + Math.round(-d) + "px to the left of") + " the text above it", offset: Math.round(d), marginLeft: Math.round(ml), padLeft: Math.round(pl), isButton: x.btn });
        }
      });
    });

    /* Top-level boxes that aren't centred, or have much more space at the bottom than the top */
    var CW = document.documentElement.clientWidth;
    Array.prototype.forEach.call(document.querySelectorAll(".elementor > .elementor-section[data-id], .elementor > .e-con[data-id], .elementor-section-wrap > .elementor-section[data-id]"), function (sec) {
      if (!shown(sec)) return;
      var r = sec.getBoundingClientRect(), cs = getComputedStyle(sec);
      var type = sec.classList.contains("e-con") ? "container" : "section";
      var info = { id: sec.getAttribute("data-id"), type: type };
      if (r.width < CW - 30) {
        var gl = r.left, gr = CW - r.right;
        if (Math.abs(gl - gr) > 16) add({ kind: "off_centre", text: (sec.querySelector("h1,h2,h3") || sec).textContent.replace(/\s+/g, " ").trim().slice(0, 40), widget: info, at: where(sec),
          detail: Math.round(gl) + "px gap on the left, " + Math.round(gr) + "px on the right", gapLeft: Math.round(gl), gapRight: Math.round(gr), marginLeft: Math.round(parseFloat(cs.marginLeft) || 0), marginRight: Math.round(parseFloat(cs.marginRight) || 0) });
      }
      var pt = parseFloat(cs.paddingTop) || 0, pb = parseFloat(cs.paddingBottom) || 0;
      var kids = Array.prototype.filter.call(sec.querySelectorAll(".elementor-widget"), shown);
      if (kids.length) {
        var top = Math.min.apply(null, kids.map(function (k) { return k.getBoundingClientRect().top; })) - r.top;
        var bot = r.bottom - Math.max.apply(null, kids.map(function (k) { return k.getBoundingClientRect().bottom; }));
        if (bot > 60 && bot > top * 1.8 && pb > pt + 30) add({ kind: "uneven_space", text: (sec.querySelector("h1,h2,h3") || sec).textContent.replace(/\s+/g, " ").trim().slice(0, 40), widget: info, at: where(sec),
          detail: Math.round(bot) + "px of space below the content, " + Math.round(top) + "px above", padTop: Math.round(pt), padBottom: Math.round(pb) });
      }
    });

    /* Words broken in the middle ("Communicati" / "ons") because the box is too narrow for the font size */
    function measure(word, el) {
      var sp = document.createElement("span"), cs = getComputedStyle(el);
      sp.textContent = word;
      sp.style.cssText = "position:absolute;visibility:hidden;white-space:nowrap;left:-9999px;top:0;font:" + cs.font + ";letter-spacing:" + cs.letterSpacing + ";text-transform:" + cs.textTransform;
      document.body.appendChild(sp); var w = sp.getBoundingClientRect().width; sp.remove(); return w;
    }
    Array.prototype.forEach.call(document.querySelectorAll("h1,h2,h3,h4,h5,h6,.elementor-heading-title,p,li,.elementor-button-text,a.elementor-button"), function (el) {
      if (!shown(el) || inHiddenSlide(el) || el.querySelector("h1,h2,h3,h4,h5,h6,p,li")) return;
      var tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT), tn, done = false;
      while (!done && (tn = tw.nextNode())) {
        var re = /\S{4,}/g, mm;
        while (!done && (mm = re.exec(tn.data))) {
          var rg = document.createRange(); rg.setStart(tn, mm.index); rg.setEnd(tn, mm.index + mm[0].length);
          var rs = Array.prototype.filter.call(rg.getClientRects(), function (q) { return q.width > 0; });
          if (rs.length > 1 && Math.abs(rs[rs.length - 1].top - rs[0].top) > 4) {
            var cs = getComputedStyle(el), fs = parseFloat(cs.fontSize) || 16;
            var box = el.clientWidth - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0);
            var word = mm[0].replace(/[^\w'’-]+$/, ""), ww = measure(word, el);
            var need = ww > 0 ? Math.floor(fs * (box / ww) * 0.96) : Math.floor(fs * 0.8);
            add({ kind: "broken_word", text: el.textContent.replace(/\s+/g, " ").trim().slice(0, 60), word: word, fontSize: Math.round(fs), fitSize: Math.max(10, need), widget: widgetOf(el), at: where(el),
              detail: "“" + word + "” splits across two lines at " + W + "px wide" });
            done = true;
          }
        }
      }
    });

    /* Big headings with loose line spacing (big gaps between the lines) */
    Array.prototype.forEach.call(document.querySelectorAll("h1,h2,h3,.elementor-heading-title"), function (el) {
      if (!shown(el) || inHiddenSlide(el) || el.querySelector("h1,h2,h3")) return;
      var cs = getComputedStyle(el), fs = parseFloat(cs.fontSize) || 16, lh = parseFloat(cs.lineHeight);
      if (!lh || fs < 26) return;
      var lines = Math.round(el.getBoundingClientRect().height / lh);
      if (lines >= 2 && lh / fs > 1.42) add({ kind: "loose_lines", text: el.textContent.replace(/\s+/g, " ").trim().slice(0, 60), widget: widgetOf(el), at: where(el),
        ratio: Math.round(lh / fs * 100) / 100, fontSize: Math.round(fs), detail: "line spacing is " + (Math.round(lh / fs * 100) / 100) + " times the text size" });
    });

    /* Boxes with a lot of empty space at the top or bottom */
    var PADMAX = W >= 1025 ? 110 : W >= 768 ? 90 : 64, PADTO = W >= 1025 ? 80 : W >= 768 ? 60 : 40;
    Array.prototype.forEach.call(document.querySelectorAll(".elementor > .elementor-section[data-id], .elementor > .e-con[data-id], .elementor-section-wrap > .elementor-section[data-id]"), function (sec) {
      if (!shown(sec)) return;
      var cs = getComputedStyle(sec), pt = parseFloat(cs.paddingTop) || 0, pb = parseFloat(cs.paddingBottom) || 0;
      var bg = cs.backgroundColor && !/rgba\(0, 0, 0, 0\)|transparent/.test(cs.backgroundColor);
      if ((pt > PADMAX || pb > PADMAX) && bg) add({ kind: "big_padding", text: (sec.querySelector("h1,h2,h3") || sec).textContent.replace(/\s+/g, " ").trim().slice(0, 40),
        widget: { id: sec.getAttribute("data-id"), type: sec.classList.contains("e-con") ? "container" : "section" }, at: where(sec),
        padTop: Math.round(pt), padBottom: Math.round(pb), padTo: PADTO, detail: Math.round(pt) + "px empty at the top, " + Math.round(pb) + "px at the bottom" });
    });

    var m = document.body.className.match(/(?:page-id|postid)-(\d+)/);
    var msg = { wpt: "display-check", url: location.href.split("?")[0], width: W, pageId: m ? +m[1] : 0, issues: out };
    try { (window.opener || window.parent).postMessage(msg, "*"); } catch (e) {}
  }
  if (document.readyState === "complete") run(); else addEventListener("load", run);
})();
/*DISPLAY_CHECK_END*/
WPTJS;
	echo "\n</script>\n";
}, 999 );
