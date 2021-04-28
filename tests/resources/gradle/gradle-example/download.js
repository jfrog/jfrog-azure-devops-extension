const testUtils = require('../../../testUtils');
const path = require('path');
const TEST_NAME = 'gradle';

let inputs = {
    fileSpec: JSON.stringify({
        files: [
            {
                pattern: testUtils.getRepoKeys().mavenLocalRepo,
                target: path.join(TEST_NAME, 'files', 'gradle-example', '/'),
                build: 'Gradle Test/3',
                flat: 'true'
            }
        ]
    }),
    failNoOp: true,
    dryRun: false,
    insecureTls: false,
    validateSymlinks: false,
    specSource: 'taskConfiguration'
};

testUtils.runArtifactoryTask(testUtils.download, {}, inputs);
