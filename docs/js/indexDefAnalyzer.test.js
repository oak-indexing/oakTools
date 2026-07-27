/**
 * Unit Tests for Index Definition Analyzer
 *
 * Run with: node js/indexDefAnalyzer.test.js
 */

const { analyzeIndexDefinitions, diffAllowedValueChanges } = require('./indexDefAnalyzer.js');

// Simple test framework
class TestRunner {
    constructor() {
        this.tests = [];
        this.passed = 0;
        this.failed = 0;
    }

    test(name, testFn) {
        this.tests.push({ name, testFn });
    }

    assertEqual(actual, expected, message = '') {
        if (JSON.stringify(actual) === JSON.stringify(expected)) {
            return true;
        } else {
            throw new Error(`Assertion failed ${message}:
Expected: ${JSON.stringify(expected, null, 2)}
Actual: ${JSON.stringify(actual, null, 2)}`);
        }
    }

    async run() {
        console.log('🧪 Running Index Definition Analyzer Tests...\n');

        for (const { name, testFn } of this.tests) {
            try {
                await testFn.call(this);
                console.log(`✅ ${name}`);
                this.passed++;
            } catch (error) {
                console.log(`❌ ${name}`);
                console.log(`   Error: ${error.message}\n`);
                this.failed++;
            }
        }

        console.log(`\n📊 Test Results: ${this.passed} passed, ${this.failed} failed`);

        if (this.failed > 0) {
            process.exit(1);
        }
    }
}

// Test Suite
const runner = new TestRunner();

runner.test('Should surface an aggregates-only customization (nt:folder DAM Lucene index)', function() {
    // Arrange
    const input = {
        "/oak:index/ntFolderDamLucene-10": {
            "jcr:primaryType": "nam:oak:QueryIndexDefinition",
            "compatVersion": 2,
            "includedPaths": ["/content/dam"],
            "queryPaths": ["/content/dam"],
            "tags": ["assetsListing", "assetsOmnisearch"],
            "type": "lucene",
            "async": ["async", "nrt"],
            "evaluatePathRestrictions": true,
            "aggregates": {
                "jcr:primaryType": "nam:nt:unstructured",
                "nt:folder": {
                    "jcr:primaryType": "nam:nt:unstructured",
                    "include0": {
                        "jcr:primaryType": "nam:nt:unstructured",
                        "path": "str:jcr:content"
                    }
                }
            },
            "indexRules": {
                "jcr:primaryType": "nam:nt:unstructured",
                "nt:folder": {
                    "jcr:primaryType": "nam:nt:unstructured",
                    "properties": {
                        "jcr:primaryType": "nam:nt:unstructured",
                        "jcrTitle": {
                            "jcr:primaryType": "nam:nt:unstructured",
                            "nodeScopeIndex": true,
                            "useInSuggest": true,
                            "useInSpellcheck": true,
                            "name": "str:jcr:content/jcr:title"
                        }
                    }
                }
            }
        },
        "/oak:index/ntFolderDamLucene-10-custom-3": {
            "jcr:primaryType": "nam:oak:QueryIndexDefinition",
            "compatVersion": 2,
            "includedPaths": ["/content/dam"],
            "queryPaths": ["/content/dam"],
            "tags": ["assetsListing", "assetsOmnisearch"],
            "type": "lucene",
            "async": ["async", "nrt"],
            "evaluatePathRestrictions": true,
            "aggregates": {
                "jcr:primaryType": "nam:nt:unstructured",
                "nt:folder": {
                    "jcr:primaryType": "nam:nt:unstructured",
                    "include0": {
                        "jcr:primaryType": "nam:nt:unstructured",
                        "path": "str:jcr:content"
                    }
                },
                "sling:Folder": {
                    "jcr:primaryType": "nam:nt:unstructured",
                    "include1": {
                        "jcr:primaryType": "nam:nt:unstructured",
                        "path": "str:jcr:content/metadata"
                    },
                    "include0": {
                        "jcr:primaryType": "nam:nt:unstructured",
                        "path": "str:jcr:content"
                    }
                }
            },
            "indexRules": {
                "jcr:primaryType": "nam:nt:unstructured",
                "nt:folder": {
                    "jcr:primaryType": "nam:nt:unstructured",
                    "properties": {
                        "jcr:primaryType": "nam:nt:unstructured",
                        "jcrTitle": {
                            "jcr:primaryType": "nam:nt:unstructured",
                            "nodeScopeIndex": true,
                            "useInSuggest": true,
                            "useInSpellcheck": true,
                            "name": "str:jcr:content/jcr:title"
                        }
                    }
                }
            }
        }
    };

    const expected = {
        error: null,
        result: {
            ntFolderDamLucene: {
                aggregates: {
                    "sling:Folder": {
                        include1: { path: "jcr:content/metadata" },
                        include0: { path: "jcr:content" }
                    }
                }
            }
        },
        commentLines: []
    };

    // Act
    const actual = analyzeIndexDefinitions(input);

    // Assert
    this.assertEqual(actual, expected, 'Should keep only the aggregates addition (sling:Folder) as the diff for the custom index, not drop it');
});

runner.test('Should report invalid JSON as an error', function() {
    const actual = analyzeIndexDefinitions('{ not valid json');
    this.assertEqual(actual.result, null, 'Result should be null on parse failure');
    if (!actual.error || !actual.error.startsWith('Invalid JSON')) {
        throw new Error(`Expected an "Invalid JSON" error, got: ${JSON.stringify(actual.error)}`);
    }
});

