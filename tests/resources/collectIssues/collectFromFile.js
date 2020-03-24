const testUtils = require('../../testUtils');
const path = require('path');
const TEST_NAME = testUtils.getTestName(__dirname);
const configPath = path.join(testUtils.testDataDir, TEST_NAME, 'config.yaml');

let inputs = {
    buildName: 'Collect issues from file',
    buildNumber: '4',
    artifactoryService: 'mock-service',
    configSource: 'file',
    file: configPath
};

testUtils.copyTestFilesToTestWorkDir(TEST_NAME, 'resources');
testUtils.copyTestFilesToTestWorkDir(TEST_NAME, 'collectIssues_.git_suffix', '.git');
testUtils.runTask(testUtils.collectIssues, {}, inputs);
