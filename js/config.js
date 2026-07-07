/* ═══ config.js — deployment configuration ═══ */
"use strict";

/*
 * Where the big media files (assets/…) are served from.
 *
 * ASSET_REMOTE = "" → use the local "assets/" folder next to index.html.
 *   (This is how the site runs on your PC, straight from file://.)
 *
 * For the hosted version (GitHub Pages), the assets folder is NOT pushed
 * to the repo — set ASSET_REMOTE to your Cloudflare R2 public bucket URL
 * instead, WITH a trailing slash, e.g.:
 *   const ASSET_REMOTE = "https://pub-xxxxxxxxxxxxxxxx.r2.dev/";
 *
 * When opened from file:// the local assets folder is always used, so the
 * site keeps working offline even with ASSET_REMOTE set.
 */
const ASSET_REMOTE = "";
