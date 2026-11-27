/**
 * @file Platforms configuration.
 *
 * This file holds the frozen defaults. Use `mergePlatformsConfig()` to
 * customize a platform. Do not change the shared configuration object.
 *
 * Consumers such as FiltersRegistry pass a patch, not a copy.
 *
 * @see {@link mergePlatformsConfig}
 */

import { posix } from 'node:path';

import { deepFreeze } from './utils/deep-freeze';
import type { DeepReadonly } from './utils/deep-freeze.js';

/**
 * One regex replacement applied to every rule of a platform.
 */
export interface PlatformReplacement {
    /**
     * Regular expression pattern. The compiler passes it to `new RegExp(from, 'g')`.
     */
    from: string;

    /**
     * Replacement text.
     */
    to: string;
}

/**
 * Rule processing options of one platform.
 *
 * The compiler reads this shape after it merges the patches.
 */
export interface PlatformConfiguration {
    /**
     * Regular expressions of rules to remove from the platform output, as
     * strings or `RegExp` objects.
     */
    removeRulePatterns?: (string | RegExp)[];

    /**
     * Whether to honour `!+` rule hints.
     */
    ignoreRuleHints?: boolean;

    /**
     * Regex replacements applied to every rule.
     */
    replacements?: PlatformReplacement[];

    /**
     * Header line written before the rules. Used by the uBO platform.
     */
    adbHeader?: string;
}

/**
 * `!#if` preprocessor flags for a platform.
 *
 * The map is open: a filter list can test any flag name. A `true` value
 * enables the flag. An absent flag reads as `undefined`.
 */
export type PlatformDefines = Record<string, boolean | undefined>;

/**
 * Configuration of one platform.
 *
 * `platform` and `path` are required. `expires` is optional.
 */
export interface PlatformEntry {
    /**
     * Platform family. The compiler branches on this value.
     */
    platform: string;

    /**
     * Output directory under the platforms path.
     */
    path: string;

    /**
     * Cache lifetime written to the platform metadata.
     */
    expires?: string;

    /**
     * Rule processing options.
     */
    configuration: PlatformConfiguration;

    /**
     * `!#if` preprocessor flags.
     */
    defines: PlatformDefines;
}

/**
 * Full platform configuration keyed by platform name.
 *
 * This is the mutable shape that the merge uses for its draft. Consumers
 * receive the frozen `ReadonlyPlatformsConfig`.
 */
export type PlatformsConfig = Record<string, PlatformEntry>;

/**
 * Patch for the rule processing options of a platform.
 *
 * Every field is optional. A `null` value removes the field from the
 * effective configuration.
 */
export interface PlatformConfigurationPatch {
    /**
     * Regular expressions of rules to remove, as strings or `RegExp` objects.
     * Replaces the default array. `false` or `null` removes the field.
     */
    removeRulePatterns?: readonly (string | RegExp)[] | false | null | undefined;

    /**
     * Whether to honour `!+` rule hints. `false` is a value.
     */
    ignoreRuleHints?: boolean | null | undefined;

    /**
     * Regex replacements applied to every rule. Replaces the default array.
     */
    replacements?: readonly PlatformReplacement[] | null | undefined;

    /**
     * Header line written before the rules.
     */
    adbHeader?: string | null | undefined;
}

/**
 * Patch for one platform.
 *
 * A patch of an existing platform can be partial. A patch that adds a platform
 * must contain `platform`, `path`, `configuration`, and `defines`.
 * An absent or `undefined` field inherits the current value. A `null` value
 * removes an optional field. `platform`, `path`, `configuration`, and `defines`
 * cannot be removed.
 */
export interface PlatformPatch {
    /**
     * Platform family.
     */
    platform?: string | undefined;

    /**
     * Output directory under the platforms path.
     *
     * The merge normalizes it and keeps it relative.
     */
    path?: string | undefined;

    /**
     * Cache lifetime written to the platform metadata.
     */
    expires?: string | null | undefined;

    /**
     * Rule processing options.
     */
    configuration?: PlatformConfigurationPatch | undefined;

    /**
     * `!#if` preprocessor flags. A `null` value removes one flag. An
     * `undefined` value inherits the current flag.
     */
    defines?: Record<string, boolean | null | undefined> | undefined;
}

/**
 * Platform patches keyed by platform name.
 *
 * A patch can change an existing platform or add a new platform. An
 * `undefined` entry inherits the base platform, or adds nothing.
 */
export type PlatformsConfigPatch = Record<string, PlatformPatch | undefined>;

/**
 * Frozen platform configuration that consumers receive.
 *
 * This is the type of `platformsConfig` and of the value returned by
 * `mergePlatformsConfig()`. Every property and array is readonly.
 */
export type ReadonlyPlatformsConfig = DeepReadonly<PlatformsConfig>;

/**
 * Pattern to check if rule contains `$domain` modifier with regular expression
 *
 * In Safari, `if-domain` and `unless-domain` do not support regexps, only `*`
 * https://github.com/AdguardTeam/FiltersRegistry/pull/806
 *
 * @example
 * ```[$domain=/^inattv\d+\.pro$/]#%#//scriptlet('set-constant', 'config.adv', 'emptyObj')```
 */
const DOMAIN_WITH_REGEXPS_PATTERNS = [
    '\\$domain=\/',
    ',domain=\/',
];

/**
 * Pattern to check if rule contains `$all` modifier
 *
 * @example
 * ```/?t=popunder&$all```
 */
const ALL_MODIFIER_PATTERNS = [
    '\\$all',
];

/**
 * Pattern to check if rule contains `$mp4` modifier
 *
 * @example
 * ```Deprecated, use $redirect=noopmp4-1s instead```
 */
const MP4_MODIFIER_PATTERNS = [
    '\\$(.*,)?mp4',
];

/**
 * Pattern to check if rule contains `$network` modifier
 *
 * @example
 * ```57.128.71.215$network```
 */
const NETWORK_MODIFIER_PATTERNS = [
    '\\$network',
];

/**
 * Pattern to check if rule contains `$webrtc` modifier
 *
 * @example
 * ```Removed and no longer supported```
 */
const WEBRTC_MODIFIER_PATTERNS = [
    '\\$webrtc',
];

/**
 * Pattern to check if rule contains `$csp` modifier
 *
 * @example
 * ```||deloplen.com^$csp=script-src 'none'```
 */
const CSP_MODIFIER_PATTERNS = [
    '\\$csp',
];

/**
 * Pattern to check if rule contains `$$` modifier
 *
 * Do not exclude scriptlets which contain '$$' when excluding '$$' and '$@$' rules
 * https://github.com/AdguardTeam/FiltersRegistry/issues/731
 *
 * @example
 * ```mail.com$$script[tag-content="uabp"][min-length="20000"][max-length="300000"]```
 */
const HTML_FILTERING_MODIFIER_PATTERNS = [
    '^((?!#%#).)*\\$\\$|\\$\\@\\$',
];

/**
 * Regex fragment that matches a non-basic modifier list, e.g. `[$path=/page]`.
 *
 * A cosmetic rule restricts itself to certain pages with the non-basic modifiers
 * `$domain`, `$path`, and `$url`. The fragment only matches a list at the start
 * of a rule: a network rule can also contain `$domain=` followed by a `]` in a
 * later modifier value, and must not be mistaken for a cosmetic rule.
 * A list can have no value or whitespace before `=`, as the parser allows both.
 *
 * The modifier patterns below reuse this fragment to skip the `$` that opens a
 * `$path`, `$domain`, or `$url` list. Otherwise the `$app` pattern starts there
 * and matches `app=` in `[$path=...]##.textad,[app="ads"]`, removing the rule.
 *
 * `$app` is deliberately absent, see `APP_MODIFIER_PATTERNS` for its removal.
 *
 * @example
 * ```[$url=||example.com/?app=1]##.ad```
 * @example
 * ```[$path =/x]e.com##.a```
 * @example
 * ```[$path]example.com##.content```
 */
const NON_BASIC_MODIFIER_LIST_GUARD = '(?<=^\\[\\$)(path|domain|url)\\b.*]';

