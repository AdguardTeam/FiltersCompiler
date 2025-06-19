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
	"filters": [
		{
			"filterId": 2,
			"name": "AdGuard Base filter",
			"description": "EasyList + AdGuard English filter. This filter is necessary for quality ad blocking.",
			"homepage": "https://easylist.adblockplus.org/",
			"expires": 43200,
			"displayNumber": 101,
			"groupId": 2,
			"subscriptionUrl": "https://filters.adtidy.org/mac/filters/2.txt",
			"version": "1.0.0.2",
			"timeUpdated": "2025-06-19T19:04:20+0300",
			"languages": [
				"en",
				"pl"
			]
		},
		{
			"filterId": 4,
			"name": "Directives Filter",
			"description": "Directives Filter description",
			"homepage": "https://example.com/",
			"expires": 43200,
			"displayNumber": 101,
			"groupId": 2,
			"subscriptionUrl": "https://example.com/",
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
			"languages": []
		},
		{
			"filterId": 5,
			"name": "Trust Level Test Filter",
			"description": "Trust Level Filter description",
			"homepage": "https://easylist.adblockplus.org/",
			"expires": 43200,
			"displayNumber": 101,
			"groupId": 5,
			"subscriptionUrl": "https://filters.adtidy.org/mac/filters/5.txt",
			"version": "1.0.0.4",
			"timeUpdated": "2025-06-19T19:04:20+0300",
			"languages": [
				"en",
				"pl"
			]
		},
		{
			"filterId": 6,
			"name": "Obsolete Test Filter",
			"description": "Obsolete Test Filter description",
			"homepage": "https://easylist.adblockplus.org/",
			"expires": 43200,
			"displayNumber": 200,
			"groupId": 3,
			"subscriptionUrl": "https://filters.adtidy.org/mac/filters/6.txt",
			"version": "1.0.0.0",
			"timeUpdated": "2025-06-19T18:55:24+0300",
			"languages": []
		},
		{
			"filterId": 7,
			"name": "Test Platforms Filter",
			"description": "Test Filter description",
			"homepage": "https://easylist.adblockplus.org/",
			"expires": 43200,
			"displayNumber": 110,
			"groupId": 3,
			"subscriptionUrl": "https://easylist-downloads.adblockplus.org/easylist.txt",
			"platformsIncluded": [
				"mac",
				"ios",
				"chromium"
			],
			"version": "1.0.0.0",
			"timeUpdated": "2025-06-19T18:55:24+0300",
			"languages": []
		},
		{
			"filterId": 10,
			"name": "Modifiers Filter",
			"description": "Modifiers Filter description",
			"homepage": "https://example.com/",
			"expires": 43200,
			"displayNumber": 130,
			"groupId": 5,
			"subscriptionUrl": "https://example.com/",
			"version": "1.0.0.0",
			"timeUpdated": "2025-06-19T18:55:24+0300",
			"languages": []
		},
		{
			"filterId": 11,
			"name": "Ignore Trust Level Filter",
			"description": "description",
			"homepage": "https://example.com/",
			"expires": 43200,
			"displayNumber": 99,
			"groupId": 5,
			"subscriptionUrl": "https://raw.example.com/file.txt",
			"version": "1.0.0.0",
			"timeUpdated": "2025-06-19T18:58:50+0300",
			"languages": []
		},
		{
			"filterId": 12,
			"name": "Remove Redundant Rules Filter",
			"description": "description",
			"homepage": "https://example.com/",
			"expires": 43200,
			"displayNumber": 99,
			"groupId": 5,
			"subscriptionUrl": "https://raw.example.com/file.txt",
			"version": "1.0.0.0",
			"timeUpdated": "2025-06-19T18:55:24+0300",
			"languages": []
		},
		{
			"filterId": 13,
			"name": "Remove Diff-Path header tag",
			"description": "description",
			"homepage": "https://example.com/",
			"expires": 43200,
			"displayNumber": 99,
			"groupId": 5,
			"subscriptionUrl": "https://raw.example.com/file.txt",
			"version": "1.0.0.0",
			"timeUpdated": "2025-06-19T18:55:24+0300",
			"languages": []
		}
	]
}