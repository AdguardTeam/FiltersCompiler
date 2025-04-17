/**
 * @file
 * This is a temporary solution for default strings in filters_i18n.json.
 *
 * TODO: probably refactoring should be considered so this data is passed from the filters registry AG-41700.
 */

const { NAME_KEY, DESCRIPTION_KEY } = require('./constants');

/**
 * Default data for groups, where keys are ids of AdGuard-supported groups.
 */
const GROUPS_DEFAULT_DATA = {
    1: {
        [NAME_KEY]: 'Ad blocking',
        [DESCRIPTION_KEY]: 'Block ads',
    },
    2: {
        [NAME_KEY]: 'Privacy',
        [DESCRIPTION_KEY]: 'Block trackers',
    },
    3: {
        [NAME_KEY]: 'Social widgets',
        [DESCRIPTION_KEY]: 'Block social media elements such as Like and Share buttons',
    },
    4: {
        [NAME_KEY]: 'Annoyances',
        [DESCRIPTION_KEY]: 'Block annoying web elements, such as cookie notices or in-page popups',
    },
    5: {
        [NAME_KEY]: 'Security',
        [DESCRIPTION_KEY]: 'Block requests to phishing and malicious websites',
    },
    6: {
        [NAME_KEY]: 'Other',
        [DESCRIPTION_KEY]: 'This group contains various filters that don\'t fit into other categories',
    },
    7: {
        [NAME_KEY]: 'Language-specific',
        [DESCRIPTION_KEY]: 'Block ads on websites in specified languages',
    },
};

/**
 * Default data for filters, where keys are ids of AdGuard-supported filters.
 */
