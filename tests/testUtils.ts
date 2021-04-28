import * as mockRun from 'azure-pipelines-task-lib/mock-run';
import * as tl from 'azure-pipelines-task-lib/task';
import * as path from 'path';
import * as fs from 'fs-extra';
import rimraf from 'rimraf';
import * as syncRequest from 'sync-request';
import * as assert from 'assert';
import NullWritable from 'null-writable';
import { TaskMockRunner } from 'azure-pipelines-task-lib/mock-run';

const testDataDir: string = path.join(__dirname, 'testData');
const repoKeysPath: string = path.join(testDataDir, 'configuration', 'repoKeys');
const artifactoryUrl: string = process.env.ADO_ARTIFACTORY_URL || '';
const artifactoryUsername: string = process.env.ADO_ARTIFACTORY_USERNAME || '';
const artifactoryPassword: string = process.env.ADO_ARTIFACTORY_PASSWORD || '';
const artifactoryAccessToken: string = process.env.ADO_ARTIFACTORY_ACCESS_TOKEN || '';
const distributionUrl: string = process.env.ADO_DISTRIBUTION_URL || '';
const artifactoryDockerDomain: string = process.env.ADO_ARTIFACTORY_DOCKER_DOMAIN || '';
const artifactoryDockerRepo: string = process.env.ADO_ARTIFACTORY_DOCKER_REPO || '';
const skipTests: string[] = process.env.ADO_ARTIFACTORY_SKIP_TESTS ? process.env.ADO_ARTIFACTORY_SKIP_TESTS.split(',') : [];

const testReposPrefix: string = 'ado-extension-test';
const repoKeys: any = {
    repo0: 'repo0',
    repo1: 'repo1',
    repo2: 'repo2',
    cliRepo: 'jfrog-cli',
    mavenLocalRepo: 'maven-local',
    mavenRemoteRepo: 'maven-remote',
    nugetLocalRepo: 'nuget-local',
    nugetRemoteRepo: 'nuget-remote',
    nugetVirtualRepo: 'nuget-virtual',
    npmLocalRepo: 'npm-local',
    npmRemoteRepo: 'npm-remote',
    npmVirtualRepo: 'npm-virtual',
    conanLocalRepo: 'conan-local',
    goLocalRepo: 'go-local',
    goRemoteRepo: 'go-remote',
    goVirtualRepo: 'go-virtual',
    pipLocalRepo: 'pip-local',
    pipRemoteRepo: 'pip-remote',
    pipVirtualRepo: 'pip-virtual',
    releaseBundlesRepo: 'rb-repo'
};

export {
    testDataDir,
    repoKeys,
    artifactoryDockerDomain,
    artifactoryDockerRepo,
    artifactoryUrl,
    artifactoryPassword,
    artifactoryUsername,
    distributionUrl
};

