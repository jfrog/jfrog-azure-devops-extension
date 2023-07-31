const testUtils = require('../../testUtils');
const join = require('path').join;
const TEST_NAME = testUtils.getTestName(__dirname);

let inputs = {
    buildName: 'DotNET Test',
    buildNumber: '7',
    command: 'push',
    targetDeployRepo: testUtils.getRepoKeys().nugetLocalRepo,
    targetDeployPath: 'custom/path',
    pathToNupkg: join(testUtils.getLocalTestDir(TEST_NAME), 'nugetTest*.nupkg'),
    collectBuildInfo: true,
};

testUtils.copyTestFilesToTestWorkDir(TEST_NAME, 'push');
testUtils.runArtifactoryTask(testUtils.dotnet, {}, inputs);
