const testUtils = require('../../testUtils');
const path = require('path');
const fs = require('fs-extra');
const TEST_NAME = testUtils.getTestName(__dirname);
const specPath = path.join(testUtils.testDataDir, 'updateSpec.json');

fs.writeFileSync(
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