const FILTERS_DEFAULT_DATA = {
    1: {
        [NAME_KEY]: 'AdGuard Russian filter',
        [DESCRIPTION_KEY]: 'Filter that enables ad blocking on websites in the Russian language.',
    },
    2: {
        [NAME_KEY]: 'AdGuard Base filter',
        [DESCRIPTION_KEY]: 'EasyList + AdGuard Base filter. This filter is necessary for quality ad blocking.',
    },
    3: {
        [NAME_KEY]: 'AdGuard Tracking Protection filter',
        // eslint-disable-next-line max-len
        [DESCRIPTION_KEY]: 'The most comprehensive list of various online counters and web analytics tools. Use this filter, if you do not want your actions on the Internet to be tracked.',
    },
    4: {
        [NAME_KEY]: 'AdGuard Social Media filter',
        [DESCRIPTION_KEY]: 'Filter for social media widgets ("Like" buttons and such).',
    },
    5: {
        [NAME_KEY]: 'AdGuard Experimental filter',
        // eslint-disable-next-line max-len
        [DESCRIPTION_KEY]: 'Filter designed to test certain hazardous filtering rules before they are added to the basic filters.',
    },
    6: {
        [NAME_KEY]: 'AdGuard German filter',
        // eslint-disable-next-line max-len
        [DESCRIPTION_KEY]: 'EasyList Germany + AdGuard German filter. Filter list that specifically removes ads on websites in the German language.',
    },
    7: {
        [NAME_KEY]: 'AdGuard Japanese filter',
        [DESCRIPTION_KEY]: 'Filter that enables ad blocking on websites in the Japanese language.',
    },
    8: {
        [NAME_KEY]: 'AdGuard Dutch filter',
        // eslint-disable-next-line max-len
        [DESCRIPTION_KEY]: 'EasyList Dutch + AdGuard Dutch filter. Filter list that specifically removes ads on websites in the Dutch language.',
    },
    9: {
        [NAME_KEY]: 'AdGuard Spanish/Portuguese filter',
        // eslint-disable-next-line max-len
        [DESCRIPTION_KEY]: 'Filter list that specifically removes ads on websites in Spanish, Portuguese, and Brazilian Portuguese languages.',
    },
    10: {
        [NAME_KEY]: 'Filter unblocking search ads and self-promotion',
        // eslint-disable-next-line max-len
        [DESCRIPTION_KEY]: 'Filter that unblocks search ads in Google, DuckDuckGo, Bing, or Yahoo and self-promotion on websites.',
    },
    11: {
        [NAME_KEY]: 'AdGuard Mobile Ads filter',
        [DESCRIPTION_KEY]: 'Filter for all known mobile ad networks. Useful for mobile devices.',
    },
    // 12 is obsolete and removed
    13: {
        [NAME_KEY]: 'AdGuard Turkish filter',
        [DESCRIPTION_KEY]: 'Filter list that specifically removes ads on websites in the Turkish language.',
    },
    14: {
        [NAME_KEY]: 'AdGuard Annoyances filter',
        // eslint-disable-next-line max-len
        [DESCRIPTION_KEY]: 'Blocks irritating elements on web pages including cookie notices, third-party widgets and in-page pop-ups. Contains the following AdGuard filters: Cookie Notices, Popups, Mobile App Banners, Other Annoyances and Widgets.',
    },
    15: {
        [NAME_KEY]: 'AdGuard DNS filter',
        // eslint-disable-next-line max-len
        [DESCRIPTION_KEY]: 'Filter composed of several other filters (AdGuard Base filter, Social Media filter, Tracking Protection filter, Mobile Ads filter, EasyList and EasyPrivacy) and simplified specifically to be better compatible with DNS-level ad blocking.',
    },
    16: {
        [NAME_KEY]: 'AdGuard French filter',
        // eslint-disable-next-line max-len
        [DESCRIPTION_KEY]: 'Liste FR + AdGuard French filter. Filter list that specifically removes ads on websites in the French language.',
    },
    17: {
        [NAME_KEY]: 'AdGuard URL Tracking filter',
        [DESCRIPTION_KEY]: 'Filter that enhances privacy by removing tracking parameters from URLs.',
    },
    18: {
        [NAME_KEY]: 'AdGuard Cookie Notices filter',
        [DESCRIPTION_KEY]: 'Blocks cookie notices on web pages.',
    },
    19: {
        [NAME_KEY]: 'AdGuard Popups filter',
        // eslint-disable-next-line max-len
        [DESCRIPTION_KEY]: 'Blocks all kinds of pop-ups that are not necessary for websites\' operation according to our Filter policy.',
    },
    20: {
        [NAME_KEY]: 'AdGuard Mobile App Banners filter',
        [DESCRIPTION_KEY]: 'Blocks irritating banners that promote mobile apps of websites.',
    },
    21: {
        [NAME_KEY]: 'AdGuard Other Annoyances filter',
        // eslint-disable-next-line max-len
        [DESCRIPTION_KEY]: 'Blocks irritating elements on web pages that do not fall under the popular categories of annoyances.',
    },
    22: {
        [NAME_KEY]: 'AdGuard Widgets filter',
        [DESCRIPTION_KEY]: 'Blocks annoying third-party widgets: online assistants, live support chats, etc.',
    },
    23: {
        [NAME_KEY]: 'AdGuard Ukrainian filter',
        [DESCRIPTION_KEY]: 'Filter that enables ad blocking on websites in the Ukrainian language.',
    },
    224: {
        [NAME_KEY]: 'AdGuard Chinese filter',
        // eslint-disable-next-line max-len
        [DESCRIPTION_KEY]: 'EasyList China + AdGuard Chinese filter. Filter list that specifically removes ads on websites in Chinese language.',
    },
};

/**
 * Default data for tags, where keys are ids of AdGuard-supported tags.
 */
