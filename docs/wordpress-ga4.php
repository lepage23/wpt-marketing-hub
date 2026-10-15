<?php
/**
 * WPT Marketing Hub: Google Analytics 4 (direct).
 *
 * Reads GA4 reports through the Google Analytics Data API using a Google
 * service account (a read-only robot login added to GA4 as a Viewer).
 *
 * /wpt-hub/v1/ga4        Traffic, leads (key events), channels, sources,
 *                        landing pages. Cached for an hour.
 * /wpt-hub/v1/ga4-setup  POST: save the property ID and key file (admins only).
 *                        DELETE: remove them.
 *
 * Safety:
 * - Only administrators can save or remove the key. It is stored in this site's
 *   database and never sent back out, not even to the hub.
 * - Only logged-in editors can read the reports.
 * - Google only lets the key read Analytics (analytics.readonly). It cannot
 *   change anything in GA4.
 *
 * Install: Snippets > Add New, title "WPT Hub GA4", type PHP, Run everywhere.
 * Paste everything below this comment block, Save and Activate.
 */

add_action( 'rest_api_init', function () {
	$opt = 'wpt_hub_ga4';
	$b64 = function ( $s ) {
		return rtrim( strtr( base64_encode( $s ), '+/', '-_' ), '=' );
	};
	$token = function ( $cfg ) use ( $b64 ) {
		$cached = get_transient( 'wpt_hub_ga4_token' );
		if ( $cached ) {
			return $cached;
		}
		$now   = time();
		$head  = $b64( wp_json_encode( array( 'alg' => 'RS256', 'typ' => 'JWT' ) ) );
		$claim = $b64( wp_json_encode( array(
			'iss'   => $cfg['client_email'],
			'scope' => 'https://www.googleapis.com/auth/analytics.readonly',
			'aud'   => 'https://oauth2.googleapis.com/token',
			'iat'   => $now,
			'exp'   => $now + 3600,
		) ) );
		$sig = '';
		if ( ! openssl_sign( $head . '.' . $claim, $sig, $cfg['private_key'], 'sha256WithRSAEncryption' ) ) {
			return new WP_Error( 'wpt_ga4', 'Could not sign the request. The key file may be damaged. Download a fresh one.' );
		}
		$res = wp_remote_post( 'https://oauth2.googleapis.com/token', array(
			'timeout' => 20,
			'body'    => array(
				'grant_type' => 'urn:ietf:params:oauth:grant-type:jwt-bearer',
				'assertion'  => $head . '.' . $claim . '.' . $b64( $sig ),
			),
		) );
		if ( is_wp_error( $res ) ) {
			return $res;
		}
		$j = json_decode( wp_remote_retrieve_body( $res ), true );
		if ( empty( $j['access_token'] ) ) {
			return new WP_Error( 'wpt_ga4', 'Google refused the key: ' . ( isset( $j['error_description'] ) ? $j['error_description'] : ( isset( $j['error'] ) ? $j['error'] : 'unknown error' ) ) );
		}
		set_transient( 'wpt_hub_ga4_token', $j['access_token'], 50 * MINUTE_IN_SECONDS );
		return $j['access_token'];
	};
	$batch = function ( $cfg, $requests ) use ( $token ) {
		$t = $token( $cfg );
		if ( is_wp_error( $t ) ) {
			return $t;
		}
		$res = wp_remote_post( 'https://analyticsdata.googleapis.com/v1beta/properties/' . rawurlencode( $cfg['property'] ) . ':batchRunReports', array(
			'timeout' => 30,
			'headers' => array( 'Authorization' => 'Bearer ' . $t, 'Content-Type' => 'application/json' ),
			'body'    => wp_json_encode( array( 'requests' => $requests ) ),
		) );
		if ( is_wp_error( $res ) ) {
			return $res;
		}
		$code = (int) wp_remote_retrieve_response_code( $res );
		$j    = json_decode( wp_remote_retrieve_body( $res ), true );
		if ( 200 !== $code ) {
			$msg = isset( $j['error']['message'] ) ? $j['error']['message'] : 'error ' . $code;
			if ( 403 === $code ) {
				$msg .= ' Check the service account email is added to this GA4 property as a Viewer, and that the Google Analytics Data API is enabled in Google Cloud.';
			}
			return new WP_Error( 'wpt_ga4', 'Google Analytics said: ' . $msg );
		}
		$out = array();
		foreach ( isset( $j['reports'] ) ? (array) $j['reports'] : array() as $rep ) {
			$dims = array();
			foreach ( isset( $rep['dimensionHeaders'] ) ? $rep['dimensionHeaders'] : array() as $h ) {
				$dims[] = $h['name'];
			}
			$mets = array();
			foreach ( isset( $rep['metricHeaders'] ) ? $rep['metricHeaders'] : array() as $h ) {
				$mets[] = $h['name'];
			}
			$rows = array();
			foreach ( isset( $rep['rows'] ) ? $rep['rows'] : array() as $r ) {
				$row = array();
				foreach ( $dims as $i => $n ) {
					$row[ $n ] = $r['dimensionValues'][ $i ]['value'];
				}
				foreach ( $mets as $i => $n ) {
					$row[ $n ] = (float) $r['metricValues'][ $i ]['value'];
				}
				$rows[] = $row;
			}
			$out[] = $rows;
		}
		return $out;
	};
	$totals = array( array( 'name' => 'sessions' ), array( 'name' => 'totalUsers' ), array( 'name' => 'newUsers' ), array( 'name' => 'engagementRate' ), array( 'name' => 'keyEvents' ) );

	register_rest_route( 'wpt-hub/v1', '/ga4', array(
		'methods'             => 'GET',
		'permission_callback' => function () {
			return current_user_can( 'edit_pages' );
		},
		'callback'            => function ( WP_REST_Request $req ) use ( $opt, $batch, $totals ) {
			$cfg = get_option( $opt );
			if ( ! $cfg || empty( $cfg['property'] ) ) {
				return array( 'configured' => false );
			}
			$days = (int) $req->get_param( 'days' );
			$days = $days >= 7 && $days <= 90 ? $days : 28;
			$key  = 'wpt_hub_ga4_report_' . $days;
			if ( ! $req->get_param( 'fresh' ) ) {
				$c = get_transient( $key );
				if ( $c ) {
					return $c;
				}
			}
			$cur  = array( array( 'startDate' => $days . 'daysAgo', 'endDate' => 'yesterday' ) );
			$prev = array( array( 'startDate' => ( 2 * $days ) . 'daysAgo', 'endDate' => ( $days + 1 ) . 'daysAgo' ) );
			$a    = $batch( $cfg, array(
				array( 'dateRanges' => $cur, 'metrics' => $totals ),
				array( 'dateRanges' => $prev, 'metrics' => $totals ),
				array( 'dateRanges' => $cur, 'dimensions' => array( array( 'name' => 'date' ) ), 'metrics' => array( array( 'name' => 'sessions' ), array( 'name' => 'keyEvents' ) ), 'orderBys' => array( array( 'dimension' => array( 'dimensionName' => 'date' ) ) ), 'limit' => 100 ),
				array( 'dateRanges' => $cur, 'dimensions' => array( array( 'name' => 'sessionDefaultChannelGroup' ) ), 'metrics' => array( array( 'name' => 'sessions' ), array( 'name' => 'keyEvents' ), array( 'name' => 'engagementRate' ) ), 'limit' => 25 ),
				array( 'dateRanges' => $cur, 'dimensions' => array( array( 'name' => 'sessionSource' ) ), 'metrics' => array( array( 'name' => 'sessions' ), array( 'name' => 'keyEvents' ) ), 'orderBys' => array( array( 'metric' => array( 'metricName' => 'sessions' ), 'desc' => true ) ), 'limit' => 200 ),
			) );
			if ( is_wp_error( $a ) ) {
				return $a;
			}
			$b = $batch( $cfg, array(
				array( 'dateRanges' => $cur, 'dimensions' => array( array( 'name' => 'landingPage' ) ), 'metrics' => array( array( 'name' => 'sessions' ), array( 'name' => 'keyEvents' ), array( 'name' => 'engagementRate' ) ), 'orderBys' => array( array( 'metric' => array( 'metricName' => 'sessions' ), 'desc' => true ) ), 'limit' => 100 ),
				array( 'dateRanges' => $cur, 'dimensions' => array( array( 'name' => 'eventName' ) ), 'metrics' => array( array( 'name' => 'eventCount' ), array( 'name' => 'keyEvents' ) ), 'orderBys' => array( array( 'metric' => array( 'metricName' => 'eventCount' ), 'desc' => true ) ), 'limit' => 50 ),
				array( 'dateRanges' => $cur, 'dimensions' => array( array( 'name' => 'landingPage' ) ), 'metrics' => array( array( 'name' => 'sessions' ), array( 'name' => 'keyEvents' ), array( 'name' => 'engagementRate' ) ),
					'dimensionFilter' => array( 'filter' => array( 'fieldName' => 'sessionDefaultChannelGroup', 'stringFilter' => array( 'value' => 'Organic Search' ) ) ),
					'orderBys' => array( array( 'metric' => array( 'metricName' => 'sessions' ), 'desc' => true ) ), 'limit' => 100 ),
			) );
			if ( is_wp_error( $b ) ) {
				return $b;
			}
			$out = array(
				'configured'      => true,
				'property'        => $cfg['property'],
				'account'         => $cfg['client_email'],
				'days'            => $days,
				'totals'          => isset( $a[0][0] ) ? $a[0][0] : array(),
				'prev'            => isset( $a[1][0] ) ? $a[1][0] : array(),
				'daily'           => $a[2],
				'channels'        => $a[3],
				'sources'         => $a[4],
				'landing'         => $b[0],
				'events'          => $b[1],
				'organic_landing' => $b[2],
				'fetched'         => gmdate( 'c' ),
			);
			set_transient( $key, $out, HOUR_IN_SECONDS );
			return $out;
		},
	) );

	register_rest_route( 'wpt-hub/v1', '/ga4-setup', array(
		array(
			'methods'             => 'POST',
			'permission_callback' => function () {
				return current_user_can( 'manage_options' );
			},
			'callback'            => function ( WP_REST_Request $req ) use ( $opt, $batch, $totals ) {
				$property = preg_replace( '/\D/', '', (string) $req->get_param( 'property' ) );
				$key      = json_decode( (string) $req->get_param( 'key' ), true );
				if ( ! $property ) {
					return new WP_Error( 'wpt_ga4', 'The GA4 property ID should be a number, like 123456789. Find it in GA4 under Admin, then Property details.', array( 'status' => 400 ) );
				}
				if ( ! is_array( $key ) || empty( $key['client_email'] ) || empty( $key['private_key'] ) || ( isset( $key['type'] ) && 'service_account' !== $key['type'] ) ) {
					return new WP_Error( 'wpt_ga4', 'That file isn\'t a service account key. In Google Cloud, open the service account, then Keys, then Add key, then JSON.', array( 'status' => 400 ) );
				}
				$cfg = array( 'property' => $property, 'client_email' => $key['client_email'], 'private_key' => $key['private_key'] );
				delete_transient( 'wpt_hub_ga4_token' );
				$test = $batch( $cfg, array( array( 'dateRanges' => array( array( 'startDate' => '7daysAgo', 'endDate' => 'yesterday' ) ), 'metrics' => $totals ) ) );
				if ( is_wp_error( $test ) ) {
					delete_transient( 'wpt_hub_ga4_token' );
					return new WP_Error( 'wpt_ga4', $test->get_error_message(), array( 'status' => 400 ) );
				}
				update_option( $opt, $cfg, false );
				foreach ( array( 7, 28, 90 ) as $d ) {
					delete_transient( 'wpt_hub_ga4_report_' . $d );
				}
				return array( 'ok' => true, 'account' => $cfg['client_email'], 'property' => $property, 'sessions_last_7_days' => isset( $test[0][0]['sessions'] ) ? $test[0][0]['sessions'] : 0 );
			},
		),
		array(
			'methods'             => 'DELETE',
			'permission_callback' => function () {
				return current_user_can( 'manage_options' );
			},
			'callback'            => function () use ( $opt ) {
				delete_option( $opt );
				delete_transient( 'wpt_hub_ga4_token' );
				foreach ( array( 7, 28, 90 ) as $d ) {
					delete_transient( 'wpt_hub_ga4_report_' . $d );
				}
				return array( 'ok' => true );
			},
		),
	) );
} );
