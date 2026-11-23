// These are CLI argument delimiters, not shell syntax. No expansion, operators,
// globbing or command substitution is ever evaluated.
function parseCommandLine(command) {
    const args = [];
    let value = '';
    let quote = '';
    let started = false;
    for (let i = 0; i < command.length; i++) {
        const ch = command[i];
        if (ch === '\0') {
            throw new Error('CLI arguments cannot contain NUL bytes.');
        }
        if (ch === '\\' && quote !== "'") {
            let end = i;
            while (command[end] === '\\') end++;
            const count = end - i;
            if (command[end] === '"') {
                value += '\\'.repeat(Math.floor(count / 2));
                if (count % 2) {
                    value += '"';
                } else {
                    quote = quote ? '' : '"';
                }
                i = end;
            } else {
                value += '\\'.repeat(count);
                i = end - 1;
            }
            started = true;
        } else if (quote) {
            if (ch === quote) {
                quote = '';
            } else {
                value += ch;
            }
        } else if (ch === '"' || ch === "'") {
            quote = ch;
            started = true;
        } else if (/\s/.test(ch)) {
            if (started) {
                args.push(value);
                value = '';
                started = false;
            }
        } else {
            value += ch;
            started = true;
        }
    }
    if (quote) {
        throw new Error('Unterminated quote in CLI arguments.');
    }
    if (started) {
        args.push(value);
    }
    return args;
}

function quoteArgument(value) {
    // Backslashes only need doubling when immediately followed by a quote.
    // This also preserves literal UNC paths entered in custom command fields.
    return '"' + value.replace(/(\\*)"/g, '$1$1\\"').replace(/(\\+)$/, '$1$1') + '"';
}

module.exports = { parseCommandLine, quoteArgument };
