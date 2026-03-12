/**
 * Index Definition Generator JavaScript
 * 
 * This module contains the main logic for parsing SQL-2 and XPath queries
 * and generating Lucene index definitions.
 */

/**
 * Extract subqueries from an XPath union query
 * @param {string} query - XPath union query starting with '('
 * @returns {Array<string>} - Array of XPath subquery strings
 */
function extractXPathUnionParts(query) {
    const start = query.indexOf("(");
    if (start === -1) return [query];

    const begin = query.substring(0, start);
    const partList = query.substring(start);
    let level = 0;
    const parts = [];
    let lastOrIndex = 0;
    let i = 0;

    if (partList[i] !== '(') {
        return [query];
    }
    i++; // Skip the opening '('
    lastOrIndex = i;

    while (i < partList.length) {
        const ch = partList[i];

        if (ch === '(') {
            level++;
            i++;
        } else if (ch === ')') {
            if (level === 0) {
                // This is the closing ')' of the union
                const orPart = partList.substring(lastOrIndex, i);
                parts.push(orPart);
                i++; // Skip the ')'
                break;
            } else {
                level--;
                i++;
            }
        } else if (ch === '|' && level === 0) {
            // This is a union separator at the top level
            const orPart = partList.substring(lastOrIndex, i);
            parts.push(orPart);
            i++; // Skip the '|'
            lastOrIndex = i;
        } else if (ch === '\'' || ch === '"') {
            // Skip over string literals
            const quote = ch;
            i++;
            while (i < partList.length && partList[i] !== quote) {
                if (partList[i] === '\\' && i + 1 < partList.length) {
                    i += 2;
                } else {
                    i++;
                }
            }
            if (i < partList.length) {
                i++;
            }
        } else {
            i++;
        }
    }

    const end = partList.substring(i);

    // Reconstruct full queries from parts
    return parts.map(p => begin + p + end);
}

/**
 * Main function to parse SQL-2 or XPath queries and generate index definitions
 */
function parseSQL2() {
    const sqlInput = document.getElementById('sqlInput');
    const astOutput = document.getElementById('astOutput');
    const filterOutput = document.getElementById('filterOutput');
    const indexOutput = document.getElementById('indexOutput');
    const errorMessage = document.getElementById('errorMessage');
    const warningMessage = document.getElementById('warningMessage');
    const successMessage = document.getElementById('successMessage');
    
    // Clear previous messages
    errorMessage.style.display = 'none';
    warningMessage.style.display = 'none';
    successMessage.style.display = 'none';
    
    try {
        let sql = sqlInput.value.trim();
        
        if (sql === '') {
            astOutput.textContent = 'Enter SQL-2 or XPath query to see AST.';
            filterOutput.textContent = 'Filter representation will appear here.';
            indexOutput.textContent = 'Lucene index definition will appear here.';
            return;
        }
        
        // Check if the query is XPath (starts with /jcr:root/ after ignoring spaces and opening parentheses)
        const trimmedQuery = sql.replace(/^[\s(]+/, ''); // Remove leading spaces and opening parentheses
        const isXPath = trimmedQuery.startsWith('/jcr:root/');
        const isXPathUnion = sql.trim().startsWith('(') && isXPath;
        let xpathUnionParts = null;

        if (isXPath) {
            try {
                // If this is an XPath union, extract the parts before conversion
                if (isXPathUnion) {
                    xpathUnionParts = extractXPathUnionParts(sql);
                }

                // Convert XPath to SQL-2 first
                sql = convertXPathToSQL2(sql);
            } catch (xpathError) {
                throw new Error('XPath conversion failed: ' + xpathError.message);
            }
        }

        // Tokenize
        const lexer = new SQL2Lexer(sql);

        // Parse
        const parser = new SQL2Parser(lexer.tokens);
        const originalAst = parser.parseQuery();

        // Create a new AST with sql2 at the top (when converting from XPath)
        let ast;
        if (isXPath) {
            ast = { sql2: sql };
            // Copy all properties from original AST
            for (const key in originalAst) {
                if (originalAst.hasOwnProperty(key)) {
                    ast[key] = originalAst[key];
                }
            }
        } else {
            ast = originalAst;
        }

        // Add XPath union information to AST if applicable
        if (isXPathUnion && xpathUnionParts) {
            // Insert XPathUnion after sql2 but before other properties
            const tempAst = { sql2: ast.sql2 };
            tempAst.XPathUnion = {
                description: "XPath union query with " + xpathUnionParts.length + " subqueries",
                subqueries: xpathUnionParts
            };
            // Copy remaining properties
            for (const key in ast) {
                if (ast.hasOwnProperty(key) && key !== 'sql2') {
                    tempAst[key] = ast[key];
                }
            }
            ast = tempAst;
        }

        // Format and display AST
        astOutput.textContent = formatAST(ast);
        
        // Convert AST to Filter and display
        const filter = convertASTToFilter(ast);
        filterOutput.textContent = formatFilter(filter);
        
        // Convert Filter to Lucene Index Definition and display
        const indexDef = convertFilterToLuceneIndex(filter);
        indexOutput.textContent = formatLuceneIndex(indexDef);
        
        // Check for path restrictions and show warning if not present
        const hasPathRestriction = Object.values(indexDef).some(index => 
            index.includedPaths && index.includedPaths.length > 0
        );
        
        // Check for index tag and show warning if not present
        const hasIndexTag = filter.indexTag && filter.indexTag.trim() !== '';
        
        // Combine warnings if multiple conditions are missing
        let warnings = [];
        if (!hasPathRestriction) {
            warnings.push("Warning: the query doesn't have a path restriction. This is not recommended. Consider adding a path restriction such as '/content'.");
        }
        if (!hasIndexTag) {
            warnings.push("Warning: the query doesn't use a tag. Consider adding a tag using 'option(index tag xyz)' where 'xyz' is the name of the component of the application.");
        }
        
        if (warnings.length > 0) {
            warningMessage.innerHTML = warnings.join('<br><br>');
            warningMessage.style.display = 'block';
        }
        
        let successText = 'Query processed and Lucene index definition generated successfully!';
        if (isXPath) {
            successText = 'XPath query converted to SQL-2 and Lucene index definition generated successfully!';
        }
        successMessage.textContent = successText;
        successMessage.style.display = 'block';
        
    } catch (error) {
        astOutput.textContent = 'Error occurred during parsing.';
        filterOutput.textContent = 'Error occurred during filter conversion.';
        indexOutput.textContent = 'Error occurred during index definition generation.';
        
        let errorText = 'Query Error: ' + error.message;
        errorMessage.textContent = errorText;
        errorMessage.style.display = 'block';
    }
}

/**
 * Toggle the visibility of detailed panels (AST and Filter)
 */
function toggleDetailedPanels() {
    const detailedPanels = document.getElementById('detailedPanels');
    const checkbox = document.getElementById('detailsCheckbox');
    
    if (checkbox.checked) {
        detailedPanels.classList.add('show');
    } else {
        detailedPanels.classList.remove('show');
    }
}

/**
 * Get URL parameter value by name
 * @param {string} name - The name of the URL parameter
 * @returns {string|null} The parameter value or null if not found
 */
function getURLParameter(name) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(name);
}

