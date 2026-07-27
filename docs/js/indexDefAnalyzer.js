/**
 * Index Definition Analyzer JavaScript
 *
 * Contains the core logic for analyzing a set of index definitions and
 * producing a "diff index" (the minimal set of custom overlays needed on
 * top of the out-of-the-box indexes), along with comments/validation
 * findings for the caller to display.
 */

function isPlainObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isEmptyObject(obj) {
    return obj && typeof obj === 'object' && Object.keys(obj).length === 0;
}

function cleanupAndConvertToLucene(level, v) {
    const allKeys = new Set(Object.keys(isPlainObject(v) ? v : {}));
    for (const key of allKeys) {
        let value = v[key];
        if (typeof value === "string") {
            if (value.startsWith('str:') || value.startsWith('dat:')) {
                value = value.substring(4);
                v[key] = value;
            }
        }
        if (key === 'jcr:uuid' || key === 'jcr:primaryType') {
            delete v[key];
        }
        if (level === 0) {
            if (key.startsWith(':')
                || key === 'seed'
                || key === 'merges'
                || key === 'mergeInfo'
                || key === 'mergeChecksum'
                || key === 'reindexCount'
                || key === 'refresh'
                || key === 'originalType'
                || key === 'reindex') {
                delete v[key];
                continue;
            }
        }
        if (key.endsWith('@lucene')) {
            const k2 = key.replace('@lucene', '');
            v[k2] = v[key];
            delete v[key];
            continue;
        }
        v[key] = cleanupAndConvertToLucene(level + 1, v[key])
    }
    return v;
}

// Deep diff between base and current objects, producing hierarchical added/removed/changed
function deepDiff(level, base, current, type) {
    let result = {};

    const baseKeys = new Set(Object.keys(isPlainObject(base) ? base : {}));
    const currKeys = new Set(Object.keys(isPlainObject(current) ? current : {}));
    const allKeys = new Set([...baseKeys, ...currKeys]);

    for (const key of allKeys) {
        const inBase = baseKeys.has(key);
        const inCurr = currKeys.has(key);
        const baseVal = inBase ? base[key] : undefined;
        const currVal = inCurr ? current[key] : undefined;

        if (!inBase && inCurr && type === 'added') {
            result[key] = currVal;
            continue;
        }
        if (inBase && !inCurr && type === 'removed') {
            // Keys only for removed
            result[key] = {};
            continue;
        }

        // Both present
        if (isPlainObject(baseVal) && isPlainObject(currVal)) {
            const sub = deepDiff(level + 1, baseVal, currVal, type);
            if (Object.keys(sub).length > 0) {
                result[key] = sub;
            }
        }
        if (type === 'changed') {
            const equal = Array.isArray(baseVal) && Array.isArray(currVal)
                ? JSON.stringify(baseVal) === JSON.stringify(currVal)
                : baseVal === currVal;
            if (!equal) {
                // Keys only for changed
                result[key] = true;
            }
        }
    }
    if (isEmptyObject(result)) return {};
    return result;
}

// Properties that are allowed to be tuned on a custom index without adding a new
// key, so a *changed value* (not just an added key) must still surface in the diff.
const ALLOWED_VALUE_CHANGE_KEYS = new Set(['boost', 'weight', 'secure']);

// Recursively finds properties in ALLOWED_VALUE_CHANGE_KEYS whose value differs
// between base and current, at any depth, and returns a sparse object containing
// only those changed values (using the current value), mirroring their location.
function diffAllowedValueChanges(base, current) {
    if (!isPlainObject(base) || !isPlainObject(current)) return {};
    const result = {};
    for (const key of Object.keys(current)) {
        const currVal = current[key];
        if (!Object.prototype.hasOwnProperty.call(base, key)) {
            continue;
        }
        const baseVal = base[key];
        if (ALLOWED_VALUE_CHANGE_KEYS.has(key)) {
            const equal = Array.isArray(baseVal) && Array.isArray(currVal)
                ? JSON.stringify(baseVal) === JSON.stringify(currVal)
                : baseVal === currVal;
            if (!equal) {
                result[key] = currVal;
            }
            continue;
        }
        if (isPlainObject(currVal) && isPlainObject(baseVal)) {
            const sub = diffAllowedValueChanges(baseVal, currVal);
            if (!isEmptyObject(sub)) {
                result[key] = sub;
            }
        }
    }
    return result;
}

