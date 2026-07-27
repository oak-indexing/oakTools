/**
 * Unit Tests for Index Definition Analyzer
 *
 * Run with: node js/indexDefAnalyzer.test.js
 */

const { analyzeIndexDefinitions } = require('./indexDefAnalyzer.js');

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

// Run the tests
if (require.main === module) {
    runner.run().catch(console.error);
}

module.exports = { TestRunner };
