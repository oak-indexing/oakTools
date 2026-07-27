/**
 * Unit Tests for Diff Index Verifier
 *
 * Run with: node js/diffIndexVerifier.test.js
 */

const { validateDiffIndex } = require('./diffIndexVerifier.js');

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
        console.log('🧪 Running Diff Index Verifier Tests...\n');

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

runner.test('validateFacetConfig should FAIL when facets.secure is "secure"', function() {
    // Arrange
    const input = {
        "damAssetLucene": {
            "facets": {
                "secure": "secure"
            }
        }
    };

    // Act
    const lines = validateDiffIndex(input);

    // Assert
    const facetLines = lines.filter(l => l.startsWith('validateFacetConfig'));
    this.assertEqual(facetLines, [
        'validateFacetConfig: FAIL "damAssetLucene" — facets.secure must not be "secure"; use "insecure" or "statistical" instead to ensure facets are fast.'
    ], 'Should fail validateFacetConfig when facets.secure is set to the literal value "secure"');
});

runner.test('validateFacetConfig should PASS when facets.secure is a different value', function() {
    // Arrange
    const insecureInput = {
        "damAssetLucene": {
            "facets": {
                "secure": "insecure"
            }
        }
    };
    const statisticalInput = {
        "damAssetLucene": {
            "facets": {
                "secure": "statistical"
            }
        }
    };

    // Act
    const insecureLines = validateDiffIndex(insecureInput).filter(l => l.startsWith('validateFacetConfig'));
    const statisticalLines = validateDiffIndex(statisticalInput).filter(l => l.startsWith('validateFacetConfig'));

    // Assert
    this.assertEqual(insecureLines, ['validateFacetConfig: OK'], 'Should pass when facets.secure is "insecure"');
    this.assertEqual(statisticalLines, ['validateFacetConfig: OK'], 'Should pass when facets.secure is "statistical"');
});

// Run the tests
if (require.main === module) {
    runner.run().catch(console.error);
}

module.exports = { TestRunner };