// Deep-merges `source` into `target` (nested plain objects are merged
// recursively; other values are overwritten) and returns `target`.
function deepMerge(target, source) {
    for (const key of Object.keys(source)) {
        if (isPlainObject(source[key]) && isPlainObject(target[key])) {
            deepMerge(target[key], source[key]);
        } else {
            target[key] = source[key];
        }
    }
    return target;
}

function isOutOfTheBoxIndex(path) {
    const oobPrefixes = [
        "/oak:index/aemformsAFReferenceLuceneIndex",
        "/oak:index/appsLibsLucene",
        "/oak:index/assetLinkShare",
        "/oak:index/assetPrefixNodename",
        "/oak:index/authorizables",
        "/oak:index/cmLucene",
        "/oak:index/commerceLucene",
        "/oak:index/contentFragments",
        "/oak:index/contentResourceType",
        "/oak:index/cqContentFragment",
        "/oak:index/cqContentReference",
        "/oak:index/cqLiveSyncCancelledLucene",
        "/oak:index/cqMasterLucene",
        "/oak:index/cqPageContent",
        "/oak:index/cqPageLucene",
        "/oak:index/cqProjectLucene",
        "/oak:index/cqReportsLucene",
        "/oak:index/cqSiteSearch",
        "/oak:index/cqTagLucene",
        "/oak:index/cqTags",
        "/oak:index/cqVarCacheableDepsLucene",
        "/oak:index/damAssetLucene",
        "/oak:index/damAssetStateIndex",
        "/oak:index/damCollectionLucene",
        "/oak:index/damUploadStaging",
        "/oak:index/designFiles",
        "/oak:index/experienceFragmentsIndex",
        "/oak:index/formsManagerCcmForm",
        "/oak:index/formsTemplateLucene",
        "/oak:index/fragments",
        "/oak:index/graphqlConfig",
        "/oak:index/guidesAssetProperties",
        "/oak:index/guidesKonnect",
        "/oak:index/guidesMapCollectionV2",
        "/oak:index/guidesPeerLinks",
        "/oak:index/guidesProperties",
        "/oak:index/internalVerificationLucene",
        "/oak:index/models",
        "/oak:index/nodetypeLucene",
        "/oak:index/ntBaseLucene",
        "/oak:index/ntFileFolderLucene",
        "/oak:index/ntFolderDamLucene",
        "/oak:index/ntHierarchyLucene",
        "/oak:index/packageLucene",
        "/oak:index/pathReference",
        "/oak:index/repAccessControllableDamLucene",
        "/oak:index/repTokenIndex",
        "/oak:index/screensContentJcrPrimaryType",
        "/oak:index/screensSmartSyncJcrPrimaryType",
        "/oak:index/siteEditorIndex",
        "/oak:index/slingeventJob",
        "/oak:index/slingQuickSites",
        "/oak:index/slingResourceResolver",
        "/oak:index/slingSitemaps",
        "/oak:index/socialLucene",
        "/oak:index/versionStoreIndex",
        "/oak:index/workflowDataLucene",
        "/oak:index/workflowMetaDataIndex",

        // not really out-of-the-box, but relatively common
        "/oak:index/algoliaFragmentsIndex",
        "/oak:index/algoliaHitTemplate",
        "/oak:index/commerceDam",
        "/oak:index/commerceExperienceFragments",
        "/oak:index/contentFragmentLucene",
        "/oak:index/cqAuditLucene",
        "/oak:index/cqLiveSyncCancelled",
        "/oak:index/enablementResourceName",
        "/oak:index/experienceFragments",
        "/oak:index/lucene",
        "/oak:index/glpropertyIndex",
        "/oak:index/workfrontDocumentId"
    ];
    return oobPrefixes.some(prefix => path.startsWith(prefix));
}

/**
 * Analyzes a set of index definitions and computes the "diff index".
 * @param {string|object} input - Raw JSON text, or an already-parsed object, of the index definitions.
 * @returns {{error: string|null, result: object|null, commentLines: string[]}}
 */
