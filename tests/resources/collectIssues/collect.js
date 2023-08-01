const testUtils = require('../../testUtils');
const yaml = require('js-yaml');
const join = require('path').join;
const TEST_NAME = testUtils.getTestName(__dirname);
const CUSTOM_WORKING_DIR = 'customDir';

const configYaml = {
    version: 1,
    issues: {
        trackerName: 'JIRA',
        regexp: '(.+-[0-9]+)\\s-\\s(.+)',
        keyGroupIndex: '1',
        summaryGroupIndex: '2',
        trackerUrl: 'http://my-jira.com/issues',
        aggregate: 'true',
        aggregationStatus: 'RELEASED',
    },
};
const configString = yaml.dump(configYaml);

let inputs = {
    buildName: 'Collect issues',
    buildNumber: '3',
    configSource: 'taskConfiguration',
    taskConfig: configString,
    workingDirectory: CUSTOM_WORKING_DIR,
};

testUtils.copyTestFilesToTestWorkDir(TEST_NAME, 'resources');
testUtils.copyTestFilesToTestWorkDir(TEST_NAME, 'collectIssues_.git_suffix', join(CUSTOM_WORKING_DIR, '.git'));
testUtils.runArtifactoryTask(testUtils.collectIssues, {}, inputs);
