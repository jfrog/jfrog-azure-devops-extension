const path = require('path');
const osUtils = require('./osUtils');

function joinArgs() {
    let command = "";
    for (let i = 0; i < arguments.length; ++i) {
        let arg = arguments[i];
        if (arg.length > 0) {
            command += (command === "") ? arg : (" " + arg);
        }
    }
    return command;
}

/**
 * Escape single backslashes in a string.
 * / -> //
 * // -> //
 * @param string (String) - The string to escape
 * @returns (String) - The string after escaping
 */
function fixWindowsPaths(string) {
    return osUtils.isWindows() ? string.replace(/([^\\])\\(?!\\)/g, '$1\\\\') : string;
}

/**
 * Encodes spaces with quotes in a path.
 * a/b/Program Files/c --> a/b/"Program Files"/c
 * @param str (String) - The path to encoded.
 * @returns {string} - The encoded path.
 */
function encodePath(str) {
    let encodedPath = "";
    let arr = str.split(path.sep);
    let count = 0;
    for (let section of arr) {
        if (section.length === 0) {
            continue;
        }
        count++;
        if (section.indexOf(" ") > 0 && !section.startsWith("\"") && !section.endsWith("\"")) {
            section = quote(section);
        }
        encodedPath += section + path.sep;
    }
    if (count > 0 && !str.endsWith(path.sep)) {
        encodedPath = encodedPath.substring(0, encodedPath.length - 1);
    }
    if (str.startsWith(path.sep)) {
        encodedPath = path.sep + encodedPath;
    }

    return encodedPath;
}

function quote(str) {
    return "\"" + str + "\"";
}

module.exports = {
    joinArgs,
    fixWindowsPaths,
    encodePath,
    quote
};