export const promote: string = path.join(__dirname, '..', 'tasks', 'ArtifactoryBuildPromotion', 'buildPromotion.js');
export const conan: string = path.join(__dirname, '..', 'tasks', 'ArtifactoryConan', 'conanBuild.js');
export const docker: string = path.join(__dirname, '..', 'tasks', 'ArtifactoryDocker', 'dockerBuild.js');
export const download: string = path.join(__dirname, '..', 'tasks', 'ArtifactoryGenericDownload', 'Ver3', 'downloadArtifacts.js');
export const upload: string = path.join(__dirname, '..', 'tasks', 'ArtifactoryGenericUpload', 'Ver2', 'uploadArtifacts.js');
export const mavenVer1: string = path.join(__dirname, '..', 'tasks', 'ArtifactoryMaven', 'Ver1', 'mavenBuild.js');
export const mavenVer2: string = path.join(__dirname, '..', 'tasks', 'ArtifactoryMaven', 'Ver2', 'mavenBuild.js');
export const npmVer1: string = path.join(__dirname, '..', 'tasks', 'ArtifactoryNpm', 'Ver1', 'npmBuild.js');
export const npmVer2: string = path.join(__dirname, '..', 'tasks', 'ArtifactoryNpm', 'Ver2', 'npmBuild.js');
export const nugetVer1: string = path.join(__dirname, '..', 'tasks', 'ArtifactoryNuget', 'Ver1', 'nugetBuild.js');
export const nugetVer2: string = path.join(__dirname, '..', 'tasks', 'ArtifactoryNuget', 'Ver2', 'nugetBuild.js');
export const dotnet: string = path.join(__dirname, '..', 'tasks', 'ArtifactoryDotnet', 'dotnetBuild.js');
export const gradle: string = path.join(__dirname, '..', 'tasks', 'ArtifactoryGradle', 'gradleBuild.js');
export const publish: string = path.join(__dirname, '..', 'tasks', 'ArtifactoryPublishBuildInfo', 'publishBuildInfo.js');
export const discard: string = path.join(__dirname, '..', 'tasks', 'ArtifactoryDiscardBuilds', 'discardBuilds.js');
export const properties: string = path.join(__dirname, '..', 'tasks', 'ArtifactoryProperties', 'properties.js');
export const go: string = path.join(__dirname, '..', 'tasks', 'ArtifactoryGo', 'goBuild.js');
export const collectIssues: string = path.join(__dirname, '..', 'tasks', 'ArtifactoryCollectIssues', 'collectIssues.js');
export const toolsInstaller: string = path.join(__dirname, '..', 'tasks', 'ArtifactoryToolsInstaller', 'toolsInstaller.js');
export const genericCli: string = path.join(__dirname, '..', 'tasks', 'JfrogCli', 'jfrogCliRun.js');
export const pip: string = path.join(__dirname, '..', 'tasks', 'ArtifactoryPip', 'pipBuild.js');
export const releaseBundle: string = path.join(__dirname, '..', 'tasks', 'DistributionReleaseBundle', 'releaseBundle.js');

export function initTests(): void {
    process.env.JFROG_CLI_REPORT_USAGE = 'false';
    process.env.JFROG_CLI_OFFER_CONFIG = 'false';
    process.env.JFROG_CLI_LOG_LEVEL = 'ERROR';
    process.env.USE_UNSUPPORTED_CONAN_WITH_PYTHON_2 = 'true';
    tl.setStdStream(new NullWritable());
    tl.setVariable('Agent.WorkFolder', testDataDir);
    tl.setVariable('Agent.TempDirectory', testDataDir);
    tl.setVariable('Agent.ToolsDirectory', testDataDir);

    cleanUpOldRepositories();
    recreateTestDataDir();
    createTestRepositories();
}

export function runTask(testMain: string, variables: any, inputs: any): void {
    setServiceConnectionCredentials(artifactoryUrl);
    runTaskForService(testMain, variables, inputs);
}

export function runDistTask(testMain: string, variables: any, inputs: any): void {
    setServiceConnectionCredentials(distributionUrl);
    runTaskForService(testMain, variables, inputs);
}

export function runTaskForService(testMain: string, variables: any, inputs: any): void {
    variables['Agent.WorkFolder'] = testDataDir;
    variables['Agent.TempDirectory'] = testDataDir;
    variables['Agent.ToolsDirectory'] = testDataDir;
    variables['System.DefaultWorkingDirectory'] = testDataDir;

    const tmr: TaskMockRunner = new mockRun.TaskMockRunner(testMain);

    setVariables(variables);
    mockGetInputs(inputs);

    tmr.registerMock('azure-pipelines-task-lib/mock-task', tl);
    tmr.run();
}

export function recreateTestDataDir(): void {
    if (fs.existsSync(testDataDir)) {
        rimraf.sync(testDataDir);
    }
    fs.mkdirSync(testDataDir);
}

export function getBuild(buildName: string, buildNumber: string): syncRequest.Response {
    return syncRequest.default('GET', stripTrailingSlash(artifactoryUrl) + '/api/build/' + buildName + '/' + buildNumber, {
        headers: {
            Authorization: getAuthorizationHeaderValue()
        }
    });
}

export function deleteBuild(buildName: string): void {
    syncRequest.default('DELETE', stripTrailingSlash(artifactoryUrl) + '/api/build/' + buildName + '?deleteAll=1&artifacts=1', {
        headers: {
            Authorization: getAuthorizationHeaderValue()
        }
    });
}

export function cleanToolCache(): void {
    const jfrogToolDirectory: string = path.join(testDataDir, 'jfrog');
    if (fs.pathExistsSync(jfrogToolDirectory)) {
        fs.removeSync(jfrogToolDirectory);
    }
}

