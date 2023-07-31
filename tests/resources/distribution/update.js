const testUtils = require('../../testUtils');
const join = require('path').join;
const writeFileSync = require('fs-extra').writeFileSync;
const TEST_NAME = testUtils.getTestName(__dirname);
const specPath = join(testUtils.testDataDir, 'updateSpec.json');

writeFileSync.writeFileSync(
    specPath,
    JSON.stringify({
        files: [
            {
                pattern: testUtils.getRemoteTestDir(testUtils.getRepoKeys().repo1, TEST_NAME) + 'b.in',
            },
        ],
    }),
    'utf8'
);

let inputs = {
    command: 'update',
    rbName: 'ado-test-rb',
    rbVersion: '123',
    specSource: 'file',
    file: specPath,
    replaceSpecVars: false,
    autoSign: false,
    useCustomRepo: true,
    customRepoName: testUtils.getRepoKeys().releaseBundlesRepo,
    addReleaseNotes: false,
    description: 'ADO DESC UPDATE',
    dryRun: false,
    insecureTls: false,
};

testUtils.runDistributionTask(testUtils.distribution, {}, inputs);