/**
 * Pattern to check if rule contains `$protobuf` modifier
 * and does not contain a non-basic modifier list (`$domain`, `$path`, `$url`).
 *
 * Pattern parts:
 * - `\\$` — modifiers divider
 * - `(?!#|...)` — negative lookahead that excludes CSS rules (#$#), rules with a non-basic modifier list (see
 *   `NON_BASIC_MODIFIER_LIST_GUARD`), and `$removeparam` values like `$removeparam=protobuf`
 * - `.*protobuf` — protobuf modifier itself
 * - `(,|=|$)` — end of line or modifiers divider, as `$protobuf` can be followed by other modifiers (`,`),
 *   it may have a value (`=`), or it may be the last modifier in the rule (`$`).
 *
 * Currently it is not supported, but it can be added in the future
 * https://github.com/AdguardTeam/CoreLibs/issues/1778
 */
const PROTOBUF_MODIFIER_PATTERNS = [
    `\\$(?!#|${NON_BASIC_MODIFIER_LIST_GUARD}|.*removeparam=).*protobuf(,|=|$)`,
];

/**
 * Pattern to check if rule contains `$app` modifier
 * and does not contain a non-basic modifier list (`$domain`, `$path`, `$url`).
 *
 * Pattern parts:
 * - `\\$` — modifiers divider
 * - `(?!#|...)` — negative lookahead that excludes CSS rules (#$#), rules with a non-basic modifier list (see
 *   `NON_BASIC_MODIFIER_LIST_GUARD`), and `$removeparam` values like `$removeparam=app=ads`
 * - `.*app=` — app= modifier itself
 *
 * @example
 * ```@@||imasdk.googleapis.com^$app=tv.htv.app```
 */
const APP_MODIFIER_PATTERNS = [
    `\\$(?!#|${NON_BASIC_MODIFIER_LIST_GUARD}|.*removeparam=).*app=`,
];

/**
 * Pattern to check if rule contains `$extension` modifier
 * and does not contain a non-basic modifier list (`$domain`, `$path`, `$url`).
 *
 * Pattern parts:
 * - `\\$` — modifiers divider
 * - `(?!#|...)` — negative lookahead that excludes CSS rules (#$#), rules with a non-basic modifier list (see
 *   `NON_BASIC_MODIFIER_LIST_GUARD`), and `$removeparam` values like `$removeparam=extension`
 * - `.*extension` — extension modifier itself
 * - `(,|=|$)` — end of line or modifiers divider, as `$extension` can be followed by other modifiers (`,`),
 *   it may have a value (`=`), or it may be the last modifier in the rule (`$`).
 *
 * @example
 * ```@@||radar.cloudflare.com^$elemhide,extension,content```
 */
const EXTENSION_MODIFIER_PATTERNS = [
    `\\$(?!#|${NON_BASIC_MODIFIER_LIST_GUARD}|.*removeparam=).*extension(,|=|$)`,
];

/**
 * Pattern to check if rule contains only `$content` modifier.
 *
 * @example
 * ```@@||telegram.hr^$content```
 */
const ONLY_CONTENT_MODIFIER_PATTERNS = [
    '\\$content$',
];

/**
 * Pattern to check if rule contains `$content` modifier
 * and does not contain a non-basic modifier list (`$domain`, `$path`, `$url`).
 *
 * Pattern parts:
 * - `\\$` — modifiers divider
 * - `(?!#|...)` — negative lookahead that excludes CSS rules (#$#), rules with a non-basic modifier list (see
 *   `NON_BASIC_MODIFIER_LIST_GUARD`), and `$removeparam` values like `$removeparam=content`
 * - `.*content` — content modifier itself
 * - `(,|$)` — end of line or modifiers divider, as `$content` can be followed by other modifiers (`,`).
 *
 * @example
 * ```@@||dnsleaktest.com^$content,elemhide,jsinject```
 */
const CONTENT_MODIFIER_PATTERNS = [
    `\\$(?!#|${NON_BASIC_MODIFIER_LIST_GUARD}|.*removeparam=).*content(,|$)`,
];

/**
 * Pattern to check if rule contains `$jsinject` modifier
 * and does not contain a non-basic modifier list (`$domain`, `$path`, `$url`).
 *
 * Pattern parts:
 * - `\\$` — modifiers divider
 * - `(?!#|...)` — negative lookahead that excludes CSS rules (#$#), rules with a non-basic modifier list (see
 *   `NON_BASIC_MODIFIER_LIST_GUARD`), and `$removeparam` values like `$removeparam=jsinject`
 * - `.*jsinject` — jsinject modifier itself
 * - `(,|$)` — end of line or modifiers divider, as `$jsinject` can be followed by other modifiers (`,`).
 *
 * @example
 * ```@@://www.atlassian.com^$elemhide,jsinject,extension```
 */
const JSINJECT_MODIFIER_PATTERNS = [
    `\\$(?!#|${NON_BASIC_MODIFIER_LIST_GUARD}|.*removeparam=).*jsinject(,|$)`,
];

/**
 * Pattern to check if rule contains `$urlblock` modifier
 * and does not contain a non-basic modifier list (`$domain`, `$path`, `$url`).
 *
 * Pattern parts:
 * - `\\$` — modifiers divider
 * - `(?!#|...)` — negative lookahead that excludes CSS rules (#$#), rules with a non-basic modifier list (see
 *   `NON_BASIC_MODIFIER_LIST_GUARD`), and `$removeparam` values like `$removeparam=urlblock`
 * - `.*urlblock` — urlblock modifier itself
 * - `(,|$)` — end of line or modifiers divider, as `$urlblock` can be followed by other modifiers (`,`).
 *
 * @example
 * ```@@||google.com/settings/ads/onweb$urlblock```
 */
const URLBLOCK_MODIFIER_PATTERNS = [
    `\\$(?!#|${NON_BASIC_MODIFIER_LIST_GUARD}|.*removeparam=).*urlblock(,|$)`,
];

/**
 * Pattern to check if rule contains `$referrerpolicy` modifier
 * and does not contain a non-basic modifier list (`$domain`, `$path`, `$url`).
 *
 * Pattern parts:
 * - `\\$` — modifiers divider
 * - `(?!#|...)` — negative lookahead that excludes CSS rules (#$#), rules with a non-basic modifier list (see
 *   `NON_BASIC_MODIFIER_LIST_GUARD`), and `$removeparam` values like `$removeparam=referrerpolicy`
 * - `.*referrerpolicy` — referrerpolicy modifier itself
 * - `(,|=|$)` — end of line or modifiers divider, as `$referrerpolicy` can be followed by other modifiers (`,`),
 *   it may have a value (`=`), or it may be the last modifier in the rule (`$`).
 *
 * @example
 * ```||yallo.tv^$referrerpolicy=origin```
 */
const REFERRERPOLICY_MODIFIER_PATTERNS = [
    `\\$(?!#|${NON_BASIC_MODIFIER_LIST_GUARD}|.*removeparam=).*referrerpolicy(,|=|$)`,
];

/**
 * Pattern to check if rule contains `$replace` modifier
 * and does not contain a non-basic modifier list (`$domain`, `$path`, `$url`).
 *
 * Pattern parts:
 * - `\\$` — modifiers divider
 * - `(?!#|...)` — negative lookahead that excludes CSS rules (#$#), rules with a non-basic modifier list (see
 *   `NON_BASIC_MODIFIER_LIST_GUARD`), and `$removeparam` values like `$removeparam=replace=ads`
 * - `.*replace` — replace modifier itself
 * - `(,|=|$)` — end of line or modifiers divider, as `$replace` can be followed by other modifiers (`,`),
 *   it may have a value (`=`), or it may be the last modifier in the rule (`$`).
 *
 * @example
 * ```||pubads.g.doubleclick.net/gampad/live/ads?correlator=$replace=/(<VAST[\s\S]*?>)[\s\S]*<\/VAST>/\$1<\/VAST>/```
 */
const REPLACE_MODIFIER_PATTERNS = [
    `\\$(?!#|${NON_BASIC_MODIFIER_LIST_GUARD}|.*removeparam=).*replace(,|=|$)`,
];

