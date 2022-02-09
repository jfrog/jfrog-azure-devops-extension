const testUtils = require('../../testUtils');

const TEST_NAME = testUtils.getTestName(__dirname);

let BUILD_NAME = 'excludeEnv';
let BUILD_NUMBER = '3';

let variables = {
    'Build.DefinitionName': BUILD_NAME,
    'Build.BuildNumber': BUILD_NUMBER,
    'Build.password': 'open-sesame',
    'Build.token': 'open-sesame',
    'Build.secret': 'open-sesame',
    'Build.undefined': 'undefined',
    'Build.null': 'null'
};
let inputs = {
    buildName: BUILD_NAME,
    buildNumber: BUILD_NUMBER,
    fileSpec: JSON.stringify({
        files: [
            {
                pattern: testUtils.getTestLocalFilesDir(__dirname),
                target: testUtils.getRemoteTestDir(testUtils.getRepoKeys().repo1, TEST_NAME)
            }
        ]
    }),
    failNoOp: true,
    dryRun: false,
    insecureTls: false,
    symlinks: false,
    includeEnvVars: true,
    collectBuildInfo: true,
    specSource: 'taskConfiguration'
};

testUtils.runArtifactoryTask(testUtils.upload, variables, inputs);
