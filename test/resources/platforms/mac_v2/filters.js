{
	"groups": [
		{
			"groupId": 1,
			"groupName": "Adguard Filters",
			"displayNumber": 1
		},
		{
			"groupId": 2,
			"groupName": "EasyList",
			"displayNumber": 2
		},
		{
			"groupId": 3,
			"groupName": "Other",
			"displayNumber": 100
		},
		{
			"groupId": 4,
			"groupName": "Directives",
			"displayNumber": 100
		},
		{
			"groupId": 5,
			"groupName": "Trust Levels tests",
			"displayNumber": 250
		}
	],
	"tags": [
		{
			"tagId": 1,
			"keyword": "purpose:ads"
		},
		{
			"tagId": 2,
			"keyword": "purpose:privacy"
		},
		{
			"tagId": 7,
			"keyword": "lang:en"
		},
		{
			"tagId": 41,
			"keyword": "lang:pl"
		},
		{
			"tagId": 10,
			"keyword": "recommended"
		},
		{
			"tagId": 46,
			"keyword": "obsolete"
		}
	],
	"filters": [
		{
			"filterId": 2,
			"name": "AdGuard Base filter",
			"description": "EasyList + AdGuard English filter. This filter is necessary for quality ad blocking.",
			"timeAdded": "2014-06-30T11:56:55+0400",
			"homepage": "https://easylist.adblockplus.org/",
			"expires": 43200,
			"displayNumber": 101,
			"groupId": 2,
			"deprecated": true,
			"subscriptionUrl": "https://filters.adtidy.org/mac_v2/filters/2.txt",
			"trustLevel": "full",
			"version": "1.0.0.2",
			"timeUpdated": "2025-06-19T19:04:20+0300",
			"languages": [
				"en",
				"pl"
			],
			"tags": [
				1,
				7,
				41,
				10
			],
			"downloadUrl": "https://filters.adtidy.org/mac_v2/filters/2.txt"
		},
		{
			"filterId": 4,
			"name": "Directives Filter",
			"description": "Directives Filter description",
			"timeAdded": "2014-06-30T11:56:55+0400",
			"homepage": "https://example.com/",
			"expires": 43200,
			"displayNumber": 101,
			"groupId": 2,
			"subscriptionUrl": "https://example.com/",
			"trustLevel": "full",
			"platformsIncluded": [
				"mac",
				"ios",
				"cli",
				"ext_ublock",
				"ext_edge",
				"ext_chromium_mv3"
			],
			"version": "1.0.0.0",
			"timeUpdated": "2025-06-19T18:55:24+0300",
			"deprecated": false,
			"languages": [],
			"tags": [],
			"downloadUrl": "https://filters.adtidy.org/mac_v2/filters/4.txt"
		},
		{
			"filterId": 5,
			"name": "Trust Level Test Filter",
			"description": "Trust Level Filter description",
			"timeAdded": "2014-06-30T11:56:55+0400",
			"homepage": "https://easylist.adblockplus.org/",
			"expires": 43200,
			"displayNumber": 101,
			"groupId": 5,
			"subscriptionUrl": "https://filters.adtidy.org/mac_v2/filters/5.txt",
			"trustLevel": "high",
			"version": "1.0.0.4",
			"timeUpdated": "2025-06-19T19:04:20+0300",
			"deprecated": false,
			"languages": [
				"en",
				"pl"
			],
			"tags": [
				1,
				7,
				41,
				10
			],
			"downloadUrl": "https://filters.adtidy.org/mac_v2/filters/5.txt"
		},
		{
			"filterId": 7,
			"name": "Test Platforms Filter",
			"description": "Test Filter description",
			"timeAdded": "2014-06-30T11:56:55+0400",
			"homepage": "https://easylist.adblockplus.org/",
			"expires": 43200,
			"displayNumber": 110,
			"groupId": 3,
			"subscriptionUrl": "https://easylist-downloads.adblockplus.org/easylist.txt",
			"trustLevel": "high",
			"platformsIncluded": [
				"mac",
				"ios",
				"chromium"
			],
			"version": "1.0.0.0",
			"timeUpdated": "2025-06-19T18:55:24+0300",
			"deprecated": false,
			"languages": [],
			"tags": [
				1,
				7,
				41
			],
			"downloadUrl": "https://filters.adtidy.org/mac_v2/filters/7.txt"
		},
		{
			"filterId": 10,
			"name": "Modifiers Filter",
			"description": "Modifiers Filter description",
			"timeAdded": "1970-01-20T18:42:26+0300",
			"homepage": "https://example.com/",
			"expires": 43200,
			"displayNumber": 130,
			"groupId": 5,
			"subscriptionUrl": "https://example.com/",
			"trustLevel": "high",
			"version": "1.0.0.0",
			"timeUpdated": "2025-06-19T18:55:24+0300",
			"deprecated": false,
			"languages": [],
			"tags": [
				1,
				7
			],
			"downloadUrl": "https://filters.adtidy.org/mac_v2/filters/10.txt"
		},
		{
			"filterId": 11,
			"name": "Ignore Trust Level Filter",
			"description": "description",
			"timeAdded": "2023-12-13T21:36:10+0300",
			"homepage": "https://example.com/",
			"expires": 43200,
			"displayNumber": 99,
			"groupId": 5,
			"subscriptionUrl": "https://raw.example.com/file.txt",
			"trustLevel": "low",
			"version": "1.0.0.0",
			"timeUpdated": "2025-06-19T18:58:50+0300",
			"deprecated": false,
			"languages": [],
			"tags": [
				1,
				7
			],
			"downloadUrl": "https://filters.adtidy.org/mac_v2/filters/11.txt"
		},
		{
			"filterId": 12,
			"name": "Remove Redundant Rules Filter",
			"description": "description",
			"timeAdded": "2023-12-13T21:36:10+0300",
			"homepage": "https://example.com/",
			"expires": 43200,
			"displayNumber": 99,
			"groupId": 5,
			"subscriptionUrl": "https://raw.example.com/file.txt",
			"trustLevel": "low",
			"version": "1.0.0.0",
			"timeUpdated": "2025-06-19T18:55:24+0300",
			"deprecated": false,
			"languages": [],
			"tags": [
				1,
				7
			],
			"downloadUrl": "https://filters.adtidy.org/mac_v2/filters/12.txt"
		},
		{
			"filterId": 13,
			"name": "Remove Diff-Path header tag",
			"description": "description",
			"timeAdded": "2023-12-13T21:36:10+0300",
			"homepage": "https://example.com/",
			"expires": 43200,
			"displayNumber": 99,
			"groupId": 5,
			"subscriptionUrl": "https://raw.example.com/file.txt",
			"trustLevel": "low",
			"version": "1.0.0.0",
			"timeUpdated": "2025-06-19T18:55:24+0300",
			"deprecated": false,
			"languages": [],
			"tags": [
				1,
				7
			],
			"downloadUrl": "https://filters.adtidy.org/mac_v2/filters/13.txt"
		}
	]
}