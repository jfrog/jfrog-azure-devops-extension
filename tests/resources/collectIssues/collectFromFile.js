const testUtils = require('../../testUtils');
const path = require('path');
const TEST_NAME = testUtils.getTestName(__dirname);
const configPath = path.join(testUtils.testDataDir, TEST_NAME, 'config.yaml');
const CUSTOM_WORKING_DIR = 'customDir';

let inputs = {
    buildName: 'Collect issues from file',
    buildNumber: '4',
    configSource: 'file',
    file: configPath,
    workingDirectory: CUSTOM_WORKING_DIR,
};

testUtils.copyTestFilesToTestWorkDir(TEST_NAME, 'resources');
testUtils.copyTestFilesToTestWorkDir(TEST_NAME, 'collectIssues_.git_suffix', path.join(CUSTOM_WORKING_DIR, '.git'));
testUtils.runArtifactoryTask(testUtils.collectIssues, {}, inputs);