/**
 * Pattern to check if rule contains `$urltransform` modifier
 * and does not contain a non-basic modifier list (`$domain`, `$path`, `$url`).
 *
 * Pattern parts:
 * - `\\$` — modifiers divider
 * - `(?!#|...)` — negative lookahead that excludes CSS rules (#$#), rules with a non-basic modifier list (see
 *   `NON_BASIC_MODIFIER_LIST_GUARD`), and `$removeparam` values like `$removeparam=urltransform`
 * - `.*urltransform` — urltransform modifier itself
 * - `(,|=|$)` — end of line or modifiers divider, as `$urltransform` can be followed by other modifiers (`,`),
 *   it may have a value (`=`), or it may be the last modifier in the rule (`$`).
 *
 * @example
 * ```||example.com^$urltransform=/firstpath/secondpath/```
 */
const URLTRANSFORM_MODIFIER_PATTERNS = [
    `\\$(?!#|${NON_BASIC_MODIFIER_LIST_GUARD}|.*removeparam=).*urltransform(,|=|$)`,
];

/* eslint-disable max-len */

/**
 * Pattern to check if rule contains `$hls` modifier
 * and does not contain a non-basic modifier list (`$domain`, `$path`, `$url`).
 *
 * Pattern parts:
 * - `\\$` — modifiers divider
 * - `(?!#|...)` — negative lookahead that excludes CSS rules (#$#), rules with a non-basic modifier list (see
 *   `NON_BASIC_MODIFIER_LIST_GUARD`), and `$removeparam` values like `$removeparam=hls=ads`
 * - `.*hls` — hls modifier itself
 * - `(,|=|$)` — end of line or modifiers divider, as `$hls` can be followed by other modifiers (`,`),
 *   it may have a value (`=`), or it may be the last modifier in the rule (`$`).
 *
 * @example
 * ```||pubads.g.doubleclick.net/ondemand/hls/*.m3u8$hls=/redirector\.googlevideo\.com\/videoplayback[\s\S]*?dclk_video_ads/,domain=10play.com.au```
 */
const HLS_MODIFIER_PATTERNS = [
    `\\$(?!#|${NON_BASIC_MODIFIER_LIST_GUARD}|.*removeparam=).*hls(,|=|$)`,
];

/**
 * Pattern to check if rule contains `$jsonprune` modifier
 * and does not contain a non-basic modifier list (`$domain`, `$path`, `$url`).
 *
 * Pattern parts:
 * - `\\$` — modifiers divider
 * - `(?!#|...)` — negative lookahead that excludes CSS rules (#$#), rules with a non-basic modifier list (see
 *   `NON_BASIC_MODIFIER_LIST_GUARD`), and `$removeparam` values like `$removeparam=jsonprune`
 * - `.*jsonprune` — jsonprune modifier itself
 * - `(,|=|$)` — end of line or modifiers divider, as `$jsonprune` can be followed by other modifiers (`,`),
 *   it may have a value (`=`), or it may be the last modifier in the rule (`$`).
 *
 * @example
 * ```.com/watch?v=$xmlhttprequest,jsonprune=\$..[adPlacements\, adSlots\, playerAds],domain=youtubekids.com|youtube-nocookie.com|youtube.com```
 */
const JSONPRUNE_MODIFIER_PATTERNS = [
    `\\$(?!#|${NON_BASIC_MODIFIER_LIST_GUARD}|.*removeparam=).*jsonprune(,|=|$)`,
];

/* eslint-enable max-len */

/**
 * Pattern to check if rule contains `$removeparam` modifier
 * and does not contain a non-basic modifier list (`$domain`, `$path`, `$url`).
 *
 * Pattern parts:
 * - `\\$` — modifiers divider
 * - `(?!#|...)` — negative lookahead that excludes CSS rules (#$#) and rules with a non-basic modifier list
 *   (see `NON_BASIC_MODIFIER_LIST_GUARD`)
 * - `.*removeparam` — removeparam modifier itself
 * - `(,|=|$)` — end of line or modifiers divider, as `$removeparam` can be followed by other modifiers (`,`),
 *   it may have a value (`=`), or it may be the last modifier in the rule (`$`).
 *
 * @example
 * ```$removeparam=fb_ref```
 */
const REMOVEPARAM_MODIFIER_PATTERNS = [
    `\\$(?!#|${NON_BASIC_MODIFIER_LIST_GUARD}).*removeparam(,|=|$)`,
];

/**
 * Pattern to check if rule contains `$removeheader` modifier
 * and does not contain a non-basic modifier list (`$domain`, `$path`, `$url`).
 *
 * Pattern parts:
 * - `\\$` — modifiers divider
 * - `(?!#|...)` — negative lookahead that excludes CSS rules (#$#), rules with a non-basic modifier list (see
 *   `NON_BASIC_MODIFIER_LIST_GUARD`), and `$removeparam` values like `$removeparam=removeheader`
 * - `.*removeheader` — removeheader modifier itself
 * - `(,|=|$)` — end of line or modifiers divider, as `$removeheader` can be followed by other modifiers (`,`),
 *   it may have a value (`=`), or it may be the last modifier in the rule (`$`).
 *
 * @example
 * ```||dubznetwork.com^$removeheader=refresh```
 */
const REMOVEHEADER_MODIFIER_PATTERNS = [
    `\\$(?!#|${NON_BASIC_MODIFIER_LIST_GUARD}|.*removeparam=).*removeheader(,|=|$)`,
];

/**
 * Pattern to check if rule contains `$stealth` modifier
 * and does not contain a non-basic modifier list (`$domain`, `$path`, `$url`).
 *
 * Pattern parts:
 * - `\\$` — modifiers divider
 * - `(?!#|...)` — negative lookahead that excludes CSS rules (#$#), rules with a non-basic modifier list (see
 *   `NON_BASIC_MODIFIER_LIST_GUARD`), and `$removeparam` values like `$removeparam=stealth`
 * - `.*stealth` — stealth modifier itself
 * - `(,|=|$)` — end of line or modifiers divider, as `$stealth` can be followed by other modifiers (`,`),
 *   it may have a value (`=`), or it may be the last modifier in the rule (`$`).
 *
 * @example
 * ```@@.php?play_vid=$subdocument,stealth=referrer,domain=xyflv.cc```
 */
const STEALTH_MODIFIER_PATTERNS = [
    `\\$(?!#|${NON_BASIC_MODIFIER_LIST_GUARD}|.*removeparam=).*stealth(,|=|$)`,
];

/**
 * Pattern to check if rule contains `$cookie` modifier
 * and does not contain a non-basic modifier list (`$domain`, `$path`, `$url`).
 *
 * Pattern parts:
 * - `\\$` — modifiers divider
 * - `(?!#|...)` — negative lookahead that excludes CSS rules (#$#), rules with a non-basic modifier list (see
 *   `NON_BASIC_MODIFIER_LIST_GUARD`), and `$removeparam` values like `$removeparam=cookie`
 * - `.*cookie` — cookie modifier itself
 * - `(,|=|$)` — end of line or modifiers divider, as `$cookie` can be followed by other modifiers (`,`),
 *   it may have a value (`=`), or it may be the last modifier in the rule (`$`).
 *
 * @example
 * ```$cookie=_ga```
 */
const COOKIE_MODIFIER_PATTERNS = [
    `\\$(?!#|${NON_BASIC_MODIFIER_LIST_GUARD}|.*removeparam=).*cookie(,|=|$)`,
];

/**
 * Pattern to check if rule contains `$redirect` modifier
 * and does not contain a non-basic modifier list (`$domain`, `$path`, `$url`).
 *
 * Pattern parts:
 * - `\\$` — modifiers divider
 * - `(?!#|...)` — negative lookahead that excludes CSS rules (#$#), rules with a non-basic modifier list (see
 *   `NON_BASIC_MODIFIER_LIST_GUARD`), and `$removeparam` values like `$removeparam=redirect`
 * - `.*redirect` — redirect modifier itself
 * - `(,|=|$)` — end of line or modifiers divider, as `$redirect` can be followed by other modifiers (`,`),
 *   it may have a value (`=`), or it may be the last modifier in the rule (`$`).
 *
 * @example
 * ```||google-analytics.com/analytics.js$script,redirect=google-analytics,domain=~olx.*|~banki.ru|~bigc.co.th```
 */
