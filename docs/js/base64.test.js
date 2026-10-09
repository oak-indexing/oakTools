const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

const html = fs.readFileSync(path.join(__dirname, '../base64.html'), 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];

function createConverter() {
    const elements = {};
    for (const id of ['textInput', 'base64Input', 'textError', 'base64Error']) {
        elements[id] = {
            value: '',
            textContent: '',
            style: { display: 'none' },
            addEventListener() {}
        };
    }
    const context = vm.createContext({
        document: { getElementById: id => elements[id] },
        TextEncoder,
        TextDecoder,
        btoa,
        atob
    });
    vm.runInContext(script, context);
    return { elements, context };
}

for (const [name, text] of [
    ['empty text', ''],
    ['ASCII', 'Hello, World!'],
    ['accented characters', 'caf\u00e9 Gr\u00fc\u00dfe'],
    ['non-Latin scripts', '\u4f60\u597d \u65e5\u672c\u8a9e \u0645\u0631\u062d\u0628\u0627'],
    ['emoji', '\ud83d\ude00 \ud83d\udc69\u200d\ud83d\udcbb'],
    ['combining characters', 'e\u0301'],
    ['leading BOM', '\ufeffHello'],
    ['whitespace and null bytes', ' \t\n\u0000\r\n '],
    ['large text', 'caf\u00e9 \ud83d\ude00'.repeat(100000)]
]) {
    test(`encodes and decodes ${name} as UTF-8`, () => {
        const { elements, context } = createConverter();
        const expected = Buffer.from(text, 'utf8').toString('base64');
        elements.textInput.value = text;
        context.convertTextToBase64();
        assert.equal(elements.base64Input.value, expected);
        assert.equal(elements.textError.style.display, 'none');

        elements.textInput.value = '';
        elements.base64Input.value = expected;
        context.convertBase64ToText();
        assert.equal(elements.textInput.value, text);
        assert.equal(elements.base64Error.style.display, 'none');
    });
}

for (const [name, input] of [
    ['invalid Base64', '%%%'],
    ['invalid UTF-8', '/w=='],
    ['truncated UTF-8', '4oI=']
]) {
    test(`reports ${name} and recovers on valid input`, () => {
        const { elements, context } = createConverter();
        elements.textInput.value = 'Previous output';
        elements.base64Input.value = input;
        context.convertBase64ToText();
        assert.equal(elements.textInput.value, 'Previous output');
        assert.equal(elements.base64Error.style.display, 'block');
        assert.match(elements.base64Error.textContent, /^Error converting base64 to text: .+/);

        elements.base64Input.value = 'SGVsbG8=';
        context.convertBase64ToText();
        assert.equal(elements.textInput.value, 'Hello');
        assert.equal(elements.base64Error.style.display, 'none');
    });
}