export function cleanUpAllTests(): void {
    if (fs.existsSync(testDataDir)) {
        rimraf(testDataDir, (err: Error): void => {
            if (err) {
                console.warn('Tests cleanup issue: ' + err);
            }
        });
    }
    deleteTestRepositories();
}

export function createTestRepositories(): void {
    createUniqueReposKeys();
    createRepo(repoKeys.repo1, JSON.stringify({ rclass: 'local', packageType: 'generic' }));
    createRepo(repoKeys.repo2, JSON.stringify({ rclass: 'local', packageType: 'generic' }));
    createRepo(
        repoKeys.cliRepo,
        JSON.stringify({
            rclass: 'remote',
            packageType: 'generic',
            url: 'https://releases.jfrog.io/artifactory/jfrog-cli/v1'
        })
    );
    createRepo(repoKeys.mavenLocalRepo, JSON.stringify({ rclass: 'local', packageType: 'maven' }));
    createRepo(
        repoKeys.mavenRemoteRepo,
        JSON.stringify({
            rclass: 'remote',
            packageType: 'maven',
            url: 'https://repo.maven.apache.org/maven2'
        })
    );
    createRepo(
        repoKeys.nugetLocalRepo,
        JSON.stringify({
            rclass: 'local',
            packageType: 'nuget',
            repoLayoutRef: 'nuget-default'
        })
    );
    createRepo(
        repoKeys.nugetRemoteRepo,
        JSON.stringify({
            rclass: 'remote',
            packageType: 'nuget',
            repoLayoutRef: 'nuget-default',
            downloadContextPath: 'api/v2/package',
            feedContextPath: 'api/v2',
            v3FeedUrl: 'https://api.nuget.org/v3/index.json',
            url: 'https://www.nuget.org/'
        })
    );
    createRepo(
        repoKeys.nugetVirtualRepo,
        JSON.stringify({
            rclass: 'virtual',
            packageType: 'nuget',
            repoLayoutRef: 'nuget-default',
            repositories: [repoKeys.nugetRemoteRepo, repoKeys.nugetLocalRepo]
        })
    );
    createRepo(
        repoKeys.npmLocalRepo,
        JSON.stringify({
            rclass: 'local',
            packageType: 'npm',
            repoLayoutRef: 'npm-default'
        })
    );
    createRepo(
        repoKeys.npmRemoteRepo,
        JSON.stringify({
            rclass: 'remote',
            packageType: 'npm',
            repoLayoutRef: 'npm-default',
            url: 'https://registry.npmjs.org'
        })
    );
    createRepo(
        repoKeys.npmVirtualRepo,
        JSON.stringify({
            rclass: 'virtual',
            packageType: 'npm',
            repoLayoutRef: 'npm-default',
            repositories: [repoKeys.npmLocalRepo, repoKeys.npmRemoteRepo]
        })
    );
    createRepo(repoKeys.conanLocalRepo, JSON.stringify({ rclass: 'local', packageType: 'conan' }));
    createRepo(
        repoKeys.goLocalRepo,
        JSON.stringify({
            rclass: 'local',
            packageType: 'go',
            repoLayoutRef: 'go-default'
        })
    );
    createRepo(
        repoKeys.goRemoteRepo,
        JSON.stringify({
            rclass: 'remote',
            packageType: 'go',
            repoLayoutRef: 'go-default',
            url: 'https://gocenter.io'
        })
    );
    createRepo(
        repoKeys.goVirtualRepo,
        JSON.stringify({
            rclass: 'virtual',
            packageType: 'go',
            repoLayoutRef: 'go-default',
            repositories: [repoKeys.goLocalRepo, repoKeys.goRemoteRepo]
        })
    );
    createRepo(repoKeys.pipLocalRepo, JSON.stringify({ rclass: 'local', packageType: 'pypi', repoLayoutRef: 'simple-default' }));
    createRepo(
        repoKeys.pipRemoteRepo,
        JSON.stringify({ rclass: 'remote', packageType: 'pypi', repoLayoutRef: 'simple-default', url: 'https://files.pythonhosted.org' })
    );
    createRepo(
        repoKeys.pipVirtualRepo,
        JSON.stringify({
            rclass: 'virtual',
            packageType: 'pypi',
            repoLayoutRef: 'simple-default',
            repositories: [repoKeys.pipLocalRepo, repoKeys.pipRemoteRepo]
        })
    );
    createRepo(repoKeys.releaseBundlesRepo, JSON.stringify({ rclass: 'releaseBundles' }));
}