/**
 * Initialize event listeners when the DOM is loaded
 */
function initializeIndexDefGenerator() {
    // Check for query URL parameter and populate the textarea if present
    const queryParam = getURLParameter('query');
    const sqlInput = document.getElementById('sqlInput');
    
    if (queryParam && sqlInput) {
        // Decode URL-encoded query and set it in the textarea
        sqlInput.value = decodeURIComponent(queryParam);
    }
    
    // Parse on page load with default query (or URL parameter query)
    parseSQL2();
    
    // Add event listener for Generate Index button
    const generateButton = document.getElementById('generateButton');
    if (generateButton) {
        generateButton.addEventListener('click', parseSQL2);
    }
    
    // Add event listener for details checkbox
    const detailsCheckbox = document.getElementById('detailsCheckbox');
    if (detailsCheckbox) {
        detailsCheckbox.addEventListener('change', toggleDetailedPanels);
    }
    
    // Allow Cmd+Enter (Mac) or Ctrl+Enter (Windows/Linux) to trigger parsing
    if (sqlInput) {
        sqlInput.addEventListener('keydown', function(event) {
            if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
                parseSQL2();
            }
        });
    }
    
    // Add Cmd+A (Mac) / Ctrl+A (Windows/Linux) support for output divs
    function addSelectAllSupport(element) {
        if (element) {
            // Make the element focusable
            element.setAttribute('tabindex', '0');
            
            element.addEventListener('keydown', function(event) {
                // Handle both Cmd+A (Mac) and Ctrl+A (Windows/Linux)
                if ((event.metaKey || event.ctrlKey) && event.key === 'a') {
                    event.preventDefault();
                    selectAllText(element);
                }
            });
            
            // Also add click to focus
            element.addEventListener('click', function() {
                element.focus();
            });
        }
    }
    
    // Function to select all text in an element
    function selectAllText(element) {
        if (window.getSelection && document.createRange) {
            const selection = window.getSelection();
            const range = document.createRange();
            range.selectNodeContents(element);
            selection.removeAllRanges();
            selection.addRange(range);
        }
    }
    
    // Add support to all output elements
    const indexOutput = document.getElementById('indexOutput');
    const astOutput = document.getElementById('astOutput');
    const filterOutput = document.getElementById('filterOutput');
    
    addSelectAllSupport(indexOutput);
    addSelectAllSupport(astOutput);
    addSelectAllSupport(filterOutput);
}

// Initialize when DOM content is loaded
document.addEventListener('DOMContentLoaded', initializeIndexDefGenerator);

// Export functions for testing (if running in Node.js environment)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        parseSQL2,
        toggleDetailedPanels,
        initializeIndexDefGenerator,
        getURLParameter
    };
} 