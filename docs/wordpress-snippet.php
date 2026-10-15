<?php
/**
 * WPT Marketing Hub: let the hub update SEO titles and meta descriptions.
 *
 * By default WordPress keeps these SEO plugin fields out of the API.
 * This snippet makes them readable and editable through the API, but ONLY
 * for a logged-in user who is already allowed to edit that page or post.
 * Nobody gets any new powers. Public visitors can't see or change anything.
 *
 * Covers Yoast SEO, Rank Math and SEOPress. Fields for plugins you don't use
 * are simply ignored.
 *
 * How to add it: install the free "Code Snippets" plugin, then
 * Snippets > Add New, paste everything below this comment block (without the
 * opening <?php line), set it to "Run everywhere" and click Save and Activate.
 * To remove it, deactivate the snippet. Nothing else on the site changes.
 */

add_action( 'init', function () {
	$keys = array(
		'_yoast_wpseo_title',      // Yoast SEO title
		'_yoast_wpseo_metadesc',   // Yoast meta description
		'rank_math_title',         // Rank Math SEO title
		'rank_math_description',   // Rank Math meta description
		'_seopress_titles_title',  // SEOPress SEO title
		'_seopress_titles_desc',   // SEOPress meta description
	);
	foreach ( array( 'post', 'page' ) as $post_type ) {
		foreach ( $keys as $key ) {
			register_post_meta( $post_type, $key, array(
				'type'              => 'string',
				'single'            => true,
				'show_in_rest'      => true,
				'sanitize_callback' => 'sanitize_text_field',
				'auth_callback'     => function ( $allowed, $meta_key, $post_id ) {
					return current_user_can( 'edit_post', $post_id );
				},
			) );
		}
	}
} );