const REDIRECT_MODIFIER_PATTERNS = [
    `\\$(?!#|${NON_BASIC_MODIFIER_LIST_GUARD}|.*removeparam=).*redirect(,|=|$)`,
];

/**
 * Pattern to check if rule contains `$redirect-rule` modifier
 * and does not contain a non-basic modifier list (`$domain`, `$path`, `$url`).
 *
 * Pattern parts:
 * - `\\$` — modifiers divider
 * - `(?!#|...)` — negative lookahead that excludes CSS rules (#$#), rules with a non-basic modifier list (see
 *   `NON_BASIC_MODIFIER_LIST_GUARD`), and `$removeparam` values like `$removeparam=redirect-rule`
 * - `.*redirect-rule` — redirect-rule modifier itself
 * - `(,|=|$)` — end of line or modifiers divider, as `$redirect-rule` can be followed by other modifiers (`,`),
 *   it may have a value (`=`), or it may be the last modifier in the rule (`$`).
 *
 * @example
 * ```$script,third-party,redirect-rule=noopjs,domain=paraphraser.io```
 */
const REDIRECT_RULE_MODIFIER_PATTERNS = [
    `\\$(?!#|${NON_BASIC_MODIFIER_LIST_GUARD}|.*removeparam=).*redirect-rule(,|=|$)`,
];

/**
 * Pattern to check if rule contains `$empty` modifier
 * and does not contain a non-basic modifier list (`$domain`, `$path`, `$url`).
 *
 * Pattern parts:
 * - `\\$` — modifiers divider
 * - `(?!#|...)` — negative lookahead that excludes CSS rules (#$#), rules with a non-basic modifier list (see
 *   `NON_BASIC_MODIFIER_LIST_GUARD`), and `$removeparam` values like `$removeparam=empty`
 * - `.*empty` — empty modifier itself
 * - `(,|$)` — end of line or modifiers divider, as `$empty` can be followed by other modifiers (`,`).
 *
 * @example
 * ```Deprecated, use $redirect=nooptext instead```
 */
const EMPTY_MODIFIER_PATTERNS = [
    `\\$(?!#|${NON_BASIC_MODIFIER_LIST_GUARD}|.*removeparam=).*empty(,|$)`,
];

/**
 * Pattern to detect scriptlets and JavaScript rules
 *
 * @example
 * ```w3resource.com#%#//scriptlet('prevent-setTimeout', 'ins.adsbygoogle')```
 * @example
 * ```meczyki.pl#%#!function(){window.YLHH={bidder:{startAuction:function(){}}};}();```
 */
const JAVASCRIPT_RULES_PATTERNS = [
    '#%#',
    '#@%#',
];

/**
 * Pattern to detect CSS rules
 *
 * @example
 * ```windowslite.net#$#body { overflow: auto !important; }```
 */
const CSS_RULES_PATTERNS = [
    '#\\$#',
    '#@\\$#',
];

/**
 * Pattern to detect CSS rules with `@media` queries
 *
 * @example
 * ```windowslite.net#$#body { overflow: auto !important; }```
 */
const CSS_MEDIA_RULES_PATTERNS = [
    '#\\$#@media ',
];

/**
 * Patterns to match unblocking basic rules with `$important` modifier
 * which is not supported by uBlock Origin.
 *
 * @see {@link https://github.com/AdguardTeam/FiltersCompiler/issues/200}
 */
const UNBLOCKING_IMPORTANT_RULES_PATTERNS = [
    '@@.*?(\\$|,)important',
];

/**
 * Pattern to detect Extended CSS rules
 *
 * Plain `:has(` is deliberately absent: it is a native CSS selector supported
 * by all platforms. `:-abp-has(` is different — it is the Extended CSS alias of
 * `:has()` and is never native, so it is still removed. Nested `:has()` is not
 * valid native CSS either, hence it has its own pattern below.
 *
 * @example
 * ```xup.in#?##xupab```
 * @example
 * ```lunar.az#?#.sagpanel div[class^="yenisb"]:contains(Reklam)```
 * @example
 * ```haal.fashion#?#div:has(> div > div > div.dfp-ad-unit)```
 */
const EXTENDED_CSS_RULES_PATTERNS = [
    '\\[-ext-',
    ':has-text\\(',
    ':contains\\(',
    ':matches-css\\(',
    ':matches-attr\\(',
    ':matches-property\\(',
    ':xpath\\(',
    ':nth-ancestor\\(',
    ':upward\\(',
    ':remove\\(',
    ':matches-css-before\\(',
    ':matches-css-after\\(',
    ':-abp-has\\(',
    ':-abp-contains\\(',
    // Nested `:has()` is not valid native CSS, so it needs Extended CSS.
    // A regex cannot count paren depth, so the fix is bounded with it
    // crossing up to three nested levels.
    // div:has(.a:not(:is(.b:not(:where(.c)))):has(.d)) (four closes) is
    // still kept.
    ':has\\((?:[^)]|\\((?:[^()]|\\((?:[^()]|\\([^()]*\\))*\\))*\\))*:has\\(',
    '#\\?#',
    '#\\$\\?#',
    '#@\\?#',
    '#@\\$\\?#',
];

/**
 * Pattern to detect cosmetic rules with non-basic modifiers unsupported by
 * AdGuard Content Blocker.
 *
 * AdGuard Content Blocker supports no non-basic modifiers (`$app`,
 * `$domain`, `$path`, `$url`), so matching the modifier list prefix `[$` is
 * enough, and no modifier name must be told apart. `$app` rules are also
 * removed by `APP_MODIFIER_PATTERNS`.
 *
 * Matching the prefix instead of the names also catches variants that the
 * parser accepts, such as whitespace around `=`.
 *
 * @example
 * ```[$path=/foren]cad.de##tr.ad```
 * @example
 * ```[$path =/x]e.com##.a```
 */
const NON_BASIC_MODIFIER_PATTERNS = [
    '^\\[\\$',
];

/**
 * Used for `EXTENSION_CHROMIUM`, `EXTENSION_CHROMIUM_MV3`, `EXTENSION_EDGE`,
 * `EXTENSION_EDGE_MV3`, `EXTENSION_OPERA`, and `EXTENSION_OPERA_MV3` platforms.
 */
const CHROMIUM_BASED_EXTENSION_PATTERNS = [
    ...HTML_FILTERING_MODIFIER_PATTERNS,
    ...REPLACE_MODIFIER_PATTERNS,
    ...APP_MODIFIER_PATTERNS,
    ...NETWORK_MODIFIER_PATTERNS,
    ...PROTOBUF_MODIFIER_PATTERNS,
    ...EXTENSION_MODIFIER_PATTERNS,
    ...HLS_MODIFIER_PATTERNS,
    ...JSONPRUNE_MODIFIER_PATTERNS,
    ...REFERRERPOLICY_MODIFIER_PATTERNS,
    ...CONTENT_MODIFIER_PATTERNS,
];

/**
 * Used for `EXTENSION_CHROMIUM_MV3`, `EXTENSION_EDGE_MV3`, and
 * `EXTENSION_OPERA_MV3` platforms.
 */
const CHROMIUM_MV3_BASED_EXTENSION_PATTERNS = [
    ...CHROMIUM_BASED_EXTENSION_PATTERNS,
    ...REDIRECT_RULE_MODIFIER_PATTERNS,
];

/**
 * Used for `EXTENSION_SAFARI` and `IOS` platforms.
 */
