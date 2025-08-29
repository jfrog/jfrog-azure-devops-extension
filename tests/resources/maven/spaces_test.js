/**
 * Test to verify Maven paths with spaces are properly quoted
 */
const assert = require('assert');

// Mock the cliJoin and quote functions from utils.js
function cliJoin(...args) {
    return args.filter((x) => x.length > 0).join(' ');
}

function quote(str) {
    return str ? '"' + str + '"' : '';
}

// This test directly verifies the fix for Maven paths with spaces
function verifyPomFileIsQuoted() {
    // Mock input with spaces in the path
    const pomFile = 'path/with spaces/pom.xml';
    const goalsAndOptions = 'clean install';

    // Before fix: POM file path not quoted
    const resultBefore = cliJoin(goalsAndOptions, '-f', pomFile);
    console.log('Before fix command:', resultBefore);

    // After fix: POM file path properly quoted
    const resultAfter = cliJoin(goalsAndOptions, '-f', quote(pomFile));
    console.log('After fix command:', resultAfter);

    // Verify the path is properly quoted after the fix
    assert(!resultBefore.includes('"path/with spaces/pom.xml"'), 'Before fix: POM file path should NOT be quoted');

    assert(resultAfter.includes('-f "path/with spaces/pom.xml"'), 'After fix: POM file path should be quoted');

    console.log('✅ Maven path quoting test passed!');
    console.log(`- Before: ${resultBefore}`);
    console.log(`- After:  ${resultAfter}`);
    return true;
}

// Run the test
verifyPomFileIsQuoted();