runner.test('Should strip mergeInfo/mergeChecksum and preserve the allowed facets.secure change', function() {
    // Arrange
    const input = {
        "/oak:index/damAssetLucene-13-custom-3": {
            "jcr:primaryType": "nam:oak:QueryIndexDefinition",
            "compatVersion": 2,
            "maxFieldLength": 100000,
            ":mappingVersion": "1.4.0",
            ":version": 2,
            "includedPaths": ["/content/dam", "/content/launches"],
            "merges": ["/oak:index/damAssetLucene"],
            "type@lucene": "lucene",
            "tags": ["visualSimilaritySearch", "assetsOmnisearch", "launchesForContentFragments"],
            "type": "elasticsearch",
            "async": ["elastic-async"],
            "mergeChecksum": "33c89f43e92a0f92418b334c99627fe49a19c2843c1846989a3e549534e378ae",
            "async@lucene": ["async", "nrt"],
            "evaluatePathRestrictions": true,
            "refresh": true,
            "reindex": false,
            "reindexCount": 2,
            "mergeInfo": "This index was auto-merged. See also https://oak-indexing.github.io/oakTools/simplified.html",
            "facets": {
                "jcr:primaryType": "nam:nt:unstructured",
                "topChildren": "100",
                "secure": "statistical"
            },
            "indexRules": {
                "jcr:primaryType": "nam:nt:unstructured",
                "dam:Asset": {
                    "jcr:primaryType": "nam:nt:unstructured",
                    "includePropertyTypes": ["String", "Binary"],
                    "properties": {
                        "jcr:primaryType": "nam:nt:unstructured",
                        "cqTags": {
                            "jcr:primaryType": "nam:nt:unstructured",
                            "nodeScopeIndex": true,
                            "useInSuggest": true,
                            "propertyIndex": true,
                            "useInSpellcheck": true,
                            "name": "str:jcr:content/metadata/cq:tags"
                        }
                    }
                }
            }
        },
        "/oak:index/damAssetLucene-13": {
            "jcr:primaryType": "nam:oak:QueryIndexDefinition",
            "compatVersion": 2,
            "maxFieldLength": 100000,
            ":mappingVersion": "1.4.0",
            ":version": 2,
            "includedPaths": ["/content/dam", "/content/launches"],
            "type@lucene": "lucene",
            "seed": -1858047931834545215,
            "tags": ["visualSimilaritySearch", "assetsOmnisearch", "launchesForContentFragments"],
            "type": "elasticsearch",
            ":nameSeed": 7856111937726073111,
            "async": ["elastic-async"],
            "async@lucene": ["async", "nrt"],
            "evaluatePathRestrictions": true,
            "refresh": true,
            "reindex": false,
            "reindexCount": 2,
            "facets": {
                "jcr:primaryType": "nam:nt:unstructured",
                "topChildren": "100",
                "secure": "insecure"
            },
            "indexRules": {
                "jcr:primaryType": "nam:nt:unstructured",
                "dam:Asset": {
                    "jcr:primaryType": "nam:nt:unstructured",
                    "includePropertyTypes": ["String", "Binary"],
                    "properties": {
                        "jcr:primaryType": "nam:nt:unstructured",
                        "cqTags": {
                            "jcr:primaryType": "nam:nt:unstructured",
                            "nodeScopeIndex": true,
                            "useInSuggest": true,
                            "propertyIndex": true,
                            "useInSpellcheck": true,
                            "name": "str:jcr:content/metadata/cq:tags"
                        }
                    }
                }
            }
        }
    };

    // mergeInfo/mergeChecksum are stripped during cleanup, so they no longer leak
    // through as spurious "added" diff entries. The actual customization here -
    // facets.secure changed from "insecure" to "statistical" - is a value change on
    // an allowed-to-tune property, so it must still surface in the diff even though
    // it isn't a newly added key.
    const expected = {
        error: null,
        result: {
            damAssetLucene: {
                facets: {
                    secure: "statistical"
                }
            }
        },
        commentLines: []
    };

    // Act
    const actual = analyzeIndexDefinitions(input);

    // Assert
    this.assertEqual(actual, expected, 'Should strip mergeInfo/mergeChecksum and preserve the allowed facets.secure value change');
});

runner.test('diffAllowedValueChanges should capture boost/weight/secure changes at any depth, and ignore others', function() {
    const base = {
        indexRules: {
            'dam:Asset': {
                properties: {
                    title: { boost: 2, propertyIndex: true },
                    tags: { weight: 5 }
                }
            }
        },
        facets: { secure: 'insecure' },
        maxFieldLength: 100000
    };
    const current = {
        indexRules: {
            'dam:Asset': {
                properties: {
                    title: { boost: 4, propertyIndex: true },
                    tags: { weight: 5 }
                }
            }
        },
        facets: { secure: 'statistical' },
        maxFieldLength: 200000
    };

    const expected = {
        indexRules: {
            'dam:Asset': {
                properties: {
                    title: { boost: 4 }
                }
            }
        },
        facets: { secure: 'statistical' }
    };

    this.assertEqual(diffAllowedValueChanges(base, current), expected,
        'Should only surface boost/weight/secure value changes, not unrelated properties like maxFieldLength');
});

// Run the tests
if (require.main === module) {
    runner.run().catch(console.error);
}

module.exports = { TestRunner };