const SAFARI_BASED_EXTENSION_PATTERNS = [
    ...DOMAIN_WITH_REGEXPS_PATTERNS,
    ...HTML_FILTERING_MODIFIER_PATTERNS,
    ...EXTENSION_MODIFIER_PATTERNS,
    ...REMOVEPARAM_MODIFIER_PATTERNS,
    ...REMOVEHEADER_MODIFIER_PATTERNS,
    ...MP4_MODIFIER_PATTERNS,
    ...REPLACE_MODIFIER_PATTERNS,
    ...URLTRANSFORM_MODIFIER_PATTERNS,
    ...STEALTH_MODIFIER_PATTERNS,
    ...COOKIE_MODIFIER_PATTERNS,
    ...APP_MODIFIER_PATTERNS,
    ...PROTOBUF_MODIFIER_PATTERNS,
    ...REDIRECT_MODIFIER_PATTERNS,
    ...REDIRECT_RULE_MODIFIER_PATTERNS,
    ...EMPTY_MODIFIER_PATTERNS,
    ...WEBRTC_MODIFIER_PATTERNS,
    ...CSP_MODIFIER_PATTERNS,
    ...ONLY_CONTENT_MODIFIER_PATTERNS,
    ...NETWORK_MODIFIER_PATTERNS,
    ...REFERRERPOLICY_MODIFIER_PATTERNS,
    ...HLS_MODIFIER_PATTERNS,
    ...JSONPRUNE_MODIFIER_PATTERNS,
];

/* eslint-disable max-len */

/**
 * Pattern to detect Extended CSS `:matches-property()` rules
 *
 * @example
 * ```unsplash.com#?#.ripi6 > div:matches-property(/__reactFiber/.return.return.memoizedProps.ad)```
 * @example
 * ```
 * androidauthority.com#?#main div[class]:has(> div[class]:matches-property(/__reactFiber/.return.memoizedProps.type=med_rect_atf))
 * ```
 */
export const CSS_MATCHES_PROPERTY_RULES_PATTERNS = [
    ':matches-property\\(',
];

/**
 * Pattern to detect generic CSS rules
 *
 * @example
 * ```#$#div[class="adsbygoogle"][id="ad-detector"] { display: block !important; }```
 * @example
 * ```#$#.pub_728x90.text-ad.textAd.text_ad.text_ads.text-ads.text-ad-links { display: block !important; }```
 */
export const CSS_GENERIC_RULES_PATTERNS = [
    '^#\\$#',
];

/**
 * Platform config key of the legacy macOS v1 build.
 */
export const MAC_V1_PLATFORM = 'MAC';

/**
 * Platform config key of the legacy macOS v2 build.
 */
export const MAC_V2_PLATFORM = 'MAC_V2';

/**
 * Platform config keys of the legacy macOS builds.
 *
 * These builds keep the frozen `mac`/`mac_v2` schemas and the old metadata
 * format; the runtime `filters_i18n` schema generation is not used for them.
 * The directory names are `platformsConfig[key].path`. The array is a set:
 * code that needs one of the keys imports it by name.
 */
export const LEGACY_PLATFORMS = [MAC_V1_PLATFORM, MAC_V2_PLATFORM];

/* eslint-enable max-len */

/**
 * Regex pattern groups used by the platform configurations.
 *
 * The values are the same frozen arrays that the defaults use. A platform
 * default can compose several groups, so a patch that spreads one group
 * replaces the composed array with that group. To append, spread the
 * platform's current `removeRulePatterns` array instead.
 */
export const platformConfigPatterns = deepFreeze({
    DOMAIN_WITH_REGEXPS_PATTERNS,
    ALL_MODIFIER_PATTERNS,
    MP4_MODIFIER_PATTERNS,
    NETWORK_MODIFIER_PATTERNS,
    WEBRTC_MODIFIER_PATTERNS,
    CSP_MODIFIER_PATTERNS,
    HTML_FILTERING_MODIFIER_PATTERNS,
    PROTOBUF_MODIFIER_PATTERNS,
    APP_MODIFIER_PATTERNS,
    EXTENSION_MODIFIER_PATTERNS,
    ONLY_CONTENT_MODIFIER_PATTERNS,
    CONTENT_MODIFIER_PATTERNS,
    JSINJECT_MODIFIER_PATTERNS,
    URLBLOCK_MODIFIER_PATTERNS,
    REFERRERPOLICY_MODIFIER_PATTERNS,
    REPLACE_MODIFIER_PATTERNS,
    URLTRANSFORM_MODIFIER_PATTERNS,
    HLS_MODIFIER_PATTERNS,
    JSONPRUNE_MODIFIER_PATTERNS,
    REMOVEPARAM_MODIFIER_PATTERNS,
    REMOVEHEADER_MODIFIER_PATTERNS,
    STEALTH_MODIFIER_PATTERNS,
    COOKIE_MODIFIER_PATTERNS,
    REDIRECT_MODIFIER_PATTERNS,
    REDIRECT_RULE_MODIFIER_PATTERNS,
    EMPTY_MODIFIER_PATTERNS,
    JAVASCRIPT_RULES_PATTERNS,
    CSS_RULES_PATTERNS,
    CSS_MEDIA_RULES_PATTERNS,
    UNBLOCKING_IMPORTANT_RULES_PATTERNS,
    EXTENDED_CSS_RULES_PATTERNS,
    NON_BASIC_MODIFIER_PATTERNS,
    CHROMIUM_BASED_EXTENSION_PATTERNS,
    CHROMIUM_MV3_BASED_EXTENSION_PATTERNS,
    SAFARI_BASED_EXTENSION_PATTERNS,
    CSS_MATCHES_PROPERTY_RULES_PATTERNS,
    CSS_GENERIC_RULES_PATTERNS,
}) satisfies Readonly<Record<string, readonly string[]>>;

/**
 * Frozen regex pattern groups, keyed by their source constant name.
 *
 * Use a group to extend a platform's `removeRulePatterns` without copying
 * the regular expressions.
 */
export type PlatformConfigPatterns = typeof platformConfigPatterns;