/**
 * Creates unique repositories keys, and writes them to file for later access by the tests.
 */
export function createUniqueReposKeys(): void {
    const timestamp: number = getCurrentTimestamp();
    Object.keys(repoKeys).forEach((repoVar: string): void => {
        repoKeys[repoVar] = [testReposPrefix, repoKeys[repoVar]].join('-');
        repoKeys[repoVar] = [repoKeys[repoVar], timestamp].join('-');
    });
    fs.outputFileSync(repoKeysPath, JSON.stringify(repoKeys));
}

/**
 * Returns the current timestamp in seconds
 */
export function getCurrentTimestamp(): number {
    return Math.floor(Date.now() / 1000);
}

/**
 * Reads the configured repositories keys from file.
 */
export function getRepoKeys(): any {
    return JSON.parse(fs.readFileSync(repoKeysPath, 'utf8'));
}

export function deleteTestRepositories(): void {
    Object.values(repoKeys).forEach(deleteRepo);
}

/**
 * Deletes repositories older than 24 hours that match the tests repository key pattern.
 */
export function cleanUpOldRepositories(): void {
    const repoKeysList: string[] = getRepoListFromArtifactory();
    const repoPattern: RegExp = new RegExp('^' + testReposPrefix + '(-\\w*)+-(\\d*)$');

    // Search and delete matching repositories.
    repoKeysList.forEach((repoKey): void => {
        const regexGroups: RegExpExecArray | null = repoPattern.exec(repoKey);
        // If does not match pattern, continue.
        if (!regexGroups) {
            return;
        }
        const repoTimestamp: number = parseInt(regexGroups[1], 10);
        // Subtract and convert seconds to hours
        const timeDifference: number = (getCurrentTimestamp() - repoTimestamp) / 3600;
        // If more than 24 hours have passed, delete the repository.
        if (timeDifference > 24) {
            deleteRepo(repoKey);
        }
    });
}

export function getRepoListFromArtifactory(): string[] {
    const res: syncRequest.Response = syncRequest.default('GET', stripTrailingSlash(artifactoryUrl) + '/api/repositories/', {
        headers: {
            Authorization: getAuthorizationHeaderValue()
        }
    });
    assert.ok(
        res.statusCode === 200 || res.statusCode === 201,
        'Failed getting repositories from Artifactory. Status code: ' + res.statusCode + '. Error: ' + res.getBody('utf8')
    );
    const repoArray: any[] = JSON.parse(res.getBody('utf8'));
    return repoArray.map((repo): any => repo.key);
}

export function createRepo(repoKey: string, body: string): syncRequest.Response {
    const res: syncRequest.Response = syncRequest.default('PUT', stripTrailingSlash(artifactoryUrl) + '/api/repositories/' + repoKey, {
        headers: {
            Authorization: getAuthorizationHeaderValue(),
            'Content-Type': 'application/json'
        },
        body
    });
    assert.ok(
        res.statusCode === 200 || res.statusCode === 201,
        'Failed creating repo: ' + repoKey + '. Status code: ' + res.statusCode + '. Error: ' + res.getBody('utf8')
    );
    return res;
}

export function deleteRepo(repoKey: any): void {
    syncRequest.default('DELETE', stripTrailingSlash(artifactoryUrl) + '/api/repositories/' + repoKey, {
        headers: {
            Authorization: getAuthorizationHeaderValue(),
            'Content-Type': 'application/json'
        }
    });
}

export function getLocalReleaseBundle(bundleName: string, bundleVersion: string, expectExist: boolean): syncRequest.Response {
    const res: syncRequest.Response = syncRequest.default(
        'GET',
        stripTrailingSlash(distributionUrl) + '/api/v1/release_bundle/' + bundleName + '/' + bundleVersion,
        {
            headers: {
                Authorization: getAuthorizationHeaderValue()
            }
        }
    );
    if (!expectExist) {
        assert.ok(
            res.statusCode === 404,
            'Expected release bundle "' +
                bundleName +
                '/' +
                bundleVersion +
                '" not to exist. Status code: ' +
                res.statusCode +
                '. Error: ' +
                res.getBody('utf8')
        );
        return res;
    }
    assert.ok(
        res.statusCode === 200,
        'Expected release bundle "' +
            bundleName +
            '/' +
            bundleVersion +
            '" to exist. Status code: ' +
            res.statusCode +
            '. Error: ' +
            res.getBody('utf8')
    );
    return res;
}

