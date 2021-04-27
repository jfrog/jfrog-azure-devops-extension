const testUtils = require('../../testUtils');
const TEST_NAME = testUtils.getTestName(__dirname);

let inputs = {
    command: 'create',
    rbName: 'ado-test-rb',
    rbVersion: testUtils.getRepoKeys().releaseBundleVersion,
    fileSpec: JSON.stringify({
        files: [
            {
                pattern: testUtils.getRemoteTestDir(testUtils.getRepoKeys().repo1, TEST_NAME) + '${key1}'
            }
        ]
    }),
    specSource: 'taskConfiguration',
    replaceSpecVars: true,
    specVars: 'key1=a.in',
    autoSign: false,
    useCustomRepo: false,
    addReleaseNotes: true,
    releaseNotesFile: testUtils.getTestLocalFilesDir(__dirname) + 'releaseNotes',
    releaseNotesSyntax: 'plain_text',
    description: 'ADO DESC',
    dryRun: false,
    insecureTls: false
};

testUtils.runDistTask(testUtils.releaseBundle, {}, inputs);