export const platformsConfig: ReadonlyPlatformsConfig = deepFreeze<PlatformsConfig>({
    'WINDOWS': {
        'platform': 'windows',
        'path': 'windows',
        'expires': '12 hours',
        'configuration': {
            'ignoreRuleHints': false,
        },
        'defines': {
            'adguard': true,
            'adguard_app_windows': true,
            'adguard_corelibs': true,
            'cap_html_filtering': true,
        },
    },
    'MAC': {
        'platform': 'mac',
        'path': 'mac',
        'configuration': {
            'removeRulePatterns': HTML_FILTERING_MODIFIER_PATTERNS,
            'ignoreRuleHints': false,
        },
        'defines': {
            'adguard': true,
            'adguard_app_mac': true,
        },
    },
    'MAC_V2': {
        'platform': 'mac',
        'path': 'mac_v2',
        'expires': '12 hours',
        'configuration': {
            'ignoreRuleHints': false,
        },
        'defines': {
            'adguard': true,
            'adguard_app_mac': true,
            'adguard_corelibs': true,
            'cap_html_filtering': true,
        },
    },
    'MAC_V3': {
        'platform': 'mac',
        'path': 'mac_v3',
        'expires': '12 hours',
        'configuration': {
            'ignoreRuleHints': false,
        },
        'defines': {
            'adguard': true,
            'adguard_app_mac': true,
            'adguard_corelibs': true,
            'cap_html_filtering': true,
        },
    },
    'ANDROID': {
        'platform': 'android',
        'path': 'android',
        'configuration': {
            'ignoreRuleHints': false,
        },
        'defines': {
            'adguard': true,
            'adguard_app_android': true,
            'adguard_corelibs': true,
            'cap_html_filtering': true,
        },
    },
    'CLI': {
        'platform': 'cli',
        'path': 'cli',
        'expires': '12 hours',
        'configuration': {
            'ignoreRuleHints': false,
        },
        'defines': {
            'adguard': true,
            'adguard_app_cli': true,
            'adguard_corelibs': true,
            'cap_html_filtering': true,
        },
    },
    'EXTENSION_CHROMIUM': {
        'platform': 'ext_chromium',
        'path': 'extension/chromium',
        'expires': '10 days',
        'configuration': {
            'removeRulePatterns': CHROMIUM_BASED_EXTENSION_PATTERNS,
            'ignoreRuleHints': false,
        },
        'defines': {
            'adguard': true,
            'adguard_ext_chromium': true,
        },
    },
    'EXTENSION_CHROMIUM_MV3': {
        'platform': 'ext_chromium_mv3',
        'path': 'extension/chromium-mv3',
        'expires': '10 days',
        'configuration': {
            'removeRulePatterns': CHROMIUM_MV3_BASED_EXTENSION_PATTERNS,
            'ignoreRuleHints': false,
        },
        'defines': {
            'adguard': true,
            'adguard_ext_chromium_mv3': true,
        },
    },
    'EXTENSION_EDGE': {
        'platform': 'ext_edge',
        'path': 'extension/edge',
        'expires': '10 days',
        'configuration': {
            'removeRulePatterns': CHROMIUM_BASED_EXTENSION_PATTERNS,
            'ignoreRuleHints': false,
        },
        'defines': {
            'adguard': true,
            'adguard_ext_edge': true,
            'adguard_ext_chromium': true,
        },
    },
    'EXTENSION_EDGE_MV3': {
        'platform': 'ext_edge_mv3',
        'path': 'extension/edge-mv3',
        'expires': '10 days',
        'configuration': {
            'removeRulePatterns': CHROMIUM_MV3_BASED_EXTENSION_PATTERNS,
            'ignoreRuleHints': false,
        },
        'defines': {
            'adguard': true,
            'adguard_ext_edge_mv3': true,
            'adguard_ext_chromium_mv3': true,
        },
    },
    'EXTENSION_OPERA': {
        'platform': 'ext_opera',
        'path': 'extension/opera',
        'expires': '10 days',
        'configuration': {
            'removeRulePatterns': CHROMIUM_BASED_EXTENSION_PATTERNS,
            'ignoreRuleHints': false,
        },
        'defines': {
            'adguard': true,
            'adguard_ext_opera': true,
            'adguard_ext_chromium': true,
        },
    },
    'EXTENSION_OPERA_MV3': {
        'platform': 'ext_opera_mv3',
        'path': 'extension/opera-mv3',
        'expires': '10 days',
        'configuration': {
            'removeRulePatterns': CHROMIUM_MV3_BASED_EXTENSION_PATTERNS,
            'ignoreRuleHints': false,
        },
        'defines': {
            'adguard': true,
            'adguard_ext_opera_mv3': true,
            'adguard_ext_chromium_mv3': true,
        },
    },
    'EXTENSION_FIREFOX': {
        'platform': 'ext_ff',
        'path': 'extension/firefox',
        'expires': '10 days',
        'configuration': {
            'removeRulePatterns': [
                ...HTML_FILTERING_MODIFIER_PATTERNS,
                ...APP_MODIFIER_PATTERNS,
                ...NETWORK_MODIFIER_PATTERNS,
                ...PROTOBUF_MODIFIER_PATTERNS,
                ...EXTENSION_MODIFIER_PATTERNS,
                ...HLS_MODIFIER_PATTERNS,
                ...JSONPRUNE_MODIFIER_PATTERNS,
                ...REFERRERPOLICY_MODIFIER_PATTERNS,

            ],
            'ignoreRuleHints': false,
        },
        'defines': {
            'adguard': true,
            'adguard_ext_firefox': true,
            'cap_html_filtering': true,
        },
    },
    'EXTENSION_SAFARI': {
        'platform': 'ext_safari',
        'path': 'extension/safari',
        'configuration': {
            'removeRulePatterns': SAFARI_BASED_EXTENSION_PATTERNS,
            'ignoreRuleHints': false,
        },
        'defines': {
            'adguard': true,
            'adguard_ext_safari': true,
        },
    },
    'IOS': {
        'platform': 'ios',
        'path': 'ios',
        'configuration': {
            'removeRulePatterns': SAFARI_BASED_EXTENSION_PATTERNS,
            'ignoreRuleHints': false,
        },
        'defines': {
            'adguard': true,
            'adguard_app_ios': true,
        },
    },
    'EXTENSION_ANDROID_CONTENT_BLOCKER': {
        'platform': 'ext_android_cb',
        'path': 'extension/android-content-blocker',
        'configuration': {
            'removeRulePatterns': [
                ...DOMAIN_WITH_REGEXPS_PATTERNS,
                ...NON_BASIC_MODIFIER_PATTERNS,
                ...HTML_FILTERING_MODIFIER_PATTERNS,
                ...EXTENSION_MODIFIER_PATTERNS,
                ...REMOVEPARAM_MODIFIER_PATTERNS,
                ...REMOVEHEADER_MODIFIER_PATTERNS,
                ...JAVASCRIPT_RULES_PATTERNS,
                ...CSS_RULES_PATTERNS,
                ...MP4_MODIFIER_PATTERNS,
                ...REPLACE_MODIFIER_PATTERNS,
                ...URLTRANSFORM_MODIFIER_PATTERNS,
                ...STEALTH_MODIFIER_PATTERNS,
                ...COOKIE_MODIFIER_PATTERNS,
                ...EMPTY_MODIFIER_PATTERNS,
                ...APP_MODIFIER_PATTERNS,
                ...PROTOBUF_MODIFIER_PATTERNS,
                ...CSP_MODIFIER_PATTERNS,
                ...EXTENDED_CSS_RULES_PATTERNS,
                ...REDIRECT_MODIFIER_PATTERNS,
                ...REDIRECT_RULE_MODIFIER_PATTERNS,
                ...ONLY_CONTENT_MODIFIER_PATTERNS,
                ...ALL_MODIFIER_PATTERNS,
                ...NETWORK_MODIFIER_PATTERNS,
                ...REFERRERPOLICY_MODIFIER_PATTERNS,
                ...HLS_MODIFIER_PATTERNS,
                ...JSONPRUNE_MODIFIER_PATTERNS,
                ...JSINJECT_MODIFIER_PATTERNS,
                ...URLBLOCK_MODIFIER_PATTERNS,
            ],
            'ignoreRuleHints': false,
        },
        'defines': {
            'adguard': true,
            'adguard_ext_android_cb': true,
        },
    },
    'EXTENSION_UBLOCK': {
        'platform': 'ext_ublock',
        'path': 'extension/ublock',
        'configuration': {
            'removeRulePatterns': [
                ...HTML_FILTERING_MODIFIER_PATTERNS,
                ...MP4_MODIFIER_PATTERNS,
                ...REPLACE_MODIFIER_PATTERNS,
                ...URLTRANSFORM_MODIFIER_PATTERNS,
                ...STEALTH_MODIFIER_PATTERNS,
                ...COOKIE_MODIFIER_PATTERNS,
                ...APP_MODIFIER_PATTERNS,
                ...NETWORK_MODIFIER_PATTERNS,
                ...PROTOBUF_MODIFIER_PATTERNS,
                ...EXTENSION_MODIFIER_PATTERNS,
                ...JSINJECT_MODIFIER_PATTERNS,
                ...URLBLOCK_MODIFIER_PATTERNS,
                ...CONTENT_MODIFIER_PATTERNS,
                ...WEBRTC_MODIFIER_PATTERNS,
                ...CSS_MEDIA_RULES_PATTERNS,
                ...HLS_MODIFIER_PATTERNS,
                ...REFERRERPOLICY_MODIFIER_PATTERNS,
                ...JSONPRUNE_MODIFIER_PATTERNS,
                ...UNBLOCKING_IMPORTANT_RULES_PATTERNS,
                ...REMOVEHEADER_MODIFIER_PATTERNS,
                ...CSS_MATCHES_PROPERTY_RULES_PATTERNS, // TODO: remove when this issue is fixed - https://github.com/AdguardTeam/FiltersCompiler/issues/252
                ...CSS_GENERIC_RULES_PATTERNS,
            ],
            'ignoreRuleHints': false,
            'adbHeader': '![Adblock Plus 2.0]',
        },
        'defines': {
            'ext_ublock': true,
        },
    },
});

/**
 * Directory names of the legacy macOS platform builds.
 *
 * Derived from the platform config keys so that the JSON validator and the
 * tests use the same names.
 */
export const LEGACY_PLATFORM_PATHS = LEGACY_PLATFORMS.map((key) => platformsConfig[key].path);

/**
 * Error thrown when a platform configuration patch is invalid.
 */
export class PlatformsConfigError extends Error {
    /**
     * Dotted path to the invalid value, for example
     * `patch.EXTENSION_UBLOCK.configuration.removeRulePatterns[1]`.
     */
    readonly path: string;

