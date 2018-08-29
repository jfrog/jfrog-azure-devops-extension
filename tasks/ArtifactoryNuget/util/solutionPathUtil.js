// This util will return a list of all files matching the pattern configured in the UI in the solution path.
const tl = require('vsts-task-lib/task');
const path = require('path');

module.exports = {
    resolveFilterSpec: resolveFilterSpec,
};

// Make sure to remove any empty entries, or else we'll accidentally match the current directory.
function getPatternsArrayFromInput(pattern) {
    return pattern.split(";").map(x => x.trim()).filter(x => !!x);
}

// Attempts to resolve paths the same way the legacy PowerShell's Find-Files worked
function resolveFilterSpec(filterSpec, basePath) {
    let patterns = getPatternsArrayFromInput(filterSpec);
    let result = new Set();

    patterns.forEach(pattern => {
        let isNegative = false;
        if (pattern.startsWith("+:")) {
            pattern = pattern.substr(2);
        }
        else if (pattern.startsWith("-:")) {
            pattern = pattern.substr(2);
            isNegative = true;
        }

        if (basePath) {
            pattern = path.resolve(basePath, pattern);
        }

        tl.debug(`pattern: ${pattern}, isNegative: ${isNegative}`);

        let thisPatternFiles = resolveWildcardPath(pattern);
        thisPatternFiles.forEach(file => {
            if (isNegative) {
                result.delete(file);
            }
            else {
                result.add(file);
            }
        });
    });

    // Fail if no matching files were found
    if (!result || result.size === 0) {
        throw new Error(tl.loc("Error_NoMatchingFilesFoundForPattern", filterSpec));
    }

    return Array.from(result);
}

function resolveWildcardPath(pattern) {
    let isWindows = tl.osType() === 'Windows_NT';

    // Resolve files for the specified value or pattern
    let filesList;

    // empty patterns match nothing (otherwise they will effectively match the current directory)
    if (!pattern) {
        filesList = [];
    }
    else if (pattern.indexOf("*") === -1 && pattern.indexOf("?") === -1) {

        // No pattern found, check literal path to a single file
        tl.checkPath(pattern, "files");

        // Use the specified single file
        filesList = [pattern];

    } else {
        let firstWildcardIndex = function (str) {
            let idx = str.indexOf("*");

            let idxOfWildcard = str.indexOf("?");
            if (idxOfWildcard > -1) {
                return (idx > -1) ?
                    Math.min(idx, idxOfWildcard) : idxOfWildcard;
            }

            return idx;
        };

        // Find app files matching the specified pattern
        tl.debug("Matching glob pattern: " + pattern);

        // First find the most complete path without any matching patterns
        let idx = firstWildcardIndex(pattern);
        tl.debug("Index of first wildcard: " + idx);

        // include the wildcard character because:
        //  dirname(c:\foo\bar\) => c:\foo (which will make find() return a bunch of stuff we know we'll discard)
        //  dirname(c:\foo\bar\*) => c:\foo\bar
        let findPathRoot = path.dirname(pattern.slice(0, idx + 1));

        tl.debug("find root dir: " + findPathRoot);

        // Now we get a list of all files under this root
        let allFiles = tl.find(findPathRoot);

        // Now matching the pattern against all files
        // Turn off a bunch of minimatch features to replicate the behavior of Find-Files in the old PowerShell tasks
        let patternFilter = tl.filter(
            pattern, {
                matchBase: true,
                nobrace: true,
                noext: true,
                nocomment: true,
                nonegate: true,
                nocase: isWindows,
                dot: isWindows,
            });

        filesList = allFiles.filter(patternFilter);
    }

    if (!isWindows) {
        return filesList;
    }
    else {
        return filesList.map(file => file.split("/").join("\\"));
    }
}