const TAGS_DEFAULT_DATA = {
    1: {
        [NAME_KEY]: 'Ad Blocking',
        [DESCRIPTION_KEY]: 'Designed to block ads online',
    },
    2: {
        [NAME_KEY]: 'Privacy protection',
        [DESCRIPTION_KEY]: 'Designed to protect your privacy online by blocking trackers and analytics',
    },
    3: {
        [NAME_KEY]: 'Social widgets blocking',
        [DESCRIPTION_KEY]: 'Designed to block social media elements (widgets, "Like" buttons, etc.)',
    },
    4: {
        [NAME_KEY]: 'Protection against malware and fraud',
        [DESCRIPTION_KEY]: 'Designed to protect you from malicious and dangerous websites',
    },
    5: {
        [NAME_KEY]: 'Anti-annoyances protection',
        // eslint-disable-next-line max-len
        [DESCRIPTION_KEY]: 'Designed to block non-ads elements that distract you from the content (subscription offers, promotion notices, etc.).',
    },
    6: {
        [NAME_KEY]: 'Cookie notices blocking',
        [DESCRIPTION_KEY]: 'Designed to block cookie notices on websites',
    },
    7: {
        [NAME_KEY]: 'English language-specific ad blocking',
        [DESCRIPTION_KEY]: 'Designed specifically to block ads on web pages in the English language',
    },
    8: {
        [NAME_KEY]: 'Russian language-specific ad blocking',
        [DESCRIPTION_KEY]: 'Designed specifically to block ads on web pages in the Russian language',
    },
    9: {
        [NAME_KEY]: 'EasyList reference',
        [DESCRIPTION_KEY]: 'Has references to the EasyList filter',
    },
    10: {
        [NAME_KEY]: 'AdGuard recommendation',
        [DESCRIPTION_KEY]: 'Recommended to use with AdGuard ad blocker',
    },
    11: {
        [NAME_KEY]: 'AdGuard Base filter reference',
        [DESCRIPTION_KEY]: 'Has references to the AdGuard Base filter',
    },
    12: {
        [NAME_KEY]: 'German language-specific ad blocking',
        [DESCRIPTION_KEY]: 'Designed specifically to block ads on web pages in the German language',
    },
    13: {
        [NAME_KEY]: 'EasyList Germany filter reference',
        [DESCRIPTION_KEY]: 'Has references to the EasyList Germany filter',
    },
    14: {
        [NAME_KEY]: 'Japanese language-specific ad blocking',
        [DESCRIPTION_KEY]: 'Designed specifically to block ads on web pages in the Japanese language',
    },
    15: {
        [NAME_KEY]: 'Dutch language-specific ad blocking',
        [DESCRIPTION_KEY]: 'Designed specifically to block ads on web pages in the Dutch language',
    },
    16: {
        [NAME_KEY]: 'EasyList Dutch filter reference',
        [DESCRIPTION_KEY]: 'Has references to the EasyList Dutch filter',
    },
    17: {
        [NAME_KEY]: 'Spanish language-specific ad blocking',
        [DESCRIPTION_KEY]: 'Designed specifically to block ads on web pages in the Spanish language',
    },
    18: {
        [NAME_KEY]: 'Portuguese language-specific ad blocking',
        [DESCRIPTION_KEY]: 'Designed specifically to block ads on web pages in the Portuguese language',
    },
    19: {
        [NAME_KEY]: 'For mobile devices',
        [DESCRIPTION_KEY]: 'Designed specifically to block ads and trackers on mobile devices',
    },
    20: {
        [NAME_KEY]: 'Compatibility',
        [DESCRIPTION_KEY]: 'Contains set of rules to fix compatibility issues',
    },
    21: {
        [NAME_KEY]: 'iOS-specific',
        [DESCRIPTION_KEY]: 'Designed specifically to work on iOS-based devices',
    },
    22: {
        [NAME_KEY]: 'Safari-specific',
        [DESCRIPTION_KEY]: 'Designed specifically to work with Safari browser content blockers',
    },
    23: {
        [NAME_KEY]: 'Specific for AdGuard Content Blocker',
        [DESCRIPTION_KEY]: 'Designed specifically to work with AdGuard Content Blocker',
    },
    24: {
        [NAME_KEY]: 'Turkish language-specific ad blocking',
        [DESCRIPTION_KEY]: 'Designed specifically to block ads on web pages in the Turkish language',
    },
    25: {
        [NAME_KEY]: 'Tracking Protection filter reference',
        [DESCRIPTION_KEY]: 'Has references to the Tracking Protection filter',
    },
    26: {
        [NAME_KEY]: 'Mobile Ads filter reference',
        [DESCRIPTION_KEY]: 'Has references to the Mobile Ads filter',
    },
    27: {
        [NAME_KEY]: 'French language-specific ad blocking',
        [DESCRIPTION_KEY]: 'Designed specifically to block ads on web pages in the French language',
    },
    28: {
        [NAME_KEY]: 'Liste FR filter reference',
        [DESCRIPTION_KEY]: 'Has references to the Liste FR filter',
    },
    29: {
        [NAME_KEY]: 'Indonesian language-specific ad blocking',
        [DESCRIPTION_KEY]: 'Designed specifically to block ads on web pages in the Indonesian language',
    },
    30: {
        [NAME_KEY]: 'Bulgarian language-specific ad blocking',
        [DESCRIPTION_KEY]: 'Designed specifically to block ads on web pages in the Bulgarian language',
    },
    31: {
        [NAME_KEY]: 'Chinese language-specific ad blocking',
        [DESCRIPTION_KEY]: 'Designed specifically to block ads on web pages in the Chinese language',
    },
    32: {
        [NAME_KEY]: 'Czech language-specific ad blocking',
        [DESCRIPTION_KEY]: 'Designed specifically to block ads on web pages in the Czech language',
    },
    33: {
        [NAME_KEY]: 'Slovak language-specific ad blocking',
        [DESCRIPTION_KEY]: 'Designed specifically to block ads on web pages in the Slovak language',
    },
    34: {
        [NAME_KEY]: 'Hebrew language-specific ad blocking',
        [DESCRIPTION_KEY]: 'Designed specifically to block ads on web pages in the Hebrew language',
    },
    35: {
        [NAME_KEY]: 'Italian language-specific ad blocking',
        [DESCRIPTION_KEY]: 'Designed specifically to block ads on web pages in the Italian language',
    },
    36: {
        [NAME_KEY]: 'Latvian language-specific ad blocking',
        [DESCRIPTION_KEY]: 'Designed specifically to block ads on web pages in the Latvian language',
    },
    37: {
        [NAME_KEY]: 'Lithuanian language-specific ad blocking',
        [DESCRIPTION_KEY]: 'Designed specifically to block ads on web pages in the Lithuanian language',
    },
    38: {
        [NAME_KEY]: 'Arabic language-specific ad blocking',
        [DESCRIPTION_KEY]: 'Designed specifically to block ads on web pages in the Arabic language',
    },
    39: {
        [NAME_KEY]: 'Romanian language-specific ad blocking',
        [DESCRIPTION_KEY]: 'Designed specifically to block ads on web pages in the Romanian language',
    },
    40: {
        [NAME_KEY]: 'Finnish language-specific ad blocking',
        [DESCRIPTION_KEY]: 'Designed specifically to block ads on web pages in the Finnish language',
    },
    41: {
        [NAME_KEY]: 'Polish language-specific ad blocking',
        [DESCRIPTION_KEY]: 'Designed specifically to block ads on web pages in the Polish language',
    },
    42: {
        [NAME_KEY]: 'Icelandic language-specific ad blocking',
        [DESCRIPTION_KEY]: 'Designed specifically to block ads on web pages in the Icelandic language',
    },
    43: {
        [NAME_KEY]: 'Norwegian language-specific ad blocking',
        [DESCRIPTION_KEY]: 'Designed specifically to block ads on web pages in the Norwegian language',
    },
    44: {
        [NAME_KEY]: 'Greek language-specific ad blocking',
        [DESCRIPTION_KEY]: 'Designed specifically to block ads on web pages in the Greek language',
    },
    45: {
        [NAME_KEY]: 'Potentially problematic',
        [DESCRIPTION_KEY]: 'Can cause issues depending on your ad blocker and the specific website',
    },
    46: {
        [NAME_KEY]: 'Obsolete',
        [DESCRIPTION_KEY]: 'Outdated or not supported anymore',
    },
    47: {
        [NAME_KEY]: 'Czech language-specific ad blocking',
        [DESCRIPTION_KEY]: 'Designed specifically to block ads on web pages in the Czech language',
    },
    48: {
        [NAME_KEY]: 'Hungarian language-specific ad blocking',
        [DESCRIPTION_KEY]: 'Designed specifically to block ads on web pages in the Hungarian language',
    },
    49: {
        [NAME_KEY]: 'Danish language-specific ad blocking',
        [DESCRIPTION_KEY]: 'Designed specifically to block ads on web pages in the Danish language',
    },
    50: {
        [NAME_KEY]: 'Protection from adblock circumvention scripts',
        [DESCRIPTION_KEY]: 'Designed to resist adblock circumvention scripts on websites',
    },
    51: {
        [NAME_KEY]: 'Cookie alerts blocking',
        [DESCRIPTION_KEY]: "Designed to block websites' alerts about cookie policies",
    },
    52: {
        [NAME_KEY]: 'Vietnamese language-specific ad blocking',
        [DESCRIPTION_KEY]: 'Designed specifically to block ads on web pages in the Vietnamese language',
    },
    53: {
        [NAME_KEY]: 'Estonian language-specific ad blocking',
        [DESCRIPTION_KEY]: 'Designed specifically to block ads on web pages in the Estonian language',
    },
    54: {
        [NAME_KEY]: 'Persian language-specific ad blocking',
        [DESCRIPTION_KEY]: 'Designed specifically to block ads on web pages in the Persian language',
    },
    55: {
        [NAME_KEY]: 'Swedish language-specific ad blocking',
        [DESCRIPTION_KEY]: 'Designed specifically to block ads on web pages in the Swedish language',
    },
    56: {
        [NAME_KEY]: 'Korean language-specific ad blocking',
        [DESCRIPTION_KEY]: 'Designed specifically to block ads on web pages in the Korean language',
    },
    57: {
        [NAME_KEY]: 'ROList filter reference',
        [DESCRIPTION_KEY]: 'Has references to the ROList filter',
    },
    58: {
        [NAME_KEY]: 'EasyPrivacy filter reference',
        [DESCRIPTION_KEY]: 'Has references to the EasyPrivacy filter',
    },
    59: {
        [NAME_KEY]: 'ABPindo filter reference',
        [DESCRIPTION_KEY]: 'Has references to the ABPindo filter',
    },
    60: {
        [NAME_KEY]: 'AdGuard Turkish filter reference',
        [DESCRIPTION_KEY]: 'Has references to the AdGuard Turkish filter',
    },
    61: {
        [NAME_KEY]: 'AdGuard French filter reference',
        [DESCRIPTION_KEY]: 'Has references to the AdGuard French filter',
    },
    62: {
        [NAME_KEY]: 'Polish Annoyance filter reference',
        [DESCRIPTION_KEY]: 'Has references to the Polish Annoyance filter',
    },
    63: {
        [NAME_KEY]: 'Faroese language-specific ad blocking',
        [DESCRIPTION_KEY]: 'Designed specifically to block ads on web pages in the Faroese language',
    },
    64: {
        [NAME_KEY]: 'Thai language-specific ad blocking',
        [DESCRIPTION_KEY]: 'Designed specifically to block ads on web pages in the Thai language',
    },
    65: {
        [NAME_KEY]: 'Serbian language-specific ad blocking',
        [DESCRIPTION_KEY]: 'Designed specifically to block ads on web pages in the Serbian language',
    },
    66: {
        [NAME_KEY]: 'Croatian language-specific ad blocking',
        [DESCRIPTION_KEY]: 'Designed specifically to block ads on web pages in the Croatian language',
    },
    67: {
        [NAME_KEY]: 'Hindi language-specific ad blocking',
        [DESCRIPTION_KEY]: 'Designed specifically to block ads on web pages in the Hindi language',
    },
    68: {
        [NAME_KEY]: 'Ukrainian language-specific ad blocking',
        [DESCRIPTION_KEY]: 'Designed specifically to block ads on web pages in the Ukrainian language',
    },
    69: {
        [NAME_KEY]: 'Tajik language-specific ad blocking',
        [DESCRIPTION_KEY]: 'Designed specifically to block ads on web pages in the Tajik language',
    },
    70: {
        [NAME_KEY]: 'Pashto language-specific ad blocking',
        [DESCRIPTION_KEY]: 'Designed specifically to block ads on web pages in the Pashto language',
    },
    71: {
        [NAME_KEY]: 'Macedonian language-specific ad blocking',
        [DESCRIPTION_KEY]: 'Designed specifically to block ads on web pages in the Macedonian language',
    },
};

module.exports = {
    GROUPS_DEFAULT_DATA,
    FILTERS_DEFAULT_DATA,
    TAGS_DEFAULT_DATA,
};
