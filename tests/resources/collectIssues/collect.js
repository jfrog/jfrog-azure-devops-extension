const testUtils = require('../../testUtils');
const yaml = require('js-yaml');

const TEST_NAME = testUtils.getTestName(__dirname);

const configYaml = {
    version: 1,
    issues: {
        trackerName: 'JIRA',
        regexp: '(.+-[0-9]+)\s-\s(.+)',
        keyGroupIndex: '1',
        summaryGroupIndex: '2',
        trackerUrl: 'http://my-jira.com/issues',
        aggregate: 'true',
        aggregationStatus: 'RELEASED'
    }
};
const configString = yaml.safeDump(configYaml);

let inputs = {
    buildName: 'Collect issues',
    buildNumber: '3',
    artifactoryService: 'mock-service',
    configSource: 'taskConfiguration',
    taskConfig: configString
};

testUtils.copyTestFilesToTestWorkDir(TEST_NAME, 'resources');
testUtils.copyTestFilesToTestWorkDir(TEST_NAME, 'collectIssues_.git_suffix', '.git');
testUtils.runTask(testUtils.collectIssues, {}, inputs);
