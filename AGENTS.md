# Apache Jackrabbit Oak Tools - Agent Context

## Project Overview
Apache Jackrabbit Oak Tools is a web-based utility for working with Apache Jackrabbit Oak index definitions and queries. It replaces the legacy https://oakutils.appspot.com/generate/index tool.

**Website**: https://oak-indexing.github.io/oakTools/

## Project Structure

### Core JavaScript Components (docs/js/)
- **indexDefGenerator.js**: Main logic for parsing SQL-2/XPath queries and generating Lucene index definitions
  - Converts XPath to SQL-2 using `convertXPathToSQL2()`
  - Tokenizes and parses SQL-2 using `SQL2Lexer` and `SQL2Parser`
  - Converts AST to filter representation
  - Generates Lucene index definitions
  - Validates queries for path restrictions and index tags

- **sql2-parser.js**: SQL-2 lexer and parser implementation
  - `SQL2Lexer`: Tokenizes SQL-2 queries
  - `SQL2Parser`: Parses tokens into AST
  - Handles SELECT, FROM, WHERE, ORDER BY clauses
  - Supports JCR/Oak-specific syntax (ISDESCENDANTNODE, CONTAINS, etc.)

- **xpath2.js**: XPath to SQL-2 converter
  - Converts XPath queries (starting with /jcr:root/) to SQL-2 format
  - Handles predicates, attributes, functions, and operators

- **jq.js**: JSON query processor (jq-like functionality)
- **json-formatter.js**: JSON formatting utilities
- **select-all-support.js**: UI support for selecting text in output areas

### Java Components (src/java/)
- **org.apache.jackrabbit.oak.xpath**: XPath to SQL-2 conversion
  - `XPathToSQL2Converter`: Main converter class
  - `SQL2Parser`: Server-side SQL-2 parser
  - `Expression`, `Selector`, `Statement`: AST components
  - `PathUtils`, `ISO9075`, `XMLChar`: Utilities

- **ParallelFileDownloader.java**: Utility for parallel file downloads
- **IndexDefAnalyzer.java**: Analysis tool for index definitions

### HTML Tools (docs/)
- **indexDefGenerator.html**: Main index definition generator UI
- **indexDefAnalyzer.html**: Analyze existing index definitions
- **indexDefConverter.html**: Convert between index formats
- **converters.html**: Various conversion utilities
- **jsonJq.html**: jq-style JSON querying
- **textDiff.html**: Text comparison tool
- **regex.html**: Regular expression tester
- **xpath.html**: XPath testing
- And many other utilities...

## Key Features

### Index Definition Generation
1. Accepts SQL-2 or XPath queries as input
2. Automatically detects and converts XPath to SQL-2
3. Generates Lucene index definitions
4. Validates for:
   - Path restrictions (warns if missing)
   - Index tags via `option(index tag xyz)` (warns if missing)

### Query Processing Pipeline
```
Input (SQL-2 or XPath)
  ↓
XPath Detection & Conversion (if needed)
  ├─ Regular XPath → SQL-2
  └─ XPath Union (starts with '(') → Split into subqueries → SQL-2 UNION
  ↓
Tokenization (SQL2Lexer)
  ↓
Parsing (SQL2Parser) → AST
  ↓
Filter Conversion
  ↓
Lucene Index Definition
```

### XPath Union Query Support

The tool now supports XPath union queries using the pipe (`|`) operator:

**Syntax:**
```xpath
(xpath_query_1 | xpath_query_2 | ... | xpath_query_n) [order by ...] [option(...)]
```

**Example:**
```xpath
(/jcr:root/content//element(*, cq:Page)[(jcr:contains(., 'test'))]
|/jcr:root/content//element(*, dam:Asset)[(jcr:content/data/@cq:model = '/conf/test') and (jcr:contains(., 'test'))])
order by @jcr:created descending
```

**Converts to SQL-2:**
```sql
select ... from [cq:Page] as a where ...
union
select ... from [dam:Asset] as a where ...
order by a.[jcr:created] desc
```

**Key Features:**
- Parentheses `()` are required to group the union queries
- Pipe `|` separates the subqueries at the top level (respects nested parentheses)
- Shared `order by` clause applies to the entire union result
- Shared `option` clause applies to the entire union
- Each subquery can have its own filters and conditions
- AST displays `XPathUnion` object with all subquery strings

## Testing

Run tests using:
```bash
node docs/js/sql2-parser.test.js
node docs/js/xpath-converter.test.js
node docs/js/indexDefGenerator.test.js
```

## Development Notes

### Technology Stack
- Pure JavaScript (no build step required)
- Vanilla JS DOM manipulation
- GitHub Pages hosted
- Node.js for testing only

### Code Organization
- **Lexical Analysis**: SQL2Lexer handles tokenization
- **Syntax Analysis**: SQL2Parser builds AST
- **Semantic Analysis**: AST to Filter conversion
- **Code Generation**: Filter to Lucene index definition

### Important Patterns
- All output areas support Cmd+A/Ctrl+A for select-all
- URL parameter support: `?query=<encoded-query>`
- Keyboard shortcuts: Cmd+Enter/Ctrl+Enter to trigger parsing
- Three output panels: AST, Filter, Index Definition
- Detailed panels can be toggled via checkbox

### Best Practices
1. Always read existing code before making changes
2. Maintain backward compatibility with existing queries
3. Test with both SQL-2 and XPath inputs
4. Validate output against Oak's index definition schema
5. Preserve formatting and indentation in generated JSON

## Common Tasks

### Adding New SQL-2 Features
1. Update `SQL2Lexer` to recognize new tokens
2. Update `SQL2Parser` to parse new syntax
3. Update AST to Filter conversion
4. Update Filter to Index conversion
5. Add tests

### Adding New XPath Support
1. Update `convertXPathToSQL2()` in xpath2.js
2. Test conversion output
3. Ensure generated SQL-2 parses correctly

### Debugging Queries
1. Check AST output for parsing issues
2. Check Filter output for conversion logic
3. Verify index definition structure
4. Review console for errors

## Dependencies
- No runtime dependencies (pure JavaScript)
- GitHub Pages for hosting
- Node.js for testing only

## License
Apache License 2.0 (see LICENSE file)