    /**
     * @param path Dotted path to the invalid value.
     * @param detail What is wrong.
     */
    constructor(path: string, detail: string) {
        super(`Invalid platforms config patch at ${path}: ${detail}`);
        this.name = 'PlatformsConfigError';
        this.path = path;
    }
}

/**
 * Checks that a value is a plain object.
 *
 * A plain object has `Object.prototype` or `null` as its prototype. Date,
 * Map, and class instances are not plain objects.
 *
 * @param value Value to check.
 * @returns `true` when the value is a plain object.
 */
const isPlainObject = (value: unknown): value is Record<string, unknown> => {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        return false;
    }

    const proto = Object.getPrototypeOf(value);
    return proto === Object.prototype || proto === null;
};

/**
 * Throws when a value is not a plain object.
 *
 * @param value Value to check.
 * @param path Dotted path for the error.
 * @returns The value as a record.
 */
const requireObject = (value: unknown, path: string): Record<string, unknown> => {
    if (!isPlainObject(value)) {
        throw new PlatformsConfigError(path, 'expected an object');
    }

    return value;
};

/**
 * Throws when a value is not an object or is `null`.
 *
 * @param value Value to check.
 * @param path Dotted path for the error.
 */
const requireNotCleared = (value: unknown, path: string): void => {
    if (value === null) {
        throw new PlatformsConfigError(path, 'cannot be cleared');
    }
};

/**
 * Throws when a value is not a string.
 *
 * @param value Value to check.
 * @param path Dotted path for the error.
 * @returns The string.
 */
const requireString = (value: unknown, path: string): string => {
    if (typeof value !== 'string') {
        throw new PlatformsConfigError(path, 'expected a string');
    }

    return value;
};

/**
 * Characters a Windows directory name cannot contain.
 */
