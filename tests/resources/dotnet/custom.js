const testUtils = require('../../testUtils');
const join = require('path').join;
const TEST_NAME = testUtils.getTestName(__dirname);

let inputs = {
    command: 'custom',
    customCommand: 'restore',
    arguments: '"--build-name=DotNET Test" "--build-number=7" "--allow-insecure-connections"',
    rootPath: join(testUtils.getLocalTestDir(TEST_NAME)),
    targetResolveRepo: testUtils.getRepoKeys().nugetVirtualRepo,
    nugetProtocolVersion: 'v3',
};

testUtils.copyTestFilesToTestWorkDir(TEST_NAME, 'restore');
testUtils.runArtifactoryTask(testUtils.dotnet, {}, inputs);