export function getRemoteReleaseBundle(bundleName: string, bundleVersion: string): syncRequest.Response {
    return syncRequest.default(
        'GET',
        stripTrailingSlash(distributionUrl) + '/api/v1/release_bundle/' + bundleName + '/' + bundleVersion + '/distribution',
        {
            headers: {
                Authorization: getAuthorizationHeaderValue()
            }
        }
    );
}

export function deleteReleaseBundle(bundleName: string, bundleVersion: string): void {
    syncRequest.default('POST', stripTrailingSlash(distributionUrl) + '/api/v1/distribution/' + bundleName + '/' + bundleVersion + '/delete', {
        headers: {
            Authorization: getAuthorizationHeaderValue(),
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ dry_run: false, distribution_rules: [{ site_name: '*' }], on_success: 'delete' })
    });
}

export function getAuthorizationHeaderValue(): string {
    if (artifactoryAccessToken) {
        return 'Bearer ' + artifactoryAccessToken;
    } else {
        return 'Basic ' + Buffer.from(artifactoryUsername + ':' + artifactoryPassword).toString('base64');
    }
}

export function setServiceConnectionCredentials(url: string): void {
    (tl as any).getEndpointUrl = (): string => {
        return url;
    };
    (tl as any).getEndpointAuthorizationParameter = (id: string, key: string): string => {
        switch (key) {
            case 'username':
                return artifactoryUsername;
            case 'password':
                return artifactoryPassword;
            case 'apitoken':
                return artifactoryAccessToken;
            default:
                return '';
        }
    };
}

/**
 * Copies "tests/<testDirName>/<folderToCopy>" to a corresponding folder under "testDataDir/<testDirName>".
 * If newTargetDir is provided, the folder will be renamed to its value.
 * @param testDirName - test directory
 * @param dirToCopy - the folder to copy, located inside the test resources directory
 * @param newTargetDir - optional new name for the copied directory.
 */
export function copyTestFilesToTestWorkDir(testDirName: string, dirToCopy: string, newTargetDir: string): void {
    const sourceDir: string = path.join(__dirname, 'resources', testDirName, dirToCopy);
    let targetDir: string = path.join(testDataDir, testDirName);
    if (newTargetDir) {
        targetDir = path.join(testDataDir, newTargetDir);
    }
    fs.copySync(sourceDir, targetDir);
}

export function setVariables(variables: any): void {
    for (const [key, value] of Object.entries(variables)) {
        if (typeof value === 'string') {
            tl.setVariable(key, value);
        }
    }
}

/**
 * Override tl.getInput(), tl.getBoolInput() and tl.getPathInput() functions.
 * The test will return inputs[name] instead of using the original functions.
 * @param inputs - (String) - Test inputs
 */
export function mockGetInputs(inputs: any): void {
    (tl as any).getInput = (name: string): string => {
        return inputs[name];
    };
    (tl as any).getBoolInput = (name: string): boolean => {
        return inputs[name];
    };
    (tl as any).getPathInput = (name: string): string => {
        return inputs[name];
    };
}

export function getTestName(testDir: string): string {
    return path.basename(testDir);
}

export function getLocalTestDir(testName: string): string {
    return path.join(testDataDir, testName, '/');
}

export function getTestLocalFilesDir(testDir: string): string {
    return path.join(testDir, 'files', '/');
}

export function getRemoteTestDir(repo: string, testName: string): string {
    return repo + '/' + testName + '/';
}

export function isWindows(): boolean {
    return process.platform.startsWith('win');
}

export function isSkipTest(skipValue: string): boolean {
    return skipTests.indexOf(skipValue) !== -1;
}

export function stripTrailingSlash(str: string): string {
    return str.endsWith('/') ? str.slice(0, -1) : str;
}