const WINDOWS_INVALID_PATH_CHARACTER = /[<>:"|?*]/;

/**
 * Windows device names that cannot be a directory name.
 */
const WINDOWS_RESERVED_PATH_NAME = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i;

/**
 * Checks whether a path segment is not portable to Windows.
 *
 * @param segment One segment of a normalized platform path.
 * @returns `true` when Windows cannot represent the segment.
 */
const isUnportablePathSegment = (segment: string): boolean => {
    if (segment.endsWith('.') || segment.endsWith(' ') || WINDOWS_RESERVED_PATH_NAME.test(segment)) {
        return true;
    }

    return [...segment].some((character) => (
        WINDOWS_INVALID_PATH_CHARACTER.test(character) || character.charCodeAt(0) < 0x20
    ));
};

/**
 * Throws when a value is not a safe, portable relative platform directory.
 *
 * The path is normalized so that `./a`, `a/`, and `a` compare equal. Every
 * segment must also be representable on Windows, otherwise the same patch
 * would produce a different directory there.
 *
 * @param value Value to check.
 * @param path Dotted path for the error.
 * @returns The normalized relative path.
 */
const requirePlatformPath = (value: unknown, path: string): string => {
    const raw = requireString(value, path);
    if (raw === ''
        || raw.includes('\\')
        || raw.includes('\0')
        || posix.isAbsolute(raw)
        || /^[a-zA-Z]:/.test(raw)) {
        throw new PlatformsConfigError(path, 'expected a relative directory name');
    }

    const normalized = posix.normalize(raw).replace(/\/+$/, '');
    if (normalized === '' || normalized === '.' || normalized === '..' || normalized.startsWith('../')) {
        throw new PlatformsConfigError(path, 'expected a relative directory name');
    }

    if (normalized.split('/').some(isUnportablePathSegment)) {
        throw new PlatformsConfigError(path, 'expected a portable relative directory name');
    }

    return normalized;
};

/**
 * Throws when a value is not an array of rule removal patterns.
 *
 * A pattern is a string that compiles as a regular expression or a `RegExp`.
 * A `RegExp` is copied, so freezing the result cannot freeze the caller's
 * object.
 *
 * @param value Value to check.
 * @param path Dotted path for the error.
 * @returns A copy of the array.
 */
const requireRulePatterns = (value: unknown, path: string): (string | RegExp)[] => {
    if (!Array.isArray(value)) {
        throw new PlatformsConfigError(path, 'expected an array of strings or regular expressions');
    }

    return value.map((item, index) => {
        const itemPath = `${path}[${index}]`;
        if (item instanceof RegExp) {
            return new RegExp(item.source, item.flags);
        }
        if (typeof item !== 'string') {
            throw new PlatformsConfigError(itemPath, 'expected a string or a regular expression');
        }
        try {
            RegExp(item);
        } catch {
            throw new PlatformsConfigError(itemPath, 'invalid regular expression');
        }

        return item;
    });
};

/**
 * Throws when a value is not an array of `{ from, to }` replacements.
 *
 * @param value Value to check.
 * @param path Dotted path for the error.
 * @returns A copy of the array.
 */
const requireReplacements = (value: unknown, path: string): PlatformReplacement[] => {
    if (!Array.isArray(value)) {
        throw new PlatformsConfigError(path, 'expected an array of { from, to } objects');
    }

    return value.map((item, index) => {
        const itemPath = `${path}[${index}]`;
        const replacement = requireObject(item, itemPath);
        Object.keys(replacement).forEach((field) => {
            if (field !== 'from' && field !== 'to') {
                throw new PlatformsConfigError(`${itemPath}.${field}`, 'unknown field');
            }
        });

        const from = requireString(replacement.from, `${itemPath}.from`);
        const to = requireString(replacement.to, `${itemPath}.to`);
        try {
            RegExp(from);
        } catch {
            throw new PlatformsConfigError(`${itemPath}.from`, 'invalid regular expression');
        }

        return { from, to };
    });
};

/**
 * Merges a `defines` patch into a defines map.
 *
 * @param target Defines map to change.
 * @param patch Defines patch.
 * @param path Dotted path for the error.
 */
const mergeDefines = (target: PlatformDefines, patch: unknown, path: string): void => {
    const definesPatch = requireObject(patch, path);
    Object.keys(definesPatch).forEach((name) => {
        if (name === '__proto__') {
            throw new PlatformsConfigError(`${path}.${name}`, 'reserved key');
        }
        const value = definesPatch[name];
        if (value === undefined) {
            return;
        }
        if (value === null) {
            delete target[name];
        } else if (typeof value === 'boolean') {
            target[name] = value;
        } else {
            throw new PlatformsConfigError(`${path}.${name}`, 'expected a boolean or null');
        }
    });
};

/**
 * Merges a configuration patch into a configuration object.
 *
 * @param target Configuration to change.
 * @param patch Configuration patch.
 * @param path Dotted path for the error.
 */
const mergeConfiguration = (
    target: PlatformConfiguration,
    patch: unknown,
    path: string,
): void => {
    const configurationPatch = requireObject(patch, path);
    Object.keys(configurationPatch).forEach((field) => {
        const value = configurationPatch[field];
        const fieldPath = `${path}.${field}`;
        if (value === undefined) {
            return;
        }
        switch (field) {
            case 'removeRulePatterns':
                if (value === null || value === false) {
                    delete target.removeRulePatterns;
                } else {
                    target.removeRulePatterns = requireRulePatterns(value, fieldPath);
                }
                break;
            case 'ignoreRuleHints':
                if (value === null) {
                    delete target.ignoreRuleHints;
                } else if (typeof value === 'boolean') {
                    target.ignoreRuleHints = value;
                } else {
                    throw new PlatformsConfigError(fieldPath, 'expected a boolean or null');
                }
                break;
            case 'replacements':
                if (value === null) {
                    delete target.replacements;
                } else {
                    target.replacements = requireReplacements(value, fieldPath);
                }
                break;
            case 'adbHeader':
                if (value === null) {
                    delete target.adbHeader;
                } else {
                    target.adbHeader = requireString(value, fieldPath);
                }
                break;
            default:
                throw new PlatformsConfigError(fieldPath, 'unknown field');
        }
    });
};

/**
 * Merges a platform patch into a platform entry.
 *
 * @param target Platform entry to change.
 * @param patch Platform patch.
 * @param path Dotted path for the error.
 */
const mergePlatformEntry = (
    target: PlatformEntry,
    patch: Record<string, unknown>,
    path: string,
): void => {
    Object.keys(patch).forEach((field) => {
        const value = patch[field];
        const fieldPath = `${path}.${field}`;
        if (value === undefined) {
            return;
        }
        switch (field) {
            case 'platform':
                requireNotCleared(value, fieldPath);
                target.platform = requireString(value, fieldPath);
                break;
            case 'path':
                requireNotCleared(value, fieldPath);
                target.path = requirePlatformPath(value, fieldPath);
                break;
            case 'expires':
                if (value === null) {
                    delete target.expires;
                } else {
                    target.expires = requireString(value, fieldPath);
                }
                break;
            case 'configuration':
                requireNotCleared(value, fieldPath);
                mergeConfiguration(target.configuration, value, fieldPath);
                break;
            case 'defines':
                requireNotCleared(value, fieldPath);
                mergeDefines(target.defines, value, fieldPath);
                break;
            default:
                throw new PlatformsConfigError(fieldPath, 'unknown field');
        }
    });
};

/**
 * Creates a platform entry from a complete patch.
 *
 * @param key Platform key.
 * @param patch Platform patch.
 * @param path Dotted path for the error.
 * @returns A new platform entry.
 */
const createPlatformEntry = (
    key: string,
    patch: Record<string, unknown>,
    path: string,
): PlatformEntry => {
    ['platform', 'path', 'configuration', 'defines'].forEach((field) => {
        if (!Object.hasOwn(patch, field) || patch[field] === undefined) {
            throw new PlatformsConfigError(
                path,
                `unknown platform "${key}": a new platform requires platform, path, configuration, and defines`,
            );
        }
    });

    const entry: PlatformEntry = {
        platform: '',
        path: '',
        configuration: {},
        defines: {},
    };
    mergePlatformEntry(entry, patch, path);

    return entry;
};

/**
 * Copies one platform entry and its nested values.
 *
 * The merge must own every object and array that it freezes. A shallow copy
 * would leave the caller's `base` entries shared with the result. The path is
 * normalized so the merge compares and outputs the same form.
 *
 * @param entry Entry to copy.
 * @returns A mutable copy of the entry.
 */
const cloneEntry = (entry: DeepReadonly<PlatformEntry>): PlatformEntry => {
    const configuration: PlatformConfiguration = {};

    if (entry.configuration.removeRulePatterns) {
        configuration.removeRulePatterns = entry.configuration.removeRulePatterns.map(
            (pattern) => (typeof pattern === 'string' ? pattern : new RegExp(pattern.source, pattern.flags)),
        );
    }
    if (entry.configuration.ignoreRuleHints !== undefined) {
        configuration.ignoreRuleHints = entry.configuration.ignoreRuleHints;
    }
    if (entry.configuration.replacements) {
        configuration.replacements = entry.configuration.replacements.map((replacement) => ({ ...replacement }));
    }
    if (entry.configuration.adbHeader !== undefined) {
        configuration.adbHeader = entry.configuration.adbHeader;
    }

    return {
        ...entry,
        path: posix.normalize(entry.path).replace(/\/+$/, ''),
        configuration,
        defines: { ...entry.defines },
    };
};

/**
 * Merges a platform configuration patch into a base configuration.
 *
 * The function is pure: it does not change `base` or `patch`, and it returns a
 * new frozen configuration. An object merges key by key. An array replaces the
 * base array. An absent or `undefined` field inherits the base value. A `null`
 * field is removed from the result. `false` is a value for `ignoreRuleHints`;
 * for `removeRulePatterns`, `false` removes the field. A `removeRulePatterns`
 * entry is a string or a `RegExp`, and a string must compile as one.
 *
 * A patch key that is not in `base` adds a platform. The entry must then be
 * complete, and its `platform` must be a family that `base` already uses.
 *
 * A platform `path`, in `base` or in a patch, is normalized and must stay
 * inside the platforms output. A `path` must be unique among platforms; the
 * comparison is case-insensitive.
 * Every field of a legacy mac platform is patchable except its `path`, which
 * cannot change. An added legacy platform must use its `mac` or `mac_v2`
 * directory. Those directory names are reserved for legacy platforms.
 *
 * @param base Base configuration.
 * @param patch Platform patches.
 * @returns The merged and frozen configuration.
 * @throws {PlatformsConfigError} When a base path or a patch value is invalid.
 */
export const mergePlatformsConfig = (
    base: ReadonlyPlatformsConfig,
    patch: PlatformsConfigPatch,
): ReadonlyPlatformsConfig => {
    const patchObject = requireObject(patch, 'patch');

    // Clone every entry so freezing the result cannot freeze the caller's base.
    const result: PlatformsConfig = {};
    Object.keys(base).forEach((key) => {
        // JSON.parse creates __proto__ as an own key, and assignment runs the
        // __proto__ setter instead of adding an entry.
        if (key === '__proto__') {
            throw new PlatformsConfigError(`base.${key}`, 'reserved key');
        }
        result[key] = {
            ...cloneEntry(base[key]),
            path: requirePlatformPath(base[key].path, `base.${key}.path`),
        };
    });

    Object.keys(patchObject).forEach((key) => {
        const path = `patch.${key}`;
        if (key === '__proto__') {
            throw new PlatformsConfigError(path, 'reserved key');
        }
        if (patchObject[key] === undefined) {
            return;
        }
        const patchEntry = requireObject(patchObject[key], path);
        if (Object.hasOwn(base, key)) {
            mergePlatformEntry(result[key], patchEntry, path);
        } else {
            result[key] = createPlatformEntry(key, patchEntry, path);
        }
    });

    LEGACY_PLATFORMS.forEach((key) => {
        if (!Object.hasOwn(result, key)) {
            return;
        }
        // An existing legacy platform keeps the trusted base path; a newly
        // added one has no prior path, so it must use its legacy directory.
        const expectedPath = Object.hasOwn(base, key)
            ? requirePlatformPath(base[key].path, `base.${key}.path`)
            : platformsConfig[key].path;
        if (result[key].path !== expectedPath) {
            throw new PlatformsConfigError(
                `patch.${key}.path`,
                Object.hasOwn(base, key)
                    ? 'the path of a legacy platform cannot change'
                    : `a legacy platform must use the "${expectedPath}" directory`,
            );
        }
    });

    const families = new Set(Object.values(base).map((entry) => entry.platform));
    Object.keys(result).forEach((key) => {
        if (!families.has(result[key].platform)) {
            throw new PlatformsConfigError(
                `patch.${key}.platform`,
                `unknown platform family "${result[key].platform}"`,
            );
        }
    });

    // The JSON validator selects the legacy schemas by directory name, so no
    // other platform may end up in a legacy directory.
    const legacyPaths = new Set(LEGACY_PLATFORM_PATHS);
    Object.keys(result).forEach((key) => {
        const { path: platformPath } = result[key];
        const leaf = platformPath.slice(platformPath.lastIndexOf('/') + 1).toLowerCase();
        if (legacyPaths.has(leaf) && !LEGACY_PLATFORMS.includes(key)) {
            throw new PlatformsConfigError(
                `patch.${key}.path`,
                `the legacy directory "${leaf}" is reserved for a legacy platform`,
            );
        }
    });

    const paths = new Map<string, string>();
    Object.keys(result).forEach((key) => {
        const normalizedPath = result[key].path.toLowerCase();
        const other = paths.get(normalizedPath);
        if (other !== undefined) {
            const patchEntry = patchObject[key];
            const setsPath = isPlainObject(patchEntry)
                && Object.hasOwn(patchEntry, 'path')
                && patchEntry.path !== undefined;
            const offender = setsPath ? key : other;
            // A path that came from base is not a patch field.
            const offenderEntry = patchObject[offender];
            const offenderSetsPath = isPlainObject(offenderEntry)
                && Object.hasOwn(offenderEntry, 'path')
                && offenderEntry.path !== undefined;
            const prefix = offenderSetsPath ? 'patch' : 'base';
            throw new PlatformsConfigError(
                `${prefix}.${offender}.path`,
                `duplicate platform path "${result[key].path}" used by ${other} and ${key}`,
            );
        }
        paths.set(normalizedPath, key);
    });

    return deepFreeze(result);
};