function analyzeIndexDefinitions(input) {
    let obj;
    if (typeof input === 'string') {
        try {
            obj = JSON.parse(input);
        } catch (e) {
            return { error: 'Invalid JSON: ' + e.message, result: null, commentLines: [] };
        }
    } else {
        obj = input;
    }

    // Support case where the whole object is wrapped in a single-element array
    if (Array.isArray(obj) && obj.length === 1 && isPlainObject(obj[0])) {
        obj = obj[0];
    }

    // Cleanup and Convert To Lucene
    for (const k of Object.keys(obj)) {
        let value = obj[k];
        value = cleanupAndConvertToLucene(0, value);
        if (value.includedPaths != undefined && (value.includedPaths === "/dummy" ||
            (value.includedPaths.length === 1 && value.includedPaths[0] === "/dummy"))) {
            delete obj[k];
            continue;
        }
        if (value.type === "disabled") {
            delete obj[k];
            continue;
        }
        obj[k] = value;
    }

    const commentLines = [];

    var ootbIndexCount = 0;

    // Only process direct children keys that include '-custom-' and contain a dot
    const keys = Object.keys(obj).filter(k => {
        const isDirectChild = k.startsWith('/oak:index/');
        if (!isDirectChild) {
            return false;
        }

        const hasCustom = k.includes('-custom-');
        const hasDot = k.includes('.');
        if (hasCustom || hasDot) {
            return true;
        }

        const isOOTB = isOutOfTheBoxIndex(k);
        let value = obj[k];
        if (value.type === "property"
            || value.type === "nodetype"
            || value.type === "reference"
            || value.type === "counter") {
            return false;
        }
        if (!isOOTB) {
            ootbIndexCount++;
            if (ootbIndexCount == 1) {
                if (commentLines.length > 0) {
                    commentLines.push("");
                }
                commentLines.push("Detected a custom index that does not contain a dot.");
                commentLines.push("Please migrate it to use the format <prefix>.<name>-1-custom-1:");
                commentLines.push("");
            }
            commentLines.push("* " + k);
        }
        return false;
    });
    // Build result entries (normalize includedPaths to an array)
    const entries = keys.map(k => {
        const def = obj[k] || {};
        let paths;
        if (Array.isArray(def.includedPaths)) {
            paths = def.includedPaths;
        } else if (typeof def.includedPaths === 'string') {
            paths = [def.includedPaths];
        } else {
            // When no includedPaths, set includedPaths to "/"
            paths = ["/"];
        }
        const value = { includedPaths: paths };
        return [k, value];
    });

    var legacyIndexCount = 0;

    // Filter out entries that have root or libs/apps paths
    const filtered = entries.filter(([k, v]) => {
        const paths = Array.isArray(v.includedPaths) ? v.includedPaths : [];
        const hasRoot = paths.includes("/");
        const hasApp = paths.includes("/apps");
        const hasLibs = paths.includes("/libs");
        const hasAppsPrefix = paths.some(p => typeof p === 'string' && p.startsWith('/apps/'));
        const hasLibsPrefix = paths.some(p => typeof p === 'string' && p.startsWith('/libs/'));
        const containsAppsOrLibs = hasRoot || hasApp || hasLibs || hasAppsPrefix || hasLibsPrefix;
        if (containsAppsOrLibs) {
            legacyIndexCount++;
            if (legacyIndexCount == 1) {
                if (commentLines.length > 0) {
                    commentLines.push("");
                }
                commentLines.push("Detected a legacy index.");
                commentLines.push("Such indexes that cannot be configured using");
                commentLines.push("Simplified Index Management and ");
                commentLines.push("need to use the legacy configuration mode.");
                commentLines.push("If this custom index, consider adding");
                commentLines.push("includedPaths and queryPaths to e.g. \"/content\",");
                commentLines.push("so that Simplified Index Management can be used:");
                commentLines.push("");
            }
            commentLines.push("* " + k);
        }
        return !containsAppsOrLibs;
    });

    // Natural sort (numeric-aware) by key
    const naturalCompare = (a, b) => a[0].localeCompare(b[0], undefined, { numeric: true, sensitivity: 'base' });
    filtered.sort(naturalCompare);

    // Keep only latest per prefix (prefix = part before first '-')
    const prefixToEntry = new Map();
    for (const entry of filtered) {
        const key = entry[0];
        const dashIndex = key.indexOf('-');
        const prefix = dashIndex < 0 ? key : key.substring(0, dashIndex);
        // Sorted ascending, so later entries overwrite earlier ones to keep the latest
        prefixToEntry.set(prefix, entry);
    }

    // Collect selected entries and sort again for stable output
    const selected = Array.from(prefixToEntry.values());
    selected.sort(naturalCompare);

    // For each selected key, if a base version exists in the source JSON,
    // attach it as `baseVersion` to the entry value.
    for (const [k, v] of selected) {
        const match = k.match(/^(.*)-custom-\d+$/);
        if (match) {
            const baseKey = match[1];
            if (Object.prototype.hasOwnProperty.call(obj, baseKey)) {
                v.baseVersion = baseKey;
            }
        }
    }

    // Compute diffs against base where applicable. Track which keys were matched
    // to a base by key (rather than relying on `v.baseVersion`, which gets deleted
    // below) so the "fully custom" check further down isn't fooled by entries whose
    // diff against the base happened to come back empty.
    const matchedBaseKeys = new Set();
    for (const [k, v] of selected) {
        if (v.baseVersion && Object.prototype.hasOwnProperty.call(obj, v.baseVersion)) {
            matchedBaseKeys.add(k);
            const baseObj = obj[v.baseVersion];
            const currObj = obj[k];
            const diff = deepDiff(0, baseObj, currObj, 'added');
            // Some properties (boost, weight, secure) are allowed to be tuned in the
            // custom index without adding a new key, so their changed values must be
            // merged in even though deepDiff's 'added' pass only catches new keys.
            const allowedChanges = diffAllowedValueChanges(baseObj, currObj);
            const combinedDiff = deepMerge(diff, allowedChanges);
            if (!isEmptyObject(combinedDiff)) {
                // Carry over every added/changed top-level section (indexRules,
                // aggregates, etc.), not just indexRules.
                Object.assign(v, combinedDiff);
            }
            delete v.baseVersion;
        }
        delete v.includedPaths;
    }

    // Assemble into object
    const result = {};
    for (const [k, v] of selected) {
        result[k] = v;
    }

    // Remove empty objects, and rename keys to remove /oak:index/ prefix
    for (const [k, v] of selected) {
        if (Object.keys(v).length === 0) {
            delete result[k];
        } else {
            let k2 = k;
            if (k.indexOf('-') >= 0) {
                k2 = k.substring(0, k.indexOf('-'));
            }
            k2 = k2.replace('/oak:index/', '');
            result[k2] = v;
            delete result[k];
        }
    }

    // Fully custom indexes (without base version)
    // Each entry e is a [key, value] pair; e[0] is the original key
    const fullyCustomIndexes = filtered.filter(e => !matchedBaseKeys.has(e[0]));
    if (fullyCustomIndexes.length > 0) {
        for (const [k, v] of fullyCustomIndexes) {
            let k2 = k;
            if (k2.startsWith('/oak:index/')) {
                k2 = k2.substring('/oak:index/'.length);
            }
            var base = k2;
            if (k2.indexOf('-') >= 0) {
                base = k2.substring(0, k2.indexOf('-'));
            }
            if (result[base] != undefined) {
                continue;
            }
            let value = obj[k];
            if (value.includedPaths === "/dummy" ||
                (value.includedPaths.length === 1 && value.includedPaths[0] === "/dummy")) {
                continue;
            }
            let key = base;
            if (key.indexOf('.') < 0) {
                key = "custom." + key;
            }
            result[key] = value;
        }
    }

    if (Object.keys(result).length > 0) {
        let validateDiffIndexFn;
        if (typeof module !== 'undefined' && module.exports) {
            validateDiffIndexFn = require('./diffIndexVerifier.js').validateDiffIndex;
        } else {
            validateDiffIndexFn = validateDiffIndex;
        }
        const validationLines = validateDiffIndexFn(result);
        const hasFail = validationLines.some(l => l.includes(': FAIL '));
        if (hasFail || commentLines.length > 0) {
            if (commentLines.length > 0) commentLines.push('');
            commentLines.push('Validation:');
            commentLines.push(...validationLines);
        }
    }

    return { error: null, result, commentLines };
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        analyzeIndexDefinitions,
        isPlainObject,
        isEmptyObject,
        cleanupAndConvertToLucene,
        deepDiff,
        diffAllowedValueChanges,
        deepMerge,
        isOutOfTheBoxIndex
    };
}
